# Brief — Beam clash (draft, waits for D1)

Task: beams react when they meet, fire × ice first · Lap: temp_job_beam-clash · Harness: v0.45.0

## Problem

A torch flame and a freeze ray pass through each other as if the other is not there, while ice and fire cancel everywhere else (ground, blobs).

## Success check

Pending D1. For the recommended A: with a torch and a freeze ray spraying head-on, no ray of either fan ends past the meeting point, neither holder is lit, chilled or pushed by the other beam, and a clash is recorded for steam and `steam-hiss`.

## In scope

- A beam-vs-beam rule in `src/shared/utils` next to `rayFan` (D2): given two fans and their elements, where each ends.
- Fire × ice as the first pair; the reaction the owner picks (D1).
- Steam at the meeting point; `steam-hiss` reused; a GAME_JUICE ledger row.

## Out of scope

- Will NOT do: same-element clashes (torch × torch, ray × ray) — they keep passing through (D2).
- Will NOT do: new sounds — reuse only.
- Will NOT touch: what each beam does to ground and blobs; `src/config/app-tasks.json`.

## Edges

| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `shared/utils/rayFan` | `castRayFan` marches each ray to terrain, collects bodies | a cap per fan (or per ray) from the clash rule | new — the clash rule, role-named |
| `fire` (`torch.ts`) | `sprayTorch` casts, lights, pushes, records the spray | uses the capped fan | ride |
| `ice` (`freezeRay.ts`) | `sprayFreezeRay` casts, freezes, pushes, records the beam | uses the capped fan | ride |
| `match` | wires both into combat's `sprayAttack`; cancels fire and ice on blobs | resolves clashes between this step's beams (neither feature imports the other) | ride |
| `sound` | reads sprays, beams, counters | a clash counter → `steam-hiss` | ride |
| `documentation/game` | GAME_JUICE ledger, DESIGN_LANGUAGE effects | one moment row | ride |

Overrun rule (skill-loop D51): a diff that touches a feature area **not** in this table stops the lap.

## Size

S for A or C; M for B or D (state per clash, a new moment). Set after D1.

## Decisions

DECISIONS.md: D1 open (owner pick on the options page), D2 closed.
