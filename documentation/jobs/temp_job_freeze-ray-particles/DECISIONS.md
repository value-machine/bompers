# Freeze-ray particles: decisions

- **D1 (owner, 2026-11-23, via the orchestrator):** "Cold travels". The puffs are sim particles that keep their emitted direction and speed. Chill, push, frost and ice happen where the puffs reach, so what is seen is what is hit. No options page was made: it is a behaviour pick drawn with the already approved shape.
- **D2 (agent):** puff speed 600 u/s, a full reach in 0.3 s and 0.1 s to a blob 60 units away (snappy, but a turn still bends the spray). The rate is 400 puffs/s, about 120 in flight, matching the cloud's density. The cap is 160 per holder, and a 0.15 s burst shows where a puff lands.
- **D3 (agent):** on a moving part a puff stops and bursts as it does on terrain, in world space, and the cold lands on that part (as the rays did, mover-materials lap 2b).
- **D4 (agent):** beam clash. The clash math is unchanged; the freeze ray's clash reach caps how far its puffs fly. That reach is worked out at the current aim, so puffs from an earlier aim during a spin are capped at the same distance. The torch is unchanged.
- **D5 (agent):** stacking as recorded. A blob gains one step of chill and one push per step, along the mean heading of the puffs in it. The step's ice is split by the puffs landed on each body.
- **D6 (agent, structural):** the ice front reseeds only when every landing is on new ground or after a pause. It used to reseed when the lowest touched sample changed, which puffs change every step. D8 (an old patch stays put while the beam freezes elsewhere) still holds, and its test passes.
- **D7 (agent, code-style F3):** the render-only `sprayStream` is replaced by the sim's `sprayParticles` and deleted. The ray fan's `solidAt` / `bodyAt` are exported so the particles and the rays share one collision rule.
