import type { GameTunables } from "@/shared/types/gameTunables.types";
import { INPUT_DEVICES, inputSourceKey } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
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
} from "@/features/lobby/services/matchSettings";
import type { LobbyContext, LobbyState, LobbyView } from "@/features/lobby/types/lobby.types";

const deviceIndexOf = (key: string): number =>
  INPUT_DEVICES.findIndex((device) => inputSourceKey(device) === key);

export interface LobbyViewArgs {
  tunables: GameTunables;
  context: LobbyContext;
  /** The level a round would play now, or null while none is playable. */
  level: LevelDefinition | null;
}

export function lobbyView(
  state: LobbyState,
  { tunables, context, level }: LobbyViewArgs
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
    levelGravity:
      effective && levelGravity !== 1
        ? `${formatGravity(levelGravity)} = ${formatGravity(effective.gravityScale)}`
        : null,
  };
}
