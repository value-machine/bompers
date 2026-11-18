# Decisions — slope-rest

- **D1 — A still blob on ground steeper than the lip angle rests: grounded and stopped.** Closed (agent, the task left the pick open). Chosen over "airborne against the wall with the wall-slide" because it keeps what the game already did there: a jump at that spot was a ground jump before (the coyote timer was refreshed every other step), the blob did not move, and the drawing held by `stepContactHold` showed it standing on the slope. The airborne state would have turned that jump into a wall-jump and shown the air shadow. Rule: steep ground, no lip pull, speed along the ground below 1 u/s → stay grounded with zero velocity. A moving blob still leaves steep ground as before (a run-up carries up it, walking away slides off).
- **Open — is `stepContactHold` still needed?** Its cause (the per-step flip) is gone. With the hold set to 0 the arc run shows one airborne stretch of 6 sim steps (50 ms) with the air shadow, where the climb reaches the lip angle with speed left; nothing else. Removing it is the owner's call.

## Log

- 2026-11-18 — D1 closed via loop-build (agent pick)
