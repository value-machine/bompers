import { describe, expect, it } from "vitest";
import type { InputSource } from "@/shared/types/gameInput.types";
import {
  claimSlot,
  createLobbySlots,
  deviceKeys,
  deviceLabel,
  joinedCount,
  leaveSlot,
  slotOfDevice,
  slotSources,
} from "@/features/lobby/services/lobbySlots";

const LEFT: InputSource = { kind: "keyboard", layout: "left" };
const RIGHT: InputSource = { kind: "keyboard", layout: "right" };
const pad = (padIndex: number): InputSource => ({ kind: "gamepad", padIndex });

describe("lobbySlots", () => {
  it("should give each new device the first free slot when devices join", () => {
    let slots = createLobbySlots(4);
    slots = claimSlot(slots, RIGHT);
    slots = claimSlot(slots, pad(2));
    expect(slots).toEqual([RIGHT, pad(2), null, null]);
    expect(slotOfDevice(slots, pad(2))).toBe(1);
    expect(joinedCount(slots)).toBe(2);
  });

  it("should keep the same slots when a device that already joined presses join again", () => {
    const slots = claimSlot(createLobbySlots(4), LEFT);
    expect(claimSlot(slots, { kind: "keyboard", layout: "left" })).toBe(slots);
  });

  it("should refuse a fifth device when all four slots are taken", () => {
    const full = [LEFT, RIGHT, pad(0), pad(1)].reduce(claimSlot, createLobbySlots(4));
    expect(claimSlot(full, pad(3))).toBe(full);
  });

  it("should free only the leaving slot and reuse it for the next joiner when a player leaves", () => {
    let slots = [LEFT, RIGHT, pad(0)].reduce(claimSlot, createLobbySlots(4));
    slots = leaveSlot(slots, 1);
    expect(slots).toEqual([LEFT, null, pad(0), null]);
    expect(claimSlot(slots, pad(3))).toEqual([LEFT, pad(3), pad(0), null]);
  });

  it("should map empty slots to null sources when building the match inputs", () => {
    const slots = leaveSlot([LEFT, RIGHT].reduce(claimSlot, createLobbySlots(4)), 0);
    expect(slotSources(slots)).toEqual([null, RIGHT, null, null]);
  });

  it("should name each device and its join key when labelling the slots", () => {
    expect([LEFT, RIGHT, pad(0)].map(deviceLabel)).toEqual(["Left keys", "Right keys", "Pad 1"]);
    expect(deviceKeys(RIGHT)).toEqual({ join: "Enter", leave: "Backspace" });
    expect(deviceKeys(pad(3)).join).toBe("A");
  });
});
