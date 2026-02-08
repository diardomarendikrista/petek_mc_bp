import { world, system } from "@minecraft/server";
import { updateNameTag, checkExpiration, getPlayerRoleLevel } from "./utils.js";
import { handleScriptEvent } from "./commands.js";
import { handleSignInteract } from "../features/teleport/warps.js";
import "./chat.js";
import { setupEconomy } from "../features/economy/economy.js";
import { checkPlotProtection, isInsidePlotZone } from "../features/plots/plots.js";
import { checkCustomProtection, isZoneProtected } from "../features/admin/protection.js";
import { handleShopSignInteract } from "../features/economy/shop.js";
import { showMainMenu } from "../features/general/menu.js";
import { startPlayTimeTracker } from "../features/general/activity.js";
import { handleDeath } from "../features/teleport/death.js";
import { getProtectionFlags } from "../features/admin/protection.js";

const menuCooldowns = new Map();
const warningCooldowns = new Map(); // Cooldown untuk pesan warning

import { DANGEROUS_ITEMS } from "./config.js";

system.run(() => {
  console.warn(">> [Petek MC Mod System] Loaded!");
  setupEconomy();
  startPlayTimeTracker();
});

// Loop Nametag
system.runInterval(() => {
  for (const player of world.getPlayers()) updateNameTag(player);
}, 60);

// Listener Backup
system.afterEvents.scriptEventReceive.subscribe((eventData) => {
  handleScriptEvent(eventData);
});

// Listener Player Join (Ban Check & Nametag & Last Seen)
world.afterEvents.playerSpawn.subscribe((ev) => {
  const player = ev.player;

  // SIMPAN WAKTU LOGIN (PENTING BUAT AUTO-PURGE PLOT)
  // Ini wajib ada biar sistem tau kapan dia terakhir online
  world.setDynamicProperty(`last_seen_${player.name}`, Date.now());

  // CEK BAN
  const banExpiry = player.getDynamicProperty("ban_expiry");
  if (banExpiry) {
    const now = Date.now();
    if (now < banExpiry) {
      const timeLeft = Math.ceil((banExpiry - now) / 60000);
      system.run(() => {
        try {
          player.runCommandAsync(
            `kick "${player.name}" §cAnda masih di-BANNED! Sisa: ${timeLeft}m.`,
          );
        } catch (e) { }
      });
      return;
    } else {
      player.setDynamicProperty("ban_expiry", undefined);
    }
  }

  // Update Visual
  try {
    updateNameTag(player);
  } catch (e) { }
  try {
    checkExpiration(player);
  } catch (e) { }

  // 4. WELCOME MESSAGE (INFORMASI MENU)
  // Pesan ini hanya muncul saat Join (bukan Respawn)
  if (ev.initialSpawn) {
    system.run(() => {
      try {
        if (!player.hasTag("has_joined")) {
          // --- BERITA UNTUK PLAYER BARU ---
          player.sendMessage("\n§l§aSelamat Datang di Petek MC!");
          player.sendMessage("§e[PENTING] §fCara membuka UI §6MENU SERVER§f:");
          player.sendMessage("§b 1. Pegang §dStick");
          player.sendMessage("§b 2. Klik Kanan (PC) atau Tahan Layar (HP)");
          player.sendMessage("§b 3. atau ketik +help untuk menu via command");

          player.onScreenDisplay.setTitle("§eWelcome!", { fadeInDuration: 10, fadeOutDuration: 20, stayDuration: 60 });
          player.onScreenDisplay.updateSubtitle("§fMenu: §dStick + Right Click");
          player.playSound("random.levelup");

          player.addTag("has_joined");
        } else {
          // --- REMINDER UNTUK PLAYER LAMA ---
          player.onScreenDisplay.setActionBar("§eMenu: Stick + Right Click");
        }
      } catch (e) { }
    });
  }
});

// Update juga saat chat (JANGAN DI-COMMENT, INI PENTING)
// Biar kalau dia AFK lama di lobby tapi masih chat, dia dianggap aktif.
world.beforeEvents.chatSend.subscribe((ev) => {
  world.setDynamicProperty(`last_seen_${ev.sender.name}`, Date.now());
});

// ===============================================
// === 1. LISTENER INTERAKSI PLAYER (Ada Pesan) ===
// ===============================================

// BLOCK BREAK
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  // A. Custom Protection (Admin)
  if (!checkCustomProtection(ev.player, ev.block.location)) {
    ev.cancel = true;
    return;
  }
  // B. Plot Protection (Logic Standard Plots.js)
  if (isInsidePlotZone(ev.block.location)) {
    if (!checkPlotProtection(ev.player, ev.block.location)) {
      ev.cancel = true;
    }
  }
});

// BLOCK PLACE
world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
  // A. Custom Protection (Admin)
  if (!checkCustomProtection(ev.player, ev.block.location)) {
    ev.cancel = true;
    return;
  }
  // B. Plot Protection (Logic Standard Plots.js)
  if (isInsidePlotZone(ev.block.location)) {
    if (!checkPlotProtection(ev.player, ev.block.location)) {
      ev.cancel = true;
    }
  }
});

// ===============================================
// === 1. LISTENER ITEM USE (Klik Udara & Blok) ===
// ===============================================
world.beforeEvents.itemUse.subscribe((ev) => {
  const item = ev.itemStack;
  const player = ev.source;

  // STICK UNTUK MENU
  if (!item || (item && item.typeId === "minecraft:stick")) {
    ev.cancel = true; // Selalu batalkan animasi tangan

    // --- LOGIKA COOLDOWN ---
    const now = Date.now(); // Waktu sekarang (ms)
    const lastTime = menuCooldowns.get(player.name) || 0;
    const cooldownTime = 1000; // 1000 ms = 1 Detik

    // Jika selisih waktu kurang dari 1 detik, STOP.
    if (now - lastTime < cooldownTime) {
      return;
    }

    // Jika lolos, catat waktu sekarang
    menuCooldowns.set(player.name, now);

    // Jalankan Menu
    system.run(() => {
      try {
        showMainMenu(player);
      } catch (e) { }
    });
  }
});

// ===============================================
// === PROTEKSI Block
// ===============================================
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  const block = ev.block;
  const player = ev.player;
  const item = ev.itemStack;

  // --- WARP SIGN ---
  try {
    handleSignInteract(ev); // Logic warp lama
    // Jika warp berhasil dijalankan (misal cancel=true), kita return juga
    if (ev.cancel) return;
  } catch (e) {
    player.sendMessage("§c[Error] Terjadi kesalahan pada sistem Warp.");
    console.error(e);
  }

  // --- SHOP SIGN (BARU) ---
  try {
    handleShopSignInteract(ev); // <--- Logic Shop Baru
    if (ev.cancel) return; // Jika interaksi shop terjadi, stop proses lain
  } catch (e) {
    player.sendMessage("§c[Error] Terjadi kesalahan pada sistem Shop.");
    console.error(e);
  }

  // --- PROTEKSI ---

  // 0. GLOBAL DANGEROUS ITEM CHECK (Level < 20 / VVIP gaboleh pakai)
  if (item && DANGEROUS_ITEMS.includes(item.typeId)) {
    const userLevel = getPlayerRoleLevel(player);
    if (userLevel < 20) {
      ev.cancel = true;
      // Cooldown pesan
      const now = Date.now();
      const lastWarn = warningCooldowns.get(player.name) || 0;
      if (now - lastWarn > 2000) {
        system.run(() => player.sendMessage("§c[!] Item ini hanya untuk VVIP keatas!"));
        warningCooldowns.set(player.name, now);
      }
      return;
    }
  }

  // A. Custom Protection (Admin Zone)
  const isSign = block.typeId.includes("sign");
  if (!checkCustomProtection(player, block.location, !isSign)) {
    ev.cancel = true;
    return;
  }

  // B. Plot Protection (Player Zone)
  if (isInsidePlotZone(block.location)) {
    const allowed = checkPlotProtection(player, block.location);

    // Jika tidak punya akses (Bukan owner & bukan OP)
    if (!allowed) {
      ev.cancel = true;

      // Cek Dangerous Item (Ember Lava, dll)
      if (item && DANGEROUS_ITEMS.includes(item.typeId)) {
        // --- COOLDOWN WARNING ---
        const now = Date.now();
        const lastWarn = warningCooldowns.get(player.name) || 0;

        // Cuma kirim pesan 2 detik sekali
        if (now - lastWarn > 2000) {
          system.run(() =>
            player.sendMessage(
              "§c[!] Dilarang menggunakan item ini di lahan orang!",
            ),
          );
          warningCooldowns.set(player.name, now);
        }
      }
    }
  }
});

// ===============================================
// === 2. LISTENER DESTRUKTIF (Tanpa Pesan) ===
// ===============================================

// ANTI-LEDAKAN (TNT, Creeper, Wither)
world.beforeEvents.explosion.subscribe((ev) => {
  // Prioritas 1: Cek Sumber Ledakan (Creeper/TNT entity)
  const source = ev.source;
  let isDanger = false;

  // Jika sumber ledakan ada di Plot Zone ATAU Custom Zone
  if (source) {
    if (
      isInsidePlotZone(source.location) ||
      isZoneProtected(source.location, source.dimension.id)
    ) {
      isDanger = true;
    }
  }
  // Jika sumber null, cek blok pertama yang kena (Logic Standard Plots.js)
  else if (ev.impactedBlocks.length > 0) {
    const firstBlock = ev.impactedBlocks[0];
    if (
      isInsidePlotZone(firstBlock.location) ||
      isZoneProtected(firstBlock.location, firstBlock.dimension.id)
    ) {
      isDanger = true;
    }
  }

  // Jika berbahaya, batalkan kerusakan blok
  if (isDanger) {
    ev.setImpactedBlocks([]);
  }
});

// ANTI-PISTON (Mencegah dorong blok masuk ke area proteksi)
// world.beforeEvents.pistonActivate.subscribe((ev) => {
//   const piston = ev.block;
//   const dimID = piston.dimension.id;
//   const attachedBlocks = ev.piston.getAttachedBlocks();

//   for (const block of attachedBlocks) {
//     // Cek Plot Zone ATAU Custom Zone
//     if (
//       isInsidePlotZone(block.location) ||
//       isZoneProtected(block.location, dimID)
//     ) {
//       ev.cancel = true;
//       return;
//     }
//   }
// });

// ANTI-PETIR & API
world.afterEvents.entitySpawn.subscribe((ev) => {
  if (ev.entity.typeId === "minecraft:lightning_bolt") {
    const loc = ev.entity.location;
    const dimID = ev.entity.dimension.id;

    if (isInsidePlotZone(loc) || isZoneProtected(loc, dimID)) {
      try {
        ev.entity.remove();
      } catch (e) { }
    }
  }
});

// ===============================================
// === PROTEKSI ENTITY (Item Frame, Armor Stand) ===
// ===============================================

// Daftar Entity Dekorasi yang harus dilindungi
const PROTECTED_ENTITIES = [
  "minecraft:item_frame",
  "minecraft:glow_item_frame",
  "minecraft:armor_stand",
  "minecraft:painting",
];

// A. MENCEGAH INTERAKSI (Klik Kanan: Putar Item / Pasang Baju)
// Pastikan modul @minecraft/server minimal versi 1.9.0 di manifest.json
try {
  world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
    const player = ev.player;
    const target = ev.target;

    if (PROTECTED_ENTITIES.includes(target.typeId)) {
      // 1. Admin Zone
      if (!checkCustomProtection(player, target.location)) {
        ev.cancel = true;
        return;
      }
      // 2. Plot Zone
      if (isInsidePlotZone(target.location)) {
        if (!checkPlotProtection(player, target.location)) {
          ev.cancel = true;
        }
      }
    }
  });
} catch (e) {
  console.warn(
    "[Warning] Event playerInteractWithEntity tidak didukung di versi ini.",
  );
}

// LISTENER KEMATIAN (DEATH) - Untuk fitur +back
world.afterEvents.entityDie.subscribe((ev) => {
  handleDeath(ev);
});

// ===============================================
// === PVP PROTECTION (Command Based: Weakness & Resistance) ===
// ===============================================
// User Request: "If you gave everyone in your safezone weakness level 255, they won’t be able to hit each other"
// Logic:
// - Safe Zone: Apply Weakness 255 (Can't Hit) & Resistance 255 (Can't be Hit)
// - Unsafe Zone: Remove Effects (Optional, but good for instant PVP re-enable)

system.runInterval(() => {
  for (const player of world.getPlayers()) {
    try {
      // if (!player.isValid()) continue; // REMOVED: TypeError not a function

      // DEBUG LOG 1: Valid Player
      // console.warn(`[Debug] Checking ${player.name}`);

      let isSafe = false;

      // 1. Cek Plot (Always Safe)
      if (isInsidePlotZone(player.location)) {
        isSafe = true;
        // console.warn(`[Debug] ${player.name} inside PLOT`);
      }
      // 2. Cek Custom Zone
      else {
        // console.warn(`[Debug] Checking Flags for ${player.name}`);
        const flags = getProtectionFlags(player.location, player.dimension.id);
        // console.warn(`[Debug] Flags: ${JSON.stringify(flags)}`);
        if (flags.isProtected && !flags.pvp) {
          isSafe = true;
          // console.warn(`[Debug] ${player.name} inside CUSTOM SAFE`);
        }
      }

      // 3. Apply / Clear Effects
      if (isSafe) {
        // console.warn(`[Debug] Attempting runCommand for ${player.name}`);

        // Cek dulu apakah object player punya method runCommand (Manual Check)
        if (typeof player.runCommand !== 'function') {
          console.warn(`[CRITICAL] player.runCommand is NOT a function for ${player.name}! Type: ${typeof player.runCommand}`);
          // console.warn(`[CRITICAL] Keys: ${Object.keys(player).join(",")}`);
        }

        player.runCommand(`effect "${player.name}" weakness 2 255 true`);
        player.runCommand(`effect "${player.name}" resistance 2 255 true`);

        // console.warn(`[Debug] runCommand Success`);
      }
    } catch (e) {
      console.warn(`[PVP Error] ${player?.name || 'Unknown'}: ${e} | Stack: ${e.stack}`);
    }
  }
}, 10); // Check setiap 10 Tick (0.5 Detik)
