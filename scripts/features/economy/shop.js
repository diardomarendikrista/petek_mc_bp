import { world, system } from "@minecraft/server";
import { addMoney, formatMoney, getBalance } from "./economy.js";
import { getPlayerRoleLevel } from "../../core/utils.js";

// === DAFTAR HARGA BARANG (Per 1 Pcs) ===
// Ini daftar harga referensi jika pakai command /sell (command lama)
const PRICE_LIST = {
  "minecraft:cobblestone": 5,
  "minecraft:dirt": 2,
  "minecraft:log": 10,
  "minecraft:iron_ingot": 50,
  "minecraft:gold_ingot": 100,
  "minecraft:diamond": 500,
  "minecraft:emerald": 1000,
  "minecraft:wheat": 15,
  "minecraft:carrot": 15,
  "minecraft:potato": 15,
  "minecraft:rotten_flesh": 5,
  "minecraft:bone": 5,
};

// === FITUR JUAL (COMMAND) ===
export function handleSell(player) {
  const inventory = player.getComponent("inventory");
  if (!inventory || !inventory.container) return;

  const container = inventory.container;
  const selectedSlot = player.selectedSlotIndex;
  const item = container.getItem(selectedSlot);

  if (!item) {
    player.sendMessage("§cTangan kosong! Pegang item yang mau dijual.");
    return;
  }

  const pricePerItem = PRICE_LIST[item.typeId];
  if (!pricePerItem) {
    player.sendMessage(`§cItem §f${item.typeId} §ctidak laku di sini.`);
    return;
  }

  const amount = item.amount;
  const totalEarnings = pricePerItem * amount;

  container.setItem(selectedSlot, undefined);
  addMoney(player, totalEarnings);

  player.sendMessage(
    `§aTerjual §f${amount}x ${item.typeId.replace("minecraft:", "")}`,
  );
  player.sendMessage(`§aKamu dapat: §e${formatMoney(totalEarnings)}`);
  player.playSound("random.orb");
}

// Fitur Cek Harga (Tanpa Jual)
export function handlePriceCheck(player) {
  const inventory = player.getComponent("inventory");
  const container = inventory.container;
  const item = container.getItem(player.selectedSlotIndex);

  if (!item) {
    player.sendMessage("§cPegang item untuk cek harga.");
    return;
  }

  const price = PRICE_LIST[item.typeId];
  if (price) {
    player.sendMessage(
      `§eHarga §f${item.typeId}§e: ${formatMoney(price)} / pcs.`,
    );
  } else {
    player.sendMessage(`§cItem ini tidak memiliki harga jual.`);
  }
}

// ==========================================
// === FITUR SIGN SHOP (INTERAKSI) ===
// ==========================================

export function handleShopSignInteract(event) {
  const { block, player } = event;

  // 1. Cek Blok apakah Sign
  const isSign = block.typeId.includes("sign");
  if (!isSign) return;
  const signComp = block.getComponent("minecraft:sign");
  if (!signComp) return;

  // 2. Baca Text
  const rawText = signComp.getText();
  if (!rawText) return;

  // Bersihkan text untuk logika
  const rawLines = rawText.split("\n");
  const cleanLines = rawText.replace(/§./g, "").split("\n"); // Hapus kode warna

  // Cek Header: [SHOP]
  const header = cleanLines[0] ? cleanLines[0].trim() : "";
  if (header.toUpperCase() !== "[SHOP]") return;

  // Cek Status Verifikasi (Warna Biru §1 di header)
  const isVerified = rawLines[0].includes("§1");

  // ===================================
  // === A. VALIDASI TOKO (OP ONLY) ===
  // ===================================
  if (!isVerified) {
    event.cancel = true;

    // Cek Permission OP
    if (getPlayerRoleLevel(player) < 99) {
      system.run(() => {
        player.sendMessage("§c[!] Shop ini belum divalidasi oleh Admin.");
        player.playSound("mob.villager.no");
      });
      return;
    }

    // --- PROSES VALIDASI ---
    system.run(() => {
      // INPUT FORMAT (Admin Writing):
      // Baris 1: [SHOP]
      // Baris 2: Harga
      // Baris 3: Qty
      // Baris 4: Nama Item / hand

      const priceInput = cleanLines[1] ? cleanLines[1].trim() : "";
      const amountInput = cleanLines[2] ? cleanLines[2].trim() : "1";
      let itemNameInput = cleanLines[3] ? cleanLines[3].trim() : "";

      // 1. Cek Harga (Wajib Angka)
      const price = parseInt(priceInput);
      if (isNaN(price) || price <= 0) {
        player.sendMessage("§c[Error] Baris 2 (Harga) harus angka positif.");
        return;
      }

      // 2. Cek Qty (Default 1)
      let amount = parseInt(amountInput);
      if (isNaN(amount) || amount <= 0) amount = 1;

      // 3. Cek Item (Line 4)
      let finalItemID = "";

      // Jika kosong atau "hand", ambil dari tangan
      if (itemNameInput === "" || itemNameInput.toLowerCase() === "hand") {
        const inventory = player.getComponent("inventory");
        const itemStack = inventory.container.getItem(player.selectedSlotIndex);

        if (!itemStack) {
          player.sendMessage(
            "§c[Error] Tangan kosong! Tulis nama item di baris 4 atau pegang itemnya.",
          );
          return;
        }
        finalItemID = itemStack.typeId;
      } else {
        // Jika admin menulis nama item
        finalItemID = itemNameInput;
      }

      // Safety: Pastikan Baris 4 bukan angka (Salah input)
      if (!isNaN(parseFloat(finalItemID)) && isFinite(finalItemID)) {
        player.sendMessage("§c[Error] Baris 4 terdeteksi sebagai angka.");
        player.sendMessage(
          "§7Pastikan urutan: [SHOP] -> Harga -> Qty -> Nama Barang",
        );
        return;
      }

      if (!finalItemID.includes(":")) {
        finalItemID = "minecraft:" + finalItemID;
      }

      const displayName = finalItemID.replace("minecraft:", "");

      // 4. Update Sign jadi Valid (LAYOUT FIX)
      // Baris 1: [SHOP] (Biru)
      // Baris 2: $ Harga (Hijau Tua)
      // Baris 3: Qty: Jumlah (Hitam)
      // Baris 4: Nama Item (Abu-abu)

      const newText = `§1§l[SHOP]\n§2$ ${price}\n§0Qty: ${amount}\n§8${displayName}`;

      try {
        signComp.setText(newText);
        player.sendMessage(
          `§a[SHOP] Toko Dibuat: ${displayName} x${amount} = ${formatMoney(price)}`,
        );
        player.playSound("random.levelup");
      } catch (e) {
        player.sendMessage(
          "§c[Error] Gagal update sign. Nama item terlalu panjang?",
        );
      }
    });
    return;
  }

  // ===================================
  // === B. TRANSAKSI BELI (PLAYER) ===
  // ===================================
  event.cancel = true;

  system.run(() => {
    // LAYOUT SAAT INI (Reading from Sign):
    // Baris 1: [SHOP]
    // Baris 2: $ 1000
    // Baris 3: Qty: 64
    // Baris 4: diamond

    // 1. Parsing Data
    // Baris 2: Ambil angka saja (buang simbol $)
    const priceStr = cleanLines[1].replace(/[^0-9]/g, "");
    // Baris 3: Ambil angka saja (buang "Qty:")
    const amountStr = cleanLines[2].replace(/[^0-9]/g, "");
    // Baris 4: Nama item
    let itemID = cleanLines[3].trim();

    const price = parseInt(priceStr);
    const amount = parseInt(amountStr);

    // 2. Validasi Data
    if (!itemID || isNaN(price) || isNaN(amount)) {
      player.sendMessage("§c[Error] Data toko rusak/tidak terbaca.");
      return;
    }

    // Safety check ID
    if (!isNaN(parseFloat(itemID)) && isFinite(itemID)) {
      player.sendMessage(
        "§c[Error] Shop Error: Nama item terbaca sebagai angka.",
      );
      return;
    }

    if (!itemID.includes(":")) {
      itemID = "minecraft:" + itemID;
    }

    // 3. Cek Uang
    const balance = getBalance(player);
    if (balance < price) {
      player.sendMessage(`§cUang tidak cukup! Butuh: §e${formatMoney(price)}`);
      player.playSound("mob.villager.no");
      return;
    }

    // 4. Cek Inventory Penuh?
    const inventory = player.getComponent("inventory");
    const container = inventory.container;
    if (container.emptySlotsCount < 1) {
      player.sendMessage("§cInventory penuh! Sisakan 1 slot kosong.");
      return;
    }

    // 5. Eksekusi
    addMoney(player, -price);

    try {
      player.runCommand(`give @s ${itemID} ${amount}`);

      player.sendMessage(
        `§aMembeli ${amount}x ${itemID.replace("minecraft:", "")} seharga §e${formatMoney(price)}`,
      );

      // Info Sisa Uang
      const sisaUang = getBalance(player);
      player.sendMessage(`§aSisa uang: §e${formatMoney(sisaUang)}`);

      player.playSound("random.orb");
    } catch (e) {
      // Refund
      addMoney(player, price);
      player.sendMessage(`§c[Error] Gagal memberi item. Uang dikembalikan.`);
      console.warn(e);
    }
  });
}
