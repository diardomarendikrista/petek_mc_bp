import { world } from "@minecraft/server";
import { getPlayerRoleLevel } from "../../core/utils.js";

// === VARIABLES (Runtime Memory) ===
// Data TPA hilang jika server restart (Wajar)
const tpaRequests = new Map(); // Key: TargetName, Value: RequesterName

// === LOGIKA FITUR PUBLIC ===
export function handleSpawn(player) {
  // 1. Ambil koordinat asli dari /setworldspawn
  const spawnPos = world.getDefaultSpawnLocation();
  const overworld = world.getDimension("minecraft:overworld");

  // Default target adalah apa adanya (sesuai settingan Admin)
  let targetY = spawnPos.y;

  // 2. Fallback (Hanya jika Y tidak masuk akal / jatuh ke Void)
  // Bedrock level terendah biasanya -64. Jika spawn diset < -60, mungkin bug/belum diset.
  if (targetY < -60) {
    try {
      const topBlock = overworld.getTopmostBlock({
        x: spawnPos.x,
        z: spawnPos.z,
      });
      if (topBlock) {
        targetY = topBlock.y + 1;
      } else {
        targetY = 80; // Safety net terakhir
      }
    } catch (e) { }
  }

  // 3. Eksekusi Teleport ke koordinat ASLI
  player.teleport(
    { x: spawnPos.x, y: targetY, z: spawnPos.z },
    { dimension: overworld },
  );

  // 4. Safety (Penting!)
  // Karena kita percaya 100% pada setworldspawn,
  // Jika spawn-nya di langit (Sky Lobby), kita kasih Slow Falling biar ga mati kalau lag.
  // Jika spawn-nya di dalam tanah (salah set), Resistance bikin player ga mati lemas.
  player.runCommand("effect @s slow_falling 10 1 true");
  player.runCommand("effect @s resistance 10 255 true");

  player.sendMessage("§a>> Teleport ke Loby Utama.");
  player.playSound("random.levelup");
}

export function handleTPA(player, targetName) {
  if (!targetName) {
    player.sendMessage("§cUsage: +tpa <NamaPlayer>");
    return;
  }
  const target = world.getPlayers({ name: targetName })[0];

  if (!target) {
    player.sendMessage("§cPlayer tidak ditemukan/Offline.");
    return;
  }
  if (target === player) {
    player.sendMessage("§cGak bisa TPA ke diri sendiri bang.");
    return;
  }

  // Simpan request (Target -> Pengirim)
  tpaRequests.set(target.name, player.name);

  player.sendMessage(`§e>> Request TPA dikirim ke ${target.name}.`);
  target.sendMessage(`§6[!] ${player.name} ingin teleport ke Anda.`);
  target.sendMessage(
    `§7Ketik §a+tpaccept §7untuk terima atau §c+tpdeny §7untuk tolak.`,
  );
  player.playSound("random.click");
  target.playSound("random.click");
}

export function handleTPAccept(player) {
  // Player menerima request dari orang lain
  const requesterName = tpaRequests.get(player.name);
  if (!requesterName) {
    player.sendMessage("§c>> Tidak ada request TPA masuk.");
    return;
  }

  const requester = world.getPlayers({ name: requesterName })[0];
  if (!requester) {
    player.sendMessage("§c>> Pengirim request sudah Offline.");
    return;
  }

  // Eksekusi Teleport
  requester.teleport(player.location, { dimension: player.dimension });

  requester.sendMessage(`§a>> Request diterima! Teleporting...`);
  player.sendMessage(`§a>> Menerima ${requester.name}.`);
  requester.playSound("mob.endermen.portal");

  tpaRequests.delete(player.name); // Hapus request setelah dipakai
}

export function handleTPDeny(player) {
  const requesterName = tpaRequests.get(player.name);
  if (!requesterName) {
    player.sendMessage("§c>> Tidak ada request TPA.");
    return;
  }

  const requester = world.getPlayers({ name: requesterName })[0];
  if (requester)
    requester.sendMessage(`§c>> Request TPA ditolak oleh ${player.name}.`);

  player.sendMessage("§e>> Request ditolak.");
  tpaRequests.delete(player.name);
}

export function handleDirectTP(player, targetName) {
  if (!targetName) {
    player.sendMessage("§cUsage: +tp <NamaPlayer>");
    return;
  }

  const target = world.getPlayers({ name: targetName })[0];

  if (!target) {
    player.sendMessage("§cPlayer offline/tidak ditemukan.");
    return;
  }

  // Eksekusi Teleport Langsung
  player.teleport(target.location, { dimension: target.dimension });

  player.sendMessage(`§a>> Woosh! Langsung teleport ke ${target.name}.`);
  player.playSound("mob.endermen.portal");
}

export function handleTeleportHere(admin, targetName) {
  const target = world.getPlayers({ name: targetName })[0];

  if (!target) {
    admin.sendMessage(`§cPlayer '${targetName}' tidak ditemukan/offline.`);
    return;
  }

  if (target.name === admin.name) {
    admin.sendMessage("§cGak bisa summon diri sendiri.");
    return;
  }

  // Cek Level: Jangan sampai Moderator summon Owner sembarangan (Etika)
  const adminLevel = getPlayerRoleLevel(admin);
  const targetLevel = getPlayerRoleLevel(target);

  if (targetLevel > adminLevel) {
    admin.sendMessage("§c[Security] Tidak bisa men-summon atasan!");
    return;
  }

  // Eksekusi
  target.teleport(admin.location, { dimension: admin.dimension });

  admin.sendMessage(`§a>> Berhasil menarik §e${target.name} §ake posisimu.`);
  target.sendMessage(`§e>> Anda dipanggil oleh Staff ${admin.name}.`);

  admin.playSound("mob.endermen.portal");
  target.playSound("mob.endermen.portal");
}
