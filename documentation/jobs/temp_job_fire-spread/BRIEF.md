# Brief — Fire b1: torch and fire on terrain

Task: Fire: spreading fire, flamethrower and burn reaction — lap b1 (owner recut: b1 torch + fire on terrain, b2 burn reaction on blobs) · Lap: temp_job_fire-spread · Harness: v0.45.0 · Orchestrator run `run:bompers-game-2` (thread `fire-design`)

## Problem
The fire rules are decided (blast-power D4–D8) but nothing burns yet: there is no fire on the terrain field and no torch to start one.

## Success check
In a level with a cardboard slab, a blob holding the torch's fire lights the cardboard it touches. Fire spreads through touching cardboard at 40 units/s the same in every direction, never across air. Each lit sample burns 1.5 s and is then gone. Fire flows around stone, stops at earth (scorching it), and never lights cardboard touching ice. The torch runs dry after 3 s of spraying.

## In scope
- Material flags in the catalog: `burns` (cardboard) and `douses` (ice); level kit synced.
- Fire on the terrain field (D18 "fire = arrival time on the same field"): per-sample ignite times; a front spreading through touching fuel samples at `fire.spreadSpeed`; burn-out after `fire.burnSeconds` through the arena's one sample writer (outline and collision follow); scorch marks on earth next to fire (render only).
- Torch weapon (D8): a crate item `torch`; held fire sprays a short cone (~3 blob widths) from the helmet along the aim while fuel lasts (3 s per pickup); the first fuel sample along each cone ray is lit; blobs in the cone get a light push along the aim.
- Look and feel: flames on burning samples, scorch on earth, the torch spray and its helmet nozzle; sounds and juice per the game-juice scale.
- The start arena lists the torch in its drops so the owner can test.

## Out of scope
- Will NOT do: blobs catching fire, the burn timer, chunk loss, ice / dive putting it out, bump passing it on (lap b2).
- Will NOT do: blasts lighting anything (D4: they never do).
- Will NOT do: collision on the field for crates / the head box (a3 leftovers, DECISIONS D3).
- Will NOT touch: `reactToHit`, tumble / roll, dive (Shared roll lap runs in parallel); rocket and homing behaviour.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| fire | Not found | `features/fire/`: fire state, spread step, torch spray hook, renderer | new — one domain (fire on the field + the torch that starts it) |
| arena | `clearCrater` → `writeSample`, `exposeUnbreakable`, `remeasureAir` | `burnOut(grid, samples)` through the same writer and field upkeep | ride |
| content-catalog | material entries (toughness, friction, surface) and drop items | `burns` / `douses` material fields; item `torch` | ride |
| combat | `stepAttacks`: armed → `fireRocket` per press; `weapons.ts` `KIND_OF` | weapon fire mode: projectile (per press) or spray (held, fuel by time) through a `sprayAttack` hook | ride |
| collectibles | crates drop the level's weapon items round-robin | `torch` is a weapon item id | ride |
| shared | `WeaponItemId`, `weaponItems`, `weaponTube`, `gamePalette`, `gameTunables` | `torch` id, nozzle tube, flame colours, `fire` + `combat.torch` tunables | ride |
| match | sim steps 1–4; renderer layers | fire step after combat; fire layer under players; hook wiring | ride |
| sound / effects | events → SFX / effects | torch and ignite cues | ride |
| level files | `public/levels/start-arena.html` drops | `torch` in a drop point's items | ride |
| level-kit | catalog export | sync | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
M — a new feature (sim + render), one arena write, a weapon fire mode, catalog / tunables / level data.
Cut into laps: b2 burn reaction on blobs (next, owner recut).

## Decisions
DECISIONS.md D1–D3 (lap recut, a3 leftovers, model choices); owner rules blast-power D4–D8, D18.
