import { world, system } from "@minecraft/server";
import { HOME_LIMITS } from "../../core/config.js";

// === HELPER: Hitung Max Home Player ===
export function getMaxHomes(player) {
  // Cek dari pangkat tertinggi (Prioritas: OP -> Staff -> Donatur -> Earnable)
  if (player.hasTag("OP")) return HOME_LIMITS.OP;
  if (player.hasTag("MOD")) return HOME_LIMITS.MOD;

  if (player.hasTag("VVIP")) return HOME_LIMITS.VVIP;
  if (player.hasTag("VIP")) return HOME_LIMITS.VIP;

  // Earnable Ranks (Pangkat Hasil Main/Beli)
  // Earnable Ranks (Pangkat Hasil Main)
  // Tags di config.js adalah "VETERAN", "SENIOR", "MEMBER" (tanpa prefix rank:)
  if (player.hasTag("VETERAN")) return HOME_LIMITS.VETERAN;
  if (player.hasTag("SENIOR")) return HOME_LIMITS.SENIOR;
  if (player.hasTag("MEMBER")) return HOME_LIMITS.MEMBER;

  return HOME_LIMITS.DEFAULT;
}

// === SET HOME ===
export function handleSetHome(player, homeName = "default") {
  // 1. Bersihkan nama (kecilkan huruf, ganti spasi jadi _)
  try {
    const safeName = homeName.trim().toLowerCase().replace(/\s/g, "_");

    // 2. Ambil data lama
    let homes = [];
    const rawData = player.getDynamicProperty("homes_db");

    // 3. Migrasi Data Lama (Auto-Convert dari sistem lama ke baru)
    if (!rawData) {
      const oldData = player.getDynamicProperty("home_data");
      if (oldData) {
        homes.push({ name: "default", ...JSON.parse(oldData) });
        player.setDynamicProperty("home_data", undefined); // Hapus legacy
      }
    } else {
      homes = JSON.parse(rawData);
    }

    // 4. Cek apakah update (timpa) atau buat baru?
    const existingIndex = homes.findIndex((h) => h.name === safeName);

    if (existingIndex !== -1) {
      // UPDATE LOKASI
      homes[existingIndex].x = Math.floor(player.location.x);
      homes[existingIndex].y = Math.floor(player.location.y);
      homes[existingIndex].z = Math.floor(player.location.z);
      homes[existingIndex].dim = player.dimension.id;

      player.setDynamicProperty("homes_db", JSON.stringify(homes));
      player.sendMessage(`§a>> Home '§e${safeName}§a' berhasil diperbarui!`);
      player.playSound("random.orb");
      return;
    }

    // BUAT BARU (Cek Limit)
    const max = getMaxHomes(player);
    if (homes.length >= max) {
      player.sendMessage(`§c>> Limit Home Penuh! (${homes.length}/${max})`);
      player.sendMessage(
        `§7>> Hapus dulu dengan +delhome atau Beli Rank untuk nambah slot.`,
      );
      return;
    }

    // Simpan
    homes.push({
      name: safeName,
      x: Math.floor(player.location.x),
      y: Math.floor(player.location.y),
      z: Math.floor(player.location.z),
      dim: player.dimension.id,
    });

    player.setDynamicProperty("homes_db", JSON.stringify(homes));
    player.sendMessage(
      `§a>> Home baru '§e${safeName}§a' tersimpan! (${homes.length}/${max})`,
    );
    player.playSound("random.levelup");
  } catch (e) {
    player.sendMessage("§cError SetHome: " + e);
  }
}

// === TELEPORT HOME ===
export function handleHome(player, homeName = "default") {
  const safeName = homeName.trim().toLowerCase().replace(/\s/g, "_");
  const rawData = player.getDynamicProperty("homes_db");

  // Fallback data lama
  if (!rawData) {
    const oldData = player.getDynamicProperty("home_data");
    if (oldData) {
      const d = JSON.parse(oldData);
      player.teleport(
        { x: d.x, y: d.y, z: d.z },
        { dimension: world.getDimension(d.dim) },
      );
      player.sendMessage("§a>> Teleport ke Home Lama...");
      return;
    }
    player.sendMessage("§c>> Kamu belum punya Home satupun.");
    return;
  }

  const homes = JSON.parse(rawData);

  // 1. Cari Index Home yang dituju
  const targetIndex = homes.findIndex((h) => h.name === safeName);

  if (targetIndex === -1) {
    player.sendMessage(`§c>> Home '§f${safeName}§c' tidak ditemukan.`);
    // Tampilkan list biar player gak bingung
    const list = homes.map((h) => `§a${h.name}`).join("§7, ");
    player.sendMessage(`§7List Home: ${list}`);
    return;
  }

  // 2. CEK LIMIT (LOGIKA GEMBOK)
  const maxHomes = getMaxHomes(player);

  // Jika posisi home ini ada di luar batas limit (misal home ke-2, padahal limit cuma 1)
  // Index array mulai dari 0. Jadi limit 1 itu index 0. Index 1 sudah over limit.
  if (targetIndex >= maxHomes) {
    player.sendMessage(
      `§c[LOCKED] §7Home '§f${safeName}§7' terkunci karena Rank turun.`,
    );
    player.sendMessage(
      `§e>> Limit kamu: ${maxHomes}. Perpanjang Rank untuk membuka akses!`,
    );
    player.playSound("random.anvil_land"); // Suara gembok/besi
    return;
  }

  // 3. Eksekusi Teleport (Kalau lolos cek limit)
  const target = homes[targetIndex];
  const dim = world.getDimension(target.dim);
  if (!dim) {
    player.sendMessage("§c>> Error: Dimensi invalid.");
    return;
  }

  player.teleport(
    { x: target.x, y: target.y, z: target.z },
    { dimension: dim },
  );
  player.sendMessage(`§a>> Woosh! Teleport ke '§e${target.name}§a'.`);
  player.playSound("mob.endermen.portal");
}

// === DELETE HOME ===
export function handleDelHome(player, homeName) {
  if (!homeName) {
    player.sendMessage("§cUsage: +delhome <nama>");
    return;
  }

  const safeName = homeName.trim().toLowerCase().replace(/\s/g, "_");
  const rawData = player.getDynamicProperty("homes_db");
  if (!rawData) return;

  let homes = JSON.parse(rawData);
  const initialLength = homes.length;

  // Filter (Hapus yg namanya sama)
  homes = homes.filter((h) => h.name !== safeName);

  if (homes.length === initialLength) {
    player.sendMessage(`§cHome '${safeName}' tidak ditemukan.`);
    return;
  }

  player.setDynamicProperty("homes_db", JSON.stringify(homes));
  player.sendMessage(`§e>> Home '§f${safeName}§e' berhasil dihapus.`);
  player.playSound("random.break");
}

// === LIST HOMES ===
export function handleListHomes(player) {
  const rawData = player.getDynamicProperty("homes_db");
  const max = getMaxHomes(player);

  if (!rawData) {
    player.sendMessage(`§7Homes: (0/${max}) - Kosong.`);
    return;
  }

  const homes = JSON.parse(rawData);

  // Map dengan logika warna
  const list = homes
    .map((h, index) => {
      // Jika index di atas limit, warnanya Merah (Locked)
      const color = index >= max ? "§c[LOCKED] " : "§a";
      return `${color}${h.name} §7(${h.x},${h.y},${h.z})`;
    })
    .join("\n");

  player.sendMessage(`§2=== HOMES (${homes.length}/${max}) ===\n${list}`);
}
