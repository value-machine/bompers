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
  type PlayersView,
} from "@/features/player/api/playerApi";
import {
  applyCameraView,
  computeCameraView,
  type CameraView,
} from "@/features/camera/api/cameraApi";
import { createCombatView, syncCombatView, type CombatView } from "@/features/combat/api/combatApi";
import {
  createEffectsView,
  syncEffectsView,
  type EffectsView,
} from "@/features/effects/api/effectsApi";
import {
  createCollectiblesView,
  syncCollectiblesView,
  type CollectiblesView,
} from "@/features/collectibles/api/collectiblesApi";
import { playersInPlay, type GameState } from "@/features/match/services/gameSim";
import { createHudView, syncHudView, type HudView } from "@/features/match/services/hudRenderer";

/**
 * Composes the render layers. Scene graph:
 *   stage
 *   ├─ backdrop (screen units: sky, sun, parallax hills and clouds — arena)
 *   ├─ world   (camera transform; world units)
 *   │  ├─ terrain   (arena: solid slabs, destructible tiles)
 *   │  ├─ contact shadows of pickups and rockets (combat)
 *   │  ├─ pickups (combat), point orbs (collectibles)
 *   │  ├─ effects (debris, explosions, impact pops — effects), rockets (+ trails, tubes — combat)
 *   │  ├─ players   (player; above effects so they never cover a player outline; protected
 *   │  │             players blink inside a dashed ring)
 *   │  └─ combat overlay (health chunks above each player)
 *   └─ hud     (screen units: timer card, player cards, round-result banner — hudRenderer)
 * Players waiting to respawn are not drawn and not framed by the camera.
 * Order follows DESIGN_LANGUAGE.md § 5. Each feature owns its layer's create/sync pair; this
 * file only orders and drives them. The camera is computed first, so every layer gets this
 * frame's zoom for its outline width clamp (DESIGN_LANGUAGE § 3).
 */
export interface GameRenderer {
  backdrop: BackdropView;
  world: Container;
  terrain: TerrainView;
  players: PlayersView;
  combat: CombatView;
  effects: EffectsView;
  collectibles: CollectiblesView;
  hud: HudView;
  camera: CameraView | null;
}

export function createGameRenderer(app: Application, state: GameState): GameRenderer {
  const world = new Container({ label: "world" });
  const backdrop = createBackdropView();
  const terrain = createTerrainView(state.arena);
  const players = createPlayersView();
  const combat = createCombatView();
  const effects = createEffectsView();
  const collectibles = createCollectiblesView();
  world.addChild(
    terrain.container,
    combat.shadows,
    combat.pickups,
    collectibles.container,
    effects.layer,
    combat.rockets,
    players.container,
    combat.overlay
  );

  const hud = createHudView();
  app.stage.addChild(backdrop.root, world, hud.root);
  return { backdrop, world, terrain, players, combat, effects, collectibles, hud, camera: null };
}

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
  /** Camera zoom this frame (outline width clamp). */
  zoom: number;
}

/** Syncs every world-space layer to the state. */
function syncWorldLayers(renderer: GameRenderer, state: GameState, frame: LayerFrame): void {
  const { inPlay, nowMs, zoom } = frame;
  syncTerrainView(renderer.terrain, state.arena.terrain, zoom);
  syncPlayersView(renderer.players, inPlay, { nowMs, protectedIds: protectedIds(state) });
  syncCollectiblesView(renderer.collectibles, {
    collectibles: state.collectibles,
    size: state.tunables.collectibles.size,
    nowMs,
    zoom,
  });
  syncCombatView(renderer.combat, {
    combat: state.combat,
    players: inPlay,
    timeSeconds: state.timeSeconds,
    maxHealth: state.tunables.combat.maxHealth,
    pickupSize: state.tunables.combat.drops.size,
    terrain: state.arena.terrain,
    zoom,
  });
  syncEffectsView(renderer.effects, {
    events: state.combat.events,
    timeSeconds: state.timeSeconds,
    zoom,
  });
}

/** Draws the latest state (no interpolation, lap D6). Call once per rendered frame. */
export function renderGame(
  renderer: GameRenderer,
  frame: { state: GameState; app: Application; dt: number }
): void {
  const { state, app, dt } = frame;
  const viewport = { width: app.screen.width, height: app.screen.height };
  const { level } = state.arena;
  const inPlay = playersInPlay(state);
  const nowMs = performance.now();

  const camera = computeCameraView({
    targets: inPlay.map((player) => ({ x: player.x, y: player.y })),
    bounds: { x: 0, y: 0, w: level.worldSize.w, h: level.worldSize.h },
    viewport,
    previous: renderer.camera,
    padding: state.tunables.camera.padding,
    dt,
    settings: state.tunables.camera,
  });
  renderer.camera = camera;
  const { zoom } = camera;

  syncBackdropView(renderer.backdrop, { viewport, camera, worldHeight: level.worldSize.h, nowMs });
  syncWorldLayers(renderer, state, { inPlay, nowMs, zoom });
  applyCameraView(renderer.world, camera, viewport);
  syncHudView(renderer.hud, { state, viewport });
}
