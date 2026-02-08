import { world, system } from "@minecraft/server";
import { ROLES, RANK_REQUIREMENTS } from "../../core/config.js";

// Key untuk dynamic property
const KEY_PLAYTIME = "play_time_minutes";

export function startPlayTimeTracker() {
  // Jalankan setiap 1 menit (20 ticks * 60 = 1200 ticks)
  system.runInterval(() => {
    const players = world.getPlayers();
    for (const player of players) {
      updatePlayTime(player);
    }
  }, 1200);
}

function updatePlayTime(player) {
  try {
    // 1. Ambil data lama (default 0)
    let minutes = player.getDynamicProperty(KEY_PLAYTIME) || 0;

    // 2. Tambah 1 menit
    minutes++;

    // 3. Simpan
    player.setDynamicProperty(KEY_PLAYTIME, minutes);

    // 4. Cek Auto Rank
    checkAutoRank(player, minutes);
  } catch (e) {
    console.warn(`[Activity] Error updating ${player.name}: ${e}`);
  }
}

function checkAutoRank(player, minutes) {
  // === CEK APAKAH SUDAH PUNYA RANK TINGGI (STAFF / DONOR) ===
  // Kita cek manual by Tag karena getPlayerRoleLevel cuma balikin angka level tertinggi
  // Kita gamau override tag STAFF/DONOR, tapi kita tetep mau kasih progress.
  // Jadi, biarpun dia VIP, dia tetep bisa dapet tag "VETERAN" di background.
  // Tapi secara display, prefix akan ambil yang tertinggi (VIP/Owner) di utils.js.

  // Urutan Rank dari terendah ke tertinggi untuk pengecekan
  // MEMBER (60m) -> SENIOR (300m) -> VETERAN (1440m)

  // Cek Veteran
  if (minutes >= RANK_REQUIREMENTS.VETERAN) {
    addActivityRank(player, ROLES.VETERAN);
  }
  // Cek Senior
  else if (minutes >= RANK_REQUIREMENTS.SENIOR) {
    addActivityRank(player, ROLES.SENIOR);
  }
  // Cek Member
  else if (minutes >= RANK_REQUIREMENTS.MEMBER) {
    addActivityRank(player, ROLES.MEMBER);
  }
}

function addActivityRank(player, targetRole) {
  // Jika sudah punya tag ini, skip
  if (player.hasTag(targetRole.tag)) return;

  // Hapus tag activity lain yang lebih rendah/lama supaya rapi
  // Contoh: Kalau naik ke SENIOR, hapus MEMBER.
  // API: Kita cari semua role yang kategorinya "ACTIVITY" dan hapus.
  Object.values(ROLES).forEach((role) => {
    if (role.category === "ACTIVITY" && role.tag !== targetRole.tag) {
      if (player.hasTag(role.tag)) {
        player.removeTag(role.tag);
      }
    }
  });

  // Tambah tag baru
  player.addTag(targetRole.tag);

  // Announce / Sound
  player.playSound("random.levelup");
  player.sendMessage(
    `§e§l[LEVEL UP]§r §7Selamat! Karena main §a${RANK_REQUIREMENTS[targetRole.tag] / 60} Jam§7, pangkatmu naik jadi ${targetRole.prefix}`,
  );
  world.sendMessage(
    `§e>> §f${player.name} §7naik pangkat jadi ${targetRole.prefix}§7!`,
  );
}
