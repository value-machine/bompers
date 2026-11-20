# Brief — Physics objects (whole-object state)

Task: Physics objects (whole-object state) · Lap: temp_job_physics-objects · Branch: claude/physics-objects

## Problem
Levels have only terrain objects (trees) that never move; the owner wants objects that move and take state as a whole, starting with a ball, later a car.

## Success check
A level file with `<circle data-role="object" data-kind="ball" …>` (exact element per plan) spawns a ball that falls, bounces, rolls down a slope, is pushed by a blob / blast / dive, catches fire and freezes only as a whole, and a blob never ends a step inside terrain or overlapping-and-stuck because of it (sim test).

## In scope
- A general **physics object** mechanism (`physics-objects` feature): round rigid bodies on the terrain field, whole-object state (burning / frozen / none), level-file placement and size, catalog + level prompt entry with example.
- First kind: the ball, variants per owner pick.
- Done gate (owner rule, DOC_APP_VISION § Levels): the ball is a kind in the object registry (`features/level-objects`, physics class beside the terrain recipes), so level-kit generates its catalog row and prompt entry with an example (`levelPromptObjects.test.ts`), and its attributes are documented in `documentation/game/LEVEL_FORMAT.md`. The car later registers the same way.
- Interactions: blob bump (mass-weighted body contact), blast and rocket push (impulse ÷ mass), dive hit, slopes and moving parts (rideMovers rider), fire and freeze whole-object, leaving the kill zone (owner pick).
- Never-stuck: the escape search in `player/services/solidEscape.ts` becomes a shared resolver that takes a "hits solid" probe; players and physics objects both use it. A physics object is never solid to a player's terrain query, so it can never trap one; a stuck object pops and respawns.

## Out of scope
- Will NOT do: the car (wheels + chassis + driving) — later lap; the mechanism keeps room (bodies list, a constraint step slot).
- Will NOT do: partial destruction, per-sample fire or frost on objects (owner rule, level-objects Decisions).
- Will NOT do: an in-game editor; new ElevenLabs sounds.
- Will NOT touch: trees and terrain objects; crates' own collision (separate backlog task).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| level / level-file | `<rect data-role="object">` → `placeObject` → terrain pieces | importer: physics kinds produce a placement record, not terrain | ride |
| level-kit | registry → catalog.json, prompt Objects section | add the ball kind + example | ride |
| arena | field queries `fieldDistanceAt`, `fieldNormalAt`, `circleHitsSolid` | ball collision reads them (movers included) | ride |
| movers | `rideMovers(terrain, bodies)` carries players + crates | ball as a `MovingRider` | ride |
| player | `escapeSolid`, `resolveBodyContacts` | escape search generalised to a probe; ball↔blob contact | ride (rename by role) |
| combat | blasts push players (`directHitPush`, explosion impulse) | blast push on objects | ride |
| dive | dive hits players via contacts | dive push on objects | ride |
| fire / blob-fire / ice | per-sample terrain fire; blob burning / frozen | object reads burning ground / torch / ray; whole-object state | ride |
| match | `stepGame` order | one new step slot "1e physics objects" + render layer | ride |
| sound | cues from state counters | bounce cue per material (existing takes) | ride |
| physics-objects | Not found | new feature | new |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — new feature, 9 edges, shared-resolver rename.
Cut into laps: the car (later backlog task).

## Decisions
See DECISIONS.md.
