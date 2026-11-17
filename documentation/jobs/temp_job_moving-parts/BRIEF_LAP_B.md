# Brief — Moving parts move in the game (lap B)

Task: Moving parts in levels, lap B · Lap: temp_job_moving-parts · Ledgers: `DECISIONS.md` (D1–D16), `DECISIONS_LAP_B.md` (B1–B3)

## Problem
Levels can declare moving parts (lap A, #52), but in the game the parts stand still as static terrain, so the format promises a gameplay feature that doesn't exist yet.

## Success check
In a level with `<g data-motion="slide 0,-160">`, the part follows `motionPose(t)` in the sim. A player standing on it rides it up and down. A part moving sideways pushes a player. A rocket that hits the part explodes on it without a crater. The arena's static field never holds the part.

## Cut (bigger than M → two laps)
- **B-1 (this lap, M): collide and carry.**
  - Kinematic movers in `arena` with a local distance field per part.
  - Terrain queries (`rectHitsSolid`, `isSolidAt`, `surfaceBelow`, friction) answer for static terrain plus movers. Craters, fire and burn-out stay static-only (D11, D14).
  - A new sim step `stepMovers`, before players: pose from round time, then carry riders (players, crates) by the contact point's displacement, rotation included, then push overlapping bodies out along the part's motion (D12).
  - Rockets explode on parts with no crater, and homing steering ignores them (D15).
  - The spawn picker skips spawns a part covers.
  - Render: same slab plus the one-rule outline from the part's own field (D16), and the 2A cue: a faint dashed track with end ticks, or a pivot rivet (B1).
  - A body that cannot be pushed free is left overlapping for B-2. It is logged in dev and never crashes.
- **B-2 (next lap, S/M): crush and part sounds.**
  - Crush detection (squeezed between a part and static terrain or another part) leads to elimination, with credit to the last hitter (D13).
  - Pancake, then knockout goo splats on the object, per the round-2 pick (B3). Needs #50 merged.
  - Crush sound: `land`, then `elimination`.
  - Author-declared per-part sounds: one while moving, one at each end of the path or swing (B2). This covers the format, validator, prompt and runtime.

## Out of scope (B-1)
- Will NOT do: crush elimination, goo splats, per-part sounds (B-2). Breakable or burning parts (D14). Spawns, drops or pickups riding a part.
- Will NOT touch: the static field writers (`clearCrater`, `burnOut`, fire spread) beyond keeping parts out of them, or the knockout feature.

## Edges (B-1)
| Feature area | Hook point | Ride / new |
|---|---|---|
| `arena` | movers state + local fields; composite solid queries; mover renderer + cue | ride (large) |
| `match` | `stepMovers` before `stepPlayers`; render composition; `createGameState` drops mover pieces from the static raster | ride |
| `player` | carry + push before the controller; ground contact sees movers through arena queries | ride |
| `collectibles` | crates ride parts (same carry) | ride |
| `combat` | rockets explode on parts (via `isSolidAt`); homing ignores parts | ride |
| `level-file` | drop `MOVERS_STATIC_NOTE` | ride |
| docs | LEVEL_FORMAT § 11 engine mapping, GAME_JUICE ledger row (cue: no sound, no shake) | ride |

## Size
M for B-1. It touches 6 areas, and arena is the heart of it. B-2 is S/M and becomes a backlog task right after.

## Risks
- Players and dive, fire, roll (#51) and knockout (#50) all call arena queries, so movers show up for all of them through the shared queries. A step-order mistake can carry a rider a frame late, which shows as jitter. Mitigation: carry before the controller, tested.
- Rotating parts: carrying uses the point's displacement, so a rider on a spinning part slides off past roughly 45° of tilt. That is intended.
