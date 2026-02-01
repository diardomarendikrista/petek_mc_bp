import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { showMainMenu } from "../general/menu.js";
import { handleWarp, getAllWarps } from "./warps.js";

// ==========================================
// === FITUR WARP GUI ===
// ==========================================
export function showWarpUI(player) {
  const warps = getAllWarps();

  const form = new ActionFormData()
    .title("§l§dWARP MENU")
    .body("Pilih lokasi tujuan:");

  if (warps.length === 0) {
    // KASUS 1: WARP KOSONG
    form.button("§cTidak ada warp tersedia"); // Index 0
    form.button("§l§cKEMBALI", "textures/ui/arrow_left");
  } else {
    // KASUS 2: ADA WARP
    for (const warpName of warps) {
      form.button(`§l§b${warpName.toUpperCase()}`, "textures/ui/ender_pearl");
    }
    // Tombol Kembali ditaruh paling akhir (Index = warps.length)
    form.button("§l§cKEMBALI\n§r§fKe Menu Utama", "textures/ui/arrow_left");
  }

  system.run(() => {
    form.show(player).then((response) => {
      if (response.canceled) return;

      // LOGIKA UNTUK KASUS 1 (KOSONG)
      if (warps.length === 0) {
        if (response.selection === 1) {
          // Jika tekan tombol kedua (Kembali)
          try {
            showMainMenu(player);
          } catch (e) { }
        }
        return;
      }

      // LOGIKA UNTUK KASUS 2 (ADA ISI)

      // Cek apakah tombol yang ditekan adalah tombol TERAKHIR (Tombol Kembali)?
      // Karena array mulai dari 0, maka index tombol terakhir pasti == panjang array.
      if (response.selection === warps.length) {
        try {
          showMainMenu(player);
        } catch (e) {
          player.sendMessage("§cGagal kembali ke menu.");
        }
        return; // Stop disini, jangan lanjut ke teleport
      }

      // Jika bukan tombol kembali, berarti tombol Warp
      const selectedWarp = warps[response.selection];

      try {
        handleWarp(player, selectedWarp);
      } catch (e) {
        player.sendMessage("§cGagal teleport.");
      }
    });
  });
}
