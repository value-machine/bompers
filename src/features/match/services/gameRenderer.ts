import { Container, type Application } from "pixi.js";
import {
  createTerrainView,
  isSolidAt,
  syncTerrainView,
  type TerrainView,
} from "@/features/arena/api/arenaApi";
import {
  createBackdropView,
  syncBackdropView,
  type BackdropView,
} from "@/features/backdrop/api/backdropApi";
import { resolveBackdropTheme } from "@/features/backdrop-themes/api/backdropThemesApi";
import {
  createPlayersView,
  PANIC_PUPIL_SCALE,
  syncPlayersView,
  type BlobPoseOverlay,
  type BlobWeapon,
  type PlayersView,
} from "@/features/blob-look/api/blobLookApi";
import { stepPlayers, type PlayerState } from "@/features/player/api/playerApi";
import {
  createKnockoutView,
  createKnockoutWorld,
  CRUSH_PANCAKE,
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
import { createFireView, syncFireView, type FireView } from "@/features/fire/api/fireApi";
import {
  burningBlobPoses,
  createBlobFireView,
  syncBlobFireView,
  type BlobFireView,
} from "@/features/blob-fire/api/blobFireApi";
import {
  createIceView,
  frozenBlobPoses,
  syncIceView,
  type IceView,
} from "@/features/ice/api/iceApi";
import { playersInPlay, type GameState } from "@/features/match/services/gameSim";
import { createHudView, syncHudView, type HudView } from "@/features/match/services/hudRenderer";

/** The element layers: fire on the ground, blobs on fire, frozen ground and its ray. */
const createElementViews = () => ({
  fire: createFireView(),
  blobFire: createBlobFireView(),
  ice: createIceView(),
});

/**
 * Composes the render layers. Scene graph:
 *   stage
 *   ├─ backdrop (screen units: the level's theme — sky, sun or moon, parallax bands, particles)
 *   ├─ world   (camera transform; world units)
 *   │  ├─ terrain   (arena: solid slabs, breakable tiles)
 *   │  ├─ contact shadows: weapon crates (collectibles), rockets (combat), players (player)
 *   │  ├─ weapon crates, headbutt resets, point orbs (collectibles)
 *   │  ├─ effects (debris, explosions, rocket-hit pops — effects)
 *   │  ├─ knockouts (goo droplets, loose helmets and tubes — knockout; its goo stains sit right above the terrain)
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
 * Game feel (DESIGN_LANGUAGE § 6), all render-only: `feel` turns new combat events and roll
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
  fire: FireView;
  blobFire: BlobFireView;
  ice: IceView;
  hud: HudView;
  camera: CameraView | null;
  feel: FeelState;
  shake: CameraShake;
}

export function createGameRenderer(app: Application, state: GameState): GameRenderer {
  const world = new Container({ label: "world" });
  const backdrop = createBackdropView(
    app.renderer,
    resolveBackdropTheme(state.arena.level.settings.themeId)
  );
  const terrain = createTerrainView(state.arena);
  const players = createPlayersView();
  const combat = createCombatView();
  const effects = createEffectsView();
  const knockouts = createKnockoutView();
  const collectibles = createCollectiblesView();
  const dive = createDiveView();
  const { fire, blobFire, ice } = createElementViews();
  world.addChild(
    terrain.container,
    // Goo stains colour the terrain itself; frozen ground and fire are drawn over them.
    knockouts.stainLayer,
    // Frozen ground under the flames: a fire next to ice stays readable.
    ice.terrainLayer,
    fire.terrainLayer,
    collectibles.shadows.container,
    combat.shadows.container,
    players.shadows,
    collectibles.crates,
    collectibles.refills.container,
    collectibles.orbs,
    collectibles.bursts,
    effects.layer,
    knockouts.layer,
    combat.rockets,
    dive.effects,
    players.container,
    fire.sprayLayer,
    blobFire.layer,
    ice.beamLayer,
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
    fire,
    blobFire,
    ice,
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

/** Ids of the players holding a torch: the fire layer draws the idle flame on their nozzle. */
const torchHolderIds = (weapons: ReadonlyMap<string, BlobWeapon>): Set<string> => {
  const ids = new Set<string>();
  for (const [id, weapon] of weapons) if (weapon.itemId === "torch") ids.add(id);
  return ids;
};

/** Ids of players whose spawn protection is still running. */
const protectedIds = (state: GameState): Set<string> => {
  const ids = new Set<string>();
  for (const [id, fighter] of state.combat.fighters) {
    if (fighter.invulnerableUntil > state.timeSeconds) ids.add(id);
  }
  return ids;
};

/** Pose overlays: a burning blob's panic hop, under the dive's pose when it dives (that puts it out). */
const blobOverlays = (
  state: GameState,
  frame: { inPlay: readonly PlayerState[]; nowMs: number }
): Map<string, BlobPoseOverlay> => {
  const overlays = burningBlobPoses(state.blobFire, { players: frame.inPlay, nowMs: frame.nowMs });
  for (const [id, pose] of diveBlobPoses(state.dive, state.tunables)) overlays.set(id, pose);
  // A frozen blob holds still in its block, whatever else it was doing.
  const frozen = frozenBlobPoses(state.ice, {
    players: frame.inPlay,
    timeSeconds: state.timeSeconds,
  });
  for (const [id, pose] of frozen) overlays.set(id, pose);
  for (const player of frame.inPlay) {
    if (player.squeeze && !overlays.has(player.id))
      overlays.set(player.id, squeezePose(player.squeeze));
  }
  return overlays;
};

/** Longest a squeezed blob stretches along the gap (it goes past the squash band, owner #64). */
const SQUEEZE_STRETCH_MAX = 1.6;

/**
 * A blob squeezed by a moving part (owner change round on #64): narrow across the squeeze, taller
 * along it, axis-aligned so the eyes stay upright; it springs back when the squeeze ends. The
 * eyes keep their size (the player renderer) and show the burning blob's panic (owner, squish-eyes).
 */
function squeezePose(squeeze: NonNullable<PlayerState["squeeze"]>): BlobPoseOverlay {
  const along = Math.min(SQUEEZE_STRETCH_MAX, 1 / squeeze.scale);
  const across = squeeze.scale;
  return Math.abs(squeeze.nx) >= Math.abs(squeeze.ny)
    ? { rotation: 0, sx: across, sy: along, pupilScale: PANIC_PUPIL_SCALE }
    : { rotation: 0, sx: along, sy: across, pupilScale: PANIC_PUPIL_SCALE };
}

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

/**
 * Starts knockouts for new eliminations and advances them (render-only). A flung knockout rolls
 * with the player controller's own shared roll (`stepPlayers` on its copy of the victim, no
 * input), so it tumbles, bounces and rolls downhill exactly like a hit blob.
 */
function stepKnockoutLayer(renderer: GameRenderer, state: GameState, dt: number): void {
  const { tunables } = state;
  const { terrain } = state.arena;
  noteKnockoutEvents(renderer.knockout, {
    events: state.combat.events,
    victims: state.players,
    weaponOf: (id) => state.combat.fighters.get(id)?.weapon?.itemId ?? null,
    tunables,
  });
  stepKnockouts(renderer.knockout, {
    dt: Math.min(dt, MAX_KNOCKOUT_DT),
    gravity: tunables.world.gravity,
    solidAt: (x, y) => isSolidAt(terrain, x, y),
    roll: (body, h) => stepPlayers({ players: [body], inputs: [], terrain, tunables, dt: h }),
    movers: terrain.movers,
    tunables: tunables.feel.knockout,
    respawnDelaySeconds: tunables.match.respawnDelaySeconds,
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
 * Each flying knockout is its rolling copy of the victim under its own id, wearing the victim's
 * weapon and hit flash; the squash is a pose overlay.
 */
function blobFrame(renderer: GameRenderer, state: GameState, frame: LayerFrame): BlobFrame {
  const blobs: BlobFrame = {
    players: [...frame.inPlay],
    overlays: blobOverlays(state, { inPlay: frame.inPlay, nowMs: frame.nowMs }),
    weapons: blobWeapons(state),
    hits: new Map(frame.hits),
  };
  const tunables = state.tunables.feel.knockout;
  for (const body of knockoutBodies(renderer.knockout, tunables)) {
    addKnockoutBlob(blobs, { body, squash: tunables.squash });
  }
  return blobs;
}

function addKnockoutBlob(
  blobs: BlobFrame,
  { body, squash }: { body: KnockoutBody; squash: { sx: number; sy: number } }
): void {
  const { id, victimId } = body;
  blobs.players.push({ ...body.player, id });
  const weapon = blobs.weapons.get(victimId);
  if (weapon) blobs.weapons.set(id, weapon);
  const hit = blobs.hits.get(victimId);
  if (hit) blobs.hits.set(id, hit);
  if (body.pancake) {
    // Crushed flat by a moving part (owner, moving-parts B3): thin across the squeeze.
    blobs.overlays.set(id, {
      rotation: Math.atan2(body.pancake.ny, body.pancake.nx),
      sx: CRUSH_PANCAKE.across,
      sy: CRUSH_PANCAKE.along,
      pupilScale: CRUSH_PANCAKE.pupilScale,
    });
    return;
  }
  if (body.squash <= 0) return;
  const k = body.squash;
  blobs.overlays.set(id, { rotation: 0, sx: 1 + (squash.sx - 1) * k, sy: 1 + (squash.sy - 1) * k });
}

/** Syncs every world-space layer to the state. */
function syncWorldLayers(renderer: GameRenderer, state: GameState, frame: LayerFrame): void {
  const { inPlay, nowMs, zoom } = frame;
  stepKnockoutLayer(renderer, state, frame.dt);
  const blobs = blobFrame(renderer, state, frame);
  syncTerrainView(renderer.terrain, state.arena.terrain, zoom);
  syncIceView(renderer.ice, {
    ice: state.ice,
    terrain: state.arena.terrain,
    players: inPlay,
    blob: state.tunables.ice.blob,
    nowMs,
    timeSeconds: state.timeSeconds,
    zoom,
  });
  syncFireView(renderer.fire, {
    fire: state.fire,
    terrain: state.arena.terrain,
    nowMs,
    players: inPlay,
    timeSeconds: state.timeSeconds,
    zoom,
    torchHolderIds: torchHolderIds(blobs.weapons),
    torchLength: state.tunables.combat.torch.length,
    burnSeconds: state.tunables.fire.burnSeconds,
  });
  syncBlobFireView(renderer.blobFire, {
    blobFire: state.blobFire,
    players: inPlay,
    nowMs,
    timeSeconds: state.timeSeconds,
    momentSeconds: state.tunables.fire.blob.momentSeconds,
  });
  syncKnockoutView(renderer.knockouts, {
    world: renderer.knockout,
    zoom,
    playerHeight: state.tunables.player.height,
    tunables: state.tunables.feel.knockout,
    respawnDelaySeconds: state.tunables.match.respawnDelaySeconds,
    terrain: state.arena.terrain,
  });
  syncPlayersView(renderer.players, blobs.players, {
    nowMs,
    protectedIds: protectedIds(state),
    overlays: blobs.overlays,
    weapons: blobs.weapons,
    zoom,
    hits: blobs.hits,
    helmet: state.tunables.feel.helmet,
    barrelPop: state.tunables.feel.barrelPop,
    feet: state.tunables.feel.feet,
    groundTilt: state.tunables.feel.groundTilt,
    crouch: state.tunables.player.crouch,
  });
  syncDiveView(renderer.dive, state.dive);
  syncCollectiblesView(renderer.collectibles, {
    collectibles: state.collectibles,
    size: state.tunables.collectibles.size,
    crateSize: state.tunables.combat.drops.size,
    diveRefill: state.tunables.collectibles.diveRefill,
    feel: state.tunables.feel.pickup,
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
