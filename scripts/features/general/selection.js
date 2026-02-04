import { system } from "@minecraft/server";

// Helper untuk kalkulasi dan display volume
function showSelectionInfo(player) {
  const p1Str = player.getDynamicProperty("sel_pos1");
  const p2Str = player.getDynamicProperty("sel_pos2");
  if (!p1Str || !p2Str) return;

  const p1 = JSON.parse(p1Str);
  const p2 = JSON.parse(p2Str);

  const w = Math.abs(p1.x - p2.x) + 1;
  const h = Math.abs(p1.y - p2.y) + 1;
  const l = Math.abs(p1.z - p2.z) + 1;
  const total = w * h * l;

  player.sendMessage(`§7Size: §e${w} x ${h} x ${l} §7(${total} blocks)`);
}

// Simpan koordinat ke Player
export function handlePos1(player) {
  const loc = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };
  player.setDynamicProperty("sel_pos1", JSON.stringify(loc));
  player.sendMessage(`§dPosisi 1 set di: ${loc.x}, ${loc.y}, ${loc.z}`);
  showSelectionInfo(player);
}

export function handlePos2(player) {
  const loc = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };
  player.setDynamicProperty("sel_pos2", JSON.stringify(loc));
  player.sendMessage(`§dPosisi 2 set di: ${loc.x}, ${loc.y}, ${loc.z}`);
  showSelectionInfo(player);
}

// Helper untuk mengambil seleksi yang sudah dirapikan (Min/Max)
export function getSelection(player) {
  const p1Str = player.getDynamicProperty("sel_pos1");
  const p2Str = player.getDynamicProperty("sel_pos2");

  if (!p1Str || !p2Str) return null;

  const p1 = JSON.parse(p1Str);
  const p2 = JSON.parse(p2Str);

  // Hitung Min/Max (Bounding Box)
  return {
    min: {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      z: Math.min(p1.z, p2.z),
    },
    max: {
      x: Math.max(p1.x, p2.x),
      y: Math.max(p1.y, p2.y),
      z: Math.max(p1.z, p2.z),
    },
  };
}
