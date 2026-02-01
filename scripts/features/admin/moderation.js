import { world } from "@minecraft/server";
import { ROLES, VIP_DAYS } from "../../core/config.js";
import {
  getPlayerRoleLevel,
  updateNameTag,
  factoryResetPlayer,
} from "../../core/utils.js";

// === LOGIKA MODERASI (KICK, MUTE, BAN, SPEC) ===

export function handleMute(admin, targetName) {
  const target = world.getPlayers({ name: targetName })[0];
  if (!target) {
    admin.sendMessage("§cPlayer offline.");
    return;
  }

  if (target.hasTag("MUTED")) {
    target.removeTag("MUTED");
    admin.sendMessage(`§a>> Player ${target.name} telah di-UNMUTE.`);
    target.sendMessage(`§a>> Anda telah di-unmute oleh Admin.`);
  } else {
    target.addTag("MUTED");
    admin.sendMessage(`§c>> Player ${target.name} telah di-MUTE.`);
    target.sendMessage(`§c>> Anda telah di-MUTE oleh Admin!`);
  }
}

export function handleUnmute(admin, targetName) {
  if (!targetName) {
    admin.sendMessage("§cUsage: +unmute <Nama>");
    return;
  }

  const target = world.getPlayers({ name: targetName })[0];

  if (!target) {
    // INFO: Di Bedrock script API saat ini, kita susah memodifikasi data player OFFLINE.
    // Jadi target harus online untuk di-unmute.
    admin.sendMessage(
      `§cPlayer '${targetName}' tidak ditemukan (Harus Online).`,
    );
    return;
  }

  let count = 0;

  // 1. Hapus Mute Permanen (Tag)
  if (target.hasTag("MUTED")) {
    target.removeTag("MUTED");
    count++;
  }

  // 2. Hapus Temp Mute (Waktu)
  const expiry = target.getDynamicProperty("mute_expiry");
  if (expiry) {
    target.setDynamicProperty("mute_expiry", undefined);
    count++;
  }

  if (count > 0) {
    admin.sendMessage(`§a>> Berhasil meng-unmute §e${target.name}§a.`);
    target.sendMessage("§a>> Anda telah di-UNMUTE oleh admin. Jaga bicara ya!");
    target.playSound("random.orb");
  } else {
    admin.sendMessage(`§e>> Player ${target.name} tidak sedang di-mute.`);
  }
}

export function handleKick(
  admin,
  targetName,
  reason = "Dikeluarkan oleh Admin",
) {
  const target = world.getPlayers({ name: targetName })[0];
  if (!target) {
    admin.sendMessage("§cPlayer offline.");
    return;
  }

  // Proteksi: Mod gabisa kick Mod
  if (getPlayerRoleLevel(target) >= 30 && getPlayerRoleLevel(admin) < 99) {
    admin.sendMessage("§cSecurity: Gak bisa kick sesama Staff!");
    return;
  }

  try {
    admin.runCommand(`kick "${target.name}" ${reason}`);
    admin.sendMessage(`§a>> Sukses kick ${target.name}.`);
  } catch (e) {
    admin.sendMessage(`§c>> Gagal kick. (Coba cek nama player)`);
  }
}

export function handleSpectator(player) {
  player.runCommand("gamemode spectator @s");
  player.sendMessage("§b>> Mode Hantu (Spectator) Aktif!");
  player.sendMessage("§7Ketik +gms untuk kembali normal.");
}

export function handleTempBan(admin, argsString) {
  // Format: +tempban Steve 30
  if (!argsString) {
    admin.sendMessage("§cUsage: +tempban <Nama> <Menit>");
    return;
  }

  const args = argsString.split(" ");
  const targetName = args[0];
  const minutes = parseInt(args[1]);

  if (!targetName || isNaN(minutes)) {
    admin.sendMessage("§cUsage: +tempban <Nama> <Menit>");
    return;
  }

  const target = world.getPlayers({ name: targetName })[0];
  if (!target) {
    admin.sendMessage(
      "§cPlayer offline (Fitur ini butuh player online untuk tagging).",
    );
    return;
  }

  if (getPlayerRoleLevel(target) >= 30) {
    admin.sendMessage("§cSecurity: Jangan ban Staff!");
    return;
  }

  // Hitung waktu expired
  const banUntil = Date.now() + minutes * 60 * 1000;

  // Simpan data ban di Entity Player
  target.setDynamicProperty("ban_expiry", banUntil);

  // Kick
  try {
    target.runCommand(
      `kick "${target.name}" §cAnda di-BANNED selama ${minutes} menit!`,
    );
    admin.sendMessage(
      `§a>> ${target.name} berhasil di-banned selama ${minutes} menit.`,
    );
  } catch (e) {
    admin.sendMessage("§cError saat eksekusi kick.");
  }
}

export function handleTempMute(admin, argsString) {
  // Format: Nama Menit
  if (!argsString) {
    admin.sendMessage("§cUsage: +tempmute <Nama> <Menit>");
    return;
  }

  const args = argsString.split(" ");
  const targetName = args[0];
  const minutes = parseInt(args[1]);

  if (!targetName || isNaN(minutes)) {
    admin.sendMessage("§cUsage: +tempmute <Nama> <Menit>");
    return;
  }

  const target = world.getPlayers({ name: targetName })[0];
  if (!target) {
    admin.sendMessage("§cPlayer offline.");
    return;
  }

  // Cek Level (Jangan mute atasan)
  if (getPlayerRoleLevel(target) >= getPlayerRoleLevel(admin)) {
    admin.sendMessage("§cTidak bisa mute sesama staff/atasan.");
    return;
  }

  // Hitung waktu expired
  const muteUntil = Date.now() + minutes * 60 * 1000;

  // Simpan data
  target.setDynamicProperty("mute_expiry", muteUntil);
  target.addTag("MUTED"); // Tag visual biar gampang dicek

  admin.sendMessage(`§a>> ${target.name} di-MUTE selama ${minutes} menit.`);
  target.sendMessage(`§c>> Anda di-MUTE oleh Admin selama ${minutes} menit.`);
  target.playSound("random.break");
}

// === LOGIKA ADMIN & RANK (Updated Security) ===
export function handleRankChange(
  admin,
  targetName,
  rankType,
  customDays = null,
) {
  if (!targetName) {
    admin.sendMessage("§cError: Masukkan nama player.");
    return;
  }
  const target = world.getPlayers({ name: targetName })[0];
  if (!target) {
    admin.sendMessage(
      `§cError: Player '${targetName}' offline/tidak ditemukan.`,
    );
    return;
  }

  const adminLevel = getPlayerRoleLevel(admin);
  const targetLevel = getPlayerRoleLevel(target);

  if (rankType === "MOD" && adminLevel < 99) {
    admin.sendMessage(
      "§cSecurity: Hanya OWNER yang bisa mengangkat Moderator!",
    );
    return;
  }
  if (targetLevel >= 30 && adminLevel < 99) {
    admin.sendMessage(
      "§cSecurity: Anda tidak memiliki izin mengedit sesama Staff.",
    );
    return;
  }
  if (targetLevel >= 99) {
    admin.sendMessage("§cSecurity: Tidak bisa mengedit data OWNER.");
    return;
  }

  if (rankType === "REMOVE") {
    factoryResetPlayer(target);
    admin.sendMessage(`§aRank ${target.name} dicabut.`);
    target.sendMessage("§eRank Anda dicabut oleh Staff (Kembali ke Survival).");
  } else {
    target.removeTag("VIP");
    target.removeTag("VVIP");
    target.removeTag("MOD");

    target.addTag(rankType);

    const duration = customDays !== null ? customDays : VIP_DAYS;
    const now = new Date();
    const expiryDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
    target.setDynamicProperty("role_expiry", expiryDate.getTime());

    admin.sendMessage(
      `§a${target.name} diangkat ${rankType} (${duration} Hari).`,
    );
    target.sendMessage(
      `§aSelamat! Anda menjabat ${rankType} selama ${duration} hari.`,
    );
    target.sendMessage(`§7Berakhir pada: ${expiryDate.toDateString()}`);
    updateNameTag(target);
  }
}

export function handleResetPlayer(admin, targetName) {
  if (!targetName) {
    admin.sendMessage("§cUsage: /scriptevent cmd:reset NamaPlayer");
    return;
  }
  const target = world.getPlayers({ name: targetName })[0];
  if (!target) {
    admin.sendMessage(`§cError: Player '${targetName}' offline.`);
    return;
  }

  if (getPlayerRoleLevel(target) >= 99 && target !== admin) {
    admin.sendMessage("§cSecurity: Tidak bisa mereset sesama OWNER.");
    return;
  }

  factoryResetPlayer(target);

  admin.sendMessage(
    `§aSukses! Player ${target.name} telah di-reset ke setelan pabrik.`,
  );
  target.sendMessage(`§e⚠ Akun Anda telah di-reset oleh Admin.`);
}

export function handleSetWorldSpawn(admin) {
  try {
    // Set titik spawn di posisi kaki admin saat ini
    admin.runCommand("setworldspawn ~ ~ ~");

    // Paksa radius spawn jadi 0 (Biar gak random/mencar)
    admin.runCommand("gamerule spawnradius 0");

    admin.sendMessage("§4[OP] §aTitik Spawn Dunia berhasil dikunci di sini!");
    admin.sendMessage(
      "§7(Radius spawn diatur ke 0 agar player muncul persis di blok ini)",
    );
    admin.playSound("random.levelup");
  } catch (e) {
    admin.sendMessage("§cGagal mengatur spawn: " + e);
  }
}
