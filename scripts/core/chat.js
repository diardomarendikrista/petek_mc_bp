import { world, system } from "@minecraft/server";
import { executeCommand } from "./commands.js";
import { getPlayerPrefix } from "./utils.js";
import { CMD_PREFIX } from "./config.js";

world.beforeEvents.chatSend.subscribe((event) => {
  const player = event.sender;
  const message = event.message;

  // ===============================================
  // === 1. CEK COMMAND (PRIORITAS UTAMA) ===
  // ===============================================
  // Pindah ke sini agar player Muted tetap bisa akses menu/command
  if (message.startsWith(CMD_PREFIX)) {
    event.cancel = true;
    const content = message.substring(CMD_PREFIX.length);
    const parts = content.split(" ");
    const action = parts[0];
    const args = parts.slice(1).join(" ");

    system.run(() => {
      try {
        const success = executeCommand(player, action, args);

        if (!success) {
          player.sendMessage(
            `§c[SISTEM] Command '${action}' tidak ditemukan atau Pangkat kurang.`,
          );
        }
      } catch (e) {
        player.sendMessage(`§4[CRITICAL ERROR] ${e}`);
        console.warn(e + "\n" + e.stack);
      }
    });
    return;
  }

  // ===============================================
  // === 2. CEK MUTE (PERMANEN & TEMP) ===
  // ===============================================
  let isMuted = false;
  let muteReason = "Shhh... Anda sedang di-MUTE oleh admin.";

  // A. Cek Tag Manual (Permanen)
  if (player.hasTag("MUTED")) {
    isMuted = true;
  }

  // B. Cek Temp Mute (Waktu)
  const muteExpiry = player.getDynamicProperty("mute_expiry");
  if (muteExpiry) {
    const now = Date.now();
    if (now < muteExpiry) {
      // Masih Muted
      isMuted = true;
      const sisaMenit = Math.ceil((muteExpiry - now) / 60000);
      muteReason = `§c[TEMP MUTE] Mulut Anda dikunci! Sisa waktu: ${sisaMenit} menit.`;
    } else {
      // Sudah Expired -> Auto Hapus Status
      player.setDynamicProperty("mute_expiry", undefined);
      // Opsional: Hapus tag MUTED jika ada, biar bersih
      player.removeTag("MUTED");
      // Tidak jadi mute (isMuted tetap false atau jadi false)
      isMuted = false;
    }
  }

  // Jika Terbukti Mute
  if (isMuted) {
    event.cancel = true;
    system.run(() => {
      player.sendMessage(muteReason);
      player.playSound("mob.villager.no");
    });
    return;
  }

  // ===============================================
  // === 3. FORMAT CHAT ===
  // ===============================================
  event.cancel = true;
  const prefix = getPlayerPrefix(player);
  system.run(() => {
    world.sendMessage(`${prefix}${player.name}: §f${message}`);
  });
});
