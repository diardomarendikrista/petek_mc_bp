import { world, system } from "@minecraft/server";
import { addMoney, formatMoney, getBalance } from "./economy.js";
import { SERVER_SHOP_ITEMS } from "./shop_items.js";
// UI moved to shop_ui.js
import { showShopUI } from "./shop_ui.js";
import { getPlayerRoleLevel } from "../../core/utils.js";

// Helper Texture
export function getTexture(item) {
  if (item.texture) return item.texture;
  // Fallback Logic
  const id = item.id.replace("minecraft:", "");
  // Cek apakah block atau item (simple heuristic)
  if (id.includes("log") || id.includes("stone") || id.includes("dirt") || id.includes("grass") || id.includes("block")) {
    return `textures/blocks/${id}`;
  }
  return `textures/items/${id}`;
}

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

  // 1. Cari Item di Database
  // Kita cari berdasarkan ID.
  // Note: SERVER_SHOP_ITEMS ID pakai "minecraft:diamond", item.typeId juga sama.
  const shopItem = SERVER_SHOP_ITEMS.find((i) => i.id === item.typeId);

  if (!shopItem) {
    player.sendMessage(`§cItem §f${item.typeId}§c tidak laku di sini.`);
    return;
  }

  // 2. Cek Kategori (Selective Sell)
  // Allowed: Ores, Food, Drops
  const allowedCategories = ["Ores", "Food", "Drops"];
  if (!allowedCategories.includes(shopItem.category)) {
    player.sendMessage(`§cItem ini tidak bisa dijual!`);
    player.sendMessage(`§7Kategori: §f${shopItem.category} §7(Hanya Ores, Food, & Drops yang laku).`);
    return;
  }

  // 3. Hitung Harga (20% dari Harga Beli)
  const sellPrice = Math.floor(shopItem.price * 0.2);

  // Safety: Minimum harga jual 1 (kecuali kalau emang 0)
  const finalPrice = Math.max(1, sellPrice);

  const amount = item.amount;
  const totalEarnings = finalPrice * amount;

  container.setItem(selectedSlot, undefined);
  addMoney(player, totalEarnings);

  player.sendMessage(
    `§aTerjual §f${amount}x ${shopItem.name}`,
  );
  player.sendMessage(`§aKamu dapat: §e${formatMoney(totalEarnings)} §7(${formatMoney(finalPrice)}/pcs)`);
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

  const shopItem = SERVER_SHOP_ITEMS.find((i) => i.id === item.typeId);

  if (shopItem) {
    // Cek Kategori
    const allowedCategories = ["Ores", "Food", "Drops"];
    if (!allowedCategories.includes(shopItem.category)) {
      player.sendMessage(`§cItem: §f${shopItem.name}`);
      player.sendMessage(`§cStatus: §Cannot Sell (Category: ${shopItem.category})`);
      return;
    }

    const sellPrice = Math.max(1, Math.floor(shopItem.price * 0.2));
    player.sendMessage(
      `§eItem: §f${shopItem.name}\n§eHarga Jual: §a${formatMoney(sellPrice)} / pcs`
    );
  } else {
    player.sendMessage(`§cItem ini tidak memiliki harga jual.`);
  }
}

// UI Logic has been moved to shop_ui.js

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

  // Cek Header: [SHOP] atau [MARKET]
  const header = cleanLines[0] ? cleanLines[0].trim() : "";

  // === FITUR BARU: MARKET UI SIGN ===
  if (header.toUpperCase() === "[MARKET]") {
    const isVerified = rawLines[0].includes("§1");
    let category = cleanLines[1] ? cleanLines[1].trim() : "All";
    if (!category) category = "All";

    // A. VALIDASI (Jika belum berwarna biru)
    if (!isVerified) {
      event.cancel = true;

      // Cek Permission (Builder / Level 30+)
      if (getPlayerRoleLevel(player) < 30) {
        system.run(() => {
          player.sendMessage("§c[!] Sign Market ini belum divalidasi oleh Staff.");
          player.playSound("mob.villager.no");
        });
        return;
      }

      // Proses Validasi
      system.run(() => {
        // Format Sign:
        // Baris 1: [MARKET] (Biru)
        // Baris 2: Category (Hitam)
        // Baris 3: Info
        const newText = `§1§l[MARKET]\n§0${category}\n§8(Right Click)\n§7to Open`;

        try {
          signComp.setText(newText);
          player.sendMessage(`§a[MARKET] Validated! Category: ${category}`);
          player.playSound("random.levelup");
        } catch (e) {
          player.sendMessage("§c[Error] Gagal update sign.");
        }
      });
      return;
    }

    // B. BUKA SHOP (Sudah Valid)
    system.run(() => {
      showShopUI(player, category);
    });
    return;
  }

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
