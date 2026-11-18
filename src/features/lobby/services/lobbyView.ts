import type { GameTunables } from "@/shared/types/gameTunables.types";
import { INPUT_DEVICES, inputSourceKey } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { VOLUME_STEPS, type SoundSettings } from "@/features/sound/api/soundApi";
import { canStart, LOBBY_ROWS } from "@/features/lobby/services/lobbyMenu";
import {
  deviceKeys,
  deviceLabel,
  joinedCount,
  slotOfDevice,
} from "@/features/lobby/services/lobbySlots";
import {
  effectiveSettings,
  formatDuration,
  formatGravity,
  lobbyWeaponIds,
  type EffectiveSettings,
} from "@/features/lobby/services/matchSettings";
import type { LobbyContext, LobbyState, LobbyView } from "@/features/lobby/types/lobby.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { ALL_WEAPON_ITEM_IDS } from "@/shared/config/weaponItems";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";

const deviceIndexOf = (key: string): number =>
  INPUT_DEVICES.findIndex((device) => inputSourceKey(device) === key);

export interface LobbyViewArgs {
  tunables: GameTunables;
  context: LobbyContext;
  /** The level a round would play now, or null while none is playable. */
  level: LevelDefinition | null;
  /** The player's sound settings (volumes shown on the volume rows). */
  sound: SoundSettings;
}

type WeaponsView = Pick<LobbyView, "weapons" | "weaponsNote" | "weaponsLocked">;

/**
 * The crate toggles show what the round will really use: the lobby's choice, or the level's when
 * it sets its own (then locked, with a note). All on reads "All weapons" (auto), all off "No
 * weapons" (weapons-match-setting D6).
 */
function weaponsView(state: LobbyState, effective: EffectiveSettings | null): WeaponsView {
  const locked = effective?.weaponsSetByLevel ?? false;
  const on: readonly WeaponItemId[] = effective?.weaponIds ?? lobbyWeaponIds(state.settings);
  const onRow = LOBBY_ROWS[state.cursor] === "weapons";
  const weapons = ALL_WEAPON_ITEM_IDS.map((weaponId, index) => ({
    weaponId,
    label: resolveCatalogEntry("item", weaponId).entry?.label ?? weaponId,
    on: on.includes(weaponId),
    focused: onRow && index === state.weaponCursor,
  }));
  let weaponsNote: string | null = null;
  if (locked) weaponsNote = "Set by the level";
  else if (on.length === ALL_WEAPON_ITEM_IDS.length) weaponsNote = "All weapons";
  else if (on.length === 0) weaponsNote = "No weapons";
  return { weapons, weaponsNote, weaponsLocked: locked };
}

const formatVolume = (volume: number): string => String(Math.round(volume * VOLUME_STEPS));

export function lobbyView(
  state: LobbyState,
  { tunables, context, level, sound }: LobbyViewArgs
): LobbyView {
  const effective = level ? effectiveSettings(tunables, state.settings, level.settings) : null;
  const levelGravity = level?.settings.gravity ?? 1;
  return {
    players: joinedCount(state.slots),
    startable: canStart(state, context),
    focusedRow: LOBBY_ROWS[state.cursor] ?? "start",
    slots: state.slots.map((device, slot) => ({
      slot,
      deviceIndex: device ? deviceIndexOf(inputSourceKey(device)) : -1,
      deviceLabel: device ? deviceLabel(device) : null,
      leaveKey: device ? deviceKeys(device).leave : null,
    })),
    devices: INPUT_DEVICES.map((device) => ({
      key: inputSourceKey(device),
      label: deviceLabel(device),
      slot: slotOfDevice(state.slots, device),
    })),
    duration: formatDuration(state.settings.durationSeconds),
    gravity: formatGravity(state.settings.gravityScale),
    levelDuration: effective?.durationSetByLevel ? formatDuration(effective.durationSeconds) : null,
    ...weaponsView(state, effective),
    levelGravity:
      effective && levelGravity !== 1
        ? `${formatGravity(levelGravity)} = ${formatGravity(effective.gravityScale)}`
        : null,
    musicVolume: formatVolume(sound.musicVolume),
    sfxVolume: formatVolume(sound.sfxVolume),
  };
}
