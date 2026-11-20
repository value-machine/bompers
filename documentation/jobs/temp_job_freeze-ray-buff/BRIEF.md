# Freeze-ray buff — brief and plan

**Problem (measured on main d01940f):** the freeze ray rarely freezes a blob and a freeze gives little. The beam is ±3° wide, about 19 units at its 180-unit end, thinner than a blob (28). A freeze needs 0.5 s in the beam, but a blob crossing it is in for 0.05–0.2 s, and one running straight away from close range gets out at about 0.4 s. Chill drains as fast as it builds, so sweeps never add up. A frozen blob breaks out in about 0.3 s (3 jump taps), and a hit frees it with only the hit's own damage.

**Owner pick (Stop 1, 2026-11-20, via the orchestrator):** all four additions from the options page: A chill slows, B shatter hit, C cold floor combo, D frost cone.

**Success check:**
- A: a chilled blob's run input shrinks by `chillSlow` (up to `ice.blob.chillSlowMax`, 0.6), and gravity rises by the same share.
- B: the next direct hit on a frozen block takes `ice.blob.shatterDamage` (1) more, through combat's shared `applyHit`, and reads as a heavy-tier hit.
- C: chill fills `slipperyChillScale` (2) × as fast for a grounded blob on ice or frozen ground.
- D: the beam is ±7° on 5 rays, and chill holds `chillHoldSeconds` (1.5 s) before it drains.
- Each value is a tunable, the level prompt states the new numbers, and the GAME_JUICE ledger has the new moments.

**Size:** M (one PR; four small mechanics on one feature, plus a seam in combat).

**Edges:** the ice and combat features, the hard-hit check in effects `feelCues`, the gameSim wiring, the tunables, the level-kit prompt line and its generated `LEVEL_PROMPT.md`, GAME_JUICE.md. Not the player controller (parallel dash thread) or mover contacts (parallel unstuck thread).

## Plan (as built)

1. **Tunables:** `ice.blob.{chillSlowMax, chillHoldSeconds, slipperyChillScale, shatterDamage}`; `combat.freezeRay` gets `halfAngleDegrees` 7 and `rays` 5.
2. **Ice (`frozenBlobs.ts`):**
   - `chillBlob` takes `terrain`; it fills faster when ground friction below ≤ `frozenFriction`.
   - `chillSlow` is the new helper.
   - `frozenInputs` → `icedInputs`: it scales a chilled blob's `moveX`, as the fire's `panicInputs` does.
   - `holdFrozenBlobs` → `holdIcedBlobs`: it multiplies `gravityScale` by 1 + slow. The dive rewrites the modifiers every step, so the change never compounds.
   - `stepFrozenBlobs` drains chill only after the hold.
3. **Combat:**
   - `CombatState.bonusDamage` maps a slot to extra chunks for the next direct hit this step. `applyHit` adds it (not to `burn`), uses it up and flags the event `bonus`.
   - Combat stays ice-agnostic. Every hit path (dive and headbutt, rockets, blasts) goes through `applyHit`, so all of them shatter a block the same way.
4. **Match:** `markShatterBonus` fills the map from frozen blobs at the start of each step.
5. **Effects:** a `bonus` hit counts as hard (heavy tier: back-hit shake, full flash, 50 ms hit-stop).
6. **Level kit:** extend `freezeRayLine` and its test, then run `pnpm level-kit:sync`.

**Juice:** A has no new channel: the existing frost-building look and the ray's loop cover it. B is heavy tier, reusing the `ice-shatter`, `hit` and `dive-impact` sounds and the existing shards. C reuses the "frozen" moment. D only widens the beam. No new sounds (0 credits).

**Precedent:** chill-then-freeze slows (stacking slow before a hard CC) and shatter bonus damage on a frozen target are the common pattern for ice weapons in action games. A hold-before-decay buff is standard stack design.
