# Brief — Kart (second physics object)

Task: the car, second physics object · Lap: temp_job_physics-kart · Branch: claude/physics-kart

## Problem
The physics-objects lap left room for a car (wheels = round bodies, a spring-held chassis). The owner picked a drivable go-kart (options page "Car Options", Q1–Q4).

## Success check
A level file with `<rect data-role="object" data-kind="kart" …>` spawns a go-kart: two wheels on the ground and a springy chassis. A blob touching it presses down to get in, drives left/right, hops on jump, fires its weapon from the seat and presses down again to get out beside it (never inside a wall). A moving kart above `karts.hitSpeed` hits a blob for one chunk through combat's `applyHit`; never its own driver. The whole kart burns or freezes; burning puts the driver out. Stuck, burnt through or out of the arena it pops (driver out first) and comes back after 3 s. Sim tests prove each.

## In scope
- Kart recipe in the object registry (variant `go-kart`, data lines), catalog + prompt example + LEVEL_FORMAT.
- `karts` feature: chassis spring, wheel constraint, driving, seats, blob contacts (push, ride, hit), render, engine-hum loops.
- Wheels are physics-objects round bodies (shape `wheel`), so motion, bumps, blasts, rockets, moving parts, fire, frost and pops come from that feature.
- Ball Playground gets 3 karts.

## Out of scope
- Will NOT do: other car looks (data lines later), headbutting a seated driver (the dive hits the kart instead), balls colliding with the chassis (only with the wheels), the engine sound files (orchestrator generates; wired after the owner's pick).

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| level-objects | ball recipe | kart recipe + registry line | ride |
| shared types / tunables | `PhysicsBodySpec` ball only | union (ball, kart, wheel); `karts` tunables | ride |
| physics-objects | balls | wheels as round bodies (`addRoundBody`), moment kinds, ball-only render | ride |
| combat | `HitSource` rocket/dive/fire | `kart` source | ride |
| match | step order | 1e seat drivers, 3h `stepKarts`, render layer, sound world | ride |
| sound | held loops | kart idle/drive loops (silent until files exist) | ride |
| level-kit | prompt objects | kart example + note | ride |
| level file | Ball Playground | 3 karts | ride |
| karts | Not found | new feature | new |

## Size
M — new feature, 9 edges.

## Plan
1. Types + registry: body union, kart recipe (`go-kart`), tunables `karts`.
2. physics-objects: `addRoundBody`, wheels skipped by ball spawn and ball render, moment kinds for the kart, `wheel` shape.
3. karts: create (wheels + chassis), step (sync whole-object state, pops, wheel constraint, chassis spring, drive/hop), seats (board/leave/eject with `escapeSolid` = shared `freeSpotSearch`), contacts (push, ride, hit via `applyHit` + `reactToHit`).
4. match wiring: seated drivers skip move input, contacts and never-stuck; `stepKarts` after physics objects; rockets hit the chassis; render; sound loops.
5. Level kit + docs + Ball Playground; tests; GAME_JUICE ledger.

Acceptance test: `src/features/karts/services/karts.test.ts` (board, drive, hop, hit, burn eject, pop) + `gameSim.test.ts` Ball Playground with karts.

## Juice table
| Moment | Tier | Sound (existing takes) | Visual |
|---|---|---|---|
| Get in | light | `land` | chassis dips on its spring (settle), driver seated |
| Get out | light | `jump` | chassis springs up, driver hops out |
| Hop | light | `jump` | kart lifts, chassis lags on its spring |
| Land | light | `land` (wheel bounce, by impact) | chassis sinks and springs back (settle) |
| Hit a blob | medium | `hit` (combat `playerHit`: hurt floor, chunk pop, flash, shake) | combat's hit pop + victim roll |
| Burn / freeze / thaw / break / pop / back | as ball | ball takes (`catch-fire`, `freeze-solid`, `ice-shatter`, `steam-hiss`, `burn-out`, `thwap`, `respawn`) | flames / frost over the whole kart, smoke rings, pop-in |
| Engine | — | `kart-idle` + `kart-drive` loops (owner pick pending) | — |
