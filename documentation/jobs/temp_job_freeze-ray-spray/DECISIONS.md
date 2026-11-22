# Freeze-ray spray look: decisions

- **D1 (owner, 2026-11-22, options page):** B "Mist cloud": overlapping mist puffs pour out along each ray, growing as they travel, under one ink outline, with puffs bursting at each impact. It was picked over A, the frost jet (first picked, then changed), and C, the crystal blast.
- **D2 (owner):** the effect is unchanged (7 rays over ±20°), and the torch keeps its own drawing.
- **D3 (agent, code-style F1):** the stream of puffs along a fan's rays is a shared mechanism, named for its role (`sprayStream` in `src/shared/utils/`). The freeze ray is its first user.
