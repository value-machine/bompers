import { Container, type Application } from "pixi.js";
import {
  createBackdropView,
  createTerrainView,
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
  type PlayerState,
  type PlayersView,
} from "@/features/player/api/playerApi";
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
import {
  burningBlobPoses,
  createFireView,
  syncFireView,
  type FireView,
} from "@/features/fire/api/fireApi";
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
 *   │  ├─ effects (debris, explosions, rocket-hit pops — effects), rockets (+ trails — combat)
 *   │  ├─ dive effects (dive impact pops)   (dive)
 *   │  ├─ players   (player; above effects so they never cover a player outline; protected
 *   │  │             players blink inside a dashed ring)
 *   │  └─ combat overlay (health chunks above each player)
 *   └─ hud     (screen units: timer card, player cards, round-result banner — hudRenderer)
 * Players waiting to respawn are not drawn and not framed by the camera.
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
  collectibles: CollectiblesView;
  dive: DiveView;
  fire: FireView;
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
  const collectibles = createCollectiblesView();
  const dive = createDiveView();
  const fire = createFireView();
  world.addChild(
    terrain.container,
    fire.terrainLayer,
    collectibles.shadows.container,
    combat.shadows.container,
    players.shadows,
    collectibles.crates,
    collectibles.refills.container,
    collectibles.orbs,
    effects.layer,
    combat.rockets,
    dive.effects,
    players.container,
    fire.sprayLayer,
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
    collectibles,
    dive,
    fire,
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
  const overlays = burningBlobPoses(state.fire, { players: frame.inPlay, nowMs: frame.nowMs });
  for (const [id, pose] of diveBlobPoses(state.dive, state.tunables)) overlays.set(id, pose);
  return overlays;
};

interface LayerFrame {
  inPlay: ReturnType<typeof playersInPlay>;
  nowMs: number;
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
  hits: FeelState["hits"];
}

/** Syncs every world-space layer to the state. */
function syncWorldLayers(renderer: GameRenderer, state: GameState, frame: LayerFrame): void {
  const { inPlay, nowMs, zoom } = frame;
  const weapons = blobWeapons(state);
  syncTerrainView(renderer.terrain, state.arena.terrain, zoom);
  syncFireView(renderer.fire, {
    fire: state.fire,
    terrain: state.arena.terrain,
    nowMs,
    players: inPlay,
    timeSeconds: state.timeSeconds,
    momentSeconds: state.tunables.fire.blob.momentSeconds,
    zoom,
    torchHolderIds: torchHolderIds(weapons),
    torchLength: state.tunables.combat.torch.length,
    burnSeconds: state.tunables.fire.burnSeconds,
  });
  syncPlayersView(renderer.players, inPlay, {
    nowMs,
    protectedIds: protectedIds(state),
    overlays: blobOverlays(state, { inPlay, nowMs }),
    weapons,
    zoom,
    hits: frame.hits,
    helmet: state.tunables.feel.helmet,
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
    terrain: state.arena.terrain,
    nowMs,
    zoom,
  });
  syncCombatView(renderer.combat, {
    combat: state.combat,
    players: inPlay,
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
  syncWorldLayers(renderer, state, { inPlay, nowMs, zoom: camera.zoom, hits: renderer.feel.hits });
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
