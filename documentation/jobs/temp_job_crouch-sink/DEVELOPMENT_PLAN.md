# Development plan: Crouch — hide under the helmet (sink + settle, low)

## Summary

- **Goal:** the crouch reads as a jelly blob sinking under its hard helmet onto the ground (owner pick D1–D5), and the crouched blob's hurt box comes down with it.
- **Why:** owner request; today the shell squashes with the body and the body's top pokes ~1 u through the dome.
- **Brief:** `BRIEF.md`
- **Size:** M — player pose + renderer + controller, combat geometry, shared rayFan, tunables, docs.
- **Acceptance test:** `src/features/player/services/crouchPose.test.ts` (outline fits the helmet on every sampled frame, area band at hold, feet gone at hold) + `src/features/player/services/playerController.test.ts` › crouched hurt box + `src/features/combat/services/rockets.test.ts` › a rocket over a crouched blob flies on.
- **Plan review:** Done 2026-11-19 (`plan-review.md`, lean: 2 combined lenses — naming + rules, rebel + scale + tests — instead of the full fan-out, weekday token budget; A1–A6)
- **Scope / constraints:** render pose stays render-only; the sim only gains `hurtHeight`. Units: mockup u = r / 30 (r = height / 2.3).

## Phase overview

| Phase | Goal | Gate | Status |
|-------|------|------|--------|
| 1 | Pure crouch pose: timeline, fit table, bulge table, outline, gloss spot | `crouchPose.test.ts` green; type-check | Pending |
| 2 | Renderer: rigid helmet, redrawn body outline while crouched, eyes, gloss, feet vanish; helmet glint reshape | type-check, lint, player tests; one headless smoke (console + logged pose) | Pending |
| 3 | Sim hurt box: `hurtHeight`, `hurtBox`, combat geometry, rockets, explosions, rayFan | controller / combat / rayFan tests incl. acceptance | Pending |
| 4 | Tunables, juice ledger, README / docs fold, cleanup of the old crouch scale | full tooling gate (rule-audit § Tooling pass) | Pending |

## Conflict & compliance

- **Applicable rules:** architecture, app-code (services pure, layers), code-style (§ Naming: `crouchPose.ts` is player-specific, role-named by what it computes; `hurtBox` / `hurtHeight` name the role "what hits see"), testing (colocated, `should … when …`), game-juice (tiers / windows / band; owner pick done), file-placement, agent-behavior (no protected files touched).
- **File placements:** `src/features/player/services/crouchPose.ts` (+ `.test.ts`) — services layer, allowed pattern; everything else edits existing files.
- **Layers / imports:** combat imports `hurtBox` / `hurtHeight` via `@/features/player/api/playerApi` (barrel rule); rayFan (shared) reads optional `crouching` / `crouchHeight` on its body type — no feature import. fire / ice / blob-fire are not edited: torch and freeze ray pick up the lower origin through `helmetPoint` and the hurt shape through rayFan.
- **Reuse / packages:** skipped — bespoke pose math (no generic subsystem). Reuses `smoothstep`, `contactShadow`, `JUICE_*` checks, `outlineWidth`.
- **Foundation cleanup:** remove `crouchScale`, `stepCrouchBlend`'s linear blend (replaced by press / release times), `eyeLift`, `bodySx/bodySy/easeSeconds/helmetDrop` tunables; update the README squash note.
- **Performance:** while a blob is crouched, its body fill, ink and hit-flash redraw each frame (≤ 4 blobs × 3 Graphics × 96 points): cheap; standing blobs never redraw (key on "egg vs crouch outline"). Fit / bulge tables are solved once per body size (cached by `r`).
- **Risks:** the sim's hurt box and weapon origin drop at once while the drawing eases over 100 ms (in) / 150 ms (out). blob-fire's private `bodyCenter` (burn chunk positions) stays full height: follow-up. FillGradient `textureSpace: "local"` stretches over the new bounds (acceptable; the body shade still reads at the edge). The ground spread is drawn in torso space, so on slopes it presses along the blob's own down (the root leans with the slope) — matches the preview.
- **Standards diversions:** the crouched body sits below the squash band's per-axis limits (it is reshaped, not scaled); its area stays in the band (0.94).

## Review contract

- **Rules pinned:** `rules@9831c61` — architecture, app-code, code-style, testing, game-juice, file-placement, agent-behavior
- **Required lenses:** Reuse / packages (skipped, bespoke), Feature decomposition (one concept: the blob's crouch pose; hurt box is player state), Foundation cleanup (above), Naming, Pattern & precedent (below)
- **Tooling gate:** `loop-check/references/rule-audit.md` § Tooling pass
- **Locked decisions:** `DECISIONS.md` D1–D6; GAME_JUICE scale; DESIGN_LANGUAGE line style E; owner squish-eyes (eyes never squash)

### Amendments

| # | Date | Source | Change | Applied to |
|---|------|--------|--------|------------|
| A1 | 2026-11-19 | plan-review (rules) | player `services/` is at the 10-file layer budget; a new `crouchPose.ts` (+ test) breaks it → owner choice (see DECISIONS D7) | Conflict & compliance, Phase 1 |
| A2 | 2026-11-19 | plan-review (rules) | `hopSeconds` 0.22 → 0.2 (squash window) and tested; crouch is one ledger moment (sink, hold, stand-up) carried by the existing `land` thud, so stand-up is the moment's recovery, not a second moment | Phase 4 |
| A3 | 2026-11-19 | plan-review (scale) | no stored `hurtHeight`: `crouching` has four writers (updateCrouch, resetStance, launch, startRoll). Instead a static `crouchHeight` set in `createPlayer` (like width / height) and a pure `hurtHeight(player)`; nothing to sync | Phase 3 |
| A4 | 2026-11-19 | plan-review (rules + scale) | rayFan hit shape: a capsule filling the hurt box (w × h), equal to today's circle when standing, so side rays still hit a wide crouched blob; `RayFanBody` gains optional `crouching` / `crouchHeight` (PlayerState fits; fire / ice need no edit) | Phase 3 |
| A5 | 2026-11-19 | plan-review (tests) | acceptance adds blobPose cases that fail on the old code (crouch never scales the body or helmet); dome fit uses `helmetDome` from blobShapes; rocket test goes to `combatSim.test.ts`; tests for jump-from-crouch and hit-from-crouch hurt box, re-press mid-rise without a snap, torch / freeze origin lower when crouched | Phases 1–3 |
| A6 | 2026-11-19 | plan-review (scale) | feet vanish by time (60 ms), not by k; a press during the stand-up eases from the current pose | Phase 1 |

## Pattern & precedent

| Field | Value |
|-------|--------|
| **Capability** | Defensive crouch that visibly shrinks the target and the hurt box together |
| **Precedents** | Shell-hide in platformers (turtle / snail enemies), duck-under in 2D fighters and run-and-guns (crouch lowers the hurtbox) |
| **Aspects reviewed** | hurtbox follows the drawn silhouette; enter / exit timing short (≤ 150 ms) so the stance stays responsive; readable silhouette |
| **Findings** | aligns: hurtbox tracks the visual; aligns: 100 ms in / 150 ms out; risk: the low silhouette makes crouched blobs harder to spot in a pile-up — eyes and emblem stay visible |
| **Verdict** | Aligns with precedent |

## Phase 1 — pure crouch pose (`crouchPose.ts`)

**Goal:** one pure module that says, for a blob's crouch at render time t, where the helmet, body, eyes, feet and gloss are.

**Steps**
1. `BlobAnim` gains `crouch: { since: number | null; until: number | null; fromK: number }` (render clock of the last press / release; replaces `crouchBlend` / `crouchAtMs`). `noteCrouch(anim, { player, nowMs })` flips the times when `player.crouching` changes.
2. `crouchSink(anim, { crouch, nowMs })` → `{ k, helmetSink, drop, bulgeLag, feetScale, eyeTuck }` in mockup units: enter `k = easeOutCubic(t / sinkSeconds)`, helmet sink `sink·k` + overshoot (`overshoot·k` during the sink, then `overshoot·e^(−t'/τ)·cos(2π·settleHz·t')`, τ = settleSeconds / 3.5) + breathing (`breathe·sin(2π·breatheHz·…)` ramped in); drop `drop·k`; exit from `fromK`: `k = fromK·(1 − smoothstep(t / riseSeconds))`, helmet `sink·k − hop·sin(π·min(1, t / hopSeconds))`; feet `1 − smoothstep(k / 0.6)`.
3. `crouchFit(m)` (cached by r): for helmet sink h on a 0.25 u grid, the largest upper-half scale f whose egg points at or above the rim fit inside the dome (dome half-width at each height from the helmet bezier), and the bulge b that brings the area back to `areaKeep` (0.94).
4. `crouchOutline(m, sink)` → body points in torso space (96 points): egg, upper half × f, bulge below the rim `x·(1 + b·smoothstep((y − rim)/14u))`, shift down by `drop`, points past the ground clamp to it and spread `x·(1 + 0.9·(pen / r)·smoothstep(…))`.
5. `crouchGlossSpot(outline, rimY)` → `{ x, y, rotation }`: the left outline point nearest `rimY + 8u`, 6 u inward, long axis along the tangent; lerped from the standing spot by k.
6. Tests (acceptance): sample 0–600 ms of enter and 0–300 ms of exit: every outline point at or above the rim lies inside the dome; held area / standing area in [JUICE_SQUASH.minArea, maxArea]; held feet scale 0; held helmet sink in [sink − breathe, sink + breathe]; sinkSeconds / riseSeconds in the `squash` window, settleSeconds in `settle`; standing pose returns the plain egg.

**Gate:** `pnpm vitest run src/features/player/services/crouchPose.test.ts`, type-check.

## Phase 2 — renderer

**Goal:** draw the pick.

**Steps**
1. `blobShapes.ts`: `traceOutline(g, points)`; `drawBodyFill` / `drawBodyInk` / `drawBodyFlash` accept an optional outline (egg when absent) and draw into a given Graphics; reshape the helmet glint (shorter, 1–2 u lower) and add a test that its stroke stays ≥ 2 u inside the dome.
2. `blobPose.ts`: drop `crouchScale` and the old `crouchFace`; `blobPose` returns `crouch: CrouchSinkPose` (from Phase 1) instead of `face`.
3. `playerRenderer.ts`: torso y += drop·u; helmet layers at `rim + (wobble.drop + helmetSink)·u` (rigid: no crouch scale anywhere); body fill / ink / flash redrawn from `crouchOutline` while k > 0 or on the frame it returns to 0 (key on the sink pose, ink width from the current outline step); eyes at `rim + (helmetSink + lerp(9, 3, k))·u`, under the dome while k > 0.3; gloss at `crouchGlossSpot`; feet scaled by `feetScale` (hidden below 0.02).
4. One headless smoke run of the match page with a crouching player (console errors + logged pose numbers), no screenshots (weekday budget).

**Gate:** type-check, lint, `blobPose.test.ts`, `crouchPose.test.ts`, `blobShapes` test; smoke run clean.

## Phase 3 — sim hurt box

**Goal:** hits see the crouched blob where it is drawn.

**Steps**
1. `PlayerState.hurtHeight` (doc: "height hits see; `height` standing, `hurtHeightScale × height` crouched; set by the controller at the end of each step and on reset"). Set in `stepPlayers` after movement and in `resetStance`.
2. `hurtBox(player)` (rect from the feet up `hurtHeight`) exported from `playerController.ts` and the player api.
3. combat: `rockets.ts` hit test and `explosions.ts` distance use `hurtBox`; `combatGeometry.bodyCenter` uses `hurtHeight / 2`; `helmetPoint` sinks by `height − hurtHeight`.
4. `rayFan.ts`: `RayFanBody.hurtHeight?`; the body circle centres at `y − h / 2` with radius `min(width, h) / 2`, h = `hurtHeight ?? height`.
5. Tests: controller (crouched → `hurtHeight = 0.6 × height`, standing back on release / jump / respawn), rockets (passes over a crouched blob, hits a standing one at the same spot), rayFan (ray over a crouched body misses), combatGeometry (helmet point lower when crouched).

**Gate:** the touched test files + type-check + `pnpm arch:check`.

## Phase 4 — tunables, ledger, docs, cleanup

**Steps**
1. `gameTunables.ts` / types: `player.crouch = { sinkSeconds 0.1, settleSeconds 0.35, settleHz 2.4, riseSeconds 0.15, hopSeconds 0.22, helmetSink 12, drop 15, overshoot 2, hop 3, breathe 0.6, breatheHz 0.8, areaKeep 0.94, hurtHeightScale 0.6 }` with the why in comments; `gameJuice.test.ts` checks the windows and that `hurtHeightScale ≈ 1 − (helmetSink + drop) / 69` (±0.03).
2. GAME_JUICE § 6 rows: "Crouch sinks" (light, `land` thud, sink + settle, no flash / shake) and "Stand up from crouch" (light, no sound, helmet hop 3 u in the squash window).
3. Fold decisions: player README (crouch look, rigid helmet, feet vanish, hurt box), DESIGN_LANGUAGE § 6 crouch line if one fits.
4. `/simplify` on the lap diff; full tooling gate.

**Gate:** rule-audit § Tooling pass (format, lint, type-check, arch, structure, feature size / docs, classifier + tests).

## Notes during development

## Decisions made

| # | Topic | Choice | Precedent? |
|---|-------|--------|------------|
