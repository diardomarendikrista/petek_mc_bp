import { world, system, BlockPermutation } from "@minecraft/server";
import { getSelection } from "../general/selection.js";
import { getPlayerRoleLevel } from "../../core/utils.js";

// Import Helper dari undo.js
import { saveUndoHistory, getPermutationStates, UNDO_LIMIT } from "./undo.js";

const CLIPBOARD = new Map();
const COPY_LIMIT = 15000;

export function handleCopy(player) {
  if (getPlayerRoleLevel(player) < 30) {
    player.sendMessage("§cKhusus Builder (Level 30+).");
    return;
  }

  const sel = getSelection(player);
  if (!sel) {
    player.sendMessage("§cKamu belum set +pos1 dan +pos2!");
    return;
  }

  const width = Math.abs(sel.max.x - sel.min.x) + 1;
  const height = Math.abs(sel.max.y - sel.min.y) + 1;
  const length = Math.abs(sel.max.z - sel.min.z) + 1;
  const volume = width * height * length;

  if (volume > COPY_LIMIT) {
    player.sendMessage(
      `§cArea terlalu besar! (${volume} blok). Max: ${COPY_LIMIT}`,
    );
    return;
  }

  player.sendMessage(`§eMenyalin ${volume} blok ke Clipboard...`);
  const origin = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };

  system.run(() => {
    runCopyTask(player, sel, origin);
  });
}

function runCopyTask(player, sel, origin) {
  const dim = player.dimension;
  const data = [];
  let airCount = 0;

  try {
    for (let x = sel.min.x; x <= sel.max.x; x++) {
      for (let y = sel.min.y; y <= sel.max.y; y++) {
        for (let z = sel.min.z; z <= sel.max.z; z++) {
          const block = dim.getBlock({ x, y, z });
          if (block) {
            const perm = block.permutation;
            if (perm) {
              if (perm.type.id === "minecraft:air") {
                airCount++;
                continue;
              }
              const states = getPermutationStates(perm);
              data.push({
                dx: x - origin.x,
                dy: y - origin.y,
                dz: z - origin.z,
                name: perm.type.id,
                states: states,
              });
            }
          }
        }
      }
    }
    CLIPBOARD.set(player.name, data);
    player.sendMessage(
      `§aSukses! ${data.length} blok tersimpan. (+undo paste tersedia)`,
    );
  } catch (e) {
    player.sendMessage(`§cGagal Copy: ${e.message}`);
  }
}

export function handlePaste(player) {
  if (getPlayerRoleLevel(player) < 30) return;

  const data = CLIPBOARD.get(player.name);
  if (!data || data.length === 0) {
    player.sendMessage("§cClipboard kosong.");
    return;
  }

  const target = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };

  // === LOGIKA BACKUP SEBELUM PASTE ===
  if (data.length <= UNDO_LIMIT) {
    player.sendMessage("§eBackup area sebelum paste...");
    const dim = player.dimension;
    const history = [];

    try {
      // Kita scan area yang akan ditimpa
      for (const item of data) {
        const absX = target.x + item.dx;
        const absY = target.y + item.dy;
        const absZ = target.z + item.dz;

        const block = dim.getBlock({ x: absX, y: absY, z: absZ });
        if (block) {
          const perm = block.permutation;
          if (perm) {
            history.push({
              x: absX,
              y: absY,
              z: absZ,
              name: perm.type ? perm.type.id : "minecraft:air",
              states: getPermutationStates(perm),
            });
          }
        }
      }
      // Simpan ke Undo Manager
      saveUndoHistory(player, history);
    } catch (e) {
      player.sendMessage("§cBackup gagal, Undo tidak tersedia.");
    }
  } else {
    player.sendMessage("§6[WARN] Paste terlalu besar, Undo dimatikan.");
  }

  // === EKSEKUSI PASTE ===
  player.sendMessage(`§eMenempelkan ${data.length} blok...`);
  let index = 0;
  const CHUNK_SIZE = 200;

  const pasteJob = system.runInterval(() => {
    const dim = player.dimension;
    for (let i = 0; i < CHUNK_SIZE; i++) {
      if (index >= data.length) {
        system.clearRun(pasteJob);
        player.sendMessage("§aPaste selesai! Ketik +undo jika salah.");
        player.playSound("random.levelup");
        return;
      }
      const blockData = data[index];
      const newX = target.x + blockData.dx;
      const newY = target.y + blockData.dy;
      const newZ = target.z + blockData.dz;
      try {
        const block = dim.getBlock({ x: newX, y: newY, z: newZ });
        if (block) {
          const perm = BlockPermutation.resolve(
            blockData.name,
            blockData.states,
          );
          block.setPermutation(perm);
        }
      } catch (e) { }
      index++;
    }
  }, 1);
}
