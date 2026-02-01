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
function getAllZones() {
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
export function handleProtect(player, zoneName) {
  if (getPlayerRoleLevel(player) < 50) {
    player.sendMessage(
      "§cHanya Moderator (Level 50+) yang bisa membuat proteksi custom.",
    );
    return;
  }

  if (!zoneName) {
    player.sendMessage("§cUsage: +protect <NamaArea>");
    return;
  }

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

  const zoneData = {
    min: sel.min,
    max: sel.max,
    dim: player.dimension.id,
    creator: player.name,
    created_at: Date.now(),
  };

  saveZone(zoneName, zoneData);
  player.sendMessage(`§aArea '${zoneName}' berhasil diamankan!`);
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
      .map((z) => `§e${z.name} §7[${z.min.x}, ${z.min.z}]`)
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
