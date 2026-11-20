# Decisions — physics objects

| # | Decision | By | Why |
|---|----------|----|-----|
| D1 | **Physics core stays custom** (spec-reuse-package). Candidates checked: matter-js 0.20 (rigid bodies, polygons, no SDF), planck.js 1.x (Box2D port, chains/polygons), @dimforge/rapier2d 0.14 (WASM, heightfield/trimesh). All need polygon or mesh colliders rebuilt after every crater and burn-out (the terrain is a sample distance field that changes every step), add 100–600 kB, and bring their own stepping, which would fight the fixed-step sim order. A round body on the field is the same math the blobs already use (`fieldDistanceAt`, `fieldNormalAt`, `settleCircle`). The car later = wheels (the same round body) + a chassis held by a spring/distance constraint, a known small Verlet step. No new package. | agent | reuse-package; no new dependency |
| D2 | A physics object is **never solid to a player's terrain query**. Blob↔object is a body contact (mass-weighted version of blob-vs-blob), separated only with terrain-safe moves; the object gives way first. So an object can never trap a player, and `freeStuckPlayers` keeps its job unchanged. | agent | owner never-stuck requirement, smallest risk |
| D3 | The escape search becomes a shared resolver taking a "hits solid at" probe (named by role, F1/F3); `escapeSolid` for players stays a thin caller. A physics object left in solid (moving part, ice) uses it; trapped → pops and respawns at its level spot. | agent | reuse the never-stuck resolver |
| D4 | Whole-object state: `none | burning | frozen`, one timer per object. Fire and ice cancel like on blobs (ice-frozen-blobs D6). No per-sample state on objects. | owner rule |
| D5 | Variants, fall-out, fire spread, frozen behaviour: asked (options page). | owner | look and feel |
