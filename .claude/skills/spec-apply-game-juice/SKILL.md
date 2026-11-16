---
name: spec-apply-game-juice
description: >-
  Gives a game element its feedback from the one game-juice scale: each moment gets an impact tier,
  at least one sound and one visual channel, durations inside the timing windows and squash inside
  the volume band, plus a row in the moment ledger. Use when a lap adds or changes a game element or
  moment — a weapon, pickup, hazard, ability, enemy, animation, effect, sound, screen shake, flash,
  squash and stretch, "make it feel better", "juice", "game feel", "add a sound for X". Not for the
  look itself (colours, shapes: DESIGN_LANGUAGE) or performance of renderers (use
  spec-optimize-performance).
---

# spec-apply-game-juice

When this skill is done, every moment the lap adds or changes answers on sound and sight at the strength its tier sets, with no invented shake, flash or timing numbers, and `documentation/game/GAME_JUICE.md` § 6 lists it. That keeps the game one consistent feel while elements keep arriving (owner feedback round 2 § 4.2). The trigger lives in `.claude/rules/game-juice.md`; the scale lives in `src/shared/config/gameJuice.ts`.

## Edges

| Field | Value |
|---|---|
| In | The brief or diff; `documentation/game/GAME_JUICE.md`; `src/shared/config/gameJuice.ts`; the `feel` and `player.squash` tunables; DESIGN_LANGUAGE § 6, § 8 |
| Out | A juice table in the plan (one row per moment); at build: values from the tiers, a ledger row in GAME_JUICE.md § 6, `gameJuice.test.ts` extended for new `feel` values |
| Calls | always → `documentation/game/GAME_JUICE.md` § 7 checklist |
| Called by | [`loop-plan`](../loop-plan/SKILL.md) (a lap adds or changes a game element), [`loop-check`](../loop-check/SKILL.md) (verify the juice table was applied) · owner |
| Next | Back to the caller |
| Owner stops | stop list only ([`agent-behavior` rule § When to ask](../../../.claude/rules/agent-behavior.md)); a new tier or a window change is a conflict with a recorded decision |

## Steps

1. **List the moments** of the element (spawn, act, hit, break, vanish …): each is something a player must notice.
2. **Pick a tier per moment** by consequence (GAME_JUICE.md § 2): own action `light`, being hit or bouncing `medium`, the big moments `heavy`. Reuse `JUICE_TIERS` values; scaling down by speed or size is fine, above the tier is not.
3. **Fill the channels:** at least one sound and one visual per moment (§ 1). Sound: family, prompt template and pitch per § 5 and DESIGN_LANGUAGE § 8; cue it from sim events in the `sound` feature.
4. **Time it** inside `JUICE_WINDOWS` (§ 3) and keep squash poses inside `JUICE_SQUASH` (§ 4), checked with `isInJuiceWindow` / `isJuiceSquash`.
5. **Record it:** the plan carries the juice table; the build adds the GAME_JUICE.md § 6 row in the same lap and extends `gameJuice.test.ts` when a new `feel` value is added, so the scale stays enforced.
6. **Check (loop-check):** every changed moment has its ledger row, values read from the tiers, `gameJuice.test.ts` passes, reduced motion is honoured, effects draw under player outlines.

## Examples

**Example 1 — new weapon**
Input: lap "Add a bouncing grenade".
Output: juice table — throw (light: `grenade-throw` sound, body recoil squash), bounce (light: `grenade-bounce` sound, small squash on the grenade), explode (heavy: reuses the explosion moment: star burst, 6 px shake, ducks music). Three ledger rows; no new shake numbers.

**Example 2 — feel tweak**
Input: "make landings punchier".
Output: land stays `light` (no shake: own action). The fix tunes `player.squash.land` within the band and window, or the `land` sound gain curve; a shake on every landing would break the tier, so it is not offered as the default.

## Output

```text
Juice: <n> moments · tiers <light a / medium b / heavy c> · ledger rows <added|updated> · gameJuice.test <pass|n/a> · gaps <none | list>
```

## Not for

| Case | Use |
|---|---|
| Colours, shapes, outlines, draw order | `documentation/game/DESIGN_LANGUAGE.md` § 1–5 |
| Slow renderers, frame drops | [`spec-optimize-performance`](../spec-optimize-performance/SKILL.md) |
| Gameplay rules and mechanics | `documentation/game/GAME_DESIGN_DOCUMENT.md` |
