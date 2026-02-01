import { MODES } from "../../core/config.js";

// === LOGIKA EFEK & MODE (Standard) ===
export function toggleEffect(
  player,
  tagMode,
  effectName,
  amplifier,
  msgPrefix,
) {
  if (!player.hasTag(tagMode)) {
    player.addTag(tagMode);
    player.runCommand(`effect @s ${effectName} 99999 ${amplifier} true`);
    player.sendMessage(`${msgPrefix}: §aAKTIF`);
    if (tagMode === MODES.VANISH)
      player.sendMessage("§7(Anda menghilang dari pandangan)");
  } else {
    player.removeTag(tagMode);
    player.runCommand(`effect @s ${effectName} 0`);
    if (effectName === "speed" && player.hasTag(MODES.FLY)) {
      player.runCommand("effect @s speed 99999 2 true");
    }
    player.sendMessage(`${msgPrefix}: §cNON-AKTIF`);
  }
}

export function handleSuperheroJump(player) {
  if (!player.hasTag(MODES.FLY)) {
    player.addTag(MODES.FLY);
    player.runCommand("effect @s jump_boost 99999 4 true");
    player.runCommand("effect @s slow_falling 99999 0 true");
    player.runCommand("effect @s speed 99999 2 true");
    player.sendMessage("§6>> VVIP Flight: §aAKTIF (Superhero Mode) 🦸");
  } else {
    player.removeTag(MODES.FLY);
    player.runCommand("effect @s jump_boost 0");
    player.runCommand("effect @s slow_falling 0");
    if (player.hasTag(MODES.SPEED)) {
      player.runCommand("effect @s speed 99999 1 true");
    } else {
      player.runCommand("effect @s speed 0");
    }
    player.sendMessage("§6>> VVIP Flight: §cNON-AKTIF");
  }
}
