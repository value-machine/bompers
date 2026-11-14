# Dive headbutt ("bomp"): three options

Phase 1 of the dive-headbutt lap. All three are in the build; keys **1 / 2 / 3** switch between them and the overlay (top left) shows the active one plus a hit tally per player. Fire (P1 **F**, P2 **/** or **Enter**, pad RT / RB / X) dives headfirst in the aim direction (move keys + up / down; no direction = the way you face).

Numbers are the shipped tunables (`src/shared/config/gameTunables.ts` → `dive.options`). Frames are sim steps at 120 Hz (1 frame = 8.3 ms). For scale: a blob is 28 units wide, run speed is 340 units / s, a jump takes off at 1050 units / s, the main platform is 800 units wide.

## What all three share

Built once, used by every option (and by plain movement):

- **Body collision** (`features/player/services/bodyCollision.ts`). Blobs are equal-mass circles. Along the contact normal `n` with closing speed `c`, each blob's velocity changes by `min((1 + e) / 2 · c, maxImpulse)`; `e` = `bodyCollision.restitution` (0.9), cap 1100 units / s. So two blobs meeting head-on at the same speed both turn around at 90 % of it, and a moving blob that hits a resting one hands over 95 % of its speed and nearly stops (a Newton's cradle). Below a closing speed of 140 there is no bounce: walking into someone shoves them. A blob that cannot give way (standing on ground, hit from above) counts as a wall, so you bounce off heads.
- **A dive hit is a body contact made while travelling** toward the other blob at 150 units / s or more. The collision has then already moved the momentum; the dive adds a small strike (a push along the hit direction plus an upward pop) so the victim leaves the ground. Knockback therefore scales with how fast you actually hit: a dive at the end of its travel bumps, a fresh one launches.
- **Zone** (`features/dive/services/hitZone.ts`): back when the hit travels the way the victim faces (dot above `backZoneMinDot` 0.35), front otherwise; hits from straight above or below are front. A diving blob faces its dive direction.
- **Damage** per zone from `dive.frontHitDamage` (1) and `dive.backHitDamage` (2). Front 0 / back 1 or 4 is a change of those two numbers.
- **Hit event** `DiveHit { attackerId, victimId, zone, damage, impulse, at }`, one per victim per dive. `stepDives` returns them and keeps the last step's in `GameState.dive.hits`; combat's `applyHit` consumes them. Until then they are only tallied.
- **Victim:** steering drops to 15 % for 0.3 s (36 frames) so the knockback reads; a victim caught mid-dive loses its dive.
- **Head-on clash:** both divers are attackers and victims. The collision reflects both equally, both strikes push outward, both take a front hit. With the "front 0" variant a clash becomes bounce-only without a special rule.
- **One dive per airtime:** the charge returns on ground contact. A fire press is buffered for 0.1 s (12 frames).
- **Terrain:** the dive never moves a blob itself; the player controller does, in half-cell sub-steps, so no dive speed tunnels (tested at 6000 units / s against a one-cell wall).

## 1 · Cannonball (committed missile)

**Fantasy.** You tuck in, hang in the air for a heartbeat, and fire yourself like a cork out of a bottle: dead straight, no gravity, nothing to steer. If it connects, the other blob is gone across the arena. If it does not, everyone saw it coming and you are a sitting duck.

| Phase | Frames | What happens |
|---|---|---|
| Wind-up | 12 (100 ms) | Velocity cut to 15 %, gravity off (you hang), no steering, no jump. Direction is locked at the press |
| Launch | frame 13 | Velocity = 900 units / s along the aim, whatever you were doing before |
| Travel | 30 (250 ms) | Constant 900 units / s, zero gravity, no steering: 225 units (8 blob widths) |
| Impact | on contact | Victim gets ≈ 855 from the collision + 260 strike + 260 up; attacker ends ≈ −85 (a small recoil) |
| Recovery | 24 (200 ms) | Leaves the travel at 35 % speed, gravity back, 30 % steering, jump locked |
| Cooldown | 60 (500 ms) after recovery | |

- **Aim:** 8-way (analog aim is snapped), so the line is always readable.
- **Air / ground:** identical. On the ground it skims the floor. Diagonally into the floor it slides along it at 71 % speed.
- **Walls:** head-on (80 % or more of the speed is blocked) = **bonk**: thrown back at 35 % and stunned for 54 frames (450 ms), no steering, no jump. No cancel of any kind.
- **Squash read:** deep crouch that leans a third of the way toward the target (the telegraph), then a long stretched blob flying helmet-first; a flat pancake squash on a bonk.
- **Risk / reward:** highest of the three. 100 ms of telegraph, 250 ms of no control, then 700 ms before the next one. Reward: the longest reach and the biggest launch.
- **Counterplay:** step off the line (it cannot turn), jump over it, stand in front of a wall so a miss bonks, or answer with your own cannonball for an even clash. Punish the recovery from behind for the back hit.
- **Collision rule:** the purest read of it. A full-speed hit on a resting blob transfers almost everything; two cannonballs meeting reflect at 810 + 260 each.

## 2 · Snap (short momentum lunge)

**Fantasy.** A quick headbutt jab that is part of how you move. It adds to the speed you already have, so a running or falling snap hits harder than a standing one, and you can jump out of it. Lots of small bonks rather than one big one.

| Phase | Frames | What happens |
|---|---|---|
| Wind-up | 3 (25 ms) | Motion continues; it is only a flicker of anticipation |
| Launch | frame 4 | Velocity = 60 % of the current velocity + 640 along the aim, capped at 860 |
| Travel | 15 (125 ms) | Speed decays (drag 5 / s: about 54 % left at the end), 30 % gravity, no steering: 55–80 units |
| Impact | on contact | Victim gets 95 % of the speed you still have + 220 strike + 180 up; you are pushed back by 220 |
| Recovery | 10 (83 ms) | Momentum is kept, 60 % steering, jump allowed |
| Cooldown | 30 (250 ms) after recovery | |

- **Aim:** analog (keyboard gives 8 ways anyway).
- **Cancel:** from travel frame 6 a jump press ends the dive; on the ground that is a jump out of the lunge.
- **Air / ground:** same model; in the air the low gravity gives a short float. Diving down adds to your fall speed.
- **Walls:** nothing special; the blocked axis stops and you slide.
- **Squash read:** almost no crouch, a short sharp stretch toward the target, quick ease back to upright.
- **Risk / reward:** lowest. Short reach and a small launch when thrown from a standstill, but you are never stuck. The reward is in the set-up: run, fall or wall-jump into it.
- **Counterplay:** spacing (it is short), and its hit window is 125 ms. A snap that connects late has decayed below hit speed and only bumps.
- **Collision rule:** shows the "momentum transfers intuitively" part best, because your own speed is the damage dealer. Two snaps meeting cancel into a small mutual bounce.

## 3 · Pogo (ballistic bounce chain)

**Fantasy.** You throw yourself in an arc like a rubber ball. Gravity stays on, floors and walls bounce you back up, and every head you land on pops you into the air with your dive ready again. The arena becomes a pinball table.

| Phase | Frames | What happens |
|---|---|---|
| Wind-up | 6 (50 ms) | Motion continues |
| Launch | frame 7 | Velocity = 780 units / s along the aim |
| Travel | up to 108 (900 ms) | Gravity × 1.2 (an arc), 35 % air steering, up to **2 terrain bounces** at 80 %, still active after each. Ends on landing once the bounces are spent, or by the timer |
| Impact | on contact | Victim gets 95 % of your speed + 160 strike + 320 up; you pop straight up at 720 and **your dive is available again at once** |
| Recovery | 12 (100 ms) | Full steering, jump allowed |
| Cooldown | 42 (350 ms) after recovery; none after a hit | |

- **Aim:** analog. Down into the floor = an instant hop back up; into a wall = a ricochet.
- **Cancel:** from travel frame 18 a jump press ends the dive (on the ground it also jumps). A flat dive along the ground is a belly slide until then.
- **Air / ground:** this is the option where it matters: the arc and the bounces depend on where you start.
- **Squash read:** small crouch, stretch along the arc that turns with the velocity (the blob points where it is going after each bounce), upright pop after a hit.
- **Risk / reward:** medium per dive, high over a chain. Easy to dodge once (it is slower and arcs), but a hit keeps the attacker in the air above the victim with a fresh dive.
- **Counterplay:** move out from under the arc; hit the pogo player in the back while it is airborne (it cannot turn its facing mid-dive); stand under a ceiling.
- **Collision rule:** the head-bounce comes straight from the shared rule (a grounded blob hit from above is a wall), plus the pop. Two pogos meeting in the air reflect equally and both get their dive back.

## Side by side

| | Cannonball | Snap | Pogo |
|---|---|---|---|
| Commitment | 66 frames, no control | 28 frames, jump-cancel | up to 126 frames, steerable |
| Reach | 225 units, straight | 55–80 units | an arc, plus bounces |
| Launch on the victim | biggest (≈ 1100) | scales with your run-up (≈ 500–900) | medium (≈ 900) plus a high pop |
| Gravity during the dive | off | 30 % | 120 % |
| Walls | bonk + stun | slide | ricochet (2×) |
| Chain | no | no (short cooldown) | yes, off every hit |

## Recommendation: Pogo, with the Cannonball's telegraph borrowed in phase 2

Judged against GDD § 2 ("licht en fysiek als een blob", curved movement, momentum) and the brief "light, bouncy, chaotic":

- **Pogo** is the only one where the dive itself bounces. Its motion is an arc under gravity, terrain throws it back, heads are trampolines. It turns the shared collision rule into the main event instead of a side effect, and it creates the four-player pile-ups the GDD asks for. It also sits well next to rocket jumps: both are "launch yourself and see where you land".
- **Cannonball** is the clearest and most satisfying single hit, and the easiest to read from across the arena, but zero gravity and a locked line feel heavy and precise rather than light, and a 450 ms stun is harsh for a party game.
- **Snap** feels the most responsive and would suit a tighter, more technical game. In a chaotic four-player arena its small launches risk reading as "nothing happened".

What I would take into phase 2 with Pogo: a slightly longer, clearer wind-up crouch (borrowed from Cannonball) so victims can react, a cap on chain length if testing shows one player can juggle forever, and the impact pop / hit flash from the design language. I have only driven the build with scripted input, not by hand against a second person, so the pick should be made by feel on the preview.

## Open questions for the pick

- Head-on clash: both currently take a front hit. Bounce-only clashes are a tunables change (front damage 0) or a small rule.
- Should walking into someone bounce at all, or only shove? Tunable: `bodyCollision.restingSpeed`.
