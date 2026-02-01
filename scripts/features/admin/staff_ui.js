import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showMainMenu } from "../general/menu.js";
import { handleTeleportHere } from "../../features/teleport/tpa.js";
import {
  handleKick,
  handleMute,
  handleUnmute,
  handleTempBan,
  handleRankChange,
} from "../../features/admin/moderation.js";
import { handleCheckBalanceOther } from "../../features/economy/economy.js";

export function showStaffMenu(player) {
  const form = new ActionFormData()
    .title("§l§cSTAFF DASHBOARD")
    .body("Panel Kontrol Moderator & Admin")
    .button("§l§eSUMMON PLAYER\n§r§fTarik Player ke Sini", "textures/ui/magnet")
    .button("§l§cPLAYER MANAGER\n§r§fKick, Ban, Mute, Rank", "textures/ui/hammer_l")
    .button("§l§cKEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      if (res.selection === 0) {
        showSummonUI(player);
      } else if (res.selection === 1) {
        showPlayerManagerUI(player);
      } else {
        try {
          showMainMenu(player);
        } catch (e) { }
      }
    });
  });
}

function showSummonUI(player) {
  const allPlayers = world.getPlayers();
  const targets = allPlayers.filter((p) => p.name !== player.name);

  if (targets.length === 0) {
    player.sendMessage("§cTidak ada player lain online.");
    return;
  }

  const targetNames = targets.map((p) => p.name);

  const form = new ModalFormData()
    .title("Summon Player")
    .dropdown("Pilih player untuk ditarik:", targetNames);

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) {
        showStaffMenu(player);
        return;
      }

      const selectedName = targetNames[res.formValues[0]];
      handleTeleportHere(player, selectedName);
    });
  });
}

// === PLAYER MANAGER (NEW) ===
function showPlayerManagerUI(player) {
  const allPlayers = world.getPlayers();
  const targets = allPlayers.filter((p) => p.name !== player.name);

  if (targets.length === 0) {
    player.sendMessage("§cTidak ada player lain online.");
    return;
  }

  const targetNames = targets.map((p) => p.name);

  const form = new ModalFormData()
    .title("Player Manager")
    .dropdown("Pilih Target:", targetNames)
    .dropdown(
      "Aksi:",
      [
        "Kick",
        "Mute (Toggle)",
        "Unmute (Force)",
        "Temp Ban (30m)",
        "Set VIP (30d)",
        "Set VVIP (30d)",
        "Reset Rank",
        "Check Balance",
      ],
    );

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) {
        showStaffMenu(player);
        return;
      }

      const targetIndex = res.formValues[0];
      const actionIndex = res.formValues[1];
      const targetName = targetNames[targetIndex];

      switch (actionIndex) {
        case 0: // Kick
          handleKick(player, targetName, "Kicked by Staff via GUI");
          break;
        case 1: // Mute
          handleMute(player, targetName);
          break;
        case 2: // Unmute
          handleUnmute(player, targetName);
          break;
        case 3: // Temp Ban
          handleTempBan(player, `${targetName} 30`);
          break;
        case 4: // Set VIP
          handleRankChange(player, targetName, "VIP", 30);
          break;
        case 5: // Set VVIP
          handleRankChange(player, targetName, "VVIP", 30);
          break;
        case 6: // Reset Rank
          handleRankChange(player, targetName, "REMOVE");
          break;
        case 7: // Check Balance
          handleCheckBalanceOther(player, targetName);
          break;
      }
    });
  });
}
