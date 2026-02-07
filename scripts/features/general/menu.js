import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getPlayerRoleLevel } from "../../core/utils.js";

import { isInsidePlotZone } from "../plots/plots.js";
import { showWarpUI } from "../teleport/warps_ui.js";
import { showHomeUI } from "../teleport/homes_ui.js";
import { showVipMenu } from "./vip.js";
import { showPlotUI } from "../plots/plot_ui.js";
import { handleSpawn } from "../teleport/tpa.js";
import { showSocialEcoUI } from "../economy/social_eco_ui.js";
import { showStaffMenu } from "../admin/staff_ui.js";
import { showShopUI } from "../economy/shop_ui.js";
import { handleBack } from "../teleport/death.js";

export function showMainMenu(player) {
  const form = new ActionFormData().title("SERVER MENU");

  const actions = [];
  const level = getPlayerRoleLevel(player);

  if (isInsidePlotZone(player.location)) {
    form.button(
      "§lLAND / PLOT\n§r§fSewa & Kelola Tanah",
      "textures/items/sign",
    );
    actions.push("plot"); // Simpan aksi 'plot' ke urutan ini
  }

  // SPAWN (Baru)
  form.button("§lSPAWN\n§r§fLobby / Spawn", "textures/items/compass_item");
  actions.push("spawn");

  // HOME (Level 1 / Member)
  if (level >= 1) {
    form.button("§lHOME\n§r§fRumah Pribadi", "textures/items/bed_red");
    actions.push("home");
  }

  if (level >= 3) {
    form.button("§lWARP\n§r§fJelajahi Server", "textures/items/ender_pearl");
    actions.push("warp");

    // MARKET (Level 3 / Veteran)
    form.button("§lMARKET\n§r§fBeli Barang (UI)", "textures/items/emerald");
    actions.push("market");
  }

  // SOCIAL & ECO
  form.button(
    "§lSOCIAL & ECO\n§r§fBank, TPA, Rank",
    "textures/items/emerald"
  );
  actions.push("social");

  // BACK (Level 2 / Senior)
  if (level >= 2) {
    form.button("§lBACK\n§r§fKembali ke tempat sebelum mati", "textures/items/ender_pearl");
    actions.push("back");
  }

  // VIP
  form.button(
    "§lVIP FEATURE\n§r§6Menu Khusus Donatur",
    "textures/items/diamond",
  );
  actions.push("vip");

  // STAFF
  if (level >= 50) {
    form.button("§l§cSTAFF TOOLS\n§r§fModerator Menu", "textures/ui/op");
    actions.push("staff");
  }

  // TUTUP
  form.button("§lTUTUP", "textures/ui/cancel");
  actions.push("close");

  // EKSEKUSI
  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      const selectedAction = actions[res.selection];

      switch (selectedAction) {
        case "plot":
          showPlotUI(player);
          break;
        case "spawn":
          handleSpawn(player);
          break;
        case "warp":
          showWarpUI(player);
          break;
        case "market":
          showShopUI(player);
          break;
        case "back":
          handleBack(player);
          break;
        case "home":
          showHomeUI(player);
          break;
        case "social":
          showSocialEcoUI(player);
          break;
        case "vip":
          showVipMenu(player);
          break;
        case "staff":
          showStaffMenu(player);
          break;
        case "close":
          player.sendMessage("§7Menu ditutup.");
          break;
      }
    });
  });
}
