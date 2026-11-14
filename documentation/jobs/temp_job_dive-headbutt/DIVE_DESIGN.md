# Dive headbutt ("bomp"): final design

The unarmed attack (GDD § 3 "Ongewapende aanval"). Phase 1 shipped three playable candidates (Cannonball, Snap, Pogo); the owner picked a mix: **Cannonball's launch, Pogo's ricochet off other blobs, and no bounce off terrain** ("that makes it feel less controllable"; the hit reaction "is nice and a little bit unpredictable, which I like"). This file is that design. Durable facts also live in `src/features/dive/README.md`.

Numbers are the shipped tunables (`src/shared/config/gameTunables.ts` → `dive`, `bodyCollision`). Frames are sim steps at 120 Hz. For scale: a blob is 28 units wide, run speed 340 units / s, jump take-off 1050 units / s.

## The dive

Fire while unarmed (P1 **F**, P2 **/** or **Enter**, pad RT / RB / X) dives headfirst along the aim (move keys + up / down, snapped to 8 directions; no direction = the way you face).

| Phase | Frames | What happens |
|---|---|---|
| Wind-up | 12 (100 ms) | Velocity cut to 15 %, gravity off (you hang), no steering, no jump. The direction is locked at the press. Deep crouch leaning toward the target: this is the telegraph |
| Launch | frame 13 | Velocity = 900 units / s along the dive direction, whatever you were doing |
| Travel | up to 30 (250 ms) | Dead straight, zero gravity, no steering, no cancel: 225 units (8 blob widths) |
| Recovery (miss) | 24 (200 ms) | Leaves the travel at 35 % speed, gravity back, 30 % steering, jump locked |
| Cooldown (miss) | 60 (500 ms) after the recovery | A fire press is buffered for 12 frames |

**One dive per airtime.** The charge returns on ground contact, or at once on a hit.

## Hitting another blob: the ricochet

A hit is a body contact made while travelling toward the other blob at 150 units / s or more.

1. **Body collision first** (shared rule, below): a full-speed dive into a resting blob hands over about 95 % of the speed, so the victim leaves at roughly 855 units / s and the attacker is left nearly still. Because this is the real contact normal between two circles, an off-centre hit sends the victim off at an angle: that is the "slightly unpredictable" part.
2. **Strike:** the victim gets another 160 units / s along the hit direction and a 320 units / s pop upward, and steers at 15 % for 36 frames (300 ms) so the flight reads.
3. **Ricochet:** the attacker pops straight up at 720 units / s (about 118 units high) with its **dive ready again at once**: no recovery, no cooldown. Dive again from the air to chain off the next blob.

- **Zone and damage:** back when the hit travels the way the victim faces, front otherwise (straight from above or below = front). Front 1, back 2 health chunks; front 0 / back 1 or 4 is a tunables change.
- **Head-on clash:** both are attackers and victims; both reflect equally (same speed, mirrored), both ricochet up, both take a front hit.
- **A victim caught mid-dive** loses its dive.

## Terrain: it always ends the dive, never bounces

- **Head-on** (80 % or more of the dive speed is blocked: a wall, or the floor when diving straight down): a **bonk**. A small hop back at 25 % of the speed and 30 frames (250 ms) of stun (no steering, no jump). The prototype's stun was 54 frames; this is the "fair" version: long enough to punish, short enough to stay in the fight.
- **Glancing** (diagonal into the floor or a wall): the dive ends and you keep sliding along the surface into the normal miss recovery.
- The player controller moves the blob in half-cell sub-steps, so no dive speed tunnels through thin terrain (tested at 6000 units / s against a one-cell wall).

## Shared body collision (also without a dive)

`features/player/services/bodyCollision.ts`. Blobs are equal-mass circles. Along the contact normal with closing speed `c`, each blob's velocity changes by `min((1 + e) / 2 · c, maxImpulse)`; restitution `e` 0.9, cap 1100 units / s. Two blobs meeting head-on at the same speed both turn around at 90 % of it. Below a closing speed of 140 there is no bounce: walking into someone shoves them. A blob that cannot give way (standing on ground, hit from above) counts as a wall, so you bounce off heads.

## Squash and stretch

| Moment | Shape |
|---|---|
| Wind-up | crouch to (1.32, 0.70), leaning 35 % of the way toward the dive |
| Launch | snaps to a long (0.68, 1.46) stretch, helmet first, settling to (0.82, 1.24) over 80 ms |
| Hit, attacker | flattens to (1.30, 0.74) against the victim, springs upright with a small overshoot over 160 ms |
| Hit, victim | (1.15, 0.88) for 100 ms (DESIGN_LANGUAGE § 6 "bash hit taken") |
| Impact pop | at the contact point: a disc at full size on frame 1 that shrinks away, an ink ring running outward, eight spokes; 250 ms. Back hits: bigger and yellow |
| Bonk | flat (1.34, 0.70) squash easing upright through the stun |

## Risk, reward, counterplay

- **Risk:** 100 ms of telegraph, a locked line, 700 ms before the next dive after a miss, a stun on a wall.
- **Reward:** the biggest launch in the game so far, and a hit keeps you airborne above the fight with a fresh dive.
- **Counterplay:** step off the line or jump it; stand in front of a wall; answer with your own dive for an even clash; hit the diver in the back during its recovery.

## Open tuning questions

- **Launch strength.** The victim's launch comes from the real collision at 900 units / s, so it is stronger than the phase-1 Pogo's (780 units / s). If it throws people off the arena too easily: lower `bodyCollision.maxImpulse` or `dive.strikeImpulse`.
- **Chain length.** Nothing caps how many blobs one player can chain off. If one player can juggle forever, add a cap.
