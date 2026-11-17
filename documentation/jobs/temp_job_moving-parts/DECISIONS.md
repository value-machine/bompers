# Decisions — moving-parts

Job: `temp_job_moving-parts`
Updated: 2026-11-17

## Closed (proposed by loop-refine; orchestrator relays the open ones)

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Where motion is written | closed | one `data-motion` attribute on a `<g>` wrapping `terrain` shapes; no `transform`, no role on the `<g>` | loop-refine (clear winner) | grouping already allowed (LEVEL_FORMAT § 5); one attribute = fewest tokens; `data-behavior` stays for catalog behaviours (bouncy…), motion is geometry |
| D2 | Coordinates | closed | shapes are drawn at their **rest pose in absolute world coords** like any terrain; motion offsets are relative to that rest pose | loop-refine (clear winner) | agents already align static terrain; no relative frame or matrix maths to get wrong |
| D3 | Grammar | closed | `<kind> <args> [Ns] [@phase] [pivot] [ccw]`; kinds `slide dx,dy` (back and forth, eased), `path dx,dy dx,dy …` (closed loop through offsets, constant speed, back to start), `spin` (full turn per period), `swing deg` (pendulum ±deg) | loop-refine | comma pairs are always offsets; order-free optional tokens |
| D4 | Defaults | closed | period `4s`, phase `@0`, pivot `center` for spin / `top` for swing, `cw` | loop-refine | most parts need 1 attribute: `slide 0,-160`, `spin`, `swing 30` |
| D5 | Pivot | closed | named anchor of the group's bounding box: `center top bottom left right top-left top-right bottom-left bottom-right` | loop-refine | named, not numeric: on-grid shapes give on-grid pivots, no arithmetic for the agent |
| D6 | Phase / sync | closed | `@0.5` = half a period ahead; parts with the same period and phase move in lockstep | loop-refine | lets agents build staircases / alternating lifts blind |
| D7 | Time base | closed | pose = pure function of round sim time (`timeSeconds` since round start); restart resets | loop-refine (clear winner) | deterministic, replay- and restart-safe, no stored mover state |
| D8 | Format version | closed | additive, no bump (LEVEL_FORMAT § 8); an older game ignores `data-motion` and keeps the shapes static | loop-refine | |
| D9 | Validation (warnings, level still loads) | closed | bad grammar → group static; non-terrain role inside a moving group → stays static; nested motion → inner ignored; offsets / sweep off the 4-unit grid → snap note; sweep leaves bounds, overlaps static terrain or a spawn (sampled over one period) → warning; peak surface speed above the ride limit → "too fast to ride"; period outside 1–30 s → clamped; more than 16 movers → extras static | loop-refine | numbers W11+ taken after #47 lands; the sweep checks are what let a blind agent align parts |
| D10 | Lap cut | closed | lap A = format + importer + pose fn + preview + prompt; lap B = runtime | loop-refine | lap A touches no arena/player code, so it does not collide with the terrain chain |
| D11 | Collision model (lap B) | closed | each mover is a kinematic body with its own local distance field (same 4-unit samples, same seeding), queried by transforming the query into the mover's frame; never baked into the static field | loop-refine (clear winner) | static field stays the only crater/fire writer; a few movers × bounding-box broadphase is cheap |
| D12 | Riding / pushing (lap B) | closed | a grounded player or crate on a mover moves with the mover's point velocity at the contact (carry, incl. rotation); a mover overlapping a body pushes it out along that velocity | loop-refine (industry default: kinematic platforms) | ride-speed limit in D9 keeps carry feel sane |
| D14 | Breakable / fire on movers | closed | lap A/B: moving parts are unbreakable (a breakable material on a mover warns and acts unbreakable; looks keep its colour); not flammable | loop-refine | keeps one writer of the static field; later lap if wanted |
| D15 | Rockets, homing, crates, camera (lap B) | closed | rockets explode on movers (no crater); homing ignores movers when steering; crates land and ride; camera unchanged (frames players/bounds); spawn picker skips a spawn a mover currently overlaps | loop-refine | |
| D16 | Look (lap B) | closed | a mover draws as the same slab + one-rule outline (#48) from its own local field, so it reads as a separate piece where it meets static terrain | loop-refine | |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D13 | Crush (lap B) | open | A: pushed into static terrain or a second mover = eliminated (credit to last hitter) — proposed / B: never crush, mover passes through the trapped player / C: crush squeezes the player out sideways | lap B plan |

## Log

- 2026-11-17 — D1–D12, D14–D16 closed via loop-refine (clear winner / proposed); D13 open for the owner via the orchestrator.
