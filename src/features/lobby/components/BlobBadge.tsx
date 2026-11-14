import { GAME_PALETTE, toCssColor } from "@/shared/config/gamePalette";
import {
  PLAYER_EMBLEM_NAMES,
  playerEmblemShape,
  type EmblemShape,
} from "@/shared/utils/playerEmblem";

const pick = (colors: readonly number[], slot: number): string =>
  toCssColor(colors[slot % colors.length] ?? GAME_PALETTE.ink);

const Emblem = ({ shape, fill }: { shape: EmblemShape; fill: string }) => {
  switch (shape.kind) {
    case "circle":
      return <circle r={shape.radius} fill={fill} />;
    case "polygon":
      return <polygon points={shape.points.join(" ")} fill={fill} />;
    case "roundRect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.radius}
          fill={fill}
        />
      );
  }
};

/** Egg body (R = 20): half-width R, height 1.94 R, fuller at the bottom (DESIGN_LANGUAGE § 2). */
const BODY_PATH =
  "M0,-21 C13,-21 20,-8 20,4 C20,15 12,18 0,18 C-12,18 -20,15 -20,4 C-20,-8 -13,-21 0,-21 Z";

/**
 * The player's blob as a small SVG for the lobby: body colour, feet in the shade, cream
 * helmet with the slot's emblem in the body colour, one ink silhouette line (style E).
 */
export const BlobBadge = ({ slot, size = 64 }: { slot: number; size?: number }) => {
  const body = pick(GAME_PALETTE.players, slot);
  const shade = pick(GAME_PALETTE.playerShades, slot);
  const ink = toCssColor(GAME_PALETTE.ink);
  const helmet = toCssColor(GAME_PALETTE.helmet);
  const white = toCssColor(GAME_PALETTE.eyeWhite);
  return (
    <svg
      viewBox="-26 -30 52 56"
      width={size}
      height={size}
      role="img"
      aria-label={`P${slot + 1} blob, ${PLAYER_EMBLEM_NAMES[slot % 4]} emblem`}
    >
      <g stroke={ink} strokeWidth={2.5}>
        <ellipse cx={-9} cy={19} rx={8} ry={5} fill={shade} />
        <ellipse cx={9} cy={19} rx={8} ry={5} fill={shade} />
        <path d={BODY_PATH} fill={body} />
        <path d="M-22,-4 C-22,-18 -12,-24 0,-24 C12,-24 22,-18 22,-4 Z" fill={helmet} />
      </g>
      <g transform="translate(0,-12)">
        <Emblem shape={playerEmblemShape(slot, 5.5)} fill={body} />
      </g>
      <circle cx={-6} cy={4} r={3.6} fill={white} />
      <circle cx={6} cy={4} r={3.6} fill={white} />
      <circle cx={-5} cy={4.5} r={1.8} fill={ink} />
      <circle cx={7} cy={4.5} r={1.8} fill={ink} />
    </svg>
  );
};
