# Decisions — blast-power

Job: `temp_job_blast-power`
Updated: 2026-11-16

Owner picks come from the fire-design ideation page (version 3, https://claude.ai/artifact/KStEshn2kooJPfpH5C951X), relayed by the orchestrator of `run:bompers-game-2`. D4–D8 govern laps (b) and (c); this lap folds them into `DOC_APP_VISION.md` so those laps find them.

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | How a blast cuts | closed | Power ÷ toughness per cell, no shelter: a cell clears when `distance × toughness ≤ craterPerPower × power` | owner (via orchestrator) | Rejected: shelter (tough cells absorb power along the ray), wear (sub-toughness hits crack and accumulate) |
| D2 | Toughness values | closed | Cardboard 0.7, earth 1.0; ice and stone unbreakable | owner (via orchestrator) | Rejected: breakable ice 2.0; cardboard 0.5 |
| D3 | Push growth with power | closed | Straight line: centre push 27·P, reach 1.28·P, falloff max(0.35, 1 − d/reach) as today; rocket P 50 reproduces 1350 / 64 | derived from owner's "all recommended" (orchestrator) | Reversible tuning. Rejected: curved growth; push-only with fixed reach |
| D4 | Do blasts light cardboard | closed | No: fire comes only from the flamethrower and burning blobs | owner (via orchestrator) | Governs lap b |
| D5 | Fire spread | closed | Outward from the source through touching fuel cells, same speed every direction (circle in solid cardboard), never across air; flows around stone, scorches and stops at earth, cardboard touching ice never catches | owner (via orchestrator) | Governs lap b. Rejected: pure circle jumping gaps; faster upward |
| D6 | Spread speed and burn time | closed | 40 units/s; a cell burns 1.5 s, then is removed | owner (via orchestrator) | Governs lap b; starting values |
| D7 | Burn reaction | closed | On fire 2 s, then −1 chunk; put out by touching ice or by a dive; bumping a rival passes the fire on | owner (via orchestrator) | Governs lap b. Rejected: instant hot-foot; heat meter |
| D8 | Flamethrower form | closed | Torch: short cone (~3 blob widths), 3 s fuel per pickup, lights what it touches, light push | owner (via orchestrator) | Governs lap c. Rejected: gel lobber; heat jet |
| D9 | Where toughness lives | closed | Reuse the catalog's existing, unused `MaterialEntry.durability` as the toughness divisor; `destructible: false` keeps meaning unbreakable | loop-refine | clear-winner — alternatives: new `toughness` field (duplicates an unused one), rename (kit churn for no behaviour) |
| D10 | Power scale | closed | 0–100, rocket 50; per-power constants chosen so P 50 equals today's crater 34, push 1350, reach 64 | loop-refine | clear-winner — owner saw this scale on the page; keeps every current test and the feel unchanged |
| D11 | Where a weapon's power lives | closed | In `gameTunables` with the weapon (`combat.rocket.power`) | loop-refine | clear-winner — combat README: every combat number lives in the `combat` tunables; alternative: item catalog entry (content, not tuning) |
| D12 | Seam for the shared-roll lap | closed | A blast resolves to one `{ direction, impulse }` per pushed player and calls `reactToHit` as today; the tumble threshold stays in the reaction | loop-refine | clear-winner — the roll lap swaps the reaction without touching blast code |
| D13 | Consumers of removed constants | closed | Explosion event `radius` = this blast's reach; feel shake scale and out-of-bounds margin derive from the rocket's power | loop-refine | clear-winner — identical values at P 50 |

| D14 | Terrain look | closed | Smooth outline over the existing cell grid: per-corner distance values traced as a contour (marching squares), so craters and edges read as one sheet; per-cell materials, toughness and fire stay | owner (via orchestrator) | Supersedes the owner's earlier vector-terrain pick (C). Rejected: 2-unit pixel grid; vector polygons. Built in its own lap after this one (D16); comparison page https://claude.ai/artifact/293sCRDGDCbdjrghGBNzZE |
| D15 | Collision vs smooth outline | closed | Collision follows the smooth outline (blobs stand and roll on the drawn line), not the cell staircase | owner (via orchestrator) | Needed for the queued Shared roll lap (rolling down slopes) |
| D16 | Lap placement of the smooth outline | closed | Own laps after this one: "Smooth terrain outline + crater shapes" (render + crater field), then "Collision on the smooth outline"; both before Shared roll | loop-refine | clear-winner — keeps each lap ≤ M; this lap writes the crater test as a distance rule (`shapeDistance × toughness ≤ craterPerPower × power`) so the outline lap reuses it |
| D17 | Crater shape per weapon | closed | The crater test takes a shape (distance rule) per weapon; the rocket stays round; the shape slot ships with the outline lap | owner (via orchestrator) "custom crater shapes per weapon" | This lap: round only, function signature ready |

| D18 | Terrain representation (final) | closed | "Field with real curves": a fine true-distance field (~4 units) over the terrain; edges drawn truly curved (spline-smoothed contour or a shader edge, PixiJS spike first); untouched authored shapes may draw from their level vectors so corners stay sharp until damaged; collision samples the same field (distance + surface direction); crater = shape distance × toughness per sample, crater shapes per weapon; fire = arrival time on the same field (no second representation) | owner (via orchestrator, after the A-vs-vector deep dive in session_01S5apqczKJ9URdGSktgADZt) | Supersedes D14 (8-unit contour) and refines D15/D16. D1–D8 hold; "per cell" in D1/D5 now reads "per field sample". Sharp points under a sample round off once damaged |
| D19 | Lap order under D18 | closed | a (this lap, blast power on today's grid; the per-cell test is the per-sample test at another resolution) → a2 field storage + crater on field → a2r curved edge renderer → a3 collision on the field → Shared roll; fire (b) after a2r; torch (c) after b | loop-refine | clear-winner — supersedes D16; each lap ≤ M |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-16 — D1, D2, D4–D8 closed via owner "all recommended" (relayed by orchestrator)
- 2026-11-16 — D3 closed, derived from the owner's "all recommended" (orchestrator)
- 2026-11-16 — D9–D13 closed via loop-refine (clear-winner)
- 2026-11-16 — D14, D15, D17 closed via owner (relayed by orchestrator; D14 supersedes the vector pick); D16 via loop-refine (clear-winner)
- 2026-11-16 — D18 closed via owner (final terrain pick, supersedes D14); D19 via loop-refine (clear-winner, supersedes D16)
