import { world, system } from "@minecraft/server";

const KEY_LAST_DEATH = "last_death_pos";

// === LISTENER: Simpan Lokasi Kematian ===
export function handleDeath(event) {
  const deadEntity = event.deadEntity;

  // Cek apakah yang mati adalah Player
  if (deadEntity.typeId !== "minecraft:player") return;

  try {
    const location = {
      x: Math.floor(deadEntity.location.x),
      y: Math.floor(deadEntity.location.y),
      z: Math.floor(deadEntity.location.z),
      dim: deadEntity.dimension.id,
    };

    // Simpan ke Dynamic Property Player
    deadEntity.setDynamicProperty(KEY_LAST_DEATH, JSON.stringify(location));

    deadEntity.sendMessage(
      "§c§l[!] KAMU MATI! [!]§r\n§7Lokasi kematianmu telah dicatat.\n§7Ketik §e+back §7untuk kembali ke sana (Level 2+).",
    );
  } catch (e) {
    console.warn("Error saving death location: " + e);
  }
}

// === COMMAND: +back ===
export function handleBack(player) {
  try {
    const rawData = player.getDynamicProperty(KEY_LAST_DEATH);

    if (!rawData) {
      player.sendMessage("§cKamu belum pernah mati (atau data hilang).");
      return;
    }

    const pos = JSON.parse(rawData);
    const dim = world.getDimension(pos.dim);

    if (!dim) {
      player.sendMessage("§cDimensi tidak ditemukan.");
      return;
    }

    // Teleport
    player.teleport({ x: pos.x, y: pos.y, z: pos.z }, { dimension: dim });
    player.sendMessage(`§aMembawamu kembali ke lokasi kematian...`);
    player.playSound("mob.endermen.portal");
  } catch (e) {
    player.sendMessage("§cGagal teleport back: " + e);
  }
}
