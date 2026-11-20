# Freeze-ray buff — decisions

- **D1 (owner, 2026-11-20, options page):** build all four additions: A chill slows, B shatter hit, C cold floor combo, D frost cone.
- **D2 (agent):** A's jump slow goes through `gravityScale` × (1 + slow), an existing motion modifier, instead of a new jump-speed field on the player.
  - At full chill a jump reaches about 62 % height, and the blob falls faster.
  - The run slow scales the input (`moveX`), as the fire's `panicInputs` does, so ground, air and slope speeds all follow it without touching the controller.
- **D3 (agent):** B lives in combat as a generic `bonusDamage` per slot, filled by the match from the ice.
  - Every direct-hit path shatters a block the same way, and combat does not import ice.
  - One bonus per block, and none for fire (fire melts a block, it does not break it).
- **D4 (agent):** C's "the block glides off ledges" needed no change: a block already brakes at `slideGrip` × the ground's grip (0.15 × 0.04 on ice).
  - "Slippery ground" means ground friction no better than the ice grip, so ice terrain counts as well as frozen ground.
- **D5 (agent):** the frost puffs drawn on the options page were not built. The existing frost-building look already shows the chill, so A adds no new visual channel.
