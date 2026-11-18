import { describe, expect, it, vi } from "vitest";
import { createMenuFocusModality } from "@/shared/services/menuFocusModality";

const pointerMove = (movementX: number, movementY: number): Event =>
  Object.assign(new Event("pointermove"), { movementX, movementY });

describe("createMenuFocusModality", () => {
  it("should start hidden when nothing was pressed yet", () => {
    expect(createMenuFocusModality(new EventTarget()).isVisible()).toBe(false);
  });

  it("should show the mark when a menu press arrives", () => {
    const modality = createMenuFocusModality(new EventTarget());
    modality.noteMenuPress();
    expect(modality.isVisible()).toBe(true);
  });

  it("should hide the mark when the pointer is pressed or moved", () => {
    const target = new EventTarget();
    const modality = createMenuFocusModality(target);
    modality.noteMenuPress();
    target.dispatchEvent(new Event("pointerdown"));
    expect(modality.isVisible()).toBe(false);

    modality.noteMenuPress();
    target.dispatchEvent(pointerMove(3, 0));
    expect(modality.isVisible()).toBe(false);
  });

  it("should keep the mark when a pointermove reports no movement", () => {
    const target = new EventTarget();
    const modality = createMenuFocusModality(target);
    modality.noteMenuPress();
    target.dispatchEvent(pointerMove(0, 0));
    expect(modality.isVisible()).toBe(true);
  });

  it("should notify subscribers only when the mode changes", () => {
    const target = new EventTarget();
    const modality = createMenuFocusModality(target);
    const listener = vi.fn();
    modality.subscribe(listener);
    modality.noteMenuPress();
    modality.noteMenuPress();
    target.dispatchEvent(new Event("pointerdown"));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should stop reacting to the pointer when disposed", () => {
    const target = new EventTarget();
    const modality = createMenuFocusModality(target);
    modality.noteMenuPress();
    modality.dispose();
    target.dispatchEvent(new Event("pointerdown"));
    expect(modality.isVisible()).toBe(true);
  });
});
