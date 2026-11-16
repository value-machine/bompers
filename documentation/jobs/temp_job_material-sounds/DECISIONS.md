# Decisions: material-sounds

- **D1** One sound per material, played on impact (dive wall bonk) and on destroy (blast). Alternative: separate `impactSound` / `destroySound` fields — a catalog schema change that collides with the parallel blast-power lap; deferred until a material needs two different sounds.
- **D2** The bonk keeps its body sound and layers the material sound over it, so the blob still sounds like itself; the owner's A/B decides which body sound (current dive impact or the landing splut).
- **D3** The bonked material is found by the match when it builds the sound snapshot (terrain cell just past the player in the dive direction), not by a new sim field, so dive and player sims stay untouched (game-sound D2: sound reads, the sim is unchanged).
- **D4** Existing IDs `thud` and `crumble` keep their meaning (stone and earth); cardboard and ice get new IDs. IDs are never renamed (LEVEL_FORMAT § 6).
