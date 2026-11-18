import { GAME_PALETTE, toCssColor } from "@/shared/config/gamePalette";
import { DEBUG_INK_LAYERS, DEBUG_INK_ON } from "@/shared/utils/debugInk";

const PANEL_STYLE = {
  color: toCssColor(GAME_PALETTE.ink),
  backgroundColor: toCssColor(GAME_PALETTE.hud.card),
};

/** Which colour each ink pass has with `?debugInk=1` (nothing without the flag). */
export const DebugInkLegend = () => {
  if (!DEBUG_INK_ON) return null;
  return (
    <ul
      className="pointer-events-none absolute top-2 left-2 rounded-md px-3 py-2 text-xs"
      style={PANEL_STYLE}
      data-testid="debug-ink-legend"
    >
      {Object.entries(DEBUG_INK_LAYERS).map(([layer, { color, label }]) => (
        <li key={layer} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: toCssColor(color) }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
};
