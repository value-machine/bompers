# Never stuck in geometry + hold-to-respawn (lap brief)

**Owner report:** a moving platform pushed the blob against something and it ended stuck inside the platform. "That should never be able to happen." Also: a button to respawn yourself as a fallback.

**Size:** S (two parts, one PR). Model C, branch `claude/never-stuck`.

## Cause (proved by a fuzz test, `gameSim.test.ts` § never stuck)

1. **Any overlap freezes the blob.** The controller's contact moves (`moveAxis` → `backOff`) bisect between the last free position and the hit; when the body starts a step already overlapping, every sub-step hits and it backs off to where it was. The movers ride left bodies overlapping in several ways (overlap up to `SQUEEZE_SLOP` counted as contact; stepping out of a non-facing obstacle back into the pusher; a squeeze letting go next to a wall; launching off a part's edge). Before the fix the fuzz showed a blob sinking 1 → 3 units deeper into solid step after step and never getting out.
2. **A squeezed blob sank into the floor.** `restingY` (ground settle) and `slideUpSlope` put the feet `height / 2` under the circle's centre; a squeezed circle sits `scale × width / 2` above the feet, so every ground step pushed a squeezed blob up to its shrink (3–6 units) into the floor.

## Fix

- **Invariant, one mechanism:** match step 1c `freeStuckPlayers` → player `escapeSolid` every step before the players move: nearest free spot within a body width (rings, then back to contact); else the largest squeeze down to `player.crushGapFraction` that fits; else trapped → crush (cause `crush`, squeeze of the part it is deepest in when there is one). Covers every source (parts, squeezes, terrain) instead of patching each ride path.
- **Root fix:** `restingY` and `slideUpSlope` seat the feet under the actual (possibly squeezed) circle (`bodyCenter`).
- **Debug invariant:** the property test fuzzes 60 seeds of random parts (slide / spin / swing, thin to thick, slow to fast) by a wall and under a ceiling with random inputs; no player ends a step deeper in solid than 1 unit of contact noise (400 seeds checked once by hand). No runtime flag: the check runs every step anyway.

## Respawn on purpose (Part 2)

- **Bindings:** hold 1 s (`match.selfRespawnHoldSeconds`): keyboard left Q, right Backspace (the menu back keys, unused in play), pad Back / View / Select (button 8, unused in play). A full second of hold without a break, so a stray press never fires.
- **Scoring:** like a fall (match-rules D1, crush D13): a hitter within `killCreditSeconds` gets the kill, else the player pays `fallPenalty` (−1). It can never dodge a kill.
- **Juice:** cause `self` → the normal knockout (flies with its own velocity, goo burst, `elimination` pop). While held, a solid ink arc fills clockwise on the spawn-protection ring's circle (same radius, ink and stroke): a reuse of the existing ring look, not a new design. Ledger row in `GAME_JUICE.md`.

## Not covered

- Weapon crates use their own collision; the escape runs for players only.
- The controller's launch-off-an-edge path can still end a step up to ~1 unit inside a part; the next step's escape absorbs it before the blob moves.
