import { system } from "@minecraft/server";
import { showMainMenu } from "../features/general/menu.js";
import { MODES } from "./config.js";
import { getPlayerRoleLevel } from "./utils.js";
import {
  toggleEffect,
  handleSuperheroJump,
} from "../features/general/effects.js";
import {
  handleRankChange,
  handleResetPlayer,
  handleMute,
  handleKick,
  handleTempBan,
  handleTempMute,
  handleUnmute,
  handleSpectator,
  handleSetWorldSpawn,
} from "../features/admin/moderation.js";
import {
  handleTPA,
  handleTPAccept,
  handleTPDeny,
  handleDirectTP,
  handleTeleportHere,
  handleSpawn,
} from "../features/teleport/tpa.js";
import { handleBack } from "../features/teleport/death.js";
import {
  sendHelpMenu,
  sendInfoMenu,
  handleRankList,
} from "../features/general/info.js";
import {
  handleClaim,
  handleUnclaim,
  handleWarpPlot,
  handleGenPlot,
  handleResetAllPlots,
  handlePurgePlots,
  handleResetPlot,
} from "../features/plots/plots.js";
import { handleSetWarp, handleWarp, handleDelWarp } from "../features/teleport/warps.js";
import {
  handleSetHome,
  handleHome,
  handleDelHome,
  handleListHomes,
} from "../features/teleport/homes.js";
import { handlePos1, handlePos2 } from "../features/general/selection.js";
import { handleProtect, handleUnprotect, handleZoneFlag, handleZoneRename, handleZoneInfo, getAllZones } from "../features/admin/protection.js";
import { handleFill } from "../features/admin/fill.js";
import { handleCopy, handlePaste } from "../features/admin/clipboard.js";
import { handleUndo } from "../features/admin/undo.js";
import { handlePay, handleBalance, handleAddMoney, handleCheckBalanceOther } from "../features/economy/economy.js";
import { handleSell, handlePriceCheck } from "../features/economy/shop.js";
import { showShopUI } from "../features/economy/shop_ui.js";
import { handleButcher } from "../features/admin/admin.js";

// [REVERTED] COMMAND_REGISTRY removed as per user request for simplicity.

export function executeCommand(player, action, messageArgs) {
  const userLevel = getPlayerRoleLevel(player);
  let args = messageArgs ? messageArgs.trim() : "";
  let targetName = "";
  let customDays = null;

  // Parsing Rank Arguments
  if (messageArgs) {
    const parts = messageArgs.trim().split(" ");
    if (parts.length > 1 && !isNaN(parts[parts.length - 1])) {
      customDays = parseInt(parts[parts.length - 1]);
      parts.pop();
      targetName = parts.join(" ");
    } else {
      targetName = messageArgs.trim();
    }
  }

  if (action === "info") {
    sendInfoMenu(player, userLevel);
    return true;
  }
  if (action === "help" || action === "h") {
    sendHelpMenu(player, userLevel);
    return true;
  }

  // ====================================================
  // === PUBLIC COMMANDS (LEVEL 0) ===
  // ====================================================
  switch (action) {
    case "menu":
      player.sendMessage("§eMenu akan terbuka dalam 2 detik... (Mohon tunggu)");
      // 40 Ticks = 2 Detik. (20 ticks = 1 detik)
      system.runTimeout(() => {
        showMainMenu(player);
      }, 40);
      return true;

    case "tpa":
      handleTPA(player, args);
      return true;
    case "tpaccept":
      handleTPAccept(player);
      return true;
    case "tpdeny":
      handleTPDeny(player);
      return true;

    case "spawn":
      handleSpawn(player);
      return true;

    // PLOT COMMANDS (PUBLIC)
    case "plot":
      handleWarpPlot(player);
      return true;
    case "claim":
      handleClaim(player);
      return true;
    case "unclaim":
      handleUnclaim(player);
      return true;
    case "resetplot":
      handleResetPlot(player);
      return true;

    case "ranks": // Alias 1
    case "ranklist": // Alias 2
      handleRankList(player);
      return true;

    // ECONOMY COMMANDS (PUBLIC)
    case "bal":
    case "money":
      handleBalance(player);
      return true;
    case "pay":
    case "transfer":
      handlePay(player, args); // args berisi "Nama Jumlah"
      return true;
    case "sell":
      handleSell(player); // Jual barang di tangan
      return true;
    case "price":
      handlePriceCheck(player); // Cek harga
      return true;

    // UI SHOP (Conditional Access)
    // UI SHOP (Conditional Access)
    case "shop":
    case "market":
      // Level 3 = Veteran
      if (userLevel >= 3) {
        player.sendMessage("§eMenu akan terbuka dalam 2 detik... (segera tutup chat!!)");
        system.runTimeout(() => {
          showShopUI(player);
        }, 40);
      } else {
        player.sendMessage("§c[!] Akses Ditolak. Minimal Rank: Veteran.");
        player.playSound("mob.villager.no");
      }
      return true;

  }

  // ====================================================
  // === LEVEL 1: MEMBER
  // ====================================================
  if (userLevel >= 1) {
    switch (action) {
      case "sethome":
        handleSetHome(player, args);
        return true;
      case "home":
        handleHome(player, args);
        return true;
      case "listhome":
      case "homes":
        handleListHomes(player);
        return true;
      case "delhome":
        handleDelHome(player, args);
        return true;
    }
  }

  // ====================================================
  // === LEVEL 2: SENIOR
  // ====================================================
  if (userLevel >= 2) {
    switch (action) {
      case "back": // return ke tempat sebelum mati
        handleBack(player);
        return true;
    }
  }

  // ====================================================
  // === LEVEL 3: VETERAN
  // ====================================================
  if (userLevel >= 3) {
    switch (action) {
      case "warp":
        handleWarp(player, args);
        return true;
    }
  }

  // ====================================================
  // === LEVEL 10: VIP
  // ====================================================
  if (userLevel >= 10) {
    switch (action) {
      case "heal":
        const hp = player.getComponent("minecraft:health");
        if (hp) hp.setCurrentValue(hp.defaultValue);
        player.sendMessage("§a>> Darah dipulihkan!");
        return true;
      case "feed":
        player.runCommand("effect @s saturation 1 255 true");
        player.sendMessage("§a>> Rasa lapar hilang!");
        return true;
      case "nv":
        toggleEffect(player, MODES.NV, "night_vision", 0, "§b>> Mata Elang");
        return true;

      // VIP Access to Shop Command (Handled in Public Switch)
    }
  }

  // ====================================================
  // === LEVEL 20: VVIP
  // ====================================================
  if (userLevel >= 20) {
    switch (action) {
      case "jump":
        handleSuperheroJump(player);
        return true;
      case "speed":
        toggleEffect(player, MODES.SPEED, "speed", 1, "§6>> VVIP Speed");
        return true;
      case "tp":
        handleDirectTP(player, args);
        return true;
      case "restore":
        const hpRes = player.getComponent("minecraft:health");
        if (hpRes) hpRes.setCurrentValue(hpRes.defaultValue);
        player.runCommand("effect @s saturation 1 255 true");
        player.sendMessage("§6>> Kondisi fisik dipulihkan sepenuhnya!");
        return true;
    }
  }

  // ====================================================
  // === LEVEL 30: BUILDER (Staff Junior / Kreatif) ===
  // ====================================================
  if (userLevel >= 30) {
    switch (action) {
      case "gmc":
        player.runCommand("gamemode creative @s");
        return true;
      case "gms":
        player.runCommand("gamemode survival @s");
        return true;
      case "day":
        player.runCommand("time set day");
        return true;
      case "night":
        player.runCommand("time set night");
        return true;
      case "wclear":
        player.runCommand("weather clear");
        return true;
      case "wrain":
        player.runCommand("weather rain");
        return true;
      case "wthunder":
        player.runCommand("weather thunder");
        return true;

      // SELECTION COMMANDS
      case "pos1":
        handlePos1(player);
        return true;
      case "pos2":
        handlePos2(player);
        return true;

      case "fill":
        handleFill(player, args);
        return true;
      case "undo":
        handleUndo(player);
        return true;
      case "copy":
        handleCopy(player);
        return true;
      case "paste":
        handlePaste(player);
        return true;
    }
  }

  // ====================================================
  // === LEVEL 50: MODERATOR (Penegak Hukum) ===
  // ====================================================
  if (userLevel >= 50) {
    switch (action) {
      case "gmsp":
      case "spec":
        handleSpectator(player);
        return true;
      case "vanish":
        toggleEffect(
          player,
          MODES.VANISH,
          "invisibility",
          0,
          "§c>> Mode Hantu",
        );
        return true;

      // mini-management
      case "protect":
        handleProtect(player, args);
        return true;
      case "unprotect":
        handleUnprotect(player, args);
        return true;
      case "zoneflag":
      case "flag":
        // args: "name key value"
        // kita butuh split 3 argumen.
        // Tapi di handler kita panggil handleZoneFlag(player, zoneName, flagKey, flagValue)
        // Kita parsing manual simple disini atau biarkan handler terima raw args?
        // Handler 'handleZoneFlag' expect (player, zoneName, flagKey, flagValue).
        // Fungsi executeCommand mengirim `messageArgs` sebagai satu string.
        // Kita parsing disini.
        if (args) {
          const fArgs = args.split(" ");
          if (fArgs.length >= 3) {
            handleZoneFlag(player, fArgs[0], fArgs[1], fArgs[2]);
          } else {
            player.sendMessage(`§7Available: ${getAllZones().map(z => z.name).join(", ")}`);
            player.sendMessage("§cUsage: +zoneflag <name> <pvp|hostile> <true|false>");
          }
        } else {
          player.sendMessage(`§7Available: ${getAllZones().map(z => z.name).join(", ")}`);
          player.sendMessage("§cUsage: +zoneflag <name> <pvp|hostile> <true|false>");
        }
        return true;

      case "zonerename":
      case "renamezone":
        if (args) {
          const rArgs = args.split(" ");
          if (rArgs.length >= 2) {
            handleZoneRename(player, rArgs[0], rArgs[1]);
          } else {
            player.sendMessage(`§7Available: ${getAllZones().map(z => z.name).join(", ")}`);
            player.sendMessage("§cUsage: +zonerename <oldName> <newName>");
          }
        } else {
          player.sendMessage(`§7Available: ${getAllZones().map(z => z.name).join(", ")}`);
          player.sendMessage("§cUsage: +zonerename <oldName> <newName>");
        }
        return true;

      case "zoneinfo":
      case "zonecheck":
        handleZoneInfo(player, args);
        return true;
      case "butcher":
        handleButcher(player, args);
        return true;

      case "tphere":
        handleTeleportHere(player, targetName);
        return true;

      // Economy (Staff)
      case "checkbal":
        handleCheckBalanceOther(player, messageArgs);
        return true;

      // warps
      case "setwarp":
        handleSetWarp(player, args);
        return true;
      case "delwarp":
        handleDelWarp(player, args);
        return true;

      // punishment
      case "kick":
        handleKick(player, args);
        return true;
      case "mute":
        handleMute(player, args);
        return true;
      case "unmute":
        handleUnmute(player, targetName);
        return true;
      case "tempmute":
        handleTempMute(player, messageArgs); // handleTempMute perlu 2 args (Nama Waktu)
        return true;
      case "tempban":
        handleTempBan(player, messageArgs);
        return true;

      // Ranks
      case "setvip":
        handleRankChange(player, targetName, "VIP", customDays);
        return true;
      case "setvvip":
        handleRankChange(player, targetName, "VVIP", customDays);
        return true;
      case "removetag":
        handleRankChange(player, targetName, "REMOVE");
        return true;
      case "reset":
        handleResetPlayer(player, targetName);
        return true;
    }
  }

  // ====================================================
  // === LEVEL 80: ADMIN (Manajemen Server) ===
  // ====================================================
  if (userLevel >= 80) {
    switch (action) {
      case "setworldspawn":
        handleSetWorldSpawn(player);
        return true;
      case "genplot":
        handleGenPlot(player, args);
        return true;
      case "purgeplots":
        // args adalah angka hari (misal: "30")
        handlePurgePlots(player, args);
        return true;

      case "setmod":
        handleRankChange(player, targetName, "MOD", customDays);
        return true;
      case "setbuilder":
        handleRankChange(player, targetName, "BUILDER", customDays);
        return true;
    }
  }

  // ====================================================
  // === LEVEL 99: OP (Dewa) ===
  // ====================================================
  if (userLevel >= 99) {
    switch (action) {
      case "setadmin":
        handleRankChange(player, targetName, "ADMIN");
        return true;
      case "setworldspawn":
        handleSetWorldSpawn(player);
        return true;
      case "genplot":
        handleGenPlot(player, args);
        return true;
      // Reset total player (Bahaya, OP Only)
      case "reset":
        handleResetPlayer(player, targetName);
        return true;
      case "resetplots": // COMMAND BERBAHAYA
        handleResetAllPlots(player);
        return true;
      case "addmoney":
        handleAddMoney(player, args);
        return true;
    }
  }

  return false;
}

// Handler Backup
export function handleScriptEvent(eventData) {
  const { id, sourceEntity, message } = eventData;
  if (!id.startsWith("cmd:")) return;
  if (!sourceEntity || sourceEntity.typeId !== "minecraft:player") return;
  const action = id.split(":")[1];
  const success = executeCommand(sourceEntity, action, message);
  if (!success)
    sourceEntity.sendMessage(
      `§c>> Command '${action}' tidak dikenal / Level kurang.`,
    );
}
