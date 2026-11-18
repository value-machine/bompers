import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { GAME_PALETTE, toCssColor, weaponLook } from "@/shared/config/gamePalette";
import { WEAPON_CRATE_SHAPE } from "@/shared/utils/weaponCrate";
import { weaponTubeMark, type TubePart } from "@/shared/utils/weaponTube";

/** Crate size in SVG units; the box sits on y = 0 (origin bottom-centre, like the game's). */
const SIZE = 48;
const HALF = SIZE / 2;
/** Room for the ink outline around the box. */
const PAD = 2.5;
const OUTLINE = 2.5;
const DEG = 180 / Math.PI;

const Part = ({ part, fill }: { part: TubePart; fill: string }) =>
  part.kind === "rect" ? (
    <rect
      x={part.x}
      y={part.y}
      width={part.width}
      height={part.height}
      rx={part.radius}
      fill={fill}
    />
  ) : (
    <polygon points={part.points.join(" ")} fill={fill} />
  );

/**
 * The in-game weapon crate as a small SVG (lobby weapons toggles, weapons-match-setting D5): the
 * box in the weapon accent, the mouth mark in ink inside a white outline, one gloss oval. Same
 * proportions as `collectibles/services/weaponCrateRenderer.ts` via `WEAPON_CRATE_SHAPE`.
 */
export const WeaponCrateIcon = ({
  weaponId,
  size = 44,
}: {
  weaponId: WeaponItemId;
  size?: number;
}) => {
  const shape = WEAPON_CRATE_SHAPE;
  const look = weaponLook(weaponId);
  const ink = toCssColor(GAME_PALETTE.ink);
  const white = toCssColor(GAME_PALETTE.crateMarkOutline);
  const { parts, centre } = weaponTubeMark(look.tube, SIZE / shape.markUnits);
  const { gloss } = shape;
  return (
    <svg
      viewBox={`${-HALF - PAD} ${-SIZE - PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect
        x={-HALF}
        y={-SIZE}
        width={SIZE}
        height={SIZE}
        rx={SIZE * shape.cornerRadius}
        fill={toCssColor(look.accent)}
        stroke={ink}
        strokeWidth={OUTLINE}
        strokeLinejoin="round"
      />
      <ellipse
        rx={SIZE * gloss.rx}
        ry={SIZE * gloss.ry}
        fill={toCssColor(GAME_PALETTE.gloss)}
        fillOpacity={gloss.alpha}
        transform={`translate(${SIZE * gloss.x} ${SIZE * gloss.y}) rotate(${gloss.tilt * DEG})`}
      />
      <g
        transform={`translate(0 ${-HALF}) rotate(${shape.markTilt * DEG}) translate(${-centre.x} ${-centre.y})`}
      >
        <g stroke={white} strokeWidth={SIZE * shape.markOutline * 2} strokeLinejoin="round">
          {parts.map((part, i) => (
            <Part key={`o${i}`} part={part} fill={white} />
          ))}
        </g>
        {parts.map((part, i) => (
          <Part key={`m${i}`} part={part} fill={ink} />
        ))}
      </g>
    </svg>
  );
};
