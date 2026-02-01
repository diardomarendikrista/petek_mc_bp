import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getPlayerRoleLevel } from "../../core/utils.js";
import { MODES } from "../../core/config.js";
import { showMainMenu } from "./menu.js"; // Tombol Kembali

// Import Logic dari handlers.js (Pastikan file handlers.js kamu export fungsi-fungsi ini)
import {
  toggleEffect,
  handleSuperheroJump,
} from "./effects.js";
import { handleDirectTP } from "../teleport/tpa.js";

// ==========================================
// === MENU UTAMA VIP/VVIP ===
// ==========================================
export function showVipMenu(player) {
  const level = getPlayerRoleLevel(player);

  // 1. Cek Dasar: Apakah dia punya akses VIP minimal?
  if (level < 10) {
    // Jika warga biasa coba buka menu ini
    const form = new ActionFormData()
      .title("§l§cAKSES DITOLAK")
      .body(
        "Menu ini khusus §bVIP §rke atas!\nSilakan beli rank untuk akses fitur:\n\n- Heal & Feed\n- Night Vision\n- Fly & Speed (VVIP)\n- Teleport (VVIP)",
      )
      .button("§l§cKEMBALI", "textures/ui/arrow_left");

    system.run(() => {
      form.show(player).then(() => showMainMenu(player));
    });
    return;
  }

  // 2. Susun Menu
  const form = new ActionFormData()
    .title("§l§6VIP & VVIP MENU")
    .body(`Halo, §e${player.name}§r!\nRank Level: §a${level}`);

  // --- BAGIAN VIP (Level 10+) ---
  // Selalu muncul karena dia sudah lolos cek level < 10 di atas
  form.button("§l§bHEAL\n§r§fPulihkan Darah", "textures/ui/heart"); // Index 0
  form.button("§l§6FEED\n§r§fIsi Perut", "textures/items/bread"); // Index 1
  form.button(
    "§l§9NIGHT VISION\n§r§fMata Elang",
    "textures/items/night_vision_effect",
  ); // Index 2

  // --- BAGIAN VVIP (Level 20+) ---
  // Kita pakai logika: Jika level < 20, tombol digembok.

  if (level >= 20) {
    // Tampilan VVIP TERBUKA
    form.button("§l§eSUPER JUMP\n§r§fMode Terbang", "textures/items/elytra"); // Index 3
    form.button(
      "§l§bFLASH SPEED\n§r§fLari Cepat",
      "textures/items/potion_bottle_moveSpeed",
    ); // Index 4
    form.button(
      "§l§dTELEPORT\n§r§fKe Player Lain",
      "textures/ui/magnifying_glass",
    ); // Index 5
  } else {
    // Tampilan VVIP TERKUNCI (Gembok)
    form.button("§l§c🔒 SUPER JUMP\n§r§f[VVIP ONLY]", "textures/ui/lock"); // Index 3
    form.button("§l§c🔒 FLASH SPEED\n§r§f[VVIP ONLY]", "textures/ui/lock"); // Index 4
    form.button("§l§c🔒 TELEPORT\n§r§f[VVIP ONLY]", "textures/ui/lock"); // Index 5
  }

  // Tombol Kembali
  form.button("§l§cKEMBALI\n§r§fKe Menu Utama", "textures/ui/arrow_left"); // Index 6

  // 3. Tampilkan & Handle
  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      // Logic Switch Case
      switch (res.selection) {
        // === VIP ===
        case 0: // Heal
          const hp = player.getComponent("minecraft:health");
          if (hp) hp.setCurrentValue(hp.defaultValue);
          player.sendMessage("§a>> Darah dipulihkan!");
          player.playSound("random.burp");
          break;

        case 1: // Feed
          player.runCommand("effect @s saturation 1 255 true");
          player.sendMessage("§a>> Rasa lapar hilang!");
          player.playSound("random.eat");
          break;

        case 2: // NV
          toggleEffect(player, MODES.NV, "night_vision", 0, "§b>> Mata Elang");
          break;

        // === VVIP ===
        case 3: // Jump
          if (level < 20) {
            showLockedMessage(player);
            break;
          }
          handleSuperheroJump(player);
          break;

        case 4: // Speed
          if (level < 20) {
            showLockedMessage(player);
            break;
          }
          toggleEffect(player, MODES.SPEED, "speed", 1, "§6>> VVIP Speed");
          break;

        case 5: // Teleport (Buka Sub-Menu Baru)
          if (level < 20) {
            showLockedMessage(player);
            break;
          }
          showTeleportMenu(player);
          break;

        case 6: // Kembali
          try {
            showMainMenu(player);
          } catch (e) { }
          break;
      }
    });
  });
}

// Helper Pesan Terkunci
function showLockedMessage(player) {
  player.playSound("random.anvil_land");
  player.sendMessage("§c[!] Fitur ini terkunci. Upgrade ke VVIP untuk akses!");
}

// ==========================================
// === SUB-MENU: TELEPORT PLAYER (VVIP) ===
// ==========================================
function showTeleportMenu(player) {
  // 1. Ambil semua player KECUALI diri sendiri
  const allPlayers = world.getPlayers();
  const targets = allPlayers.filter((p) => p.name !== player.name);

  if (targets.length === 0) {
    player.sendMessage("§cTidak ada player lain yang online.");
    return;
  }

  // 2. Buat Array Nama untuk Dropdown
  const targetNames = targets.map((p) => p.name);

  const form = new ModalFormData()
    .title("VVIP Teleport")
    .dropdown("Pilih target teleport:", targetNames);

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) {
        showVipMenu(player); // Balik ke menu VIP
        return;
      }

      // Ambil index yang dipilih
      const selectedIndex = res.formValues[0];
      const targetName = targetNames[selectedIndex];

      // Panggil fungsi handler lama
      handleDirectTP(player, targetName);
    });
  });
}
