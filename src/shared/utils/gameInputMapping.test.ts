import { describe, expect, it } from "vitest";
import {
  mapGamepadInput,
  mapKeyboardInput,
  mapPlayerInputs,
} from "@/shared/utils/gameInputMapping";

const pad = (axes: number[], pressedButtons: number[] = []) => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => pressedButtons.includes(i)),
});

describe("gameInputMapping", () => {
  it("should map the left keyboard half when WASD and F are held", () => {
    const input = mapKeyboardInput(new Set(["KeyD", "KeyW", "KeyF"]), "left");
    expect(input).toEqual({
      connected: true,
      moveX: 1,
      aimX: 1,
      aimY: -1,
      jump: true,
      fire: true,
    });
  });

  it("should ignore the other half's keys when mapping one keyboard half", () => {
    const input = mapKeyboardInput(new Set(["ArrowLeft"]), "left");
    expect(input.moveX).toBe(0);
  });

  it("should cancel out when both directions are held", () => {
    expect(mapKeyboardInput(new Set(["ArrowLeft", "ArrowRight"]), "right").moveX).toBe(0);
  });

  it("should report a disconnected slot when the gamepad is missing", () => {
    expect(mapGamepadInput(null).connected).toBe(false);
  });

  it("should drop stick noise inside the deadzone when mapping a gamepad", () => {
    expect(mapGamepadInput(pad([0.1, -0.1, 0, 0])).moveX).toBe(0);
  });

  it("should aim with the right stick when it is pushed", () => {
    const input = mapGamepadInput(pad([0.8, 0, 0, -1], [0]));
    expect(input).toMatchObject({ moveX: 0.8, aimX: 0, aimY: -1, jump: true, fire: false });
  });

  it("should return one input per slot with keyboards first when using the default sources", () => {
    const inputs = mapPlayerInputs({
      heldKeys: new Set(["ArrowRight"]),
      gamepads: [pad([0, 0, 0, 0], [7])],
    });
    expect(inputs).toHaveLength(4);
    expect(inputs[1]?.moveX).toBe(1);
    expect(inputs[2]).toMatchObject({ connected: true, fire: true });
    expect(inputs[3]?.connected).toBe(false);
  });
});
