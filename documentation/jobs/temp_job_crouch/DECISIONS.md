# Decisions — crouch

| ID | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | Halve with floor: `floor(damage × 0.5)` | round, ceil | The only rounding that meets both owner rules (halved; 1 → 0). |
| D2 | Damage step lives in combat `applyHit` | in `reactToHit` | `applyHit` is the one damage path; `reactToHit` is knockback and has no damage. |
| D3 | Crouch is an explicit `PlayerInput.crouch`, grounded only | derive from `aimY` | Gamepad aims with the right stick; crouch must follow the move stick / d-pad. Air down stays aim-down, so dive-down and rocket-down are untouched. |
| D4 | Aim, fire and jump stay live while crouching; facing still turns | lock them | Owner only asked to stop walking; turning lets the blob face an attacker (back hits hurt more). |
| D6 | Feet keep their normal pose while crouched; only body and head sink | feet shrink to almost nothing (round 2 § 2.4) | Owner, Stop 2 Change verdict on #40: "The feet shouldn't disappear. They can stay the same." Overrides feedback round 2 § 2.4. |
| D7 | Crouched face: helmet sinks 4 u, eyes rise 2 u and are drawn under the dome, so the rim covers about half of each eye; standing face unchanged | only lower the helmet (eyes are drawn over the dome, so it never covers them); always draw eyes under the dome (cuts their top while standing) | Owner, Stop 2 on #40: "when crouching, the helmet should cover about 50% of the eyes". Agent's call on helmet vs eyes per the orchestrator. |
| D5 | Hitbox unchanged (render-only sink) | shorter hitbox | Spec is a damage stance; ducking under rockets would be a second mechanic. |
