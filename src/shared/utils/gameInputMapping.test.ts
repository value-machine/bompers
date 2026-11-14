import { describe, expect, it } from "vitest";
import {
  inputSourceKey,
  INPUT_DEVICES,
  mapGamepadInput,
  mapKeyboardInput,
  mapMenuInputs,
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

  it("should report an empty slot as disconnected when its source is null", () => {
    const inputs = mapPlayerInputs({ heldKeys: new Set(["KeyD"]), gamepads: [] }, [
      null,
      { kind: "keyboard", layout: "left" },
    ]);
    expect(inputs[0]?.connected).toBe(false);
    expect(inputs[1]).toMatchObject({ connected: true, moveX: 1 });
  });

  it("should map menu buttons per device when keys and a pad are held", () => {
    const menus = mapMenuInputs({
      heldKeys: new Set(["Space", "Backspace", "ArrowDown"]),
      gamepads: [null, pad([0, 0.9, 0, 0], [1])],
    });
    expect(menus).toHaveLength(INPUT_DEVICES.length);
    expect(menus[0]).toMatchObject({ present: true, confirm: true, back: false });
    expect(menus[1]).toMatchObject({ present: true, down: true, back: true, confirm: false });
    expect(menus[2]?.present).toBe(false);
    expect(menus[3]).toMatchObject({ present: true, down: true, back: true });
  });

  it("should give every device a distinct key when listing the input devices", () => {
    const keys = INPUT_DEVICES.map(inputSourceKey);
    expect(new Set(keys).size).toBe(INPUT_DEVICES.length);
    expect(keys[0]).toBe("keyboard:left");
    expect(keys[5]).toBe("gamepad:3");
  });
});
