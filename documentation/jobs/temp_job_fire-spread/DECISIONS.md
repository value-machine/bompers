# Decisions — fire-spread

Job: `temp_job_fire-spread`
Updated: 2026-11-17

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Lap cut for fire | closed | b1 = torch + fire on terrain; b2 = burn reaction on blobs | owner (via orchestrator, option 1 of 3) | Supersedes blast-power D19's "fire (b) → torch (c)" order: fire only starts from the torch or a burning blob (D4), so b alone had nothing the owner could test on the preview. Rejected: a temporary `?ignite` flag; one L lap |
| D2 | Skip lap a3 | closed | No separate "collision on the field" lap: slope-walking #49 moved blob bodies onto the field | orchestrator (agreed) | See D3 for what is left |
| D3 | a3 leftovers (note) | closed | Weapon crates and other rect bodies, and the blob's head box, still collide on the cells (`rectHitsSolid`) | loop-refine | Invisible in play today; the Moving parts lap may need body collision against moving geometry and can pick these up |
| D4 | Fire model | closed | Arrival time on the field: each fuel sample gets an ignite time; a lit sample lights its touching fuel neighbours (8-neighbourhood, solid only) at t + distance / spreadSpeed (Dijkstra-style front); burns `burnSeconds`, then is removed through the arena writer | loop-refine (owner D5, D6, D18) | The 8-neighbour front is an octagon within ≈ 8 % of a circle; the rule is one queue and two numbers |
| D5 | Torch hit test | closed | A fan of rays from the helmet along the aim, each marching until it meets terrain; the first fuel sample it meets is lit; blobs inside the cone are pushed | loop-refine | "Lights what it touches" (D8): terrain behind terrain is not lit through it |
| D6 | Torch fuel | closed | The weapon's `ammo` holds seconds of fuel; spraying drains it by dt; the HUD pills show it rounded up | loop-refine | Same `weapon` slot and pickup path as the launchers |
| D8 | Fire sounds | closed | Placeholders this lap: torch start plays `rocket-fire`, burn-out plays cardboard's `thwap` through the existing `terrainDestroyed` event; real fire takes are a follow-up asset task | loop-plan | New audio is asset generation (token-heavy / possibly paid), weekend or owner-approved |
| D9 | Diagonal contact | closed | Fire steps diagonally only when one of the two orthogonal in-between samples is solid, so two fuel samples meeting at a corner across air do not pass fire (owner "never across air") | loop-plan (review A5) | Keeps 8-neighbour round fronts in solid fuel |
| D7 | Torch with Shared roll | closed | The torch's light push changes velocity directly (like recoil), not through `reactToHit`, so the parallel Shared roll lap owns that reaction untouched | loop-refine (orchestrator hook note) | b2's burn chunk uses `reactToHit(player, { impulse: 0 })` per Shared roll |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|

## Log

- 2026-11-17 — D1 owner recut via orchestrator; D2 orchestrator; D3–D7 loop-refine
