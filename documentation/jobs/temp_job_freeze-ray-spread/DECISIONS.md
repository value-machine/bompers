# Freeze-ray spread: decisions

- **D1 (owner, 2026-11-21, options page):** A "Frost fan": 7 rays over a fixed ±20°, drawn as one wide spray whose edge follows each ray's impact, with frost puffs where the rays land. It was picked over B, 3 discrete beams, and C, a fan that opens while held.
- **D2 (owner):** the torch stays as it is. The shared ray caster (`castRayFan`) stays shared and unchanged.
- **D3 (agent, confirmed by the owner):** wider is not stronger. Chill and push stay once per blob per step, and the ice per second stays the same, shared over the rays that touch ground.
- **D4 (agent):** the release puffs let go at the middle ray's end, as before, rather than at every ray's end. That keeps the release light tier and short.
- **Cost (measured):** one cast takes about 66 µs for 7 rays over ±20°, against 52 µs for 5 rays over ±7°.
