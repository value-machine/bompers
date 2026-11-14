import type { InputSource, SlotSources } from "@/shared/types/gameInput.types";
import { inputSourceKey } from "@/shared/utils/gameInputMapping";
import type { LobbySlots } from "@/features/lobby/types/lobby.types";

/** Free slots for `maxPlayers` players. */
export const createLobbySlots = (maxPlayers: number): LobbySlots =>
  Array.from({ length: maxPlayers }, () => null);

/** The slot `device` holds, or -1. */
export const slotOfDevice = (slots: LobbySlots, device: InputSource): number => {
  const key = inputSourceKey(device);
  return slots.findIndex((source) => source !== null && inputSourceKey(source) === key);
};

/**
 * `device` takes the first free slot (its colour and emblem). Unchanged when the device
 * already holds a slot or all slots are taken.
 */
export function claimSlot(slots: LobbySlots, device: InputSource): LobbySlots {
  if (slotOfDevice(slots, device) !== -1) return slots;
  const free = slots.indexOf(null);
  if (free === -1) return slots;
  return slots.map((source, index) => (index === free ? device : source));
}

/** Frees `slot`; the other players keep their slots (and colours). */
export const leaveSlot = (slots: LobbySlots, slot: number): LobbySlots =>
  slots[slot] ? slots.map((source, index) => (index === slot ? null : source)) : slots;

export const joinedCount = (slots: LobbySlots): number =>
  slots.filter((source) => source !== null).length;

/** The match's slot → device map: empty slots stay disconnected, so they never spawn. */
export const slotSources = (slots: LobbySlots): SlotSources => [...slots];

/** Short device name for the slot cards and the device strip. */
export const deviceLabel = (device: InputSource): string =>
  device.kind === "keyboard"
    ? device.layout === "left"
      ? "Left keys"
      : "Right keys"
    : `Pad ${device.padIndex + 1}`;

/** The device's join / leave keys (also its menu confirm / back). */
export const deviceKeys = (device: InputSource): { join: string; leave: string } => {
  if (device.kind === "gamepad") return { join: "A", leave: "B" };
  return device.layout === "left"
    ? { join: "Space", leave: "Q" }
    : { join: "Enter", leave: "Backspace" };
};
