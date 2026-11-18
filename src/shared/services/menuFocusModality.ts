/**
 * Whether menus show their focus mark, like `:focus-visible` for the couch (owner,
 * controller-focus D2): a press from a keyboard half or a pad shows it, pointer use hides it.
 * The menus report their presses (they already sample every device); pointer use is read here
 * from the window. One shared instance, so the mode carries from the lobby into the pause menu.
 */
export interface MenuFocusModality {
  /** True after a key or pad menu press, false after the pointer was used. */
  isVisible: () => boolean;
  /** A menu press from a keyboard half or a pad. */
  noteMenuPress: () => void;
  subscribe: (listener: () => void) => () => void;
  /** Removes the window listeners. */
  dispose: () => void;
}

// Some browsers fire a pointermove without movement on layout changes; only real moves count.
const moved = (event: Event): boolean => {
  const { movementX = 0, movementY = 0 } = event as Partial<PointerEvent>;
  return movementX !== 0 || movementY !== 0;
};

/** Starts listening on `target` (usually `window`). The mark starts hidden, like `:focus-visible`. */
export function createMenuFocusModality(target: EventTarget): MenuFocusModality {
  let visible = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean): void => {
    if (next === visible) return;
    visible = next;
    listeners.forEach((listener) => listener());
  };
  const onPointerDown = (): void => set(false);
  const onPointerMove = (event: Event): void => {
    if (moved(event)) set(false);
  };
  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointermove", onPointerMove);

  return {
    isVisible: () => visible,
    noteMenuPress: () => set(true),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointermove", onPointerMove);
      listeners.clear();
    },
  };
}

let shared: MenuFocusModality | null = null;

/** The app's one instance, created on first use (lobby and pause share it). */
export function getMenuFocusModality(): MenuFocusModality {
  shared ??= createMenuFocusModality(window);
  return shared;
}
