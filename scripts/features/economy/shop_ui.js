import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { addMoney, formatMoney, getBalance } from "./economy.js";
import { getTexture } from "./shop.js";
import { SERVER_SHOP_ITEMS } from "./shop_items.js";

// ==========================================
// === UI SHOP SYSTEM ===
// ==========================================

export function showShopUI(player, category = "all") {
  const form = new ActionFormData()
    .title(`§l§eMARKET (${category.toUpperCase()})`)
    .body(`Uang Anda: §a${formatMoney(getBalance(player))}\n§rPilih barang yang ingin dibeli:`);

  // Filter Items
  const filteredItems = SERVER_SHOP_ITEMS.filter(item => {
    if (category.toLowerCase() === "all") return true;
    if (category.toLowerCase() === "uncategorized") return !item.category;
    return item.category && item.category.toLowerCase() === category.toLowerCase();
  });

  if (filteredItems.length === 0) {
    player.sendMessage(`§c[Shop] Tidak ada barang di kategori: ${category}`);
    return;
  }

  for (const item of filteredItems) {
    // Label: Nama \n Harga
    form.button(`${item.name}\n§e${formatMoney(item.price)}`, getTexture(item));
  }

  form.show(player).then((response) => {
    if (response.canceled) return;

    const selectedItem = filteredItems[response.selection];
    buyConfirmation(player, selectedItem);
  });
}

function buyConfirmation(player, item) {
  const balance = getBalance(player);

  const form = new ModalFormData()
    .title(`Beli ${item.name}`)
    .slider(`Jumlah (Harga satuan: ${formatMoney(item.price)})\nSisa Uang: ${formatMoney(balance)}`, 1, 64, { valueStep: 1, defaultValue: 1 })
    .toggle("Konfirmasi Beli?", { defaultValue: true });

  form.show(player).then((res) => {
    if (res.canceled) return;

    const [amount, confirmed] = res.formValues;

    if (!confirmed) return;

    const totalPrice = item.price * amount;
    // Ambil balance terbaru (siapa tau berubah pas lagi mikir)
    const currentBalance = getBalance(player);

    // 1. Cek Uang
    if (currentBalance < totalPrice) {
      player.sendMessage(`§c[Gagal] Uang kurang! Butuh: ${formatMoney(totalPrice)}`);
      player.playSound("mob.villager.no");
      return;
    }

    // 2. Cek Inventory
    const inventory = player.getComponent("inventory");
    if (inventory.container.emptySlotsCount < 1) {
      player.sendMessage("§c[Gagal] Inventory Penuh!");
      return;
    }

    // 3. Eksekusi
    addMoney(player, -totalPrice);

    try {
      player.runCommand(`give @s ${item.id} ${amount}`);
      player.sendMessage(`§a[Sukses] Membeli ${amount}x ${item.name} seharga ${formatMoney(totalPrice)}`);
      // Tampilkan sisa uang
      player.sendMessage(`§aSisa Uang: §e${formatMoney(currentBalance - totalPrice)}`);
      player.playSound("random.orb");
    } catch (e) {
      player.sendMessage("§c[Error] Gagal memberikan item.");
      addMoney(player, totalPrice); // Refund logic simple
      console.warn(e);
    }
  });
}
