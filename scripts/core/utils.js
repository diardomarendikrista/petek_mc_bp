import { ROLES, MODES } from "./config.js";

// === LOGIKA DINAMIS ===
// Kita buat helper untuk mengurutkan Role dari Level TERTINGGI ke TERENDAH
// Ini penting agar sistem cek prioritas (OP dulu, baru Admin, dst)
const SORTED_ROLES = Object.values(ROLES).sort((a, b) => b.level - a.level);

export function getPlayerRoleLevel(player) {
  // Loop otomatis mencari tag tertinggi
  for (const role of SORTED_ROLES) {
    if (player.hasTag(role.tag)) {
      return role.level;
    }
  }
  return 0; // Member biasa
}

export function getPlayerPrefix(player) {
  // Loop otomatis mencari prefix tertinggi
  for (const role of SORTED_ROLES) {
    if (player.hasTag(role.tag)) {
      return role.prefix;
    }
  }
  return "§7[Member] §r"; // Default
}

// === FACTORY RESET (Tetap sama, tapi kita bikin dinamis hapus tag role juga) ===
export function factoryResetPlayer(player) {
  // 1. Hapus semua Tag Role secara otomatis (KECUALI ACTIVITY)
  for (const role of SORTED_ROLES) {
    if (role.category !== "ACTIVITY") {
      player.removeTag(role.tag);
    }
  }

  // 2. Hapus Tag Mode (Fly, Vanish, dll)
  Object.values(MODES).forEach((modeTag) => {
    player.removeTag(modeTag);
  });

  player.setDynamicProperty("role_expiry", undefined);

  player.runCommand("effect @s clear");
  player.runCommand("gamemode survival @s");
  player.runCommand("ability @s mayfly false");
  player.nameTag = player.name;
}

export function updateNameTag(player) {
  const prefix = getPlayerPrefix(player);
  // Cek 4 karakter pertama untuk deteksi perubahan warna/tag
  if (!player.nameTag.startsWith(prefix.trim().substring(0, 4))) {
    player.nameTag = `${prefix}${player.name}`;
  }
}

export function checkExpiration(player) {
  // Cek apakah player punya role apapun (level > 0)
  if (getPlayerRoleLevel(player) === 0) return;

  const expiryDate = player.getDynamicProperty("role_expiry");
  if (expiryDate === undefined || expiryDate === null) return;

  const now = Date.now();

  if (now >= expiryDate) {
    factoryResetPlayer(player);
    player.playSound("random.break");
    player.sendMessage("§c§l[!] MASA JABATAN/RANK ANDA HABIS [!]");
    player.sendMessage("§7Akun Anda telah dikembalikan ke Survival Mode.");
  }
}
