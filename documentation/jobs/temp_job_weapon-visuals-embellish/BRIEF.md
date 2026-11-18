# Brief — Weapon visuals: embellish (muzzle and crate)

Task: Weapon visuals: embellish — muzzle and crate design · Lap: temp_job_weapon-visuals-embellish · Harness: v0.45.0

Design page the owner picked from (rounds 1–8): https://claude.ai/artifact/Cnyu1t1xJ79irmeyRRcYri

## Problem
The owner dislikes the helmet weapon tube and the crate: the tube does not connect to the helmet (its rounded back end shows, it hides behind the body when aiming down) and all crates read as the same pale box.

## Success check
A held weapon draws one tapered barrel that starts at the helmet centre in the helmet's own flat cream, with a mouth in the weapon accent, at every aim angle; a crate is a block in the weapon accent with the weapon's mouth centred in ink inside a white outline.

## In scope
- One barrel per weapon from the helmet centre (pivot on the emblem), tapered, flat cream; mouth parts per weapon in the accent: rocket lip, homing lip + two swept-back fins, torch funnel.
- Barrel rides the helmet (same spring), drawn over the eyes; eyes do not move.
- Mouth is the ready light: accent alpha over a pale base (replaces the muzzle dot).
- Shot: squash pop of the barrel (0.78 × 1.22, 0.2 s) when readiness drops.
- Helmet flat cream (no gradient); gloss stroke lowered 3 u so it stays inside the dome.
- Crate: accent block, mouth mark centred, ink with white outline; no cream face, no ring.
- Docs: DESIGN_LANGUAGE § 1, § 2, § 3, § 6, § 9; GAME_JUICE ledger; player and collectibles READMEs.

## Out of scope
- Will NOT do: accent colour changes (rocket sky vs freeze ice blue closeness) — owner judges on the page.
- Will NOT touch: sim (shot origin `combat.rocket.muzzleOffset`, recoil impulse), HUD ammo pills, projectile looks, sounds.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| shared (weaponTube, weaponTubeRenderer, gamePalette, gameTunables) | shape table of round rects → tracer → fill | same module, new part model (barrel / mouth roles, polygons) | ride — same mechanism, new geometry |
| player (blobShapes, playerRenderer) | tube pair under the body, pivot 0.5 R off-centre, muzzle dot alpha | tube moves into the helmet layers; pop from `BlobWeapon.ready` | ride |
| collectibles (weaponCrateRenderer) | cream box, accent ring, ink mark | `drawCrate` | ride |
| knockout (loose tube piece) | `drawLooseTube` via playerApi | unchanged signature | ride |
| fire (flame leaves the nozzle) | `FLAME_LOOK.spray.nozzleReach` 15 units from the helmet point | constant follows the new funnel mouth | ride |
| ice (breath leaves the emitter; added when #63 landed first) | `ICE_LOOK.breath.emitterReach` 15 units from the helmet point | constant follows the freeze ray's dish mouth (wide dish + knob, accent from #63) | ride |
| documentation/game | DESIGN_LANGUAGE, GAME_JUICE | rows updated | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size
S — render-only; three feature areas ride existing hook points; one geometry module reshaped.
Cut into laps: none (the freeze-ray mouth joined this lap when #63 merged first).

## Plan
1. Acceptance test first (`weaponTube.test.ts`): every weapon look has exactly one barrel part starting at x = 0 and at least one mouth part; the crate mark is centred on its own bounds.
2. `weaponTube.ts`: parts with a role (`barrel` | `mouth`) and a kind (polygon | round rect); shapes `lip`, `finned`, `funnel`; `weaponTubeMark` (barrel cut at x = 16, centred). `weaponTubeRenderer`: trace by role. `gamePalette`: looks point at the new shapes; `mouthPale`; drop `pickupCrate`, `helmetShade`.
3. `gameTunables.feel.barrelPop` + `gameJuice.test` preset check.
4. `blobShapes` / `playerRenderer`: flat helmet, lowered gloss, barrel in the helmet layers over the eyes, mouth alpha = readiness, pop on a shot.
5. `weaponCrateRenderer`: accent block + outlined mark. `FLAME_LOOK.spray.nozzleReach` to the funnel mouth.
6. Docs and READMEs; fold DECISIONS.

Gate per step: `pnpm test:run` on the touched tests, `pnpm type-check`, `pnpm lint`.

## Decisions
DECISIONS.md D1–D9.
