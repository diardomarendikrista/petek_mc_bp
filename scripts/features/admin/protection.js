import { world, system } from "@minecraft/server";
import { getSelection } from "../general/selection.js";
import { getPlayerRoleLevel } from "../../core/utils.js";

// === DATABASE HELPERS ===
// Kita simpan proteksi dengan prefix "prot_"
function saveZone(name, data) {
  world.setDynamicProperty(`prot_${name.toLowerCase()}`, JSON.stringify(data));
}
function getZone(name) {
  const d = world.getDynamicProperty(`prot_${name.toLowerCase()}`);
  return d ? JSON.parse(d) : null;
}
export function getAllZones() {
  return world
    .getDynamicPropertyIds()
    .filter((id) => id.startsWith("prot_"))
    .map((id) => {
      const data = JSON.parse(world.getDynamicProperty(id));
      return { name: id.substring(5), ...data };
    });
}
function deleteZone(name) {
  world.setDynamicProperty(`prot_${name.toLowerCase()}`, undefined);
}

// === COMMAND HANDLER ===
export function handleProtect(player, args) {
  if (getPlayerRoleLevel(player) < 50) {
    player.sendMessage(
      "§cHanya Moderator (Level 50+) yang bisa membuat proteksi custom.",
    );
    return;
  }

  if (!args) {
    player.sendMessage("§cUsage: +protect <Name> [y|full]");
    return;
  }

  // Split args into name and optional param
  const parts = args.trim().split(" ");
  const zoneName = parts[0];
  const mode = parts.length > 1 ? parts[1].toLowerCase() : null;

  const existingZone = getZone(zoneName);
  if (existingZone) {
    player.sendMessage(`§c[GAGAL] Nama '${zoneName}' sudah digunakan!`);
    player.sendMessage(
      `§7Lokasi lama: ${existingZone.min.x}, ${existingZone.min.y}, ${existingZone.min.z}`,
    );
    player.sendMessage(
      `§7Gunakan nama lain atau hapus dulu dengan +unprotect.`,
    );
    return; // STOP proses disini
  }

  // Ambil seleksi dari selection.js
  const sel = getSelection(player);
  if (!sel) {
    player.sendMessage("§cKamu belum set +pos1 dan +pos2!");
    return;
  }

  // Check valid selection
  if (sel.min.x === sel.max.x && sel.min.z === sel.max.z && sel.min.y === sel.max.y) {
    // Optional: Warning for single block selection? No, might be intended.
  }

  // Handle Full Height Mode
  let isFullHeight = false;
  if (mode === "y" || mode === "full" || mode === "expand") {
    sel.min.y = -64;
    sel.max.y = 320;
    isFullHeight = true;
  }

  const zoneData = {
    min: sel.min,
    max: sel.max,
    dim: player.dimension.id,
    creator: player.name,
    created_at: Date.now(),
    flags: { pvp: false, hostile: false }, // Default Flags
  };

  saveZone(zoneName, zoneData);
  player.sendMessage(`§aArea '${zoneName}' berhasil diamankan!`);
  if (isFullHeight) {
    player.sendMessage("§b(Full Height Protection: Y -64 to 320)");
  }
  player.sendMessage(`§7Flags Default: PVP=False, Hostile=False`);
  player.sendMessage(
    `§7Size: ${Math.abs(sel.max.x - sel.min.x) + 1}x${Math.abs(sel.max.z - sel.min.z) + 1}`,
  );
}

export function handleUnprotect(player, zoneName) {
  // Cek Level Staff (Minimal Moderator/50 atau Admin/80 terserah kamu)
  // Disini kita set 50 (Mod) biar sama kayak protect
  if (getPlayerRoleLevel(player) < 50) {
    player.sendMessage("§cHanya Staff yang bisa menghapus proteksi.");
    return;
  }

  if (!zoneName) {
    player.sendMessage("§cUsage: +unprotect <NamaArea>");

    // UPDATE: Tampilkan Nama + Koordinat biar jelas
    const all = getAllZones()
      .map((z) => `§e${z.name} §7[${z.min.x}, ${z.min.z}] Flags: ${JSON.stringify(z.flags || {})}`)
      .join("\n"); // Pakai Enter (\n) biar rapi ke bawah

    player.sendMessage(`§7=== List Zone ===\n${all}`);
    return;
  }

  // 1. Cek apakah zona ada? (Disini getZone terpakai!)
  const existing = getZone(zoneName);
  if (!existing) {
    player.sendMessage(`§cZone '${zoneName}' tidak ditemukan!`);
    return;
  }

  // 2. Hapus
  deleteZone(zoneName);
  player.sendMessage(`§eZone '${zoneName}' berhasil dihapus (Unprotected).`);
  player.playSound("random.break");
}

export function handleZoneFlag(player, zoneName, flagKey, flagValue) {
  if (getPlayerRoleLevel(player) < 50) return;

  if (!zoneName || !flagKey || !flagValue) {
    player.sendMessage("§cUsage: +zoneflag <name> <pvp|hostile> <true|false>");
    return;
  }

  const zone = getZone(zoneName);
  if (!zone) {
    player.sendMessage(`§cZone '${zoneName}' tidak ditemukan.`);
    return;
  }

  // Normalisasi input
  const key = flagKey.toLowerCase();
  const val = flagValue.toLowerCase() === "true";

  if (key !== "pvp" && key !== "hostile") {
    player.sendMessage("§cFlag valid: pvp, hostile");
    return;
  }

  // Init flags jika belum ada (backward compatibility)
  if (!zone.flags) zone.flags = { pvp: false, hostile: false };

  zone.flags[key] = val;
  saveZone(zoneName, zone);
  player.sendMessage(`§aSet Flag '${key}' zone '${zoneName}' -> ${val}`);
}

export function handleZoneRename(player, oldName, newName) {
  if (getPlayerRoleLevel(player) < 50) return;

  if (!oldName || !newName) {
    player.sendMessage("§cUsage: +renamedzone <oldName> <newName>");
    return;
  }

  const oldZone = getZone(oldName);
  if (!oldZone) {
    player.sendMessage(`§cZone '${oldName}' tidak ditemukan.`);
    return;
  }

  if (getZone(newName)) {
    player.sendMessage(`§cNama baru '${newName}' sudah dipakai!`);
    return;
  }

  // Save new, delete old
  saveZone(newName, oldZone);
  deleteZone(oldName);
  player.sendMessage(`§aSukses rename '${oldName}' -> '${newName}'`);
}

export function handleZoneInfo(player, zoneName) {
  if (!zoneName) {
    const all = getAllZones().map((z) => `§e- ${z.name}`).join("\n");
    player.sendMessage(`§7Zones: \n${all}`);
    player.sendMessage("§cUsage: +zoneinfo <name>");
    return;
  }

  const zone = getZone(zoneName);
  if (!zone) {
    player.sendMessage(`§cZone '${zoneName}' tidak ditemukan.`);
    return;
  }

  const flags = zone.flags || { pvp: false, hostile: false };

  player.sendMessage(`§a=== Zone Info: ${zoneName} ===`);
  player.sendMessage(`§7Creator: §e${zone.creator}`);
  player.sendMessage(`§7Dimension: §b${zone.dim}`);
  player.sendMessage(`§7Location: §f(${zone.min.x},${zone.min.z}) to (${zone.max.x},${zone.max.z})`);
  player.sendMessage(`§7Flags:`);
  player.sendMessage(`  §f- PVP: ${flags.pvp ? "§aALLOWED" : "§cBLOCKED"}`);
  player.sendMessage(`  §f- Hostile: ${flags.hostile ? "§aALLOWED" : "§cBLOCKED"}`);
}

// === LISTENER CHECKER ===
// Fungsi ini akan dipanggil di main.js
export function checkCustomProtection(player, blockLocation) {
  // Bypass: Minimal Builder (Level 30) agar Staff bisa kerja/renovasi
  if (getPlayerRoleLevel(player) >= 30) return true;

  const dimID = player.dimension.id;
  const x = blockLocation.x;
  const y = blockLocation.y;
  const z = blockLocation.z;

  // WARNING: Loop ini cek semua zone.
  // Untuk server kecil/menengah ini AMAN.
  // Untuk server raksasa, perlu algoritma Spatial Hashing (nanti saja kalau sudah lag).
  const zones = getAllZones();

  for (const zone of zones) {
    // 1. Cek Dimensi
    if (zone.dim !== dimID) continue;

    // 2. Cek AABB (Axis Aligned Bounding Box)
    if (
      x >= zone.min.x &&
      x <= zone.max.x &&
      y >= zone.min.y &&
      y <= zone.max.y &&
      z >= zone.min.z &&
      z <= zone.max.z
    ) {
      // Kena Zona Proteksi!
      player.sendMessage(`§cHey! Area '${zone.name}' dilindungi.`);
      return false; // DILARANG
    }
  }

  return true; // BOLEH (Tidak kena zona apapun)
}

// === HELPER MURNI (REUSABLE) ===
// Fungsi ini cuma jawab TRUE/FALSE. Tidak kirim chat.
// Dipakai oleh Explosion, Piston, Fire, dll.
export function isZoneProtected(location, dimensionId) {
  const zones = getAllZones();

  for (const zone of zones) {
    if (zone.dim !== dimensionId) continue;
    if (
      location.x >= zone.min.x &&
      location.x <= zone.max.x &&
      location.y >= zone.min.y &&
      location.y <= zone.max.y &&
      location.z >= zone.min.z &&
      location.z <= zone.max.z
    ) {
      return true; // ADA ZONE DISINI
    }
  }
  return false; // AMAN (KOSONG)
}

// Helper baru untuk cek Flags
export function getProtectionFlags(location, dimensionId) {
  const zones = getAllZones();
  // Default: Aman (PVP On di wild, Hostile On di wild)
  // Tapi user minta "Disable PVP on protected area". 
  // Jadi jika masuk zona => PVP OFF (kecuali flag=true).

  // Kita cari zona yang meng-cover lokasi ini.
  for (const zone of zones) {
    if (zone.dim !== dimensionId) continue;
    if (
      location.x >= zone.min.x &&
      location.x <= zone.max.x &&
      location.y >= zone.min.y &&
      location.y <= zone.max.y &&
      location.z >= zone.min.z &&
      location.z <= zone.max.z
    ) {
      // Found Zone
      const flags = zone.flags || { pvp: false, hostile: false };
      return {
        isProtected: true,
        pvp: flags.pvp === true, // Default False inside zone, unless true
        hostile: flags.hostile === true // Default False inside zone, unless true
      };
    }
  }

  return { isProtected: false, pvp: true, hostile: true }; // Wild area: Bebas
}
