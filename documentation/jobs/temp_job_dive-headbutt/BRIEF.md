# Brief — Dive headbutt (bomp), phase 1: three playable options

Task: orchestrator thread "dive headbutt" (not in app-tasks.json; the orchestrator owns the backlog) · Lap: temp_job_dive-headbutt · Harness: v0.44.0

## Problem

The owner wants the unarmed attack (GDD § 3 "Beuk") to be a headfirst dive, but can only pick how it should feel by playing it: three different dives must be playable against each other on the preview.

## Success check

In a two-player sim, a player who fires toward a stationary opponent with each of the three options ends up with exactly one typed hit event (attacker, victim, zone, damage from tunables, impulse) and the victim moving away; a symmetric head-on meeting leaves both with equal and opposite velocities.

## In scope

- `documentation/jobs/temp_job_dive-headbutt/DIVE_OPTIONS.md`: three options (fantasy, timeline in frames at 120 Hz, motion model, squash read, risk / counterplay, collision interaction) and a recommendation.
- Shared mechanics, built for real: blob-vs-blob body collision (equal mass, restitution, impulse cap), front / back hit zone, damage per zone from tunables, typed hit events, a debug hit tally.
- `features/dive`: one data-driven dive state machine; the three options are tunable sets; keys 1 / 2 / 3 switch at runtime; fire (F, / or pad) dives in the aim direction.
- Render read: headfirst rotation, wind-up squash, travel stretch, hit squash, an impact ring; on-screen option name and hit tally.
- Unit tests per the request (head-on, momentum transfer, zones, damage, timeline, no tunnelling).

## Out of scope

- Will NOT do: health chunks, elimination, scoring, spawn protection — combat lap (`applyHit` consumes the hit events).
- Will NOT do: sound, screen shake, final feel polish, removing the losing options — phase 2 after the owner's pick.
- Will NOT touch: movement tunables and feel outside a dive; `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `features/player` | `stepPlayers` moves each blob against terrain; blobs pass through each other | controller reads three generic modifiers (steer scale, gravity scale, jump lock) and reports terrain hits; new `bodyCollision` service; renderer takes a pose overlay per player | ride — body collision is about `PlayerState` bodies and needs the controller's terrain-safe move |
| `features/dive` | Not found | sim step 3a, between players and (future) combat | new — one bounded concept (the unarmed attack) |
| `features/match` | `stepGame` 1 join · 2 players · 4 out-of-bounds · 5 timer | adds 2b body contacts, 3a dive; `GameState.dive`; render layers; 1/2/3 keys in `useGameSession` | ride |
| `shared/config` tunables + palette | sections per concept | new `bodyCollision` and `dive` sections; effect colors | ride |
| Docs | ARCHITECTURE § Game module map | rows for dive and body collision | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

M — a new feature, a new physics system in `player`, sim and render wiring, about ten test groups.
Cut into laps: phase 2 (remove two options, polish, wire `applyHit`) after the owner's pick.

## Plan

Size M normally takes a `DEVELOPMENT_PLAN.md`; this lap is a prototype for a feel pick, so the plan is this list (phases = gates):

1. Tunables + player seam (modifiers, terrain-hit report) — existing player tests stay green.
2. `bodyCollision` with tests (head-on, momentum transfer, cap, terrain-safe separation).
3. `features/dive` (state machine, zones, damage, hit events) with tests (timeline per option, zones, damage, no tunnelling, acceptance test in `gameSim.test.ts`).
4. Render (pose overlay, impact ring, overlay text), option keys, docs (`DIVE_OPTIONS.md`, README, ARCHITECTURE).
5. Check: lint, type-check, arch, structure, feature size / docs, tests, build, a Playwright run of the preview build.

## Decisions

`DECISIONS.md` D1–D7.
