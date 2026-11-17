import { Container, type Application } from "pixi.js";
import {
  createBackdropView,
  createTerrainView,
  isSolidAt,
  syncBackdropView,
  syncTerrainView,
  type BackdropView,
  type TerrainView,
} from "@/features/arena/api/arenaApi";
import {
  createPlayersView,
  syncPlayersView,
  type BlobPoseOverlay,
  type BlobWeapon,
  type PlayersView,
  type PlayerState,
} from "@/features/player/api/playerApi";
import {
  createKnockoutView,
  createKnockoutWorld,
  knockoutBodies,
  noteKnockoutEvents,
  stepKnockouts,
  syncKnockoutView,
  type KnockoutBody,
  type KnockoutView,
  type KnockoutWorld,
} from "@/features/knockout/api/knockoutApi";
import {
  applyCameraView,
  cameraShakeOffset,
  computeCameraView,
  createCameraShake,
  type CameraShake,
  type CameraView,
  type Viewport,
} from "@/features/camera/api/cameraApi";
import {
  createCombatView,
  syncCombatView,
  weaponTunables,
  type CombatView,
} from "@/features/combat/api/combatApi";
import {
  createEffectsView,
  createFeelState,
  readFeelCues,
  syncEffectsView,
  type EffectsView,
  type FeelState,
} from "@/features/effects/api/effectsApi";
import { prefersReducedMotion } from "@/shared/utils/reducedMotion";
import { blastReach } from "@/shared/utils/blastPower";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import {
  createCollectiblesView,
  syncCollectiblesView,
  type CollectiblesView,
} from "@/features/collectibles/api/collectiblesApi";
import {
  createDiveView,
  diveBlobPoses,
  syncDiveView,
  type DiveView,
} from "@/features/dive/api/diveApi";
import { playersInPlay, type GameState } from "@/features/match/services/gameSim";
import { createHudView, syncHudView, type HudView } from "@/features/match/services/hudRenderer";

/**
 * Composes the render layers. Scene graph:
 *   stage
 *   ├─ backdrop (screen units: sky, sun, parallax hills and clouds — arena)
 *   ├─ world   (camera transform; world units)
 *   │  ├─ terrain   (arena: solid slabs, breakable tiles)
 *   │  ├─ contact shadows: weapon crates (collectibles), rockets (combat), players (player)
 *   │  ├─ weapon crates, headbutt resets, point orbs (collectibles)
 *   │  ├─ effects (debris, explosions, rocket-hit pops — effects)
 *   │  ├─ knockouts (goo splats, goo droplets, loose helmets and tubes — knockout)
 *   │  ├─ rockets (+ trails — combat)
 *   │  ├─ dive effects (dive impact pops)   (dive)
 *   │  ├─ players   (player; above effects so they never cover a player outline; protected
 *   │  │             players blink inside a dashed ring)
 *   │  └─ combat overlay (health chunks above each player)
 *   └─ hud     (screen units: timer card, player cards, round-result banner — hudRenderer)
 * Players waiting to respawn are not drawn and not framed by the camera. A knocked-out blob that is
 * still flying or squashing (knockout feature) is drawn by the player layer under its own id.
 * Order follows DESIGN_LANGUAGE.md § 5. Each feature owns its layer's create/sync pair; this
 * file only orders and drives them. The camera is computed first, so every layer gets this
 * frame's zoom for its outline width clamp (DESIGN_LANGUAGE § 3).
 *
 * Game feel (DESIGN_LANGUAGE § 6), all render-only: `feel` turns new combat events and tumble
 * bounces into hit flashes, helmet kicks and `shake` kicks; the shake offset is added when the
 * camera is applied (none under the OS reduced-motion setting); after a hard hit the world view
 * holds still for `feel.hitStop` (the sim keeps running, the HUD keeps drawing).
 */
export interface GameRenderer {
  backdrop: BackdropView;
  world: Container;
  terrain: TerrainView;
  players: PlayersView;
  combat: CombatView;
  effects: EffectsView;
  knockouts: KnockoutView;
  /** Knockout simulation (render-only): flying blobs, goo, loose pieces. */
  knockout: KnockoutWorld;
  collectibles: CollectiblesView;
  dive: DiveView;
  hud: HudView;
  camera: CameraView | null;
  feel: FeelState;
  shake: CameraShake;
}

export function createGameRenderer(app: Application, state: GameState): GameRenderer {
  const world = new Container({ label: "world" });
  const backdrop = createBackdropView(app.renderer);
  const terrain = createTerrainView(state.arena);
  const players = createPlayersView();
  const combat = createCombatView();
  const effects = createEffectsView();
  const knockouts = createKnockoutView();
  const collectibles = createCollectiblesView();
  const dive = createDiveView();
  world.addChild(
    terrain.container,
    collectibles.shadows.container,
    combat.shadows.container,
    players.shadows,
    collectibles.crates,
    collectibles.refills.container,
    collectibles.orbs,
    effects.layer,
    knockouts.layer,
    combat.rockets,
    dive.effects,
    players.container,
    combat.overlay
  );

  const hud = createHudView();
  app.stage.addChild(backdrop.root, world, hud.root);
  return {
    backdrop,
    world,
    terrain,
    players,
    combat,
    effects,
    knockouts,
    knockout: createKnockoutWorld(),
    collectibles,
    dive,
    hud,
    camera: null,
    feel: createFeelState(),
    shake: createCameraShake(),
  };
}

/**
 * Held weapons by player id, as the blobs show them: the weapon's tube, and how ready the next
 * shot is (1 − cooldown / fire cooldown) for the muzzle light (weapon-visuals D3).
 */
const blobWeapons = (state: GameState): Map<string, BlobWeapon> => {
  const weapons = new Map<string, BlobWeapon>();
  for (const [id, fighter] of state.combat.fighters) {
    if (!fighter.weapon) continue;
    const { itemId } = fighter.weapon;
    const { fireCooldown } = weaponTunables(state.tunables, itemId);
    const ready = fireCooldown > 0 ? 1 - fighter.attackCooldown / fireCooldown : 1;
    weapons.set(id, { itemId, ready });
  }
  return weapons;
};

/** Ids of players whose spawn protection is still running. */
const protectedIds = (state: GameState): Set<string> => {
  const ids = new Set<string>();
  for (const [id, fighter] of state.combat.fighters) {
    if (fighter.invulnerableUntil > state.timeSeconds) ids.add(id);
  }
  return ids;
};

interface LayerFrame {
  inPlay: ReturnType<typeof playersInPlay>;
  nowMs: number;
  /** Render frame length, seconds (steps the knockouts). */
  dt: number;
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
  hits: FeelState["hits"];
}

/** Render frames longer than this step the knockouts as if they were this long (tab switches). */
const MAX_KNOCKOUT_DT = 0.05;

/** Starts knockouts for new eliminations and advances them (render-only). */
function stepKnockoutLayer(renderer: GameRenderer, state: GameState, dt: number): void {
  const { terrain } = state.arena;
  noteKnockoutEvents(renderer.knockout, {
    events: state.combat.events,
    victims: state.players,
    weaponOf: (id) => state.combat.fighters.get(id)?.weapon?.itemId ?? null,
  });
  stepKnockouts(renderer.knockout, {
    dt: Math.min(dt, MAX_KNOCKOUT_DT),
    gravity: state.tunables.world.gravity,
    solidAt: (x, y) => isSolidAt(terrain, x, y),
    tunables: state.tunables.feel.knockout,
    respawnDelaySeconds: state.tunables.match.respawnDelaySeconds,
  });
}

/** Blobs the player layer draws: the players in play, plus knocked-out blobs still flying. */
interface BlobFrame {
  players: PlayerState[];
  overlays: Map<string, BlobPoseOverlay>;
  weapons: Map<string, BlobWeapon>;
  hits: FeelState["hits"];
}

/**
 * Each flying knockout is the victim's own state moved to the knockout body (tumbling, so it rolls
 * with its travel), wearing the victim's weapon and hit flash; the squash is a pose overlay.
 */
function blobFrame(renderer: GameRenderer, state: GameState, frame: LayerFrame): BlobFrame {
  const blobs: BlobFrame = {
    players: [...frame.inPlay],
    overlays: new Map(diveBlobPoses(state.dive, state.tunables)),
    weapons: blobWeapons(state),
    hits: new Map(frame.hits),
  };
  const tunables = state.tunables.feel.knockout;
  for (const body of knockoutBodies(renderer.knockout, tunables)) {
    const victim = state.players.find((player) => player.id === body.victimId);
    if (victim) addKnockoutBlob(blobs, { body, victim, squash: tunables.squash });
  }
  return blobs;
}

function addKnockoutBlob(
  blobs: BlobFrame,
  {
    body,
    victim,
    squash,
  }: { body: KnockoutBody; victim: PlayerState; squash: { sx: number; sy: number } }
): void {
  const { id, victimId, x, y, vx, vy } = body;
  blobs.players.push({
    ...victim,
    id,
    x,
    y,
    vx,
    vy,
    grounded: false,
    tumbleSeconds: 1,
    crouching: false,
  });
  const weapon = blobs.weapons.get(victimId);
  if (weapon) blobs.weapons.set(id, weapon);
  const hit = blobs.hits.get(victimId);
  if (hit) blobs.hits.set(id, hit);
  if (body.squash <= 0) return;
  const k = body.squash;
  blobs.overlays.set(id, { rotation: 0, sx: 1 + (squash.sx - 1) * k, sy: 1 + (squash.sy - 1) * k });
}

/** Syncs every world-space layer to the state. */
function syncWorldLayers(renderer: GameRenderer, state: GameState, frame: LayerFrame): void {
  const { nowMs, zoom } = frame;
  stepKnockoutLayer(renderer, state, frame.dt);
  const blobs = blobFrame(renderer, state, frame);
  syncTerrainView(renderer.terrain, state.arena.terrain, zoom);
  syncKnockoutView(renderer.knockouts, {
    world: renderer.knockout,
    zoom,
    playerHeight: state.tunables.player.height,
    tunables: state.tunables.feel.knockout,
    respawnDelaySeconds: state.tunables.match.respawnDelaySeconds,
  });
  syncPlayersView(renderer.players, blobs.players, {
    nowMs,
    protectedIds: protectedIds(state),
    overlays: blobs.overlays,
    weapons: blobs.weapons,
    zoom,
    hits: blobs.hits,
    helmet: state.tunables.feel.helmet,
    feet: state.tunables.feel.feet,
    crouch: state.tunables.player.crouch,
  });
  syncDiveView(renderer.dive, state.dive);
  syncCollectiblesView(renderer.collectibles, {
    collectibles: state.collectibles,
    size: state.tunables.collectibles.size,
    crateSize: state.tunables.combat.drops.size,
    diveRefill: state.tunables.collectibles.diveRefill,
    terrain: state.arena.terrain,
    nowMs,
    zoom,
  });
  syncCombatView(renderer.combat, {
    combat: state.combat,
    players: frame.inPlay,
    timeSeconds: state.timeSeconds,
    maxHealth: state.tunables.combat.maxHealth,
    terrain: state.arena.terrain,
    zoom,
  });
  syncEffectsView(renderer.effects, {
    events: state.combat.events,
    timeSeconds: state.timeSeconds,
    zoom,
  });
}

/**
 * Reads this frame's game-feel cues. `frozen`: a hit-stop holds the world view; `offset`: the
 * screen shake (none under the OS reduced-motion setting).
 */
function readFeel(
  renderer: GameRenderer,
  frame: { state: GameState; nowMs: number }
): { frozen: boolean; offset: Vec2 | undefined } {
  const { state, nowMs } = frame;
  // Decided before reading: the hit's own frame still draws (with its flash), then it holds.
  const frozen = renderer.camera !== null && nowMs < renderer.feel.hitStopUntilMs;
  const reducedMotion = prefersReducedMotion();
  readFeelCues(renderer.feel, {
    events: state.combat.events,
    bodies: state.players,
    nowMs,
    feel: state.tunables.feel,
    // The rocket's blast is the full-size reference for the explosion shake.
    fullBlastRadius: blastReach(state.tunables, state.tunables.combat.rocket.power),
    reducedMotion,
    shake: renderer.shake,
  });
  const offset = reducedMotion
    ? undefined
    : cameraShakeOffset(renderer.shake, { nowMs, settings: state.tunables.feel.shake });
  return { frozen, offset };
}

/** Draws the latest state (no interpolation, lap D6). Call once per rendered frame. */
export function renderGame(
  renderer: GameRenderer,
  frame: { state: GameState; app: Application; dt: number }
): void {
  const { state, app, dt } = frame;
  const viewport = { width: app.screen.width, height: app.screen.height };
  const nowMs = performance.now();
  const { frozen, offset } = readFeel(renderer, { state, nowMs });

  if (frozen && renderer.camera) {
    applyCameraView(renderer.world, renderer.camera, { viewport, offset });
    syncHudView(renderer.hud, { state, viewport });
    return;
  }

  const inPlay = playersInPlay(state);
  const camera = frameCamera(renderer, { state, inPlay, viewport, dt });
  const worldHeight = state.arena.level.worldSize.h;
  syncBackdropView(renderer.backdrop, { viewport, camera, worldHeight, nowMs });
  syncWorldLayers(renderer, state, {
    inPlay,
    nowMs,
    dt,
    zoom: camera.zoom,
    hits: renderer.feel.hits,
  });
  applyCameraView(renderer.world, camera, { viewport, offset });
  syncHudView(renderer.hud, { state, viewport });
}

/** Frames the players in play and remembers the view for the next frame. */
function frameCamera(
  renderer: GameRenderer,
  frame: { state: GameState; inPlay: LayerFrame["inPlay"]; viewport: Viewport; dt: number }
): CameraView {
  const { state, inPlay, viewport, dt } = frame;
  const { level } = state.arena;
  renderer.camera = computeCameraView({
    targets: inPlay.map((player) => ({ x: player.x, y: player.y })),
    bounds: { x: 0, y: 0, w: level.worldSize.w, h: level.worldSize.h },
    viewport,
    previous: renderer.camera,
    padding: state.tunables.camera.padding,
    dt,
    settings: state.tunables.camera,
  });
  return renderer.camera;
}
