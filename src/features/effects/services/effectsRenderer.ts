import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { starPoints } from "@/shared/utils/shapeGeometry";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { DESIGN_SCALE, outlineWidth } from "@/shared/utils/outlineWidth";
import { resolveCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
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
  debris: Map<number, Container>;
}

export interface EffectsFrame {
  events: readonly CombatEvent[];
  timeSeconds: number;
  zoom: number;
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
    debris: new Map(),
  };
}

const inkStroke = (width: number) => ({
  width,
  color: GAME_PALETTE.ink,
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

const lookOfMaterial = (materialId: string) => {
  const token = resolveCatalogEntry("material", materialId).entry?.lookToken ?? "";
  return GAME_PALETTE.materialLooks[token] ?? GAME_PALETTE.fallbackLook;
};

/** Deterministic 0..1 noise from an event seq and a piece index (no RNG in render). */
const noise = (seq: number, i: number): number => {
  const x = Math.sin(seq * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** 5–8 cell-coloured squares with a grid-line edge (DESIGN_LANGUAGE § 6 Explosion debris). */
function drawDebris(event: EventOf<"terrainDestroyed">): Container {
  const root = new Container();
  const look = lookOfMaterial(event.materialId);
  const count = 5 + (event.seq % 4);
  const half = DEBRIS.size / 2;
  for (let i = 0; i < count; i += 1) {
    root.addChild(
      new Graphics()
        .roundRect(-half, -half, DEBRIS.size, DEBRIS.size, DEBRIS.size * 0.25)
        .fill(i % 3 === 0 ? look.accent : look.fill)
        .stroke({ width: 0.8, color: GAME_PALETTE.cellLine })
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
    list: liveEvents(frame, "playerHit", POP.seconds),
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
}
