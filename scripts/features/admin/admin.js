import { world, system } from "@minecraft/server";
import { getPlayerRoleLevel } from "../../core/utils.js";

export function handleButcher(player, args) {
  // 1. Cek Permission (Wajib OP/MOD)
  if (getPlayerRoleLevel(player) < 50) {
    player.sendMessage("§cKhusus Staff/OP.");
    return;
  }

  // 2. Parse Radius (Default 32 blok jika tidak diisi)
  const argParts = args.split(" ");
  let radius = parseInt(argParts[0]);

  if (isNaN(radius) || radius < 1) radius = 32; // Default
  if (radius > 100) radius = 100; // Limit biar ga crash server kalau terlalu luas

  // 3. Konfigurasi Filter
  // Kita exclude (kecualikan) Player, NPC, dan Item yang jatuh
  // Supaya yang terhapus cuma MOBS (Hewan/Monster/Minecart/Boat)
  const filter = {
    location: player.location,
    maxDistance: radius,
    excludeTypes: [
      "minecraft:player", // JANGAN HAPUS PLAYER
      "minecraft:npc", // Jangan hapus NPC (kalau pakai NPC dialog)
      "minecraft:item", // Jangan hapus item yang lagi tergeletak (opsional)
      "minecraft:floating_text", // Jangan hapus floating text/hologram
    ],
  };

  try {
    const dim = player.dimension;
    const entities = dim.getEntities(filter);

    let count = 0;

    // 4. Eksekusi Penghapusan
    for (const entity of entities) {
      // Pastikan sekali lagi bukan player (safety net)
      if (entity.typeId === "minecraft:player") continue;

      // Gunakan .remove() BUKAN .kill()
      // .remove() = Hilang seketika (Despawn) -> Tidak ada lag animasi mati, tidak ada item drop.
      // .kill() = Mati -> Ada animasi merah, jatuhin daging/item -> Bikin tambah lag.
      entity.remove();
      count++;
    }

    if (count > 0) {
      player.sendMessage(
        `§a[Success] Berhasil menghapus §e${count} §aentity di radius ${radius}.`,
      );
      player.playSound("random.levelup");
    } else {
      player.sendMessage(`§eTidak ada hewan/monster di radius ${radius}.`);
    }
  } catch (e) {
    player.sendMessage(`§cError: ${e.message}`);
  }
}
