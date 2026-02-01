# Petek MC Mod

**Core Server: Plots, Protection, Warps & Ranks System.**

This behavior pack implements the core systems for the Petek MC Server, providing plotting, economy, protection, and a tiered VIP system for Minecraft Bedrock Edition.

## Features

### 🛡️ Protection & Zones

- **Plot Protection:** Players can claim plots where other players cannot break or place blocks without permission.
- **Admin/Custom Zones:** Special areas defined by administrators (e.g., Lobby, Spawn) with strict protection rules.
- **Anti-Grief:**
  - Prevents explosions (TNT, Creeper, Wither) in protected zones.
  - Prevents dangerous fluid placement bucket usage (Lava, Water, etc.) in protected plots.
  - Limits usage of dangerous items (e.g., End Crystals, TNT) to VVIP+ players or allowed zones.
- **Entity Protection:** Prevents interaction with Item Frames, Armor Stands, and Paintings in protected areas.

### 💰 Economy & Shop

- **Economy System:** Integrated currency system.
- **Shop Signs:** Interactive sign-based shop for buying and selling items.

### 🌟 VIP & VVIP System

A tiered rank system offering exclusive perks:

- **VIP (Level 10+):**
  - **Heal:** Restore health instantly.
  - **Feed:** Fill hunger bar.
  - **Night Vision:** Toggle "Eye of the Eagle" effect.
- **VVIP (Level 20+):**
  - All VIP features.
  - **Super Jump:** High jump ability (fly-like).
  - **Flash Speed:** Increased movement speed.
  - **Teleport:** Access to a menu to directly teleport to other players.

### 🔧 General Utilities

- **Menu System:** Accessible via Item Interaction (Stick).
- **AFK Tracker:** Monitors player activity and tracks playtime.
- **Ban System:** Timed ban enforcement with auto-kick logic.
- **Welcome Message:** Informational join messages and detailed instructions on how to use the menu.
- **Death Handler:** Custom logic handling player deaths (e.g., for back commands).

## Usage

### 🎮 Controls

- **Open Main Menu:** Hold a **Stick** and **Right-Click** (Windows) or **Long Press** (Mobile).

### 📋 Requirements

- **Minecraft Bedrock Edition**
- **Script API Version:**
  - `@minecraft/server`: `2.5.0-beta`
  - `@minecraft/server-ui`: `2.1.0-beta`

## Setup & Installation

1. Install the Behavior Pack in your world's `behavior_packs` folder.
2. Enable the behavior pack in your world settings.
3. Ensure "Beta APIs" are enabled in Experiments if required by the specific version of Minecraft.
4. Reload the world.
