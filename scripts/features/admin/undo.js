import { system, BlockPermutation } from "@minecraft/server";

const UNDO_HISTORY = new Map();
// Kita set limit 5000 blok agar server tidak berat
export const UNDO_LIMIT = 5000;

// === HELPER (Pindahan dari fill.js) ===
export function getPermutationStates(perm) {
  if (!perm) return {};
  if (typeof perm.getAllStates === "function") return perm.getAllStates();
  if (typeof perm.getStates === "function") return perm.getStates();
  if (perm.states && typeof perm.states === "object") return perm.states;
  return {};
}

// === FUNGSI MENYIMPAN RIWAYAT (Dipakai oleh Fill & Paste) ===
export function saveUndoHistory(player, historyData) {
  UNDO_HISTORY.set(player.name, historyData);
}

// === HANDLER UTAMA +undo ===
export function handleUndo(player) {
  // Cek Level minimal Builder (30)
  // (Kita asumsikan handler di commands.js sudah filter level, tapi cek lagi gak masalah)

  const history = UNDO_HISTORY.get(player.name);
  if (!history || history.length === 0) {
    player.sendMessage(
      "§cTidak ada riwayat aksi terakhir (atau sudah di-undo).",
    );
    return;
  }

  player.sendMessage(`§e[UNDO] Mengembalikan ${history.length} blok...`);

  // Hapus riwayat setelah dipakai (biar gak bisa undo berulang kali untuk aksi yg sama)
  UNDO_HISTORY.delete(player.name);

  let index = 0;
  const CHUNK_SIZE = 500;

  // Proses Restore (Cicil biar gak lag)
  const restoreJob = system.runInterval(() => {
    const dim = player.dimension;

    for (let i = 0; i < CHUNK_SIZE; i++) {
      if (index >= history.length) {
        system.clearRun(restoreJob);
        player.sendMessage("§aUndo selesai!");
        player.playSound("random.orb");
        return;
      }

      const data = history[index];
      try {
        const block = dim.getBlock({ x: data.x, y: data.y, z: data.z });
        if (block) {
          // Resolve blok dari nama & states
          const restoredPerm = BlockPermutation.resolve(data.name, data.states);
          block.setPermutation(restoredPerm);
        }
      } catch (e) {
        // Skip error
      }
      index++;
    }
  }, 1);
}
