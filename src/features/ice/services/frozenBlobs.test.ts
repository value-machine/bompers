import { describe, expect, it } from "vitest";
import { isInJuiceWindow } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import {
  createPlayer,
  hurtCenter,
  stepPlayers,
  type PlayerState,
} from "@/features/player/api/playerApi";
import { helmetPoint } from "@/features/combat/api/combatApi";
import {
  BLOCK_LOOK,
  blockBox,
  crackLines,
  frozenBlobPoses,
  shardTriangle,
} from "@/features/ice/services/blobIceRenderer";
import { sprayFreezeRay } from "@/features/ice/services/freezeRay";
import {
  chillSlow,
  CRACK_HOP_SECONDS,
  icedInputs,
  holdIcedBlobs,
  isFrozen,
  isIced,
  releaseBlob,
  stepFrozenBlobs,
} from "@/features/ice/services/frozenBlobs";
import { createIceState } from "@/features/ice/services/iceSim";

const TUNABLES = DEFAULT_GAME_TUNABLES;
const B = TUNABLES.ice.blob;
const FLOOR = 200;
const dt = 1 / 120;

const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "b", title: "B" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 1200, h: 300 },
  terrain: [{ shape: { type: "rect", x: 0, y: FLOOR, w: 1200, h: 40 }, materialId: "stone" }],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 1200, h: 300 },
};

/** A holder aiming right at a victim 60 units away, both standing on the floor. */
function scene(floor = "stone") {
  const terrain = buildTerrainFromLevel({
    ...level,
    terrain: level.terrain.map((piece) => ({ ...piece, materialId: floor })),
  });
  const ice = createIceState(terrain);
  const holder = createPlayer(0, { x: 200, y: FLOOR }, TUNABLES);
  holder.aimX = 1;
  holder.aimY = 0;
  const victim = createPlayer(1, { x: 260, y: FLOOR }, TUNABLES);
  const players = [holder, victim];
  const world = { time: 0 };
  const step = (seconds: number, ray: boolean, canChill?: (player: PlayerState) => boolean) => {
    for (let i = 0; i < Math.round(seconds / dt); i += 1) {
      const now = world.time;
      if (ray)
        sprayFreezeRay(ice, { terrain, players, holder, tunables: TUNABLES, now, dt, canChill });
      stepFrozenBlobs(ice, { players, now, dt, tunables: TUNABLES });
      world.time += dt;
    }
  };
  /** The sim's inputs for one step with the victim's jump held or not. */
  const press = (jump: boolean): PlayerInputs => {
    const raw = mapPlayerInputs({ heldKeys: new Set(), gamepads: [] });
    const inputs = raw.map((input, slot) =>
      slot === 1 ? { ...input, connected: true, jump, moveX: 1, fire: true } : input
    );
    return icedInputs(ice, players, { inputs, now: world.time, tunables: TUNABLES });
  };
  return { terrain, ice, holder, victim, players, world, step, press };
}

describe("frozen blobs (ice-frozen-blobs D1)", () => {
  it("should freeze a blob when it has been in the ray for the freeze time", () => {
    const s = scene();
    s.step(B.freezeSeconds - 0.1, true);
    expect(isFrozen(s.ice, s.victim)).toBe(false);
    expect(isIced(s.ice, s.victim)).toBe(true);
    s.step(0.1, true);
    expect(isFrozen(s.ice, s.victim)).toBe(true);
    expect(s.ice.frozeCounts[s.victim.id]).toBe(1);
    expect(isIced(s.ice, s.holder)).toBe(false);
  });

  it("should freeze a blob when two short sweeps land within the chill hold", () => {
    const s = scene();
    s.step(0.3, true);
    s.step(B.chillHoldSeconds - 0.1, false);
    expect(isIced(s.ice, s.victim)).toBe(true);
    s.step(0.3, true);
    expect(isFrozen(s.ice, s.victim)).toBe(true);
  });

  it("should not freeze a blob when its sweeps are further apart than the hold and drain", () => {
    const s = scene();
    s.step(0.3, true);
    s.step(B.chillHoldSeconds + 0.4, false);
    expect(isIced(s.ice, s.victim)).toBe(false);
    s.step(0.3, true);
    expect(isFrozen(s.ice, s.victim)).toBe(false);
  });

  it("should slow the run input and raise gravity by the chill share when a blob is chilled", () => {
    const s = scene();
    s.step(B.freezeSeconds / 2, true);
    const slow = B.chillSlowMax / 2;
    expect(chillSlow(s.ice, s.victim, TUNABLES)).toBeCloseTo(slow, 2);
    expect(s.press(false)[1]!.moveX).toBeCloseTo(1 - slow, 2);
    s.victim.gravityScale = 1;
    holdIcedBlobs(s.ice, s.players, TUNABLES);
    expect(s.victim.gravityScale).toBeCloseTo(1 + slow, 2);
    expect(s.holder.gravityScale).toBe(1);
  });

  it("should freeze a blob faster when it stands on slippery ground", () => {
    const s = scene("ice");
    s.victim.grounded = true;
    s.step(B.freezeSeconds / B.slipperyChillScale + dt, true);
    expect(isFrozen(s.ice, s.victim)).toBe(true);
  });

  it("should take twice as long to freeze when the blob is crouching", () => {
    const s = scene();
    s.victim.crouching = true;
    // A crouched blob hides low (crouch-sink D4): aim from the helmet at its lowered centre.
    const from = helmetPoint(s.holder);
    const to = hurtCenter(s.victim);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    s.holder.aimX = (to.x - from.x) / length;
    s.holder.aimY = (to.y - from.y) / length;
    s.step(B.freezeSeconds + 0.1, true);
    expect(isFrozen(s.ice, s.victim)).toBe(false);
    s.step(B.freezeSeconds, true);
    expect(isFrozen(s.ice, s.victim)).toBe(true);
  });

  it("should never chill a blob when it may not be chilled (a dive, spawn protection)", () => {
    const s = scene();
    s.step(1, true, () => false);
    expect(isIced(s.ice, s.victim)).toBe(false);
  });

  it("should empty a frozen blob's inputs when it is frozen", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    const input = s.press(false)[1]!;
    expect(input).toMatchObject({ connected: true, moveX: 0, jump: false, fire: false });
  });

  it("should break the block when jump is pressed for the third time", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    s.press(false);
    for (let i = 0; i < B.cracksToBreak - 1; i += 1) {
      s.press(true);
      s.press(false);
    }
    expect(isFrozen(s.ice, s.victim)).toBe(true);
    expect(s.ice.crackCounts[s.victim.id]).toBe(B.cracksToBreak - 1);
    // Holding it is one press, not many.
    s.press(false);
    s.press(true);
    expect(isFrozen(s.ice, s.victim)).toBe(false);
    expect(s.ice.shatterCounts[s.victim.id]).toBe(1);
    expect(s.ice.blobMoments.map((moment) => moment.kind)).toContain("shatter");
    // Control is back on the next step.
    expect(s.press(false)[1]?.moveX).toBe(1);
  });

  it("should not count a jump held at the freeze as a press", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    for (let i = 0; i < 10; i += 1) s.press(true);
    expect(s.ice.crackCounts[s.victim.id] ?? 0).toBe(0);
  });
});

describe("ice block: how it ends and slides", () => {
  it("should break the block by itself when the frozen time is over", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    s.step(B.frozenSeconds - 0.1, false);
    expect(isFrozen(s.ice, s.victim)).toBe(true);
    s.step(0.2, false);
    expect(isIced(s.ice, s.victim)).toBe(false);
  });

  it("should gather no chill during the grace when a block just ended", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    releaseBlob(s.ice, s.victim, { kind: "shatter", now: s.world.time, tunables: TUNABLES });
    s.step(B.graceSeconds - 0.1, true);
    expect(isIced(s.ice, s.victim)).toBe(false);
    s.step(0.2, true);
    expect(isIced(s.ice, s.victim)).toBe(true);
  });

  it("should leave steam and no shatter count when fire melts the block", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    expect(
      releaseBlob(s.ice, s.victim, { kind: "melt", now: s.world.time, tunables: TUNABLES })
    ).toBe(true);
    expect(s.ice.blobMoments.map((moment) => moment.kind)).toContain("melt");
    expect(s.ice.shatterCounts[s.victim.id]).toBeUndefined();
  });

  it("should slide several times further than a free blob when a frozen blob is shoved", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    // The free blob runs on ground the beam never froze (the frost fan's low rays freeze the
    // floor in front of the holder), so it compares a block with a blob on plain ground.
    const plain = scene();
    const free = createPlayer(2, { x: 260, y: FLOOR }, TUNABLES);
    const idle = mapPlayerInputs({ heldKeys: new Set(), gamepads: [] });
    const both = (): void => {
      stepPlayers({
        players: [s.victim],
        inputs: idle,
        terrain: s.terrain,
        tunables: TUNABLES,
        dt,
      });
      stepPlayers({
        players: [free],
        inputs: idle,
        terrain: plain.terrain,
        tunables: TUNABLES,
        dt,
      });
    };
    both();
    for (const blob of [s.victim, free]) blob.vx = 300;
    for (let i = 0; i < 120; i += 1) {
      holdIcedBlobs(s.ice, [s.victim, free], TUNABLES);
      both();
    }
    expect(s.victim.jumpLocked).toBe(true);
    expect(s.victim.x - 260).toBeGreaterThan(3 * (free.x - 260));
  });
});

describe("ice block look", () => {
  it("should give a frozen blob pinprick pupils and a hop when its block cracks", () => {
    const s = scene();
    s.step(B.freezeSeconds, true);
    s.press(false);
    s.press(true);
    const frame = { players: s.players, timeSeconds: s.world.time + CRACK_HOP_SECONDS / 2 };
    const pose = frozenBlobPoses(s.ice, frame).get(s.victim.id);
    expect(pose?.pupilScale).toBe(BLOCK_LOOK.frozenPupilScale);
    expect(pose?.lift).toBeCloseTo(BLOCK_LOOK.hopHeight, 5);
    expect(frozenBlobPoses(s.ice, frame).has(s.holder.id)).toBe(false);
  });

  it("should wrap the whole blob when the block is full size", () => {
    const { victim } = scene();
    const box = blockBox(victim, { scale: 1, lift: 0 });
    expect(box.x).toBeLessThan(victim.x - victim.width / 2);
    expect(box.y).toBeLessThan(victim.y - victim.height);
    expect(box.y + box.h).toBeGreaterThan(victim.y);
    expect(crackLines(box, 2)).toHaveLength(2);
    expect(crackLines(box, 9)).toHaveLength(3);
  });

  it("should throw shards outward and shrink them when the block breaks", () => {
    const center = { x: 0, y: 0 };
    const size = (k: number) => {
      const [a, b] = shardTriangle(center, 0, k);
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };
    const reach = (k: number) => Math.hypot(shardTriangle(center, 0, k)[0]!.x, 0);
    expect(size(1)).toBeLessThan(size(0));
    expect(reach(1)).toBeGreaterThan(reach(0));
  });

  it("should keep its timings inside the juice windows", () => {
    expect(isInJuiceWindow("linger", B.momentSeconds)).toBe(true);
    expect(isInJuiceWindow("effect", B.momentSeconds * BLOCK_LOOK.popShare)).toBe(true);
    expect(isInJuiceWindow("squash", CRACK_HOP_SECONDS)).toBe(true);
  });
});

describe("freeze ray on moving parts (mover-materials lap 1)", () => {
  /** A cardboard part (piece 1) between the holder and a victim; raised 120 it is out of the way. */
  const partScene = () => {
    const terrain = buildTerrainFromLevel({
      ...level,
      terrain: [
        ...level.terrain,
        { shape: { type: "rect", x: 228, y: 100, w: 8, h: 100 }, materialId: "cardboard" },
      ],
      movers: [
        {
          motion: { kind: "slide", offset: { x: 0, y: -120 }, periodS: 4, phase: 0 },
          pivot: { x: 232, y: 150 },
          terrainIndices: [1],
        },
      ],
    });
    const ice = createIceState(terrain);
    const holder = createPlayer(0, { x: 200, y: FLOOR }, TUNABLES);
    holder.aimX = 1;
    holder.aimY = 0;
    const victim = createPlayer(1, { x: 260, y: FLOOR }, TUNABLES);
    const args = { terrain, players: [holder, victim], holder, tunables: TUNABLES };
    const spray = () => sprayFreezeRay(ice, { ...args, now: 0, dt });
    return { terrain, part: terrain.movers[0]!, ice, victim, spray };
  };

  it("should end the ray on the part and not chill or push the blob behind it when a part is in the beam", () => {
    const { terrain, part, ice, victim, spray } = partScene();
    spray();
    for (const end of ice.rays[0]!.ends) expect(end.x).toBeLessThanOrEqual(228 + 4);
    expect(victim.vx).toBe(0);
    expect(ice.blobs.has(victim.id)).toBe(false);
    // The cold lands on the part the beam touches (iceSim.test.ts), not on the ground behind it.
    expect(terrain.frozen.some((flag) => flag !== 0)).toBe(false);
    expect(part.field.frozen.some((flag) => flag !== 0)).toBe(true);
  });

  it("should reach the blob when the part has moved out of the beam", () => {
    const { part, ice, victim, spray } = partScene();
    part.pose = { dx: 0, dy: -120, angle: 0 };
    spray();
    expect(victim.vx).toBeGreaterThan(0);
    expect(ice.blobs.has(victim.id)).toBe(true);
  });
});
