import { Container, type Application } from "pixi.js";
import {
  createTerrainView,
  syncTerrainView,
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
 *   ├─ world   (camera transform; world units)
 *   │  ├─ terrain   (arena)
 *   │  ├─ pickups (combat), point orbs (collectibles)
 *   │  ├─ effects (explosions), rockets (+ rocket tubes)   (combat)
 *   │  ├─ dive effects (impact pops)   (dive)
 *   │  ├─ players   (player; above effects so they never cover a player outline; protected
 *   │  │             players blink inside a dashed ring)
 *   │  └─ combat overlay (health chunks above each player)
 *   └─ hud     (screen units: timer card, player cards, round-result banner — hudRenderer)
 * Players waiting to respawn are not drawn and not framed by the camera.
 * Order follows DESIGN_LANGUAGE.md § 5. Each feature owns its layer's create/sync pair; this
 * file only orders and drives them. Sky / parallax backgrounds come with the visual pass.
 */
export interface GameRenderer {
  world: Container;
  terrain: TerrainView;
  players: PlayersView;
  combat: CombatView;
  collectibles: CollectiblesView;
  dive: DiveView;
  hud: HudView;
  camera: CameraView | null;
}

export function createGameRenderer(app: Application, state: GameState): GameRenderer {
  const world = new Container({ label: "world" });
  const terrain = createTerrainView(state.arena.terrain);
  const players = createPlayersView();
  const combat = createCombatView();
  const collectibles = createCollectiblesView();
  const dive = createDiveView();
  world.addChild(
    terrain.container,
    combat.pickups,
    collectibles.container,
    combat.effects,
    combat.rockets,
    dive.effects,
    players.container,
    combat.overlay
  );

  const hud = createHudView();
  app.stage.addChild(world, hud.root);
  return { world, terrain, players, combat, collectibles, dive, hud, camera: null };
}

/** Ids of players whose spawn protection is still running. */
const protectedIds = (state: GameState): Set<string> => {
  const ids = new Set<string>();
  for (const [id, fighter] of state.combat.fighters) {
    if (fighter.invulnerableUntil > state.timeSeconds) ids.add(id);
  }
  return ids;
};

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
  syncTerrainView(renderer.terrain, state.arena.terrain);
  syncPlayersView(renderer.players, inPlay, {
    nowMs,
    protectedIds: protectedIds(state),
    overlays: diveBlobPoses(state.dive, state.tunables),
  });
  syncDiveView(renderer.dive, state.dive);
  syncCollectiblesView(renderer.collectibles, {
    collectibles: state.collectibles,
    size: state.tunables.collectibles.size,
    nowMs,
  });
  syncCombatView(renderer.combat, {
    combat: state.combat,
    players: inPlay,
    timeSeconds: state.timeSeconds,
    maxHealth: state.tunables.combat.maxHealth,
    pickupSize: state.tunables.combat.drops.size,
  });

  renderer.camera = computeCameraView({
    targets: inPlay.map((player) => ({ x: player.x, y: player.y })),
    bounds: { x: 0, y: 0, w: level.worldSize.w, h: level.worldSize.h },
    viewport,
    previous: renderer.camera,
    padding: state.tunables.camera.padding,
    dt,
    settings: state.tunables.camera,
  });
  applyCameraView(renderer.world, renderer.camera, viewport);
  syncHudView(renderer.hud, { state, viewport });
}
