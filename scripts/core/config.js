// Konfigurasi Role, Level, dan Prefix
export const ROLES = {
  // === STAFF (Category: STAFF) ===
  OP: { tag: "OP", level: 99, prefix: "§4[OWNER] §r", category: "STAFF" },
  ADMIN: { tag: "ADMIN", level: 80, prefix: "§c[ADMIN] §r", category: "STAFF" },
  MOD: { tag: "MOD", level: 50, prefix: "§9[MOD] §r", category: "STAFF" },
  BUILDER: { tag: "BUILDER", level: 30, prefix: "§a[BUILDER] §r", category: "STAFF" },

  // === DONATUR (Category: DONOR) ===
  VVIP: { tag: "VVIP", level: 20, prefix: "§6[VVIP] §r", category: "DONOR" },
  VIP: { tag: "VIP", level: 10, prefix: "§b[VIP] §r", category: "DONOR" },

  // === ACTIVITY (Category: ACTIVITY) ===
  VETERAN: { tag: "VETERAN", level: 3, prefix: "§e[VETERAN] §r", category: "ACTIVITY" },
  SENIOR: { tag: "SENIOR", level: 2, prefix: "§6[SENIOR] §r", category: "ACTIVITY" },
  MEMBER: { tag: "MEMBER", level: 1, prefix: "§7[MEMBER] §r", category: "ACTIVITY" },
};

// SYARAT RANK (Menit)
export const RANK_REQUIREMENTS = {
  // menit
  MEMBER: 60 * 10, // 10 Jam
  SENIOR: 60 * 70, // 70 Jam
  VETERAN: 60 * 240, // 240 Jam
};

export const MODES = {
  FLY: "MODE_FLY",
  SPEED: "MODE_SPEED",
  NV: "MODE_NV",
  VANISH: "MODE_VANISH",
};

export const VIP_DAYS = 30;

// KONFIGURASI BARU: PREFIX COMMAND
// Kalau kamu ganti jadi "!", maka command jadi "!fly"
export const CMD_PREFIX = "+";

export const HOME_LIMITS = {
  DEFAULT: 1, // Player biasa
  MEMBER: 2,
  SENIOR: 3,
  VETERAN: 5,

  // === DONATUR ===
  VIP: 10,
  VVIP: 20,
  MOD: 50, // Staff butuh banyak buat nandain tempat
  OP: 100, // Owner bebas
};

// === PROTECTION CONFIG ===
export const DANGEROUS_ITEMS = [
  "minecraft:tnt",
  "minecraft:flint_and_steel",
  "minecraft:fire_charge",
  "minecraft:lava_bucket",
  "minecraft:water_bucket",
  "minecraft:cod_bucket",
  "minecraft:salmon_bucket",
  "minecraft:pufferfish_bucket",
  "minecraft:tropical_fish_bucket",
  "minecraft:axolotl_bucket",
  "minecraft:tadpole_bucket",
  "minecraft:powder_snow_bucket",
];

export const BANNED_MOBS = [
  // 1. ZOMBIE FAMILY
  "minecraft:zombie",
  "minecraft:zombie_villager",
  "minecraft:zombie_villager_v2",
  "minecraft:husk",
  "minecraft:drowned",

  // 2. SKELETON FAMILY
  "minecraft:skeleton",
  "minecraft:stray",
  "minecraft:wither_skeleton",

  // 3. MOUNTS & JOCKEYS
  "minecraft:zombie_horse",
  "minecraft:skeleton_horse",
  "minecraft:spider",
  "minecraft:cave_spider",

  // 4. CREEPY & RAID
  "minecraft:creeper",
  "minecraft:witch",
  "minecraft:slime",
  "minecraft:phantom",
  "minecraft:pillager",
  "minecraft:vindicator",
  "minecraft:evoker",
  "minecraft:ravager",
  "minecraft:vex",
  "minecraft:enderman",

  // 5. NETHER (Opsional)
  "minecraft:piglin",
  "minecraft:zoglin",
  "minecraft:blaze",
  "minecraft:ghast",
  "minecraft:magma_cube",
];
