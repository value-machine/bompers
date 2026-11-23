import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, terrainSwatch } from "@/shared/config/gamePalette";
import { drawInkHeart } from "@/shared/services/heartRenderer";
import { inkColor } from "@/shared/utils/debugInk";
import { starPoints } from "@/shared/utils/shapeGeometry";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { DESIGN_SCALE, outlineWidth } from "@/shared/utils/outlineWidth";
import type { CombatEvent } from "@/features/combat/api/combatApi";

/**
 * Effects layer (DESIGN_LANGUAGE § 5 step 6, under rockets and players), driven by combat sim events: explosion starbursts,
 * impact pops where a player is hit, and cell-coloured debris where terrain was destroyed. Each
 * effect is drawn once from its sim event (keyed by `seq`); per frame only transforms and alpha
 * change, so the cost is independent of the effect's look. Stroke widths are the zoom-clamped
 * effect width at the moment the effect appears.
 */
export interface EffectsView {
  layer: Container;
  blasts: Map<number, Container>;
  pops: Map<number, Container>;
  /** Grey rings where a hit took nothing (crouched: blocked). */
  blocks: Map<number, Container>;
  /** Health chunks flying off a hurt blob, one per damage point. */
  chunks: Map<number, Container>;
  debris: Map<number, Container>;
}

export interface EffectsFrame {
  events: readonly CombatEvent[];
  timeSeconds: number;
  zoom: number;
  /** How long a lost chunk flies (`feel.hurt.chunkSeconds`). */
  chunkSeconds: number;
}

type EventOf<T extends CombatEvent["type"]> = Extract<CombatEvent, { type: T }>;

/** Explosion pop: full size on the first frame, shrinks away (DESIGN_LANGUAGE § 6). */
const BLAST_SECONDS = 0.25;
const POP = { seconds: 0.22, radius: 26 * DESIGN_SCALE };
const DEBRIS = { seconds: 0.5, size: 12 * DESIGN_SCALE, speed: 260, gravity: 900, spin: 9 };

export function createEffectsView(): EffectsView {
  return {
    layer: new Container({ label: "effects" }),
    blasts: new Map(),
    pops: new Map(),
    blocks: new Map(),
    chunks: new Map(),
    debris: new Map(),
  };
}

const inkStroke = (width: number) => ({
  width,
  color: inkColor("other"),
  join: "round" as const,
});

/** Orange star, lemon star, white core: the only sharp shape (DESIGN_LANGUAGE § 2). */
function drawBlast(radius: number, width: number): Container {
  const { outer, mid, core } = GAME_PALETTE.explosion;
  return new Graphics()
    .poly(starPoints(10, radius, radius * 0.62))
    .fill(outer)
    .stroke(inkStroke(width))
    .poly(starPoints(8, radius * 0.62, radius * 0.38))
    .fill(mid)
    .stroke(inkStroke(width * 0.7))
    .circle(0, 0, radius * 0.24)
    .fill(core);
}

/** White eight-point pop with an ink edge where a hit lands. */
const drawPop = (width: number): Container =>
  new Graphics()
    .poly(starPoints(8, POP.radius, POP.radius * 0.55))
    .fill(GAME_PALETTE.hitFlash)
    .stroke(inkStroke(width));

/**
 * Blocked (hurt-feedback D1): a grey ring where a hit took nothing, so a crouched hit never
 * reads as a hurt. It widens and fades over the pop's time.
 */
const BLOCK_RADIUS = 14 * DESIGN_SCALE;
const drawBlock = (width: number): Container =>
  new Graphics()
    .circle(0, 0, BLOCK_RADIUS)
    .stroke({ width: width * 1.5, color: GAME_PALETTE.hud.caption });

/**
 * A lost health chunk (hurt-feedback D1): the over-head heart (health-pickups D2), big, in the
 * victim's colour. Sized like the earlier chunk pill (11 × 9 design units).
 */
const CHUNK = { w: 11 * DESIGN_SCALE, h: 10 * DESIGN_SCALE, speed: 220, gravity: 1100, spin: 7 };
const drawChunks = (event: EventOf<"playerHit">, width: number): Container => {
  const root = new Container();
  const color = GAME_PALETTE.players[event.victimSlot % GAME_PALETTE.players.length]!;
  for (let i = 0; i < event.damage; i += 1) {
    root.addChild(
      drawInkHeart(new Graphics(), {
        x: 0,
        y: 0,
        w: CHUNK.w,
        h: CHUNK.h,
        fill: color,
        outline: width,
      })
    );
  }
  return root;
};

/** Pops each chunk up and out of the hit, falling and spinning; fades over the last third. */
function placeChunks(
  root: Container,
  event: EventOf<"playerHit">,
  at: { age: number; seconds: number }
): void {
  const { age } = at;
  root.position.set(event.x, event.y);
  root.alpha = Math.min(1, 3 * (1 - age / at.seconds));
  const middle = (root.children.length - 1) / 2;
  root.children.forEach((piece, i) => {
    const angle = -Math.PI / 2 + (i - middle) * 0.7 + (noise(event.seq, i) - 0.5) * 0.6;
    piece.position.set(
      Math.cos(angle) * CHUNK.speed * age,
      Math.sin(angle) * CHUNK.speed * age + 0.5 * CHUNK.gravity * age * age
    );
    piece.rotation = (noise(event.seq, i + 7) - 0.5) * CHUNK.spin * age * 2;
  });
}

/** Deterministic 0..1 noise from an event seq and a piece index (no RNG in render). */
const noise = (seq: number, i: number): number => {
  const x = Math.sin(seq * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** 5–8 cell-coloured squares with a grid-line edge (DESIGN_LANGUAGE § 6 Explosion debris). */
function drawDebris(event: EventOf<"terrainDestroyed">): Container {
  const root = new Container();
  const swatch = terrainSwatch(event.colorId);
  const count = 5 + (event.seq % 4);
  const half = DEBRIS.size / 2;
  for (let i = 0; i < count; i += 1) {
    root.addChild(
      new Graphics()
        .roundRect(-half, -half, DEBRIS.size, DEBRIS.size, DEBRIS.size * 0.25)
        .fill(i % 3 === 0 ? swatch.lip : swatch.fill)
        .stroke({ width: 0.8, color: swatch.seam })
    );
  }
  return root;
}

/** Flies the pieces outward and up under gravity, spinning; fades over the last third. */
function placeDebris(root: Container, event: EventOf<"terrainDestroyed">, age: number): void {
  root.position.set(event.x, event.y);
  root.alpha = Math.min(1, 3 * (1 - age / DEBRIS.seconds));
  root.children.forEach((piece, i) => {
    const angle = -Math.PI / 2 + (noise(event.seq, i) - 0.5) * Math.PI * 1.6;
    const speed = DEBRIS.speed * (0.6 + 0.6 * noise(event.seq, i + 17));
    piece.position.set(
      Math.cos(angle) * speed * age,
      Math.sin(angle) * speed * age + 0.5 * DEBRIS.gravity * age * age
    );
    piece.rotation = (noise(event.seq, i + 31) - 0.5) * DEBRIS.spin * age * 2;
  });
}

function liveEvents<T extends CombatEvent["type"]>(
  frame: EffectsFrame,
  type: T,
  seconds: number
): EventOf<T>[] {
  return frame.events.filter(
    (event): event is EventOf<T> =>
      event.type === type && frame.timeSeconds - event.timeSeconds < seconds
  );
}

/** Matches the effects to the recent sim events. Call once per rendered frame. */
export function syncEffectsView(view: EffectsView, frame: EffectsFrame): void {
  const { timeSeconds } = frame;
  const width = outlineWidth("effect", frame.zoom).width;
  const age = (event: CombatEvent): number => timeSeconds - event.timeSeconds;
  syncDisplayById(view.debris, view.layer, {
    list: liveEvents(frame, "terrainDestroyed", DEBRIS.seconds),
    key: (event) => event.seq,
    create: drawDebris,
    place: (sprite, event) => placeDebris(sprite, event, age(event)),
  });
  syncDisplayById(view.blasts, view.layer, {
    list: liveEvents(frame, "explosion", BLAST_SECONDS),
    key: (event) => event.seq,
    create: (event) => drawBlast(event.radius, width),
    place: (sprite, event) => {
      sprite.position.set(event.x, event.y);
      sprite.scale.set(Math.max(0, 1 - age(event) / BLAST_SECONDS));
    },
  });
  syncDisplayById(view.pops, view.layer, {
    // Dive hits draw their own pop (features/dive); this one marks rocket and blast hits.
    list: liveEvents(frame, "playerHit", POP.seconds).filter(
      (event) => event.source !== "dive" && event.damage > 0
    ),
    key: (event) => event.seq,
    create: () => drawPop(width),
    place: (sprite, event) => {
      const t = age(event) / POP.seconds;
      sprite.position.set(event.x, event.y);
      sprite.scale.set(0.6 + 0.8 * t);
      sprite.rotation = t * 0.6;
      sprite.alpha = 1 - t * t;
    },
  });
  syncDisplayById(view.blocks, view.layer, {
    list: liveEvents(frame, "playerHit", POP.seconds).filter((event) => event.damage === 0),
    key: (event) => event.seq,
    create: () => drawBlock(width),
    place: (sprite, event) => {
      const t = age(event) / POP.seconds;
      sprite.position.set(event.x, event.y);
      sprite.scale.set(1 + t);
      sprite.alpha = 1 - t;
    },
  });
  syncDisplayById(view.chunks, view.layer, {
    list: liveEvents(frame, "playerHit", frame.chunkSeconds).filter((event) => event.damage > 0),
    key: (event) => event.seq,
    create: (event) => drawChunks(event, width),
    place: (sprite, event) =>
      placeChunks(sprite, event, { age: age(event), seconds: frame.chunkSeconds }),
  });
}
