import { world, system, DisplaySlotId } from "@minecraft/server"; // <--- Import DisplaySlotId
import { getPlayerRoleLevel } from "../../core/utils.js";

const CURRENCY = "money";
const DISPLAY_NAME = "§a§lMONEY";
const CURRENCY_SYMBOL = "$";

// === INISIALISASI (FIXED VERSION) ===
export function setupEconomy() {
  // Cek apakah scoreboard 'money' sudah ada?
  if (!world.scoreboard.getObjective(CURRENCY)) {
    world.scoreboard.addObjective(CURRENCY, DISPLAY_NAME);
    console.warn(">> [Economy] Scoreboard 'money' berhasil dibuat otomatis.");
  }

  // Set tampilan ke Sidebar (List kanan layar)
  // const objective = world.scoreboard.getObjective(CURRENCY);
  // if (objective) {
  //   world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
  //     objective: objective,
  //   });
  // }

  try {
    world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
    // console.warn(">> [Economy] Tampilan Sidebar dibersihkan.");
  } catch (e) {
    // Abaikan jika memang sudah bersih
  }
}

// === HELPER FUNCTIONS ===

export function formatMoney(amount) {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString("en-US")}`;
}

export function getBalance(player) {
  const objective = world.scoreboard.getObjective(CURRENCY);
  if (!objective) return 0;

  try {
    if (!objective.hasParticipant(player)) return 0;
    return objective.getScore(player);
  } catch (e) {
    return 0;
  }
}

export function addMoney(player, amount) {
  const objective = world.scoreboard.getObjective(CURRENCY);
  if (!objective) return;
  try {
    objective.addScore(player, amount);
  } catch (e) {
    // Jaga-jaga kalau player belum punya skor, kita set dulu
    // Walau addScore biasanya otomatis, di beta kadang rewel
    if (!objective.hasParticipant(player)) {
      objective.setScore(player, amount);
    }
  }
}

export function setMoney(player, amount) {
  const objective = world.scoreboard.getObjective(CURRENCY);
  if (!objective) return;
  objective.setScore(player, amount);
}

// === FITUR TRANSFER (PAY) ===
export function handlePay(player, args) {
  const parts = args.split(" ");
  const targetName = parts[0];
  const amountStr = parts[1];

  if (!targetName || !amountStr) {
    player.sendMessage("§cUsage: +pay <NamaPlayer> <Jumlah>");
    return;
  }

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount <= 0) {
    player.sendMessage("§cJumlah uang tidak valid (Harus angka positif).");
    return;
  }

  const senderBalance = getBalance(player);
  if (senderBalance < amount) {
    player.sendMessage(
      `§cUang kamu kurang! Saldo: ${formatMoney(senderBalance)}`,
    );
    return;
  }

  const targetPlayer = world.getPlayers().find((p) => p.name === targetName);

  if (!targetPlayer) {
    player.sendMessage(
      `§cPlayer '${targetName}' tidak ditemukan (Harus Online).`,
    );
    return;
  }

  if (targetPlayer.name === player.name) {
    player.sendMessage("§cGak bisa kirim ke diri sendiri, kocak.");
    return;
  }

  addMoney(player, -amount);
  addMoney(targetPlayer, amount);

  player.sendMessage(
    `§aSukses kirim §e${formatMoney(amount)} §ake §f${targetPlayer.name}.`,
  );
  targetPlayer.sendMessage(
    `§aKamu menerima §e${formatMoney(amount)} §adari §f${player.name}.`,
  );
  player.playSound("random.orb");
  targetPlayer.playSound("random.levelup");
}

// === CEK SALDO ===
export function handleBalance(player) {
  const bal = getBalance(player);
  player.sendMessage(`§aUang kamu: §e${formatMoney(bal)}`);
}

// === CEK SALDO PLAYER LAIN (MOD ONLY) ===
export function handleCheckBalanceOther(player, args) {
  if (getPlayerRoleLevel(player) < 50) return;

  const targetName = args.trim();
  if (!targetName) {
    player.sendMessage("§cUsage: +checkbal <NamaPlayer>");
    return;
  }

  const targetPlayer = world.getPlayers().find((p) => p.name === targetName);

  // Kalau player offline, mungkin kita tidak bisa cek scoreboard secara langsung via object Player
  // Tapi kita coba cari dulu yang online

  if (targetPlayer) {
    const bal = getBalance(targetPlayer);
    player.sendMessage(`§aUang §f${targetPlayer.name}§a: §e${formatMoney(bal)}`);
  } else {
    // TODO: Kalau mau cek player offline, butuh akses ScoreboardIdentity yang lebih kompleks.
    // Untuk sekarang kita batasi online player dulu.
    player.sendMessage(`§cPlayer '${targetName}' tidak ditemukan (Harus Online).`);
  }
}

// === ADMIN: ADD MONEY ===
export function handleAddMoney(player, args) {
  if (getPlayerRoleLevel(player) < 99) return;

  const parts = args.split(" ");
  const targetName = parts[0];
  const amount = parseInt(parts[1]);

  if (!targetName || isNaN(amount)) {
    player.sendMessage("§cUsage: +addmoney <Nama> <Jumlah>");
    return;
  }

  const targetPlayer = world.getPlayers().find((p) => p.name === targetName);
  if (!targetPlayer) {
    player.sendMessage("§cPlayer harus online.");
    return;
  }

  addMoney(targetPlayer, amount);
  player.sendMessage(`§eAdded ${formatMoney(amount)} to ${targetPlayer.name}.`);
  targetPlayer.sendMessage(`§aAdmin memberi kamu ${formatMoney(amount)}.`);
}
