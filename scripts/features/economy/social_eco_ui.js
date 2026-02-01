import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showMainMenu } from "../general/menu.js";

// Import Handler Lama
import { handlePay, formatMoney, getBalance } from "./economy.js";

import { handleTPA, handleTPAccept, handleTPDeny } from "../teleport/tpa.js";

import { ROLES, RANK_REQUIREMENTS } from "../../core/config.js";
import { sendInfoMenu } from "../general/info.js";
import { getPlayerRoleLevel } from "../../core/utils.js";

// ==========================================
// === MAIN MENU: SOCIAL & ECO ===
// ==========================================
export function showSocialEcoUI(player) {
  const form = new ActionFormData()
    .title("§l§dSOCIAL & ECONOMY")
    .body("Layanan Perbankan & Interaksi Sosial")

    // 1. BANK / ATM
    .button(
      "§l§eBANK / ATM\n§r§fCek Saldo & Transfer",
      "textures/items/emerald",
    )

    // 2. TPA (Kirim Request)
    .button(
      "§l§bREQUEST TPA\n§r§fTeleport ke Teman",
      "textures/ui/magnifying_glass",
    )

    // 3. TPA INCOMING (Terima Request)
    .button("§l§aTERIMA TPA\n§r§fAccept / Deny", "textures/ui/check")

    // 4. RANK LIST
    .button("§l§6INFO RANK\n§r§fDaftar Pangkat", "textures/ui/infobulb")

    // 5. INFO AKUN (Baru)
    .button("§l§3INFO AKUN\n§r§fStatus & Playtime", "textures/items/book_writable")

    // 6. KEMBALI
    .button("§l§cKEMBALI\n§r§fKe Menu Utama", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      switch (res.selection) {
        case 0:
          showBankUI(player);
          break;
        case 1:
          showTPAMenu(player);
          break;
        case 2:
          showIncomingTPAUI(player);
          break;
        case 3:
          showRankListUI(player);
          break;
        case 4:
          // INFO AKUN
          const level = getPlayerRoleLevel(player);
          sendInfoMenu(player, level);
          break;
        case 5:
          try {
            showMainMenu(player);
          } catch (e) { }
          break;
      }
    });
  });
}

// ==========================================
// === 1. BANK SYSTEM ===
// ==========================================
function showBankUI(player) {
  const saldo = getBalance(player);
  const form = new ActionFormData()
    .title("§l§eBANK ATM")
    .body(
      `§lHalo, ${player.name}!\n\n§rSaldo Anda saat ini:\n§e§l${formatMoney(saldo)}`,
    )
    .button(
      "§l§6TRANSFER UANG\n§r§fKirim ke Player Lain",
      "textures/ui/arrow_right",
    )
    .button("§l§cKEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) {
        showTransferUI(player); // Buka Form Transfer
      } else {
        showSocialEcoUI(player); // Balik
      }
    });
  });
}

function showTransferUI(player) {
  // Ambil list player online selain diri sendiri
  const allPlayers = world.getPlayers();
  const targets = allPlayers.filter((p) => p.name !== player.name);

  if (targets.length === 0) {
    player.sendMessage("§cTidak ada player lain untuk ditransfer.");
    return;
  }

  const targetNames = targets.map((p) => p.name);

  const form = new ModalFormData()
    .title("Transfer Uang")
    .dropdown("Kirim kepada:", targetNames)
    .textField("Jumlah Uang:", "Contoh: 1000");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) {
        showBankUI(player);
        return;
      }

      const [targetIndex, amountStr] = res.formValues;
      const targetName = targetNames[targetIndex];

      // Kita panggil handlePay yang lama
      // Format handlePay(player, "Target Jumlah")
      const args = `${targetName} ${amountStr}`;

      handlePay(player, args);
    });
  });
}

// ==========================================
// === 2. TPA MENU (KIRIM) ===
// ==========================================
function showTPAMenu(player) {
  const allPlayers = world.getPlayers();
  const targets = allPlayers.filter((p) => p.name !== player.name);

  const form = new ActionFormData()
    .title("§l§bREQUEST TPA")
    .body("Pilih player yang ingin kamu datangi:");

  if (targets.length === 0) {
    form.button("§cTidak ada player lain online");
    form.button("§l§cKEMBALI", "textures/ui/arrow_left");
  } else {
    // Loop Player jadi Tombol
    for (const p of targets) {
      form.button(`§l§e${p.name}\n§r§fKlik untuk Request`, "textures/ui/op");
    }
    form.button("§l§cKEMBALI", "textures/ui/arrow_left");
  }

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      // Logic Tombol Kembali (Index Terakhir)
      if (targets.length === 0 || res.selection === targets.length) {
        showSocialEcoUI(player);
        return;
      }

      // Eksekusi TPA
      const targetName = targets[res.selection].name;
      handleTPA(player, targetName);
    });
  });
}

// ==========================================
// === 3. INCOMING TPA (TERIMA) ===
// ==========================================
function showIncomingTPAUI(player) {
  const form = new ActionFormData()
    .title("§l§aINCOMING TPA")
    .body("Apakah ada yang minta teleport kepadamu?")
    .button("§l§aTERIMA (ACCEPT)\n§r§fIzinkan masuk", "textures/ui/check")
    .button("§l§cTOLAK (DENY)\n§r§fJangan ganggu", "textures/ui/cancel")
    .button("§l§8KEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      switch (res.selection) {
        case 0:
          handleTPAccept(player);
          break;
        case 1:
          handleTPDeny(player);
          break;
        case 2:
          showSocialEcoUI(player);
          break;
      }
    });
  });
}

// ==========================================
// === 4. RANK LIST INFO ===
// ==========================================
function showRankListUI(player) {
  // Kita susun text manual dari config ROLES
  // Biar lebih rapi daripada lihat di chat
  const sortedRoles = Object.values(ROLES).sort((a, b) => b.level - a.level);

  let text = "§eDaftar Pangkat Server:\n\n";
  for (const role of sortedRoles) {
    let reqText = "";
    if (role.category === "ACTIVITY") {
      const roleKey = Object.keys(ROLES).find((k) => ROLES[k] === role);
      if (roleKey && RANK_REQUIREMENTS[roleKey]) {
        const hoursNeeded = RANK_REQUIREMENTS[roleKey] / 60;
        reqText = ` §7(${hoursNeeded} Jam)`;
      }
    }
    text += `${role.prefix} §r§7(Level ${role.level})${reqText}\n`;
  }

  const form = new ActionFormData()
    .title("§l§6SERVER RANKS")
    .body(text)
    .button("§l§cKEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then(() => showSocialEcoUI(player));
  });
}
