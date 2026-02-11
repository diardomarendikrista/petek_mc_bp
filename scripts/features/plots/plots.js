import { world, system } from "@minecraft/server";
import { getPlayerRoleLevel } from "../../core/utils.js";
import { addMoney, formatMoney, getBalance } from "../economy/economy.js";
import { BANNED_MOBS } from "../../core/config.js";

// === KONFIGURASI ===
const CONF = {
  CENTER_X: 150000,
  CENTER_Z: 150000,
  PLOT_SIZE: 32,
  ROAD_WIDTH: 5,
  WORLD_LIMIT: 50,
  MAX_PLOTS_PER_PLAYER: 1,
  DIMENSION: "minecraft:overworld",

  PLOT_PRICE: 100,

  // === PALET ===
  BLOCK_ROAD: "minecraft:cobblestone",
  BLOCK_PLOT: "minecraft:grass_block",
  BLOCK_SLAB: "minecraft:stone_slab",
  BLOCK_BASE: "minecraft:bedrock",
  BLOCK_FILLER: "minecraft:dirt",
  BLOCK_AIR: "minecraft:air",
};

const PLOT_ZONE_RADIUS = 20000;

const CELL_SIZE = CONF.PLOT_SIZE + CONF.ROAD_WIDTH;
const delay = (ticks) =>
  new Promise((resolve) => system.runTimeout(resolve, ticks));

export function getPlotAt(location) {
  const relX = Math.floor(location.x) - CONF.CENTER_X;
  const relZ = Math.floor(location.z) - CONF.CENTER_Z;
  const gridX = Math.floor(relX / CELL_SIZE);
  const gridZ = Math.floor(relZ / CELL_SIZE);
  const modX = ((relX % CELL_SIZE) + CELL_SIZE) % CELL_SIZE;
  const modZ = ((relZ % CELL_SIZE) + CELL_SIZE) % CELL_SIZE;
  const isRoadX = modX >= CONF.PLOT_SIZE;
  const isRoadZ = modZ >= CONF.PLOT_SIZE;
  const isRoad = isRoadX || isRoadZ;
  const isSpawn = gridX === 0 && gridZ === 0;
  const isBorder =
    Math.abs(gridX) > CONF.WORLD_LIMIT || Math.abs(gridZ) > CONF.WORLD_LIMIT;

  return {
    id: `${gridX}_${gridZ}`,
    display: `Plot [${gridX},${gridZ}]`,
    isRoad: isRoad,
    isSpawn: isSpawn,
    isBorder: isBorder,
    gridX,
    gridZ,
  };
}

// === DATABASE HELPERS ===
export function getPlotOwner(plotID) {
  return world.getDynamicProperty(`plot_${plotID}`);
}
function setPlotOwner(plotID, name) {
  world.setDynamicProperty(`plot_${plotID}`, name);
}
function getPlayerOwnedPlots(playerName) {
  const rawData = world.getDynamicProperty(`owned_plots_${playerName}`);
  if (!rawData) return []; // Belum punya plot
  try {
    return JSON.parse(rawData); // Parse dari String JSON ke Array ["1_1", "2_2"]
  } catch (e) {
    return [];
  }
}
function addPlayerPlot(playerName, plotID) {
  const plots = getPlayerOwnedPlots(playerName);
  if (!plots.includes(plotID)) {
    plots.push(plotID);
    world.setDynamicProperty(
      `owned_plots_${playerName}`,
      JSON.stringify(plots),
    );
  }
}
function removePlayerPlot(playerName, plotID) {
  let plots = getPlayerOwnedPlots(playerName);
  plots = plots.filter((id) => id !== plotID); // Hapus ID yg cocok
  world.setDynamicProperty(`owned_plots_${playerName}`, JSON.stringify(plots));
}
function setPlayerOwnedPlot(playerName, plotID) {
  world.setDynamicProperty(`owned_plot_${playerName}`, plotID);
}

// === FITUR DARURAT: RESET DATABASE (Admin Only) ===
export function handleResetAllPlots(player) {
  if (getPlayerRoleLevel(player) < 99) return;
  player.sendMessage("§e[SYSTEM] Resetting database...");
  const ids = world.getDynamicPropertyIds();
  let count = 0;
  for (const id of ids) {
    // Hapus plot_X_Y dan owned_plots_Nama
    if (
      id.startsWith("plot_") ||
      id.startsWith("owned_plots_") ||
      id.startsWith("owned_plot_")
    ) {
      world.setDynamicProperty(id, undefined);
      count++;
    }
  }
  player.sendMessage(`§a[SUKSES] Reset ${count} data.`);
}

const plotWarningCooldowns = new Map();

export function checkPlotProtection(player, blockLoc) {
  if (getPlayerRoleLevel(player) >= 30) return true;
  const info = getPlotAt(blockLoc);

  const sendWarning = (msg) => {
    const now = Date.now();
    const last = plotWarningCooldowns.get(player.name) || 0;
    if (now - last > 750) {
      player.sendMessage(msg);
      plotWarningCooldowns.set(player.name, now);
    }
  };

  if (info.isBorder) {
    sendWarning("§cBatas Dunia Plot.");
    return false;
  }
  if (info.isSpawn) {
    sendWarning("§cArea Spawn/Loby dilindungi.");
    return false;
  }
  if (info.isRoad) {
    sendWarning("§cJangan rusak jalan umum.");
    return false;
  }

  const owner = getPlotOwner(info.id);
  if (!owner) {
    sendWarning("§7Plot ini belum ada pemilik. Ketik §a+claim");
    return false;
  }
  if (owner !== player.name) {
    sendWarning(`§cIni wilayah milik ${owner}.`);
    return false;
  }
  return true;
}

// === GENERATOR (SMART INFRASTRUCTURE MODE) ===
export function handleGenPlot(player, radiusStr) {
  if (!player.hasTag("OP")) {
    player.sendMessage("§cKhusus OP!");
    return;
  }

  const args = radiusStr.split(" ");
  const radius = args[0] !== undefined && args[0] !== "" ? parseInt(args[0]) : 1;
  const isForce = args[1] === "force";

  if (radius > 5) {
    player.sendMessage("§cRadius max 5!");
    return;
  }

  const startLoc = {
    x: player.location.x,
    y: player.location.y,
    z: player.location.z,
  };

  player.sendMessage(`§eTerraforming radius ${radius}... (Flat Mode)`);
  if (isForce) player.sendMessage("§c[!] MODE FORCE: Hapus paksa!");

  system.run(async () => {
    try {
      const centerInfo = getPlotAt(player.location);
      let created = 0;
      let maintained = 0;
      let skipped = 0;
      const Y_FLOOR = 64; // Lantai dasar

      const runFill = async (x1, y1, z1, x2, y2, z2, blockName) => {
        const minX = Math.floor(Math.min(x1, x2)),
          maxX = Math.floor(Math.max(x1, x2));
        const minY = Math.floor(Math.min(y1, y2)),
          maxY = Math.floor(Math.max(y1, y2));
        const minZ = Math.floor(Math.min(z1, z2)),
          maxZ = Math.floor(Math.max(z1, z2));
        const cmd = `fill ${minX} ${minY} ${minZ} ${maxX} ${maxY} ${maxZ} ${blockName} replace`;
        try {
          await player.runCommand(cmd);
        } catch (e) { }
      };

      for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
          const currentGridX = centerInfo.gridX + x;
          const currentGridZ = centerInfo.gridZ + z;

          const startX = CONF.CENTER_X + currentGridX * CELL_SIZE;
          const startZ = CONF.CENTER_Z + currentGridZ * CELL_SIZE;
          const centerX = startX + CELL_SIZE / 2;
          const centerZ = startZ + CELL_SIZE / 2;

          const targetInfo = getPlotAt({ x: centerX, z: centerZ });
          const plotID = targetInfo.id;
          const owner = getPlotOwner(plotID);

          // Teleport load chunk
          player.teleport({ x: centerX, y: Y_FLOOR + 5, z: centerZ });
          await delay(5);

          if (owner && !isForce) {
            // === MAINTENANCE MODE (Cuma Rapikan Jalan) ===
            // Jalan Kanan
            await runFill(
              startX + CONF.PLOT_SIZE,
              Y_FLOOR,
              startZ,
              startX + CELL_SIZE - 1,
              Y_FLOOR,
              startZ + CELL_SIZE - 1,
              CONF.BLOCK_ROAD,
            );
            // Jalan Bawah
            await runFill(
              startX,
              Y_FLOOR,
              startZ + CONF.PLOT_SIZE,
              startX + CELL_SIZE - 1,
              Y_FLOOR,
              startZ + CELL_SIZE - 1,
              CONF.BLOCK_ROAD,
            );

            player.sendMessage(`§e[SKIP] Plot ${plotID} milik ${owner} aman.`);
            maintained++;
          } else {
            // === NEW BUILD MODE (Ratakan Semua) ===
            if (targetInfo.isSpawn && !isForce) {
              skipped++;
              continue;
            }

            // 1. Clear Air (Looping sampai Y=320)
            let currentAirY = Y_FLOOR + 1;
            const MAX_HEIGHT = 320;
            while (currentAirY < MAX_HEIGHT) {
              let nextY = currentAirY + 20;
              if (nextY > MAX_HEIGHT) nextY = MAX_HEIGHT;
              await runFill(
                startX,
                currentAirY,
                startZ,
                startX + CELL_SIZE - 1,
                nextY,
                startZ + CELL_SIZE - 1,
                CONF.BLOCK_AIR,
              );
              currentAirY = nextY;
            }

            // 2. Pondasi (Bedrock & Filler)
            await runFill(
              startX,
              Y_FLOOR - 5,
              startZ,
              startX + CELL_SIZE - 1,
              Y_FLOOR - 5,
              startZ + CELL_SIZE - 1,
              CONF.BLOCK_BASE,
            );
            await runFill(
              startX,
              Y_FLOOR - 4,
              startZ,
              startX + CELL_SIZE - 1,
              Y_FLOOR - 1,
              startZ + CELL_SIZE - 1,
              CONF.BLOCK_FILLER,
            );

            // 3. Surface Plot (Rumput)
            await runFill(
              startX,
              Y_FLOOR,
              startZ,
              startX + CONF.PLOT_SIZE - 1,
              Y_FLOOR,
              startZ + CONF.PLOT_SIZE - 1,
              CONF.BLOCK_PLOT,
            );

            // 4. Surface Jalan (Rumput juga, sesuai request)
            await runFill(
              startX + CONF.PLOT_SIZE,
              Y_FLOOR,
              startZ,
              startX + CELL_SIZE - 1,
              Y_FLOOR,
              startZ + CELL_SIZE - 1,
              CONF.BLOCK_ROAD,
            );
            await runFill(
              startX,
              Y_FLOOR,
              startZ + CONF.PLOT_SIZE,
              startX + CELL_SIZE - 1,
              Y_FLOOR,
              startZ + CELL_SIZE - 1,
              CONF.BLOCK_ROAD,
            );

            // 5. Slab Pembatas (Di atas Rumput, Y+1)
            const slabY = Y_FLOOR + 1;
            await runFill(
              startX,
              slabY,
              startZ,
              startX + CONF.PLOT_SIZE - 1,
              slabY,
              startZ + CONF.PLOT_SIZE - 1,
              CONF.BLOCK_SLAB,
            );
            // Lubangi tengah slab (Area rumah)
            await runFill(
              startX + 1,
              slabY,
              startZ + 1,
              startX + CONF.PLOT_SIZE - 2,
              slabY,
              startZ + CONF.PLOT_SIZE - 2,
              CONF.BLOCK_AIR,
            );

            created++;
          }
        }
      }

      player.teleport(startLoc);
      player.sendMessage(
        `§aSelesai! Created: ${created}, Fixed: ${maintained}, Skipped: ${skipped}.`,
      );
    } catch (err) {
      player.sendMessage(`§cError: ${err.message}`);
    }
  });
}

// === RESET PLOT COMMAND (User safe) ===
export function handleResetPlot(player) {
  const info = getPlotAt(player.location);

  if (info.isRoad || info.isSpawn || info.isBorder) {
    player.sendMessage("§cKamu harus berdiri di dalam plot milikmu.");
    return;
  }

  const owner = getPlotOwner(info.id);
  if (owner !== player.name && !player.hasTag("OP")) {
    player.sendMessage("§cIni bukan plot milikmu!");
    return;
  }

  player.sendMessage(
    `§eSedang me-reset plot [${info.gridX},${info.gridZ}]...`,
  );

  system.run(async () => {
    try {
      const Y_FLOOR = 64;

      const runFill = async (x1, y1, z1, x2, y2, z2, blockName) => {
        const minX = Math.floor(Math.min(x1, x2)),
          maxX = Math.floor(Math.max(x1, x2));
        const minY = Math.floor(Math.min(y1, y2)),
          maxY = Math.floor(Math.max(y1, y2));
        const minZ = Math.floor(Math.min(z1, z2)),
          maxZ = Math.floor(Math.max(z1, z2));

        // GUNAKAN DIMENSION COMMAND (Server Context) agar user biasa bisa run fill
        // NOTE: Asumsi 'dimension.runCommand' tersedia sync atau 'dimension.runCommandAsync' tidak jalan.
        // User minta "Existing Method" tapi Existing Method (player.runCommand) butuh OP.
        // Solusi: Kita pakai player.dimension.runCommand (Sync) jika bisa. 
        // JIKE TIDAK: Kita tetap pakai player.runCommand tapi user harus sadar ini butuh OP/Cheats.
        // Namun, user bilang "add resetPlot to all player".
        // Saya coba pakai `player.dimension.runCommand` (Versi sync dari runCommandAsync).

        const cmd = `fill ${minX} ${minY} ${minZ} ${maxX} ${maxY} ${maxZ} ${blockName} replace`;
        try {
          // Fallback ke player.runCommand jika dimension fail, atau sebaliknya.
          // Kita coba dimensi dulu.
          await player.dimension.runCommand(cmd);
        } catch (e) {
          // If sync command fails (API differ), try player command as backup (will fail if no OP)
          await player.runCommand(cmd);
        }
      };

      const startX = CONF.CENTER_X + info.gridX * CELL_SIZE;
      const startZ = CONF.CENTER_Z + info.gridZ * CELL_SIZE;

      // === LOGIK RESET (MIMIC GENPLOT) ===

      // 1. Clear Air
      let currentAirY = Y_FLOOR + 1;
      const MAX_HEIGHT = 320;
      while (currentAirY < MAX_HEIGHT) {
        let nextY = currentAirY + 20;
        if (nextY > MAX_HEIGHT) nextY = MAX_HEIGHT;
        await runFill(
          startX,
          currentAirY,
          startZ,
          startX + CELL_SIZE - 1,
          nextY,
          startZ + CELL_SIZE - 1,
          CONF.BLOCK_AIR,
        );
        currentAirY = nextY;
      }

      // 2. Pondasi (Bedrock & Filler)
      await runFill(
        startX,
        Y_FLOOR - 5,
        startZ,
        startX + CELL_SIZE - 1,
        Y_FLOOR - 5,
        startZ + CELL_SIZE - 1,
        CONF.BLOCK_BASE,
      );
      await runFill(
        startX,
        Y_FLOOR - 4,
        startZ,
        startX + CELL_SIZE - 1,
        Y_FLOOR - 1,
        startZ + CELL_SIZE - 1,
        CONF.BLOCK_FILLER,
      );

      // 3. Surface Plot (Rumput)
      await runFill(
        startX,
        Y_FLOOR,
        startZ,
        startX + CONF.PLOT_SIZE - 1,
        Y_FLOOR,
        startZ + CONF.PLOT_SIZE - 1,
        CONF.BLOCK_PLOT,
      );

      // 4. Surface Jalan (Rumput/Road)
      await runFill(
        startX + CONF.PLOT_SIZE,
        Y_FLOOR,
        startZ,
        startX + CELL_SIZE - 1,
        Y_FLOOR,
        startZ + CELL_SIZE - 1,
        CONF.BLOCK_ROAD,
      );
      await runFill(
        startX,
        Y_FLOOR,
        startZ + CONF.PLOT_SIZE,
        startX + CELL_SIZE - 1,
        Y_FLOOR,
        startZ + CELL_SIZE - 1,
        CONF.BLOCK_ROAD,
      );

      // 5. Slab Pembatas (Di atas Rumput, Y+1)
      const slabY = Y_FLOOR + 1;
      await runFill(
        startX,
        slabY,
        startZ,
        startX + CONF.PLOT_SIZE - 1,
        slabY,
        startZ + CONF.PLOT_SIZE - 1,
        CONF.BLOCK_SLAB,
      );
      // Lubangi tengah slab (Area rumah)
      await runFill(
        startX + 1,
        slabY,
        startZ + 1,
        startX + CONF.PLOT_SIZE - 2,
        slabY,
        startZ + CONF.PLOT_SIZE - 2,
        CONF.BLOCK_AIR,
      );

      player.sendMessage(`§aPlot berhasil di-reset ke kondisi awal!`);
      player.playSound("random.levelup");
    } catch (e) {
      player.sendMessage("§cGagal reset: " + e);
    }
  });
}

// === HANDLER CLAIM & UNCLAIM ===
export function handleClaim(player) {
  if (player.dimension.id !== CONF.DIMENSION) return;
  const info = getPlotAt(player.location);

  if (info.isSpawn || info.isRoad) {
    player.sendMessage("§cJalan/Spawn tidak bisa diclaim!");
    return;
  }

  // 1. Cek Pemilik
  const currentOwner = getPlotOwner(info.id);
  if (currentOwner) {
    player.sendMessage(
      currentOwner === player.name
        ? "§eIni sudah milikmu."
        : `§cIni milik ${currentOwner}.`,
    );
    return;
  }

  // 2. Cek Limit & UANG (Kecuali OP)
  if (!player.hasTag("OP")) {
    // A. Cek Limit
    const myPlots = getPlayerOwnedPlots(player.name);
    if (myPlots.length >= CONF.MAX_PLOTS_PER_PLAYER) {
      player.sendMessage(
        `§c[GAGAL] Batas Maksimal: ${CONF.MAX_PLOTS_PER_PLAYER} Plot.`,
      );
      return;
    }

    // B. CEK UANG (ANT-INFLASI)
    const myMoney = getBalance(player);
    const price = CONF.PLOT_PRICE;

    if (myMoney < price) {
      player.sendMessage(`§c[MISKIN] Uang tidak cukup!`);
      player.sendMessage(`§7Harga Tanah: §e${formatMoney(price)}`);
      player.sendMessage(`§7Uang Kamu: §c${formatMoney(myMoney)}`);
      return;
    }

    // POTONG UANG
    addMoney(player, -price);
    player.sendMessage(
      `§eMembayar ${formatMoney(price)} untuk membeli tanah...`,
    );
  } else {
    player.sendMessage("§e[OP] Claim gratis (Bypass harga).");
  }

  // 3. Proses Claim
  setPlotOwner(info.id, player.name);
  addPlayerPlot(player.name, info.id);

  player.sendMessage(`§aSukses Claim Plot ${info.display}!`);
  player.playSound("random.orb");
}

export function handleUnclaim(player) {
  const info = getPlotAt(player.location);
  const owner = getPlotOwner(info.id);

  if (!owner) {
    player.sendMessage("§cPlot ini bebas.");
    return;
  }
  const isAdmin = player.hasTag("OP");
  if (owner !== player.name && !isAdmin) {
    player.sendMessage("§cBukan plot kamu!");
    return;
  }

  // Proses Hapus
  setPlotOwner(info.id, undefined);
  removePlayerPlot(owner, info.id); // Hapus dari list pemilik aslinya

  player.sendMessage(`§ePlot ${info.display} berhasil di-unclaim.`);
  player.playSound("random.break");
}

export function handleWarpPlot(player) {
  player.teleport(
    { x: CONF.CENTER_X + 2, y: 65, z: CONF.CENTER_Z + 2 },
    { dimension: world.getDimension(CONF.DIMENSION) },
  );
  player.sendMessage("§aTeleport ke Plot...");
}

export function handlePurgePlots(player, daysStr) {
  if (!player.hasTag("OP")) return;
  const days = parseInt(daysStr);
  if (isNaN(days)) return;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - days * MS_PER_DAY;
  let count = 0;
  const allKeys = world.getDynamicPropertyIds();

  for (const key of allKeys) {
    if (key.startsWith("plot_")) {
      const ownerName = world.getDynamicProperty(key);
      if (ownerName) {
        const lastSeen = world.getDynamicProperty(`last_seen_${ownerName}`);
        if (lastSeen && lastSeen < cutoffTime) {
          const plotID = key.replace("plot_", "");

          // Hapus Tanah
          world.setDynamicProperty(key, undefined);

          // Hapus dari List Player
          removePlayerPlot(ownerName, plotID);

          player.sendMessage(`§7- Gusur plot [${plotID}] milik ${ownerName}.`);
          count++;
        }
      }
    }
  }
  if (count > 0) player.sendMessage(`§a[SUKSES] ${count} plot dibebaskan.`);
}

// =========================================
// === CEK AREA PROTEKSI ===
// =========================================

export function isInsidePlotZone(location) {
  const distX = Math.abs(location.x - CONF.CENTER_X);
  const distZ = Math.abs(location.z - CONF.CENTER_Z);
  return distX < PLOT_ZONE_RADIUS && distZ < PLOT_ZONE_RADIUS;
}

// =========================================
// === ANTI-MOB SYSTEM (DOUBLE LAYER) ===
// =========================================

import { checkCustomProtection, isZoneProtected, getProtectionFlags } from "../admin/protection.js";

// LAYER 1: Event Listener (Cegah saat baru lahir)
world.afterEvents.entitySpawn.subscribe((ev) => {
  const entity = ev.entity;
  try {
    if (BANNED_MOBS.includes(entity.typeId)) {
      // Cek Flags
      const flags = getProtectionFlags(entity.location, entity.dimension.id);

      // Logic: Hapus jika di Plot Zone ATAU di Custom Zone yang hostile=false
      if (
        (entity.dimension.id === CONF.DIMENSION && isInsidePlotZone(entity.location)) ||
        !flags.hostile
      ) {
        entity.remove();
      }
    }
  } catch (e) { }
});

// LAYER 2: The Smart Sweeper (Optimized)
// Jalan setiap 5 detik (100 ticks) tapi HANYA mengambil monster.
system.runInterval(() => {
  try {
    const dim = world.getDimension(CONF.DIMENSION);
    if (!dim) return;

    // OPTIMASI DISINI:
    // Kita minta engine cuma kasih entity yang keluarganya "monster".
    // Ini otomatis mengabaikan Item Drop, Sapi, Domba, Player, dll.
    const targets = dim.getEntities({
      families: ["monster"],
    });

    // Loop ini sekarang sangat ringan karena isinya cuma sedikit (hanya monster yang lolos)
    for (const entity of targets) {
      // Validasi ganda: Pastikan ID nya memang ada di BANNED_MOBS
      // (Jaga-jaga kalau ada mob "monster" yang baik/custom addon)
      if (BANNED_MOBS.includes(entity.typeId)) {
        const flags = getProtectionFlags(entity.location, entity.dimension.id);

        // Logic Sama: PlotZone OR !hostile
        if (isInsidePlotZone(entity.location) || !flags.hostile) {
          entity.remove();
        }
      }
    }
  } catch (e) {
    // Abaikan error
  }
}, 100);
