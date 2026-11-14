import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { PlayerState } from "@/features/player/api/playerApi";
import { helmetPoint } from "@/features/combat/services/combatGeometry";
import type {
  CombatEvent,
  CombatState,
  PickupState,
  RocketState,
} from "@/features/combat/types/combat.types";

/**
 * Combat render layers (DESIGN_LANGUAGE § 1 Effects, § 5 draw order). The match renderer
 * places them: pickups (5) → effects (6, explosion starbursts) → rockets (7, plus the rocket
 * tube of armed players) → players (8) → overlay (health chunks above each player). Effects
 * therefore never cover a player outline. Shapes are drawn once; per frame only transforms
 * change, except the health pips, which redraw when a player's health changes.
 *
 * Not yet (visual pass): hit flash, screen shake, debris, smoke trail, zoom-scaled strokes.
 */
export interface CombatView {
  pickups: Container;
  effects: Container;
  rockets: Container;
  overlay: Container;
  pickupSprites: Map<number, Container>;
  rocketSprites: Map<number, Container>;
  /** Explosion starbursts by event seq. */
  blasts: Map<number, Container>;
  tubes: Map<string, Container>;
  health: Map<string, { pips: Graphics; shown: number }>;
}

/** Explosion pop: full size on the first frame, shrinks away over this many seconds. */
const BLAST_SECONDS = 0.25;
const STROKE = 2.5;
const STROKE_SMALL = 1.5;
/** Body radius per collision height (matches the player renderer). */
const RADIUS_PER_HEIGHT = 1 / 2.12;
const PIP = { w: 6, h: 5, gap: 2, lift: 10 };

const ink = (width: number) => ({ width, color: GAME_PALETTE.ink, join: "round" as const });
const slotColor = (slot: number): number =>
  GAME_PALETTE.players[slot % GAME_PALETTE.players.length] ?? GAME_PALETTE.ink;

export function createCombatView(): CombatView {
  return {
    pickups: new Container({ label: "pickups" }),
    effects: new Container({ label: "effects" }),
    rockets: new Container({ label: "rockets" }),
    overlay: new Container({ label: "combat-overlay" }),
    pickupSprites: new Map(),
    rocketSprites: new Map(),
    blasts: new Map(),
    tubes: new Map(),
    health: new Map(),
  };
}

function starPoints(points: number, outer: number, inner: number): number[] {
  const path: number[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    path.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return path;
}

/** Outer orange star, mid lemon star, white core — the only sharp shape (DESIGN_LANGUAGE § 2). */
function drawBlast(radius: number): Container {
  const { outer, mid, core } = GAME_PALETTE.explosion;
  const root = new Container();
  root.addChild(
    new Graphics()
      .poly(starPoints(10, radius, radius * 0.62))
      .fill(outer)
      .stroke(ink(STROKE)),
    new Graphics()
      .poly(starPoints(8, radius * 0.62, radius * 0.38))
      .fill(mid)
      .stroke(ink(STROKE_SMALL)),
    new Graphics().circle(0, 0, radius * 0.24).fill(core)
  );
  return root;
}

/** Nose points along +x; fins in the shooter's colour; flame behind. */
const drawRocket = (rocket: RocketState): Container => {
  const { body, nose, flame } = GAME_PALETTE.rocket;
  const root = new Container();
  root.addChild(
    new Graphics().ellipse(-11, 0, 5, 2.6).fill(flame),
    new Graphics()
      .poly([-8, -5, -3, 0, -8, 5])
      .fill(slotColor(rocket.ownerSlot))
      .stroke(ink(STROKE_SMALL)),
    new Graphics().roundRect(-7, -3, 13, 6, 3).fill(body).stroke(ink(STROKE_SMALL)),
    new Graphics().circle(6, 0, 2.6).fill(nose)
  );
  return root;
};

/** Cream crate with a sky ring and a tiny rocket mark; origin bottom-centre. */
const drawPickup = (size: number): Container => {
  const root = new Container();
  const half = size / 2;
  root.addChild(
    new Graphics()
      .roundRect(-half, -size, size, size, 5)
      .fill(GAME_PALETTE.pickupCrate)
      .stroke(ink(STROKE)),
    new Graphics()
      .circle(0, -half, half * 0.62)
      .stroke({ width: 2.5, color: GAME_PALETTE.pickupRing }),
    new Graphics().roundRect(-half * 0.45, -half - 2, half * 0.9, 4, 2).fill(GAME_PALETTE.ink)
  );
  return root;
};

/** Rocket tube on the helmet (0.76 R × 0.47 R past the body edge), pivoting toward the aim. */
const drawTube = (player: PlayerState): Graphics => {
  const r = player.height * RADIUS_PER_HEIGHT;
  const length = r + 0.76 * r;
  const thick = 0.47 * r;
  return new Graphics()
    .roundRect(0, -thick / 2, length, thick, thick / 2)
    .fill(GAME_PALETTE.helmet)
    .stroke(ink(STROKE_SMALL))
    .roundRect(length - 3, -thick / 2, 3, thick, 1.5)
    .fill(GAME_PALETTE.rocket.tubeCap);
};

/** Keeps one display object per id in `sprites`: creates new ones, places all, removes stale. */
function syncById<K, T>(
  sprites: Map<K, Container>,
  parent: Container,
  items: {
    list: readonly T[];
    key: (item: T) => K;
    create: (item: T) => Container;
    place: (sprite: Container, item: T) => void;
  }
): void {
  const seen = new Set<K>();
  for (const item of items.list) {
    const id = items.key(item);
    seen.add(id);
    let sprite = sprites.get(id);
    if (!sprite) {
      sprite = items.create(item);
      sprites.set(id, sprite);
      parent.addChild(sprite);
    }
    items.place(sprite, item);
  }
  for (const [id, sprite] of sprites) {
    if (seen.has(id)) continue;
    sprite.destroy({ children: true });
    sprites.delete(id);
  }
}

function syncBlasts(view: CombatView, combat: CombatState, timeSeconds: number): void {
  const live = combat.events.filter(
    (event): event is Extract<CombatEvent, { type: "explosion" }> =>
      event.type === "explosion" && timeSeconds - event.timeSeconds < BLAST_SECONDS
  );
  syncById(view.blasts, view.effects, {
    list: live,
    key: (event) => event.seq,
    create: (event) => drawBlast(event.radius),
    place: (sprite, event) => {
      sprite.position.set(event.x, event.y);
      sprite.scale.set(Math.max(0, 1 - (timeSeconds - event.timeSeconds) / BLAST_SECONDS));
    },
  });
}

interface PipsLook {
  health: number;
  slot: number;
  max: number;
}

function drawPips(pips: Graphics, { health, slot, max }: PipsLook): void {
  const total = max * PIP.w + (max - 1) * PIP.gap;
  pips.clear();
  for (let i = 0; i < max; i += 1) {
    pips
      .roundRect(-total / 2 + i * (PIP.w + PIP.gap), 0, PIP.w, PIP.h, 2)
      .fill(i < health ? slotColor(slot) : GAME_PALETTE.healthLost)
      .stroke(ink(1.2));
  }
}

function syncPlayerExtras(view: CombatView, frame: CombatFrame): void {
  const { combat, players, maxHealth } = frame;
  const armed = players.filter((player) => combat.fighters.get(player.id)?.weapon);
  syncById(view.tubes, view.rockets, {
    list: armed,
    key: (player) => player.id,
    create: drawTube,
    place: (sprite, player) => {
      const helmet = helmetPoint(player);
      sprite.position.set(helmet.x, helmet.y);
      sprite.rotation = Math.atan2(player.aimY, player.aimX);
    },
  });
  for (const player of players) {
    const fighter = combat.fighters.get(player.id);
    if (!fighter) continue;
    let bar = view.health.get(player.id);
    if (!bar) {
      bar = { pips: new Graphics(), shown: -1 };
      view.health.set(player.id, bar);
      view.overlay.addChild(bar.pips);
    }
    if (bar.shown !== fighter.health)
      drawPips(bar.pips, { health: fighter.health, slot: player.slot, max: maxHealth });
    bar.shown = fighter.health;
    bar.pips.visible = !fighter.eliminated;
    bar.pips.position.set(player.x, player.y - player.height - PIP.lift - PIP.h);
  }
}

export interface CombatFrame {
  combat: CombatState;
  players: readonly PlayerState[];
  /** Sim time of the state being drawn, seconds. */
  timeSeconds: number;
  maxHealth: number;
  pickupSize: number;
}

/** Matches the combat layers to the state. Call once per rendered frame. */
export function syncCombatView(view: CombatView, frame: CombatFrame): void {
  const { combat, timeSeconds, pickupSize } = frame;
  syncById(view.pickupSprites, view.pickups, {
    list: combat.pickups,
    key: (pickup: PickupState) => pickup.id,
    create: () => drawPickup(pickupSize),
    place: (sprite, pickup) => sprite.position.set(pickup.x, pickup.y),
  });
  syncBlasts(view, combat, timeSeconds);
  syncById(view.rocketSprites, view.rockets, {
    list: combat.rockets,
    key: (rocket) => rocket.id,
    create: drawRocket,
    place: (sprite, rocket) => {
      sprite.position.set(rocket.x, rocket.y);
      sprite.rotation = Math.atan2(rocket.dirY, rocket.dirX);
    },
  });
  syncPlayerExtras(view, frame);
}
