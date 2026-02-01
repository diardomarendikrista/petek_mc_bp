import { world, system } from "@minecraft/server";
import { getPlayerRoleLevel } from "../../core/utils.js";
import { ROLES } from "../../core/config.js";

// === DATABASE WRAPPER ===
function saveWarp(name, data) {
  // Key dibatasi max 32 chars, jadi kita prefix "w_"
  world.setDynamicProperty(`w_${name.toLowerCase()}`, JSON.stringify(data));
}

function getWarp(name) {
  const data = world.getDynamicProperty(`w_${name.toLowerCase()}`);
  return data ? JSON.parse(data) : null;
}

function deleteWarpData(name) {
  world.setDynamicProperty(`w_${name.toLowerCase()}`, undefined);
}

export function getAllWarps() {
  // Fitur tambahan: Listing semua warp
  const ids = world.getDynamicPropertyIds();
  return ids.filter((id) => id.startsWith("w_")).map((id) => id.substring(2)); // Hapus prefix "w_"
}

// === HANDLER COMMANDS ===

export function handleSetWarp(player, args) {
  // Format: +setwarp <nama> [role]
  if (getPlayerRoleLevel(player) < 50) {
    player.sendMessage("§cHanya Staff (MOD/OP) yang bisa set warp.");
    return;
  }

  const parts = args.split(" ");
  const warpName = parts[0];
  const requiredRole = parts[1] ? parts[1].toUpperCase() : null; // Kosong = Public

  if (!warpName) {
    player.sendMessage("§cUsage: +setwarp <NamaWarp> [Role: VIP/MOD/OP]");
    return;
  }

  // Validasi Role jika diisi
  if (requiredRole && !ROLES[requiredRole]) {
    player.sendMessage(`§cRole '${requiredRole}' tidak valid!`);
    return;
  }

  const loc = player.location;
  const data = {
    x: parseFloat(loc.x.toFixed(2)),
    y: parseFloat(loc.y.toFixed(2)),
    z: parseFloat(loc.z.toFixed(2)),
    dim: player.dimension.id,
    perm: requiredRole, // Bisa null
    rotX: player.getRotation().x, // Simpan arah pandang (opsional)
    rotY: player.getRotation().y,
  };

  saveWarp(warpName, data);
  player.sendMessage(`§aSukses! Warp '${warpName}' disimpan.`);
  if (requiredRole)
    player.sendMessage(`§eAkses dibatasi untuk: ${requiredRole}`);
  else player.sendMessage(`§eAkses: PUBLIC`);
}

export function handleDelWarp(player, warpName) {
  if (getPlayerRoleLevel(player) < 50) return;

  if (!getWarp(warpName)) {
    player.sendMessage(`§cWarp '${warpName}' tidak ditemukan.`);
    return;
  }

  deleteWarpData(warpName);
  player.sendMessage(`§eWarp '${warpName}' telah dihapus.`);
}

export function handleWarp(player, warpName) {
  if (!warpName) {
    // Jika cuma ketik +warp, tampilkan list
    const list = getAllWarps().join("§7, §a");
    player.sendMessage(`§eDaftar Warp: §a${list || "Belum ada warp."}`);
    return;
  }

  const data = getWarp(warpName);
  if (!data) {
    player.sendMessage(`§cWarp '${warpName}' tidak ditemukan.`);
    return;
  }

  // 1. Cek Permission Global (dari data Warp)
  if (data.perm) {
    // Logika: Jika warp butuh VIP, tapi player cuma member -> tolak
    // Kita pakai level logic yang sudah ada di utils
    const reqLevel = ROLES[data.perm].level;
    const playerLevel = getPlayerRoleLevel(player);

    if (playerLevel < reqLevel) {
      player.sendMessage(`§cWarp ini khusus ${data.perm} ke atas!`);
      return;
    }
  }

  // 2. Eksekusi Teleport
  const targetDim = world.getDimension(data.dim);
  if (!targetDim) {
    player.sendMessage("§cError: Dimensi warp tidak valid.");
    return;
  }

  player.teleport(
    { x: data.x, y: data.y, z: data.z },
    {
      dimension: targetDim,
      rotation: { x: data.rotX || 0, y: data.rotY || 0 },
    },
  );
  player.playSound("mob.endermen.portal");
  player.sendMessage(`§aTeleport ke Warp: ${warpName}...`);
}

// === HANDLER SIGN INTERACTION ===

// ... import dan kode lainnya ...

export function handleSignInteract(event) {
  const { block, player } = event;

  // 1. Cek Blok
  const isSign = block.typeId.includes("sign");
  if (!isSign) return;
  const signComp = block.getComponent("minecraft:sign");
  if (!signComp) return;

  // 2. Baca Text RAW (Asli dengan kode warna jika ada)
  const rawText = signComp.getText();
  if (!rawText) return;

  // 3. Bersihkan text untuk dibaca logikanya
  // Kita butuh 2 versi: Raw (untuk cek keamanan) dan Clean (untuk ambil nama warp)
  const cleanText = rawText.replace(/§./g, "");
  const lines = cleanText.split("\n");
  const rawLines = rawText.split("\n"); // Cek baris 1 apakah berwarna?

  // Cek Header: [Warp]
  const header = lines[0] ? lines[0].trim() : "";
  if (header.toLowerCase() !== "[warp]") return;

  // Cek Nama Warp
  const warpName = lines[1] ? lines[1].trim() : "";
  if (!warpName) return;

  // ===================================
  // === SISTEM KEAMANAN (VERIFIKASI) ===
  // ===================================

  // Cek apakah Header Sign berwarna Biru Tua (§1) ?
  // Kita anggap §1 adalah tanda tangan resmi server.
  const isVerified = rawLines[0].includes("§1");

  // A. Jika Sign Belum Terverifikasi (Masih Hitam Polos)
  if (!isVerified) {
    event.cancel = true; // Stop edit UI

    // Cek apakah yang klik adalah STAFF?
    if (getPlayerRoleLevel(player) >= 50) {
      // JIKA STAFF: Lakukan Verifikasi (Warnai Sign)
      system.run(() => {
        // Cek dulu apakah warpnya valid di database?
        if (!getWarp(warpName)) {
          player.sendMessage(
            `§c[Error] Warp '${warpName}' tidak ditemukan di database.`,
          );
          return;
        }

        // === LOGIKA PERBAIKAN DI SINI ===
        // Kita ambil teks yang ada di baris 3 (index 2) saat ini
        const customLine3 = lines[2] || "";
        const permissionLine4 = lines[3] || "";

        // Update Text Sign jadi Berwarna
        // Baris 1: Biru Tua [Warp]
        // Baris 2: Hitam NamaWarp
        // Baris 3: Teks Custom/Icon (Isi sesuai apa yang ditulis sebelumnya)
        // Baris 4: Permission (Jika ada)

        // Perhatikan tidak ada double \n lagi setelah warpName, tapi kita masukkan variabel customLine3
        const newText = `§1§l[Warp]\n§0${warpName}\n${customLine3}\n${permissionLine4}`;

        signComp.setText(newText); // Terapkan perubahan
        player.playSound("random.orb");
        player.sendMessage(
          "§a[SECURE] Sign Warp berhasil diverifikasi & diaktifkan!",
        );
      });
    } else {
      // JIKA PLAYER BIASA: Tolak
      system.run(() => {
        player.sendMessage(
          "§c[!] Sign Warp ini ilegal/belum diverifikasi Admin.",
        );
        player.playSound("mob.villager.no");
      });
    }
    return; // Stop proses di sini
  }

  // ===================================
  // === LOGIKA WARP (Sign Sudah Valid) ===
  // ===================================

  // Cek Permission Khusus Sign (Line 4)
  const signPerm = lines[3] ? lines[3].trim() : "";
  if (signPerm.startsWith("{") && signPerm.endsWith("}")) {
    const roleReq = signPerm.slice(1, -1).toUpperCase();
    if (ROLES[roleReq]) {
      const pLevel = getPlayerRoleLevel(player);
      if (pLevel < ROLES[roleReq].level) {
        system.run(() => {
          player.sendMessage(`§cSign ini dikunci khusus ${roleReq}!`);
          player.playSound("random.break");
        });
        event.cancel = true;
        return;
      }
    }
  }

  // Eksekusi Warp
  event.cancel = true;
  system.run(() => {
    handleWarp(player, warpName);
  });
}
