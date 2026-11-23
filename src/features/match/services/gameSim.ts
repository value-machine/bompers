import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { isWeaponItemId } from "@/shared/config/weaponItems";
import { cuePointsPassed, motionCuePoints } from "@/shared/utils/levelMotion";
import {
  createArenaState,
  FIELD_BAND_SAMPLES,
  fieldNormalAt,
  moverAt,
  moversDistanceAt,
  type ArenaState,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import {
  inheritOnLeave,
  rideMovers,
  stepMoverPoses,
  type CarryMemory,
  type MovingRider,
  type PinnedBody,
} from "@/features/movers/api/moversApi";
import {
  normalizeLevelDefinition,
  type LevelDefinition,
  type LevelSettings,
} from "@/features/level/api/levelApi";
import {
  applyHit,
  eliminateFighter,
  type EliminateArgs,
  reportPartSound,
  createCombatState,
  reportTerrainDestroyed,
  stepCombat,
  takeWeaponPickups,
  type CombatState,
} from "@/features/combat/api/combatApi";
import {
  catchFire,
  createBlobFireState,
  douseBlob,
  isBurning,
  panicInputs,
  stepBurningBlobs,
  type BlobFireState,
} from "@/features/blob-fire/api/blobFireApi";
import { createFireState, sprayTorch, stepFire, type FireState } from "@/features/fire/api/fireApi";
import {
  createIceState,
  holdIcedBlobs,
  icedInputs,
  isFrozen,
  isIced,
  releaseBlob,
  sprayFreezeRay,
  stepFreezeSprays,
  stepFrozenBlobs,
  stepIce,
  type IceState,
} from "@/features/ice/api/iceApi";
import {
  createPhysicsObjectsState,
  objectsInPlay,
  popObject,
  stepPhysicsObjects,
  wakeObject,
  type ObjectBlast,
  type PhysicsObjectsState,
} from "@/features/physics-objects/api/physicsObjectsApi";
import {
  createKartsState,
  driverIds,
  driveKarts,
  kartRoundBodies,
  seatDrivers,
  seatedInputs,
  stepKarts,
  stepSeats,
  type KartHit,
  type KartsState,
} from "@/features/karts/api/kartsApi";
import {
  createCollectiblesState,
  stepCollectibles,
  stepDiveRefills,
  stepWeaponCrates,
  type CollectiblesState,
} from "@/features/collectibles/api/collectiblesApi";
import {
  createPlayer,
  escapeSolid,
  reactToHit,
  resolveBodyContacts,
  stepPlayers,
  type BodyContact,
  type PlayerState,
} from "@/features/player/api/playerApi";
import {
  createDiveState,
  isDiveSpent,
  refillDive,
  requestDive,
  stepDives,
  type DiveState,
} from "@/features/dive/api/diveApi";
import {
  awardOrbs,
  createMatchRulesState,
  isInPlay,
  killZoneOf,
  roundWinners,
  stepMatchRules,
  type MatchRulesState,
} from "@/features/match/services/matchRules";

/**
 * The simulation: `stepGame(state, inputs, dt)` advances one fixed step. Pure TS, no DOM, no
 * clock; it mutates `state` in place (the terrain grid is a byte array) and returns it.
 *
 * Systems order (each later concept slots into its numbered place):
 *   1. joinSlots       — a connected input slot without a player gets one
 *   1b. stepMovingParts — movers feature: moving parts take their pose for this step, then carry
 *                        and push the players in play and the weapon crates
 *   2. stepPlayers     — player feature: controller + terrain collision
 *   2b. bodyContacts   — player feature: blob-vs-blob bounce; the contacts feed step 3b
 *   3. stepCombat      — combat feature: rockets, blasts (damage, impulse, clearCrater);
 *                        unarmed fire goes through its `unarmedAttack` hook to the dive, a held
 *                        torch through its `sprayAttack` hook to the fire feature's `sprayTorch`,
 *                        a held freeze ray to the ice feature's `sprayFreezeRay` (it emits
 *                        puffs); then `stepFreezeSprays` flies the puffs of rays let go
 *   3g. stepPhysicsObjects — physics-objects feature: balls come back, move, bump blobs and each
 *                        other, take this step's blasts, torch, freeze ray and burning ground
 *                        (whole object), pop when stuck, burnt through or out of the kill zone.
 *                        Rockets explode on them in step 3; moving parts carry them in step 1b
 *   3h. stepKarts      — karts feature (kart lap): drivers' sticks and hops work on their karts
 *                        before 3g (`driveKarts`); after it each kart stays whole (fire, frost,
 *                        pops), its wheels are held together, the chassis springs, blobs stand
 *                        on or bump karts and fast karts hit blobs (combat's `applyHit`). Seats:
 *                        before step 2 `stepSeats` gets blobs in and out on a fresh down press;
 *                        seated drivers lose their stick, jump and down to the kart
 *                        (`seatedInputs`), skip blob contacts and step 1c, and sit on the seat
 *                        after step 2 and after 3h
 *   3e. stepIce        — ice feature: frozen samples whose time is over thaw (the ray itself
 *                        freezes inside step 3; this runs before 3c, so freezing puts fire out)
 *   3f. frozen blobs   — ice feature: before step 2 `icedInputs` empties a frozen blob's
 *                        inputs (jump presses crack its block); `stepFrozenBlobs` after 3e runs
 *                        chill down and ends blocks on time; after 3d fire and ice cancel on a
 *                        blob; after 3b a hit shatters a block and `holdIcedBlobs` sets the slide
 *   3c. stepFire      — fire feature: the front spreads through fuel; burnt-out samples go
 *                        (batched), reported as combat `terrainDestroyed` events
 *   3d. stepBurningBlobs — fire feature: blobs catch, go out (ice, dive), pass it on (bump) or
 *                        burn down (a chunk through combat's `applyHit`). Before step 2 its
 *                        `panicInputs` runs a burning blob with no move input away from the fire
 *   3a. stepWeaponCrates — collectibles feature: weapon crates drop, fall, land and get taken;
 *                        combat's `takeWeaponPickups` arms the collector
 *   3b. stepDives      — dive feature: the unarmed attack; its hits go through combat's `applyHit`
 *   4. stepHeadbuttResets — collectibles feature: a player with a spent dive touching a headbutt
 *                        reset takes it; the dive feature's `refillDive` gives the charge back
 *   4. stepCollectibles — collectibles feature: point orbs fall from the sky; touching one scores
 *   5. stepMatchRules  — out of the kill zone → elimination; scoring; eliminated players wait
 *                        `respawnDelaySeconds`, then respawn at the spawn farthest from opponents
 *                        with spawn protection and a fresh dive
 *   6. roundTimer      — counts down; at 0 the round ends (winners fixed) and systems 1–5 stop
 *
 * Steps 2–4 receive only the players in play: a player waiting to respawn is not moved, bumped,
 * hit or able to collect.
 */
/** Round progress (GDD § 5: points within a timed round). */
export interface MatchRoundState {
  phase: "playing" | "ended";
  remainingSeconds: number;
  /** Sim time the round ended, or null while playing. */
  endedAt: number | null;
  /** Slots with the top score at the end (several = a draw); empty while playing. */
  winners: number[];
}

/**
 * The whole simulation state of one match. Only the match feature knows this shape; systems
 * of other features receive the slices they need (`stepPlayers({ players, terrain, … })`).
 * New concepts add one slice here (e.g. `combat: CombatState`) and one system call in `stepGame`.
 */
export interface GameState {
  /** Fixed steps simulated so far. */
  tick: number;
  /** Simulated seconds so far. */
  timeSeconds: number;
  /** Settings for this match (a copy of the defaults, possibly overridden). */
  tunables: GameTunables;
  arena: ArenaState;
  /**
   * Leaving it eliminates; rockets and crates vanish outside it (`killZoneOf`: the level bounds,
   * grown far past the sides and top from this match's tunables).
   */
  killZone: Rect;
  /** What normalising the level corrected (unknown IDs etc.); empty for a clean level. */
  levelWarnings: string[];
  players: PlayerState[];
  /** Health, weapons, rockets and the combat event log (keyed by player id). */
  combat: CombatState;
  /** Unarmed attack (dive headbutt) state; `dive.hits` holds the last step's hits. */
  dive: DiveState;
  /** Fire on the terrain field and this step's torch sprays. */
  fire: FireState;
  /** Blobs on fire (their own feature; reads `fire` to catch from burning ground). */
  blobFire: BlobFireState;
  /** Frozen ground on the terrain field and this step's freeze rays. */
  ice: IceState;
  /** Each rider's carry velocity last step: a body leaving a moving part keeps it once (movers). */
  moverCarry: CarryMemory;
  /** Moving bodies the level placed (balls), whole-object fire and frost. */
  physicsObjects: PhysicsObjectsState;
  /** Karts the level placed (their wheels are in `physicsObjects`), seats and kart hits. */
  karts: KartsState;
  /** Sky drops: point orbs falling onto the collectible points, weapon crates from the drop points. */
  collectibles: CollectiblesState;
  /** Scores and the respawn queue. */
  rules: MatchRulesState;
  round: MatchRoundState;
}

export interface CreateGameStateArgs {
  /** Any level; it is normalised against the content catalog here. */
  level: LevelDefinition;
  /** Engine defaults (or lobby overrides); the level's settings apply on top. */
  tunables: GameTunables;
}

/** Per-level settings on top of the engine tunables (gravity is a multiplier). */
export function applyLevelSettings(tunables: GameTunables, settings: LevelSettings): GameTunables {
  return {
    ...tunables,
    world: { ...tunables.world, gravity: tunables.world.gravity * settings.gravity },
    match: {
      ...tunables.match,
      durationSeconds: settings.matchDurationS ?? tunables.match.durationSeconds,
      // A level's weapons win over the lobby's, like its duration (weapons-match-setting D1).
      weaponIds: settings.weaponIds?.filter(isWeaponItemId) ?? tunables.match.weaponIds,
    },
  };
}

export function createGameState({ level, tunables }: CreateGameStateArgs): GameState {
  const normalized = normalizeLevelDefinition(level);
  const matchTunables = applyLevelSettings(tunables, normalized.level.settings);
  const arena = createArenaState(normalized.level);
  const physicsObjects = createPhysicsObjectsState(normalized.level);
  const karts = createKartsState(normalized.level, physicsObjects);
  return {
    tick: 0,
    timeSeconds: 0,
    tunables: matchTunables,
    arena,
    fire: createFireState(arena.terrain),
    blobFire: createBlobFireState(),
    ice: createIceState(arena.terrain),
    moverCarry: new Map(),
    killZone: killZoneOf(normalized.level.bounds, matchTunables),
    levelWarnings: normalized.warnings,
    players: [],
    combat: createCombatState(),
    dive: createDiveState(),
    physicsObjects,
    karts,
    collectibles: createCollectiblesState(matchTunables, normalized.level.collectibles),
    rules: createMatchRulesState(matchTunables.match.maxPlayers),
    round: {
      phase: "playing",
      remainingSeconds: matchTunables.match.durationSeconds,
      endedAt: null,
      winners: [],
    },
  };
}

/** A joining player's spawn: its slot among the spawns no moving part covers now (level-orbit D4). */
const spawnPointFor = (state: GameState, slot: number): Vec2 => {
  const points = openSpawns(state);
  return points[slot % points.length] ?? { x: 0, y: 0 };
};

function joinSlots(state: GameState, inputs: PlayerInputs): void {
  const maxSlots = Math.min(inputs.length, state.tunables.match.maxPlayers);
  for (let slot = 0; slot < maxSlots; slot += 1) {
    if (!inputs[slot]?.connected) continue;
    if (state.players.some((player) => player.slot === slot)) continue;
    state.players.push(createPlayer(slot, spawnPointFor(state, slot), state.tunables));
  }
}

/** Players in play: not waiting to respawn and not eliminated earlier in this step. */
export const playersInPlay = (state: GameState): PlayerState[] =>
  state.players.filter(
    (player) =>
      isInPlay(state.rules, player) && state.combat.fighters.get(player.id)?.eliminated !== true
  );

function roundTimer(state: GameState, dt: number): void {
  const { round } = state;
  round.remainingSeconds = Math.max(0, round.remainingSeconds - dt);
  if (round.remainingSeconds > 0) return;
  round.phase = "ended";
  round.endedAt = state.timeSeconds + dt;
  // Combat stops with the round, so a clash held at the buzzer would steam and hiss on.
  state.combat.beamClashes = [];
  const slots = state.players.map((player) => player.slot);
  round.winners = roundWinners(state.rules.scores, slots);
}

/**
 * Step 1b: moving parts take their pose for the end of this step, then carry and push the players
 * in play and the weapon crates (movers feature), before anyone moves on their own.
 */
function stepMovingParts(state: GameState, players: PlayerState[], dt: number): void {
  const { terrain } = state.arena;
  if (terrain.movers.length === 0) return;
  stepMoverPoses(terrain, state.timeSeconds + dt);
  playPartSounds(state, dt);
  const crateBodies = crateRiders(state);
  const objects = objectsInPlay(state.physicsObjects);
  const objectBodies = objects.map((object) => riderOf(object, terrain));
  const bodies: MovingRider[] = [...players, ...crateBodies, ...objectBodies];
  const ride = rideMovers(terrain, bodies, {
    crushGapFraction: state.tunables.player.crushGapFraction,
  });
  const wasCarried = state.moverCarry;
  state.moverCarry = inheritOnLeave(state.moverCarry, bodies, { ride, dt });
  // Squeezed but alive: the player shrinks to fit for its own step and recovers when it opens.
  players.forEach((player, i) => {
    player.squeeze = ride.squeezed[i] ?? null;
  });
  crushPinnedPlayers(state, players, ride.pinned);
  syncCrates(state.collectibles.crates.list, crateBodies);
  rideObjects(state, {
    objects,
    objectBodies,
    pinned: ride.pinned,
    first: bodies.length - objects.length,
    carried: ride.carried,
    wasCarried,
    dt,
  });
}

/** Crates as riders. They have no horizontal speed: what they keep on leaving a part is its vertical speed. */
function crateRiders(state: GameState): MovingRider[] {
  const size = state.tunables.combat.drops.size;
  return state.collectibles.crates.list.map((crate) => ({
    id: `crate-${crate.id}`,
    x: crate.x,
    y: crate.y,
    width: size,
    height: size,
    vx: 0,
    vy: crate.vy,
  }));
}

/** Crates take their carried position and vertical speed back from their rider bodies. */
function syncCrates(
  crates: GameState["collectibles"]["crates"]["list"],
  bodies: readonly MovingRider[]
): void {
  crates.forEach((crate, i) => {
    const body = bodies[i]!;
    crate.x = body.x;
    crate.y = body.y;
    crate.vy = body.vy;
  });
}

/**
 * A physics object as a moving-part rider: a circle at its bottom no wider than the terrain
 * field's band (the ride reads round bodies on the field, which is exact only within the band),
 * so a big ball is carried by its feet like a blob. Its own step resolves the rest of its body.
 */
function riderOf(
  object: PhysicsObjectsState["objects"][number],
  terrain: TerrainGrid
): MovingRider {
  const proxy = Math.min(object.radius, FIELD_BAND_SAMPLES * terrain.cellSize * 0.75);
  return {
    id: object.id,
    x: object.x,
    y: object.y + object.radius,
    width: proxy * 2,
    height: proxy * 2,
    vx: object.vx,
    vy: object.vy,
  };
}

/** A part carried or pushed the ball this step (its rider body moved): a sleeping ball wakes. */
const partMoved = (object: PhysicsObjectsState["objects"][number], body: MovingRider): boolean =>
  Math.abs(body.x - object.x) > 1e-6 || Math.abs(body.y - object.radius - object.y) > 1e-6;

/**
 * A ball's own speed stays relative to the part it rides: leaving a part it keeps the part's
 * speed once (`inheritOnLeave`, like a blob) and remembers it; landing back on a part takes that
 * speed off again, so a bouncing ball never stacks the part's speed on top of the carry. Landing
 * on plain ground forgets it.
 */
function keepRelativeSpeed(
  object: PhysicsObjectsState["objects"][number],
  step: { body: MovingRider; by: Vec2 | null; wasCarried: boolean }
): void {
  if (step.by || partMoved(object, step.body)) wakeObject(object);
  const kept = { x: step.body.vx - object.vx, y: step.body.vy - object.vy };
  object.vx = step.body.vx;
  object.vy = step.body.vy;
  if (kept.x !== 0 || kept.y !== 0) object.heldCarry = kept;
  if (step.by && !step.wasCarried && object.heldCarry) {
    object.vx -= object.heldCarry.x;
    object.heldCarry = null;
  } else if (!step.by && object.grounded) {
    object.heldCarry = null;
  }
}

/**
 * Physics objects after the parts moved (step 1b): they take their carried position and speed;
 * one a part pins against terrain pops and comes back (it never crushes, physics-objects D3).
 */
function rideObjects(
  state: GameState,
  ride: {
    objects: readonly PhysicsObjectsState["objects"][number][];
    objectBodies: readonly MovingRider[];
    pinned: readonly PinnedBody[];
    first: number;
    carried: readonly (Vec2 | null)[];
    wasCarried: CarryMemory;
    dt: number;
  }
): void {
  ride.objects.forEach((object, i) => {
    const body = ride.objectBodies[i]!;
    const by = ride.carried[ride.first + i] ?? null;
    keepRelativeSpeed(object, { body, by, wasCarried: ride.wasCarried.has(object.id) });
    object.x = body.x;
    object.y = body.y - object.radius;
  });
  for (const pin of ride.pinned) {
    const object = ride.objects[pin.index - ride.first];
    if (!object) continue;
    popObject(state.physicsObjects, object, {
      now: state.timeSeconds,
      tunables: state.tunables,
      soundId: "thwap",
    });
  }
}

/**
 * Author-declared part sounds (owner B2; silent by default): `move` as a part passes its fastest
 * point, `end` at each turning point, timed from the same cycle as its pose (`motionCuePoints`).
 */
function playPartSounds(state: GameState, dt: number): void {
  const span = { t0: state.timeSeconds, t1: state.timeSeconds + dt };
  for (const mover of state.arena.terrain.movers) {
    const { move, end } = mover.sounds;
    if (!move && !end) continue;
    const points = motionCuePoints(mover.motion);
    const at = { x: mover.pivot.x + mover.pose.dx, y: mover.pivot.y + mover.pose.dy };
    const play = (soundId: string | null, cues: number[]) => {
      if (soundId && cuePointsPassed(mover.motion, cues, span) > 0) {
        reportPartSound(state.combat, { soundId, at, timeSeconds: state.timeSeconds });
      }
    };
    play(move, points.move);
    play(end, points.end);
  }
}

/**
 * The crush rule (owner, moving-parts D13): a player a moving part squeezes against terrain or
 * another part is eliminated, credited to the last hitter like a fall out of bounds. A pinned
 * crate just stays where it is.
 */
function crushPinnedPlayers(
  state: GameState,
  players: readonly PlayerState[],
  pinned: readonly PinnedBody[]
): void {
  const { tunables } = state;
  for (const pin of pinned) {
    const player = players[pin.index];
    if (!player) continue;
    eliminateFighter({
      combat: state.combat,
      player,
      cause: "crush",
      squeeze: { nx: pin.nx, ny: pin.ny, mover: pin.mover },
      tunables,
      timeSeconds: state.timeSeconds,
    });
  }
}

/**
 * Step 1c, the never-stuck invariant (owner, never-stuck): no player starts its own step inside
 * terrain or a moving part. A body something left overlapping solid (a part's push, a squeeze
 * letting go, terrain that grew around it) moves to the nearest free spot; where it fits only
 * smaller it is squeezed for this step, and where it fits nowhere above the crush size it is
 * trapped and the crush rule takes it like a pinned body.
 */
function freeStuckPlayers(state: GameState, players: readonly PlayerState[]): void {
  const { terrain } = state.arena;
  // A seated driver sits where its kart puts it; getting out frees it (kart K6).
  const seated = driverIds(state.karts);
  for (const player of players) {
    if (state.combat.fighters.get(player.id)?.eliminated === true) continue;
    if (seated.has(player.id)) continue;
    const minScale = state.tunables.player.crushGapFraction;
    if (escapeSolid(player, terrain, { minScale }) !== "trapped") continue;
    eliminateFighter({
      combat: state.combat,
      player,
      cause: "crush",
      ...trappedSqueeze(state, player),
      tunables: state.tunables,
      timeSeconds: state.timeSeconds,
    });
  }
}

/** The squeeze a trapped player's pancake follows: the part it is deepest in, if any. */
function trappedSqueeze(state: GameState, player: PlayerState): Pick<EliminateArgs, "squeeze"> {
  const { terrain } = state.arena;
  const center = { x: player.x, y: player.y - player.height / 2 };
  const inside = moverAt(terrain, center);
  if (!inside || inside.distance <= -player.width / 2) return {};
  const normal = fieldNormalAt(terrain, center);
  const mover = terrain.movers.indexOf(inside.mover);
  return { squeeze: { nx: normal.x, ny: normal.y, mover } };
}

/**
 * Step 1d, respawn on purpose (owner, never-stuck: the fallback when a blob is really stuck): a
 * player holding the respawn button for `selfRespawnHoldSeconds` without a break is eliminated
 * with cause `self` (the normal knockout: goo, splat, pop). Scored like a fall: a recent hitter
 * gets the kill, else it costs the player the fall penalty, so it never dodges a kill. Raw inputs:
 * a frozen blob can still bail out.
 */
function holdToRespawn(
  state: GameState,
  step: { players: readonly PlayerState[]; inputs: PlayerInputs; dt: number }
): void {
  const { tunables } = state;
  for (const player of step.players) {
    const held = step.inputs[player.slot]?.respawn === true;
    player.respawnHoldSeconds = held ? player.respawnHoldSeconds + step.dt : 0;
    if (player.respawnHoldSeconds < tunables.match.selfRespawnHoldSeconds) continue;
    player.respawnHoldSeconds = 0;
    eliminateFighter({
      combat: state.combat,
      player,
      cause: "self",
      tunables,
      timeSeconds: state.timeSeconds,
    });
  }
}

/** Steps 1–1d: join, moving parts carry and push, none left stuck, respawn holds. */
function joinAndRideParts(state: GameState, inputs: PlayerInputs, dt: number): PlayerState[] {
  joinSlots(state, inputs);
  const players = playersInPlay(state);
  stepMovingParts(state, players, dt);
  freeStuckPlayers(state, players);
  holdToRespawn(state, { players, inputs, dt });
  return players;
}

/**
 * Spawns no moving part covers right now (moving-parts D15): a body there would be pushed or
 * pinned at once. Used for respawns and, since level-orbit D4, for joining players too. All
 * spawns when every one is covered (the choice must not fail).
 */
function openSpawns(state: GameState): readonly Vec2[] {
  const { level, terrain } = state.arena;
  if (terrain.movers.length === 0) return level.spawns;
  const { width, height } = state.tunables.player;
  const open = level.spawns.filter(
    (spawn) => moversDistanceAt(terrain, { x: spawn.x, y: spawn.y - height / 2 }) <= -width / 2
  );
  return open.length > 0 ? open : level.spawns;
}

/** This step's explosions, as physics objects feel them (power back from the logged reach). */
function blastsThisStep(state: GameState): ObjectBlast[] {
  const { reachPerPower } = state.tunables.combat.blast;
  return state.combat.events.flatMap((event) =>
    event.type === "explosion" && event.timeSeconds === state.timeSeconds && reachPerPower > 0
      ? [{ at: { x: event.x, y: event.y }, power: event.radius / reachPerPower }]
      : []
  );
}

/**
 * Steps 3g and 3h: drivers work their karts, physics objects move (after combat so this step's
 * blasts and sprays reach them; seated drivers are part of their kart, not bumped), then karts
 * stay whole and meet the blobs; their hits go through combat's `applyHit`.
 */
function stepObjects(
  state: GameState,
  step: { players: readonly PlayerState[]; inputs: PlayerInputs; dt: number }
): void {
  const { players, dt } = step;
  const seated = driverIds(state.karts);
  const now = state.timeSeconds;
  driveKarts(state.karts, { ...step, physics: state.physicsObjects, now });
  stepPhysicsObjects(state.physicsObjects, {
    terrain: state.arena.terrain,
    players: players.filter((player) => !seated.has(player.id)),
    killZone: state.killZone,
    blasts: blastsThisStep(state),
    fire: state.fire,
    ice: state.ice,
    blobFire: state.blobFire,
    isDiving: (player) => isDiving(state, player),
    now,
    dt,
    tunables: state.tunables,
  });
  const hits = stepKarts(state.karts, {
    physics: state.physicsObjects,
    terrain: state.arena.terrain,
    players,
    now,
    dt,
    tunables: state.tunables,
  });
  applyKartHits(state, { players, hits });
}

/**
 * Kart hits (owner Q3, kart K7): one chunk like a headbutt through combat's `applyHit` (so the
 * hurt feedback follows), credited to the driver, and the victim rolls as hard as it was pushed.
 */
function applyKartHits(
  state: GameState,
  step: { players: readonly PlayerState[]; hits: readonly KartHit[] }
): void {
  const { tunables, timeSeconds } = state;
  const world = { combat: state.combat, players: [...step.players], tunables, timeSeconds };
  for (const hit of step.hits) {
    applyHit(world, {
      victimSlot: hit.victim.slot,
      attackerSlot: hit.attackerSlot,
      kind: "contact",
      source: "kart",
      contactPoint: hit.at,
      direction: hit.direction,
    });
    reactToHit(hit.victim, { impulse: hit.impulse }, tunables);
  }
}

/** Rockets explode on the physics objects in play and on karts' chassis (step 3). */
const roundBodiesOf = (state: GameState) => [
  ...objectsInPlay(state.physicsObjects).map((object) => ({
    center: { x: object.x, y: object.y },
    radius: object.radius,
  })),
  ...kartRoundBodies(state.karts),
];

/** Step 3a: right after combat, so a player eliminated by a rocket this step cannot collect. */
function stepCratePickups(state: GameState, dt: number): void {
  const { tunables, timeSeconds } = state;
  const { level, terrain } = state.arena;
  const players = playersInPlay(state);
  const pickups = stepWeaponCrates({
    crates: state.collectibles.crates,
    drops: level.drops,
    players,
    terrain,
    bounds: state.killZone,
    tunables,
    dt,
    bursts: state.collectibles.bursts,
  });
  takeWeaponPickups({ combat: state.combat, players, tunables, timeSeconds }, pickups);
}

/**
 * Step 4 (before the orbs): headbutt resets. Only players in play whose dive charge is spent may
 * take one (headbutt-reset D2); taking it refills their dive mid-flight.
 */
function stepHeadbuttResets(state: GameState, dt: number): void {
  const spent = playersInPlay(state).filter((player) => isDiveSpent(state.dive, player));
  const taken = stepDiveRefills({
    refills: state.collectibles.diveRefills,
    players: spent,
    tunables: state.tunables,
    dt,
  });
  for (const { slot } of taken) {
    const player = spent.find((candidate) => candidate.slot === slot);
    if (player) refillDive(state.dive, player);
  }
}

/**
 * Step 3c: fire spreads and burns out. A burnt batch throws debris from a few places in the
 * batch itself (a fire burns out along a front, so one centre would sit where nothing burns),
 * and sounds once however many places it shows: fire's own burn-out, not the material's sound.
 */
function stepFireOnTerrain(state: GameState): void {
  const batch = stepFire(state.fire, state.arena.terrain, {
    now: state.timeSeconds,
    tunables: state.tunables,
  });
  if (!batch) return;
  batch.spots.forEach((at, i) => {
    reportTerrainDestroyed(state.combat, {
      cleared: batch,
      at,
      timeSeconds: state.timeSeconds,
      soundId: i > 0 ? "none" : "burn-out",
    });
  });
}

/**
 * Steps 3c and 3d: the terrain fire, then blobs on fire catch, go out or pass it on; each burn
 * tick takes a chunk through combat's `applyHit` (kind `burn`, credited to whoever lit it) and
 * gives the hit reaction with no push. Dive phases are the previous step's (the dive steps later).
 */
function stepBlobsOnFire(
  state: GameState,
  step: { players: PlayerState[]; contacts: readonly BodyContact[] }
): void {
  stepFireOnTerrain(state);
  const { tunables, timeSeconds } = state;
  const downs = stepBurningBlobs(state.blobFire, {
    fire: state.fire,
    terrain: state.arena.terrain,
    players: step.players,
    contacts: step.contacts,
    isDiving: (player) => isDiving(state, player),
    now: timeSeconds,
    tunables,
  });
  const world = { combat: state.combat, players: step.players, tunables, timeSeconds };
  for (const down of downs) {
    applyHit(world, {
      victimSlot: down.player.slot,
      attackerSlot: down.bySlot,
      kind: "burn",
      source: "fire",
      contactPoint: down.at,
      direction: { x: 0, y: 1 },
    });
    reactToHit(down.player, { impulse: { x: 0, y: 0 } }, tunables);
  }
}

/** The blobs a torch's flame reached catch fire, lit by the holder (fire-burn b2). */
function torchBlobs(state: GameState, holder: PlayerState, reached: readonly PlayerState[]): void {
  const lit = { now: state.timeSeconds, fromX: holder.x, bySlot: holder.slot };
  for (const blob of reached) catchFire(state.blobFire, blob, lit);
}

/** Winding up or travelling in a dive (the previous step's phase: the dive steps later). */
const isDiving = (state: GameState, player: PlayerState): boolean => {
  const phase = state.dive.motions[player.id]?.phase;
  return phase === "windup" || phase === "travel";
};

/** A freeze ray chills a blob unless it is in a dive or under spawn protection (D1, D3). */
const canChill = (state: GameState, player: PlayerState): boolean =>
  !isDiving(state, player) &&
  (state.combat.fighters.get(player.id)?.invulnerableUntil ?? 0) <= state.timeSeconds;

/**
 * Ice and fire cancel on a blob (ice-frozen-blobs D6): one that burns and carries ice in the
 * same step is put out and loses the ice. So a freeze ray puts a burning blob out before any
 * chill stays, and the torch or burning ground melts a block without lighting the blob for that
 * touch (the fire's own grace).
 */
function cancelFireAndIce(state: GameState, players: readonly PlayerState[]): void {
  const at = { now: state.timeSeconds, tunables: state.tunables };
  for (const player of players) {
    if (!isBurning(state.blobFire, player) || !isIced(state.ice, player)) continue;
    douseBlob(state.blobFire, player, at);
    releaseBlob(state.ice, player, { ...at, kind: "melt" });
  }
}

/**
 * End of the step for ice blocks (D4, D5): a hit that landed on one this step shatters it (the
 * hit itself stays as it was), and the blocks that remain get their slide for the next step,
 * after the dive has written the motion modifiers.
 */
function stepIceBlocks(state: GameState, players: readonly PlayerState[]): void {
  if (state.ice.blobs.size === 0) return;
  const at = { now: state.timeSeconds, tunables: state.tunables };
  for (const event of state.combat.events) {
    if (event.type !== "playerHit" || event.timeSeconds !== state.timeSeconds) continue;
    const victim = players.find((player) => player.slot === event.victimSlot);
    if (victim && isFrozen(state.ice, victim)) {
      releaseBlob(state.ice, victim, { ...at, kind: "shatter" });
    }
  }
  holdIcedBlobs(state.ice, players, state.tunables);
}

/**
 * The ice's say before the step: a frozen blob has no control, its jump presses crack the block
 * instead (ice-frozen-blobs D7); a chilled one runs slower (freeze-ray buff A); and a block
 * shatters for more on this step's next hit (buff B).
 */
function iceStepStart(
  state: GameState,
  players: readonly PlayerState[],
  inputs: PlayerInputs
): PlayerInputs {
  markShatterBonus(state, players);
  return icedInputs(state.ice, players, {
    inputs,
    now: state.timeSeconds,
    tunables: state.tunables,
  });
}

/**
 * Before this step's hits: a frozen blob's block shatters on the next direct hit for
 * `ice.blob.shatterDamage` chunks more (freeze-ray buff B), read by combat's `applyHit`.
 */
function markShatterBonus(state: GameState, players: readonly PlayerState[]): void {
  const bonus = state.combat.bonusDamage;
  bonus.clear();
  if (state.ice.blobs.size === 0) return;
  for (const player of players) {
    if (isFrozen(state.ice, player)) bonus.set(player.slot, state.tunables.ice.blob.shatterDamage);
  }
}

interface ContactStep {
  players: PlayerState[];
  contacts: readonly BodyContact[];
  dt: number;
}

/**
 * Steps 3g, 3e, 3f, 3c, 3d: physics objects first (this step's blasts and sprays reach them); ice before fire, so a burning sample frozen this step is out before the
 * fire spreads again; then the blobs' ice and fire, which cancel on a blob that has both.
 */
function stepElements(state: GameState, step: ContactStep & { inputs: PlayerInputs }): void {
  const { tunables, timeSeconds } = state;
  // Puffs of freeze rays let go this step or earlier fly on, land and chill (freeze-ray-particles
  // D1); the objects then read every ray's puffs.
  const flight = { terrain: state.arena.terrain, tunables, now: timeSeconds, dt: step.dt };
  stepFreezeSprays(state.ice, {
    ...flight,
    players: step.players,
    canChill: (blob) => canChill(state, blob),
  });
  stepObjects(state, step);
  stepIce(state.ice, state.arena.terrain, { now: timeSeconds });
  stepFrozenBlobs(state.ice, { players: step.players, now: timeSeconds, dt: step.dt, tunables });
  stepBlobsOnFire(state, step);
  cancelFireAndIce(state, step.players);
}

/**
 * Step 3b, then the ice blocks' end of step. The dive gets the same in-play list as the
 * contacts: a blob eliminated by a rocket this step still finishes its bounce, and `applyHit`
 * refuses damage on it.
 */
function stepDivesAndBlocks(state: GameState, step: ContactStep & { inputs: PlayerInputs }): void {
  stepDives({
    dive: state.dive,
    players: step.players,
    combat: state.combat,
    contacts: step.contacts,
    inputs: step.inputs,
    tunables: state.tunables,
    timeSeconds: state.timeSeconds,
    dt: step.dt,
  });
  stepIceBlocks(state, step.players);
}

/**
 * Seats, then step 2 and 2b: blobs get in and out of karts on a fresh down press (this step's
 * inputs), seated drivers give their stick, jump and down to the kart and sit on the seat after
 * moving, and only blobs on foot bounce off each other. Returns the drivers' own inputs (aim and
 * fire kept, for combat and the dive) and the body contacts.
 */
function movePlayers(
  state: GameState,
  step: { players: PlayerState[]; inputs: PlayerInputs; dt: number }
): { own: PlayerInputs; contacts: readonly BodyContact[] } {
  const { tunables, timeSeconds } = state;
  const { terrain } = state.arena;
  const { players, inputs, dt } = step;
  const seats = { physics: state.physicsObjects, terrain, tunables, now: timeSeconds };
  stepSeats(state.karts, { ...seats, players, inputs });
  const own = seatedInputs(state.karts, players, inputs);
  // A burning blob with no move input runs from the fire (fire-burn D2); combat keeps the real inputs.
  const moving = seatedInputs(state.karts, players, panicInputs(state.blobFire, players, inputs));
  stepPlayers({ players, inputs: moving, terrain, tunables, dt });
  seatDrivers(state.karts, players);
  const seated = driverIds(state.karts);
  const onFoot = players.filter((player) => !seated.has(player.id));
  return { own, contacts: resolveBodyContacts({ players: onFoot, terrain, tunables }) };
}

function stepPlay(state: GameState, rawInputs: PlayerInputs, dt: number): void {
  const { tunables, timeSeconds } = state;
  const { level, terrain } = state.arena;
  const players = joinAndRideParts(state, rawInputs, dt);
  const iced = iceStepStart(state, players, rawInputs);
  const { own: inputs, contacts } = movePlayers(state, { players, inputs: iced, dt });
  const seated = driverIds(state.karts);
  stepCombat({
    combat: state.combat,
    players,
    inputs,
    terrain,
    bounds: state.killZone,
    tunables,
    timeSeconds,
    dt,
    roundBodies: roundBodiesOf(state),
    // A seated driver fires its weapon from the seat; unarmed it has no dive (it would leave the seat).
    unarmedAttack: ({ attacker }) =>
      seated.has(attacker.id) ? undefined : requestDive(state.dive, attacker, tunables),
    sprayAttack: ({ attacker, itemId, reach }) => {
      const spray = { terrain, players, holder: attacker, tunables, now: timeSeconds, dt, reach };
      if (itemId !== "freeze-ray") torchBlobs(state, attacker, sprayTorch(state.fire, spray));
      else sprayFreezeRay(state.ice, { ...spray, canChill: (blob) => canChill(state, blob) });
    },
    // The kart owns a seated driver's motion and the dive its diver's: spray recoil moves
    // neither (spray-recoil D4).
    steadyShooter: (shooter) => seated.has(shooter.id) || isDiving(state, shooter),
  });
  // The karts read their drivers' stick and jump (the inputs before the seat took them).
  stepElements(state, { players, contacts, inputs: iced, dt });
  stepCratePickups(state, dt);
  stepDivesAndBlocks(state, { players, contacts, inputs, dt });
  stepHeadbuttResets(state, dt);
  const collected = stepCollectibles({
    collectibles: state.collectibles,
    points: level.collectibles,
    // Re-read: a player eliminated in step 3 cannot collect in the same step.
    players: playersInPlay(state),
    tunables,
    dt,
  });
  awardOrbs(state.rules, collected, tunables.match.scoring);
  stepMatchRules({
    rules: state.rules,
    combat: state.combat,
    dive: state.dive,
    players: state.players,
    spawns: openSpawns(state),
    bounds: level.bounds,
    killZone: state.killZone,
    tunables,
    timeSeconds,
  });
  roundTimer(state, dt);
}

/** Advances the game one fixed step of `dt` seconds. */
export function stepGame(state: GameState, inputs: PlayerInputs, dt: number): GameState {
  if (state.round.phase === "playing") stepPlay(state, inputs, dt);
  state.tick += 1;
  state.timeSeconds += dt;
  return state;
}
