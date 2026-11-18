import { memo, useId } from "react";
import type { LevelDefinition, TerrainPiece } from "@/features/level/types/levelDefinition.types";
import { useThumbnailFrame } from "@/features/level/hooks/useThumbnailFrame";
import { GAME_PALETTE, terrainSwatch, toCssColor } from "@/shared/config/gamePalette";

/** Outline width as a share of the frame width (reads as the in-game ink line at card size). */
const OUTLINE_SHARE = 1 / 110;

const css = toCssColor;

const TerrainShapeView = ({ piece, outline }: { piece: TerrainPiece; outline: number }) => {
  const style = {
    fill: css(terrainSwatch(piece.colorId ?? "").fill),
    stroke: css(GAME_PALETTE.ink),
    strokeWidth: outline,
    strokeLinejoin: "round" as const,
  };
  const { shape } = piece;
  if (shape.type === "rect") {
    return (
      <rect
        data-terrain=""
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={Math.min(10, shape.h / 3)}
        style={style}
      />
    );
  }
  if (shape.type === "circle") {
    return <circle data-terrain="" cx={shape.cx} cy={shape.cy} r={shape.r} style={style} />;
  }
  return (
    <polygon
      data-terrain=""
      points={shape.points.map((p) => `${p.x},${p.y}`).join(" ")}
      style={style}
    />
  );
};

export interface LevelThumbnailProps {
  level: LevelDefinition;
  className?: string;
}

/**
 * A small picture of a level's layout, drawn from its `LevelDefinition`: the sky gradient, sun
 * and far hill of the backdrop, then every terrain piece in its swatch colour with the ink
 * outline (DESIGN_LANGUAGE § 1), framed to the level bounds. Moving parts show at rest. Pure:
 * a new `level` (a re-read file) redraws it.
 */
export const LevelThumbnail = memo(({ level, className }: LevelThumbnailProps) => {
  const skyId = `sky-${useId()}`;
  const frame = useThumbnailFrame(level.bounds);
  const outline = frame.w * OUTLINE_SHARE;
  return (
    <svg
      viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
      role="img"
      aria-label={`Layout of ${level.meta.title}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: css(GAME_PALETTE.sky.top) }} />
          <stop offset="1" style={{ stopColor: css(GAME_PALETTE.sky.bottom) }} />
        </linearGradient>
      </defs>
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill={`url(#${skyId})`} />
      <circle
        cx={frame.x + frame.w * 0.85}
        cy={frame.y + frame.h * 0.18}
        r={frame.w * 0.05}
        style={{ fill: css(GAME_PALETTE.backdrop.sun) }}
      />
      <ellipse
        cx={frame.x + frame.w * 0.3}
        cy={frame.y + frame.h * 1.02}
        rx={frame.w * 0.45}
        ry={frame.h * 0.22}
        style={{ fill: css(GAME_PALETTE.backdrop.hillsFar) }}
      />
      {level.terrain.map((piece, i) => (
        <TerrainShapeView key={i} piece={piece} outline={outline} />
      ))}
    </svg>
  );
});
