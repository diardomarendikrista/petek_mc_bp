import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showMainMenu } from "../general/menu.js";
import { handleSetHome, handleHome, getMaxHomes } from "./homes.js";

// ==========================================
// === FITUR BARU: HOME GUI ===
// ==========================================

// 1. MENU UTAMA HOME
export function showHomeUI(player) {
  const form = new ActionFormData()
    .title("§l§9HOME SYSTEM")
    .body("Kelola rumah dan lokasi pribadimu.")
    .button("§l§eDAFTAR HOME\n§r§fTeleport ke rumah", "textures/items/bed_red")
    .button(
      "§l§aBUAT HOME BARU\n§r§fSimpan lokasi ini",
      "textures/ui/color_plus",
    )
    .button("§l§cKEMBALI\n§r§fKe Menu Utama", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      if (res.selection === 0) {
        showHomeListUI(player); // Buka List
      } else if (res.selection === 1) {
        showSetHomeUI(player); // Buka Form Buat Baru
      } else if (res.selection === 2) {
        try {
          showMainMenu(player);
        } catch (e) {
          player.sendMessage("§cGagal kembali ke menu utama.");
        }
      }
    });
  });
}

// 2. SUB-MENU: LIST HOMES
function showHomeListUI(player) {
  const rawData = player.getDynamicProperty("homes_db");
  let homes = rawData ? JSON.parse(rawData) : [];

  const maxHomes = getMaxHomes(player);
  const form = new ActionFormData().title(
    `HOME LIST (${homes.length}/${maxHomes})`,
  );

  if (homes.length === 0) {
    form.body("§cKamu belum punya home.");
    form.button("Kembali");
  } else {
    form.body("Pilih home untuk teleport:");

    // Loop Homes
    homes.forEach((h, index) => {
      // Logika Gembok (Sama seperti handleHome)
      if (index >= maxHomes) {
        // Tampilan Terkunci
        form.button(
          `§l§c🔒 ${h.name}\n§r§c[LOCKED - RANK EXPIRED]`,
          "textures/ui/lock",
        );
      } else {
        // Tampilan Terbuka
        form.button(
          `§l§a${h.name}\n§r§f${h.dim.split(":")[1]} (${h.x}, ${h.y}, ${h.z})`,
          "textures/ui/world_glyph_color_2x",
        );
      }
    });
  }

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;
      if (homes.length === 0) {
        showHomeUI(player);
        return;
      } // Tombol kembali

      const selectedHome = homes[res.selection];

      // Cek lagi limit saat diklik (Double check)
      if (res.selection >= maxHomes) {
        player.playSound("random.anvil_land");
        player.sendMessage(
          `§c[LOCKED] §7Home '§f${selectedHome.name}§7' terkunci karena Rank turun.`,
        );
        player.sendMessage(`§e>> Perpanjang Rank untuk membuka akses!`);
        return;
      }

      // Eksekusi Teleport (Panggil fungsi logic lama)
      handleHome(player, selectedHome.name);
    });
  });
}

// 3. SUB-MENU: SET HOME (CREATE)
function showSetHomeUI(player) {
  const rawData = player.getDynamicProperty("homes_db");
  const homes = rawData ? JSON.parse(rawData) : [];
  const maxHomes = getMaxHomes(player);

  // Cek dulu apakah slot penuh sebelum buka form (UX yang baik)
  if (homes.length >= maxHomes) {
    player.sendMessage(`§c>> Limit Home Penuh! (${homes.length}/${maxHomes})`);
    player.playSound("mob.villager.no");
    return;
  }

  const form = new ModalFormData()
    .title("Buat Home Baru")
    .textField("Beri nama lokasi ini:", "Contoh: rumah_ku");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      let name = res.formValues[0];

      // Validasi nama kosong
      if (!name || name.trim() === "") {
        name = "default";
      }

      // Panggil fungsi logic lama
      handleSetHome(player, name);
    });
  });
}
