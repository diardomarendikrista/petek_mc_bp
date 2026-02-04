import { ROLES, RANK_REQUIREMENTS, CMD_PREFIX } from "../../core/config.js";
import { getPlayerRoleLevel } from "../../core/utils.js";

// === LOGIKA MENU ===
export function sendInfoMenu(player, userLevel) {
  let roleName = "Newbie";

  // Cari Role Name berdasarkan level
  // Menggunakan ROLES dari config agar konsisten
  const matchedEntry = Object.entries(ROLES).find(([key, val]) => val.level === userLevel);
  if (matchedEntry) {
    // Gunakan nama key (misal "OP", "ADMIN") atau parse dari prefix
    // Kita gunakan Key saja biar rapi, atau mapping manual jika perlu.
    // Mapping: OP -> OWNER, MOD -> MODERATOR
    const key = matchedEntry[0];
    if (key === "OP") roleName = "OWNER";
    else if (key === "MOD") roleName = "MODERATOR";
    else roleName = key; // ADMIN, BUILDER, VVIP, VIP, VETERAN, SENIOR, MEMBER
  }

  // Header Menu
  player.sendMessage(`§e=== STATUS AKUN ===`);

  // Logika Tampilan Berdasarkan Level
  if (userLevel >= 99) {
    // OWNER
    player.sendMessage(`§fRole: §4${roleName}`);
    player.sendMessage(`§fStatus: §cServer Operator`);
  } else if (userLevel > 0) {
    // RANKED PLAYER (VIP - MOD)
    player.sendMessage(`§fRole: §6${roleName}`);

    // Cek apakah ada expiry date
    const expiry = player.getDynamicProperty("role_expiry");

    if (expiry) {
      // Jika ada tanggal kadaluarsa (Durasi)
      const daysLeft = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
      // Cegah angka minus jika baru saja expire tapi belum ke-kick
      const displayDays = daysLeft > 0 ? daysLeft : 0;
      player.sendMessage(`§fSisa Waktu: §a${displayDays} Hari`);
    } else {
      // Jika tidak ada expiry tapi punya level (PERMANEN)
      player.sendMessage(`§fStatus: §bPERMANEN`);
    }
  } else {
    // KHUSUS PLAYER BIASA
    player.sendMessage(`§fRole: §7${roleName}`);
    player.sendMessage(`§fStatus: §7Free Player`);
  }

  // --- STATISTIK MAIN ---
  const minutesPlayed = player.getDynamicProperty("play_time_minutes") || 0;
  const hours = Math.floor(minutesPlayed / 60);
  const mins = minutesPlayed % 60;
  player.sendMessage(`§fPlay Time: §b${hours} Jam ${mins} Menit`);

  // --- NEXT RANK ---
  // Cek rank berikutnya berdasarkan play time
  let nextRank = null;
  let nextReq = 0;

  if (minutesPlayed < RANK_REQUIREMENTS.MEMBER) {
    nextRank = "MEMBER";
    nextReq = RANK_REQUIREMENTS.MEMBER;
  } else if (minutesPlayed < RANK_REQUIREMENTS.SENIOR) {
    nextRank = "SENIOR";
    nextReq = RANK_REQUIREMENTS.SENIOR;
  } else if (minutesPlayed < RANK_REQUIREMENTS.VETERAN) {
    nextRank = "VETERAN";
    nextReq = RANK_REQUIREMENTS.VETERAN;
  }

  if (nextRank) {
    const diff = nextReq - minutesPlayed;
    const diffH = Math.floor(diff / 60);
    const diffM = diff % 60;
    player.sendMessage(
      `§7Next Rank: §e${nextRank} §7(Kurang ${diffH}j ${diffM}m)`,
    );
  } else {
    player.sendMessage("§7Rank Activity: §aMAXED (VETERAN)");
  }
}

export function handleRankList(player) {
  const sortedRoles = Object.values(ROLES).sort((a, b) => b.level - a.level);

  // Cek Level Si Pelihat (Viewer)
  const viewerLevel = getPlayerRoleLevel(player);

  // Logic: Tampilkan angka level HANYA jika viewer adalah MOD (50) ke atas
  const showLevelInfo = viewerLevel >= 50;

  let msg = "§2=== §aDAFTAR PANGKAT SERVER §2===\n";

  for (const role of sortedRoles) {
    let reqText = "";
    // Tambah info waktu untuk rank activity
    if (role.category === "ACTIVITY") {
      // Cari requirementnya
      // Kita mapping manual atau cari by key
      // Tapi karena key di ROLES beda sama key di RANK_REQUIREMENTS (MEMBER vs MEMBER is fine)
      const roleKey = Object.keys(ROLES).find((k) => ROLES[k] === role);
      if (roleKey && RANK_REQUIREMENTS[roleKey]) {
        const hoursNeeded = RANK_REQUIREMENTS[roleKey] / 60;
        reqText = ` §7(${hoursNeeded} Jam)`;
      }
    }

    if (showLevelInfo) {
      // Tampilan Staff: Lengkap dengan angka
      msg += `${role.prefix} §8- §7Level ${role.level}${reqText}\n`;
    } else {
      // Tampilan Public: Bersih (Cuma prefix)
      msg += `${role.prefix}${reqText}\n`;
    }
  }

  msg += "\n§7Gunakan §f+info §7untuk cek statusmu.";
  player.sendMessage(msg);
}

export function sendHelpMenu(player, level) {
  // Header
  // CMD_PREFIX sudah diimport dari config.js
  let msg = `§2=== §aPETEK MC MOD HELP §2===\n`;
  msg += `§7GUI Menu: §e${CMD_PREFIX}menu §7(atau Klik Stick)\n`;

  // === 0. PUBLIC (Level 0+) ===
  msg += `\n§e[NEWBIE]`;
  msg += `\n§7Land: §fclaim, unclaim, plot, warp plot, resetplot`;
  msg += `\n§7Social: §ftpa, tpaccept, tpdeny, ranks, spawn`;
  msg += `\n§7Eco: §fbal, pay <nama> <jml>, sell, price`;

  // === 1. MEMBER (Level 1+) ===
  if (level >= 1) {
    msg += `\n\n§7[MEMBER]`;
    msg += `\n§7Home: §fsethome, home, listhome, delhome`;
  }

  // === 2. SENIOR (Level 2+) ===
  if (level >= 2) {
    msg += `\n\n§6[SENIOR]`;
    msg += `\n§7Death: §fback`;
  }

  // === 3. VETERAN (Level 3+) ===
  if (level >= 3) {
    msg += `\n\n§e[VETERAN]`;
    msg += `\n§7Warp: §fwarp <nama>`;
  }

  // === 4. VIP (Level 10+) ===
  if (level >= 10) {
    msg += `\n\n§b[VIP]`;
    msg += `\n§fheal, feed, nv (Night Vision)`;
  }

  // === 5. VVIP (Level 20+) ===
  if (level >= 20) {
    msg += `\n\n§6[VVIP]`;
    msg += `\n§fjump (Fly Mode), speed, tp <player>, restore`;
  }

  // === 6. BUILDER (Level 30+) ===
  if (level >= 30) {
    msg += `\n\n§a[BUILDER]`;
    msg += `\n§7Creative: §fgmc, gms, day`;
    msg += `\n§7Tools: §fpos1, pos2, fill, undo, copy, paste`;
    msg += `\n§7WorldEdit: §f//pos1, //pos2, //copy, //paste, //undo`;
  }

  // === 5. MODERATOR (Level 50+) ===
  if (level >= 50) {
    msg += `\n\n§9[MODERATOR]`;
    msg += `\n§7Protect: §fprotect <name>, unprotect, zoneflag, zonerename, zoneinfo`;
    msg += `\n§7Staff: §ftphere, vanish, spec, butcher, checkbal`;
    msg += `\n§7Punish: §fkick, mute, unmute, tempmute, tempban`;
    msg += `\n§7Rank: §fsetvip, setvvip, removetag, reset`;
    msg += `\n§7Warps: §fsetwarp, delwarp`;
  }

  // === 6. ADMIN (Level 80+) ===
  if (level >= 80) {
    msg += `\n\n§c[ADMIN]`;
    msg += `\n§fsetbuilder, setmod, genplot, purgeplots, setworldspawn`;
  }

  // === 7. OWNER / OP (Level 99+) ===
  if (level >= 99) {
    msg += `\n\n§4[OWNER]`;
    msg += `\n§fsetadmin, addmoney, resetplots`;
  }

  player.sendMessage(msg);
}
