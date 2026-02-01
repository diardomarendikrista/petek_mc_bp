import { system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { showMainMenu } from "../general/menu.js";

// Import logic dari plots.js
import {
  handleClaim,
  handleUnclaim,
  handleWarpPlot,
  isInsidePlotZone,
  getPlotAt,
  getPlotOwner, // Pastikan ini sudah di-export di plots.js
  handleResetPlot, // Added for plot reset functionality
} from "./plots.js";

export function showPlotUI(player) {
  const form = new ActionFormData().title("§l§2LAND SYSTEM");

  // 1. Cek Posisi Player
  const inZone = isInsidePlotZone(player.location);

  // Array untuk menyimpan aksi tombol dinamis
  // Biar kita gak bingung ngitung index
  let actions = [];

  // ===============================================
  // === LOGIKA DINAMIS (CLAIM / UNCLAIM) ===
  // ===============================================
  if (inZone) {
    const info = getPlotAt(player.location);
    const owner = getPlotOwner(info.id);

    // Header Status Tanah
    let statusText = "§7Status: §aTanah Kosong";
    if (info.isRoad) statusText = "§7Status: §6Jalan Umum";
    if (info.isSpawn) statusText = "§7Status: §eSpawn Area";
    if (owner) statusText = `§7Status: §cMilik ${owner}`;
    if (owner === player.name) statusText = `§7Status: §bMilikmu Sendiri`;

    form.body(`§lLokasi: §rPlot [${info.gridX}, ${info.gridZ}]\n${statusText}`);

    // LOGIC TOMBOL
    if (!info.isRoad && !info.isSpawn) {
      if (owner === player.name) {
        // Jika punya sendiri -> Muncul UNCLAIM
        form.button("§l§cUNCLAIM\n§r§fLepas tanah ini", "textures/ui/trash");
        actions.push("unclaim");

        form.button("§l§eRESET PLOT\n§r§fRatakan Tanah (Hati-hati!)", "textures/ui/refresh");
        actions.push("reset");
      } else if (!owner) {
        // Jika kosong -> Muncul CLAIM
        form.button("§l§aCLAIM\n§r§fBeli tanah ini", "textures/ui/op");
        actions.push("claim");
      } else {
        // Punya orang lain -> Tombol Info (Gak bisa diapa-apain)
        form.button(
          `§l§8MILIK ${owner.toUpperCase()}\n§r§cTidak bisa diambil`,
          "textures/ui/lock",
        );
        actions.push("info");
      }
    }
  } else {
    // Jika di luar area plot
    form.body(
      "Kamu berada di luar area kavling.\nSilakan teleport ke dunia plot dulu.",
    );
  }

  // ===============================================
  // === TOMBOL STATIS (SELALU MUNCUL) ===
  // ===============================================

  // Tombol Teleport (Warp Plot)
  form.button("§l§bWARP PLOT\n§r§fKe Loby Utama", "textures/ui/compass_item");
  actions.push("warp");

  // Tombol Kembali
  form.button("§l§cKEMBALI\n§r§fKe Menu Utama", "textures/ui/arrow_left");
  actions.push("back");

  // ===============================================
  // === EKSEKUSI ===
  // ===============================================
  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      // Ambil aksi berdasarkan urutan tombol yang diklik
      const action = actions[res.selection];

      switch (action) {
        case "claim":
          handleClaim(player);
          break;
        case "unclaim":
          // Tambah konfirmasi biar gak kepencet
          showUnclaimConfirm(player);
          break;
        case "reset":
          confirmReset(player);
          break;
        case "warp":
          handleWarpPlot(player);
          break;
        case "back":
          try {
            showMainMenu(player);
          } catch (e) { }
          break;
        case "info":
          player.playSound("mob.villager.no"); // Bunyi tolak
          break;
      }
    });
  });
}

// Sub-Menu Konfirmasi Unclaim (Biar aman)
function showUnclaimConfirm(player) {
  const form = new ActionFormData()
    .title("§cKONFIRMASI UNCLAIM")
    .body(
      "Apakah kamu yakin ingin melepas tanah ini?\nBangunanmu mungkin akan hilang/diambil orang lain.",
    )
    .button("§l§cYA, LEPAS TANAH", "textures/ui/check")
    .button("§l§aBATAL", "textures/ui/cancel");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) {
        handleUnclaim(player);
      } else {
        showPlotUI(player); // Balik ke menu plot
      }
    });
  });
}

function confirmReset(player) {
  const form = new MessageFormData()
    .title("§l§cBAHAYA: RESET PLOT")
    .body(
      "Apakah kamu yakin ingin me-reset (menghapus merata) plot ini?\n\n§cSEMUA BANGUNAN AKAN HILANG PERMANEN!\n§eTindakan ini tidak bisa dibatalkan.",
    )
    .button1("§l§cBatal") // Button 0
    .button2("§l§eRESET SEKARANG"); // Button 1

  system.run(() => {
    form.show(player).then((res) => {
      if (res.selection === 1) {
        // MessageFormData: button1 = index 0, button2 = index 1
        handleResetPlot(player);
      } else {
        showPlotUI(player); // Balik ke menu plot
      }
    });
  });
}
