# Brief — Trim skill descriptions with trigger tests

Task: Trim skill descriptions with trigger tests · Lap: temp_job_trim-skill-descriptions · Harness: v0.44.0

## Problem
The 22 skill descriptions are listed in every session (~13.5k chars, ≈3.4k tokens); much of each repeats the skill body (context-cost audit R11).

## Success check
Total description length drops by ≥3.2k chars (≈−0.8k tokens), every quoted trigger phrase, "Use when" and "Not for" survives, `pnpm validate:skills` and the sync `--check` pass, and a 24-query trigger test routes every query the old descriptions routed correctly to the same skill.

## In scope
- `description:` frontmatter of all 22 `.agents/skills/*/SKILL.md`.

## Out of scope
- Will NOT touch: skill bodies, names, catalog, rules.

## Edges
| Feature area | Loop today | Hook point | Ride / new |
|---|---|---|---|
| `.agents/skills/*/SKILL.md` frontmatter | listed every session | `description:` | ride |
| `.claude/skills/` mirror | sync script | regenerated | ride |

## Size
S — 22 frontmatter edits, one test.
Cut into laps: none

## Trigger test (meta-write-skill authoring § 5)
Two fresh subagents (same model) mapped the 24 queries below to one skill each, one with the old descriptions and one with the new, reading nothing else. Expected skill in brackets; queries 23–24 are near-misses (CI failure → debugging, not shipping; structure vs precedent → loop-plan review-precedent, not spec-check-layer).

| Set | Correct | Differences |
|---|---|---|
| Old (13,511 chars) | 24/24 | — |
| New (10,299 chars) | 24/24 | none (identical routing) |

1. ok i'm back, where were we with all this [router]
2. what should we work on after the camera thing, maybe reorder the list [loop-backlog]
3. before you start on the power-ups, pin down exactly what's in and out and how big it is [loop-refine]
4. the brief for level select looks right, now figure out the phases and the first failing test [loop-plan]
5. plan's approved, go write it phase by phase [loop-build]
6. code's done for the scoreboard, run every gate and audit the diff before we push anything [loop-check]
7. checks passed, commit this and open the pr [loop-ship]
8. tried the preview on my phone, the bumpers feel great, ship it [loop-verdict]
9. there are four ready tasks in different areas, can you run them side by side [loop-orchestrate]
10. new session on an unfamiliar branch, get yourself oriented on this codebase first [spec-load-context]
11. just add a special flag so the boss level skips the normal spawn logic [spec-check-layer]
12. the ball goes through the wall at high speed sometimes, no idea why [spec-debug-runtime]
13. the level list rerenders every frame and the fps tanks with 200 levels [spec-optimize-performance]
14. we need to parse gamepad input mappings, surely somebody already built that [spec-reuse-package]
15. the settings screen takes six taps to change the volume, feels way too much [spec-simplify-flow]
16. our rules and skills contradict each other in places and the context is bloated, clean it up [meta-audit-harness]
17. I dropped a bunch of skills from another repo into the inbox folder, bring them in [meta-intake-harness]
18. that took five attempts and the CI fix was nasty, make sure we don't repeat that [meta-learn-lessons]
19. I want a new skill that writes release notes for the game [meta-write-skill]
20. score the testing rule out of 5 and tell me what's weak in its wording [meta-grade-rule]
21. write up how another repo could copy our level-file kit [meta-write-adoption-guide]
22. talk less, just the facts, minimal words from now on [meta-compress-output]
23. the build failed on CI with a type error in the physics tests, figure out the cause [spec-debug-runtime]
24. the plan for multiplayer has a feature folder doing three things, is that ok vs how other games structure it [loop-plan]

## Decisions
- D1 cut the "what it does" detail, keep triggers and Not-for, clear-winner (audit R11: never drop trigger phrases).
- Protected-file consent: orchestrator (game-orchestration D4).
