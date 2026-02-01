import { world, system } from "@minecraft/server";
import { getSelection } from "../general/selection.js"; // Sesuaikan path import
import { getPlayerRoleLevel } from "../../core/utils.js"; // Sesuaikan path import
import { saveUndoHistory, UNDO_LIMIT } from "./undo.js"; // Sesuaikan path import

// Helper untuk delay (penting agar chunk sempat loading setelah teleport)
const delay = (ticks) =>
  new Promise((resolve) => system.runTimeout(resolve, ticks));

export function handleFill(player, args) {
  // 1. Cek Permission
  if (getPlayerRoleLevel(player) < 30) {
    player.sendMessage("§cKhusus Builder (Level 30+).");
    return;
  }

  // 2. Parse Arguments
  if (!args) {
    player.sendMessage(
      "§cUsage: +fill <BlockName> [data/state] [replace] [Target]",
    );
    return;
  }

  // 3. Cek Selection
  const sel = getSelection(player);
  if (!sel) {
    player.sendMessage("§cKamu belum set +pos1 dan +pos2!");
    return;
  }

  // 4. Hitung Volume
  const width = Math.abs(sel.max.x - sel.min.x) + 1;
  const height = Math.abs(sel.max.y - sel.min.y) + 1;
  const length = Math.abs(sel.max.z - sel.min.z) + 1;
  const volume = width * height * length;

  // 5. Logika Eksekusi
  // Batas aman fill vanilla sekitar 32768.
  // Jika di bawah itu DAN di bawah limit undo, kita backup.
  if (volume <= 32768 && volume <= UNDO_LIMIT) {
    player.sendMessage(`§eMenganalisa ${volume} blok untuk backup...`);
    system.run(() => {
      backupAndFill(player, sel, args);
    });
  } else {
    // Jika area SANGAT BESAR, matikan Undo dan pakai metode Chunking + Teleport
    player.sendMessage(
      `§6[WARN] Area besar (${volume}). Undo OFF. Mode Chunking aktif...`,
    );
    // Jalankan sebagai async agar bisa pakai await delay()
    system.run(() => {
      fillLargeArea(player, sel, args);
    });
  }
}

// === FUNGSI FILL BIASA (DENGAN UNDO) ===
function backupAndFill(player, sel, fillArgs) {
  const dim = player.dimension;
  const history = [];

  try {
    // Proses Backup (Hanya jika area kecil)
    for (let x = sel.min.x; x <= sel.max.x; x++) {
      for (let y = sel.min.y; y <= sel.max.y; y++) {
        for (let z = sel.min.z; z <= sel.max.z; z++) {
          const block = dim.getBlock({ x, y, z });
          if (block) {
            const perm = block.permutation;
            if (perm) {
              // Simpan state sederhana untuk hemat memori
              history.push({
                x,
                y,
                z,
                name: perm.type.id,
                states: perm.getAllStates(),
              });
            }
          }
        }
      }
    }

    // Simpan ke Undo
    saveUndoHistory(player, history);

    // Eksekusi Fill Biasa
    const cmd = `fill ${sel.min.x} ${sel.min.y} ${sel.min.z} ${sel.max.x} ${sel.max.y} ${sel.max.z} ${fillArgs}`;
    player.runCommand(cmd); // Versi sinkron
    player.sendMessage(`§aBerhasil fill! Ketik §e+undo §ajika keliru.`);
  } catch (e) {
    player.sendMessage(`§cGagal: ${e.message}`);
  }
}

// === FUNGSI BARU: CHUNKING + TELEPORT (LOGIKA GENPLOT) ===
async function fillLargeArea(player, sel, fillArgs) {
  const CHUNK_SIZE = 32; // Ukuran kubus per proses (32x32x32 = 32,768 blok, batas aman)
  const startLoc = {
    x: player.location.x,
    y: player.location.y,
    z: player.location.z,
  };

  let processedChunks = 0;

  try {
    // Loop X
    for (let x = sel.min.x; x <= sel.max.x; x += CHUNK_SIZE) {
      // Loop Y (Penting! Agar menara tinggi ter-cover)
      for (let y = sel.min.y; y <= sel.max.y; y += CHUNK_SIZE) {
        // Loop Z
        for (let z = sel.min.z; z <= sel.max.z; z += CHUNK_SIZE) {
          // 1. Hitung koordinat akhir chunk ini
          // Pakai Math.min agar tidak melebihi batas seleksi user (+pos2)
          const x2 = Math.min(x + CHUNK_SIZE - 1, sel.max.x);
          const y2 = Math.min(y + CHUNK_SIZE - 1, sel.max.y);
          const z2 = Math.min(z + CHUNK_SIZE - 1, sel.max.z);

          // 2. Hitung titik tengah chunk untuk teleport
          const centerX = (x + x2) / 2;
          const centerY = (y + y2) / 2;
          const centerZ = (z + z2) / 2;

          // 3. Teleport Player ke dekat area agar chunk loading
          // Kita naikkan Y sedikit agar player tidak terjebak di dalam blok
          player.teleport({ x: centerX, y: centerY + 5, z: centerZ });

          // 4. Tunggu sebentar (Logic dari GenPlot)
          // 2-5 ticks biasanya cukup untuk server lokal. Kalau server lag, naikkan jadi 10.
          await delay(4);

          // 5. Jalankan command fill
          const cmd = `fill ${x} ${y} ${z} ${x2} ${y2} ${z2} ${fillArgs}`;

          try {
            player.runCommand(cmd);
          } catch (cmdErr) {
            // Abaikan error "Cannot place blocks outside of world" yang wajar di edge case
            // Atau log jika perlu
          }

          processedChunks++;
        }
      }
    }

    // 6. Kembalikan player ke posisi awal
    player.teleport(startLoc);
    player.sendMessage(
      `§aSelesai! Area diproses dalam ${processedChunks} bagian.`,
    );
  } catch (err) {
    player.sendMessage(`§cTerhenti karena error: ${err.message}`);
    // Tetap kembalikan player jika error
    player.teleport(startLoc);
  }
}
