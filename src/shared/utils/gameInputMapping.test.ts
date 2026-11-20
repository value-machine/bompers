import { describe, expect, it } from "vitest";
import {
  GAMEPAD_DEADZONE,
  inputSourceKey,
  INPUT_DEVICES,
  mapGamepadInput,
  mapKeyboardInput,
  mapMenuInputs,
  mapPlayerInputs,
  mergeButtonPresses,
  EMPTY_PLAYER_INPUT,
} from "@/shared/utils/gameInputMapping";

describe("mergeButtonPresses", () => {
  it("should keep a fire press from a frame that ran no step when the next frame has it released", () => {
    const earlier = [{ ...EMPTY_PLAYER_INPUT, fire: true, aimX: 1 }];
    const later = [{ ...EMPTY_PLAYER_INPUT, aimX: -1 }];
    const [merged] = mergeButtonPresses(earlier, later);
    expect(merged?.fire).toBe(true);
    expect(merged?.aimX).toBe(-1);
  });

  it("should leave the later input alone when the earlier frame has no such slot", () => {
    const later = [{ ...EMPTY_PLAYER_INPUT, jump: true }];
    expect(mergeButtonPresses([], later)).toEqual(later);
  });
});

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
      pause: false,
      crouch: false,
    });
  });

  it("should crouch and aim down when a keyboard half holds down", () => {
    expect(mapKeyboardInput(new Set(["KeyS"]), "left")).toMatchObject({ crouch: true, aimY: 1 });
    expect(mapKeyboardInput(new Set(["ArrowDown"]), "right").crouch).toBe(true);
  });

  it("should crouch when the pad's d-pad or move stick points mostly down", () => {
    expect(mapGamepadInput(pad([0, 0, 0, 0], [13])).crouch).toBe(true);
    expect(mapGamepadInput(pad([0.3, 0.8, 0, 0])).crouch).toBe(true);
    expect(mapGamepadInput(pad([0.9, 0.6, 0, 0])).crouch).toBe(false);
    expect(mapGamepadInput(pad([0, 0, 0, 1])).crouch).toBe(false);
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
    expect(input).toMatchObject({ aimX: 0, aimY: -1, jump: true, fire: false });
    expect(input.moveX).toBeCloseTo((0.8 - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE));
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

  describe("gamepad sticks and pause", () => {
    it("should ramp move speed from zero when the stick just passes the deadzone", () => {
      const x = GAMEPAD_DEADZONE + 0.15;
      const expected = (x - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE);
      expect(mapGamepadInput(pad([x, 0, 0, 0])).moveX).toBeCloseTo(expected);
      expect(mapGamepadInput(pad([1, 0, 0, 0])).moveX).toBe(1);
    });

    it("should not creep sideways when the left stick points up with slight drift", () => {
      expect(mapGamepadInput(pad([0.2, -1, 0, 0])).moveX).toBe(0);
    });

    it("should keep the aim stick's true direction when it is pushed near an axis", () => {
      const input = mapGamepadInput(pad([0, 0, 0.2, -0.9]));
      expect(input.aimX / input.aimY).toBeCloseTo(0.2 / -0.9);
    });

    it("should clamp the aim to the unit circle when a stick reports a square corner", () => {
      const input = mapGamepadInput(pad([0, 0, 1, 1]));
      expect(Math.hypot(input.aimX, input.aimY)).toBeCloseTo(1);
    });

    it("should ignore aim stick noise inside the radial deadzone", () => {
      const input = mapGamepadInput(pad([0.9, 0, 0.15, 0.15]));
      expect(input).toMatchObject({ aimX: input.moveX, aimY: 0 });
    });

    it("should report pause when a pad's Start button is held", () => {
      expect(mapGamepadInput(pad([0, 0, 0, 0], [9])).pause).toBe(true);
      expect(mapGamepadInput(pad([0, 0, 0, 0], [0])).pause).toBe(false);
    });

    it("should report pause for both keyboard halves when Escape is held", () => {
      const inputs = mapPlayerInputs({ heldKeys: new Set(["Escape"]), gamepads: [] });
      expect(inputs[0]?.pause).toBe(true);
      expect(inputs[1]?.pause).toBe(true);
    });
  });
});
