# Decisions — homing-missiles

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | Homing missiles are rockets with `kind: "homing"` in `combat.rockets` (same sweep, contact, explosion). | Separate `missiles` list and step. | One flight/contact/explode path; only speed and steering differ. |
| D2 | Dodge rule: target locked at launch = nearest live opponent within ±70° of the aim (none → dumb straight shot); 0.2 s lock-on delay flying straight; turn rate ≤ 2.6 rad/s at 480 u/s (turn radius ≈ 185 u ≈ 6.6 blob widths); 1.6 s steering fuel, then straight; 3 s lifetime then air-burst; target eliminated → straight. Same blast as a rocket. | Re-target every step; proportional navigation; infinite fuel. | Speed only 1.4 × run speed and a wide turn radius: a late sidestep or jump makes it overshoot, and fuel ends loops — so not 100 % hit. Lock at launch keeps it readable (it chases who you aimed at). |
| D3 | 3 missiles per crate, 0.7 s cooldown, recoil 120. | 6 like rockets. | Homing is stronger per shot; fewer shots keep the rocket launcher attractive. |
| D4 | A drop point alternates through its `itemIds` with one crate-state counter; shipped levels list both items. | Random pick (sim has no RNG source, combat D6); per-drop counter. | Deterministic, and with any drop count both weapons appear. |
| D5 | `outOfBoundsMargin` uses the largest recoil across weapons. | Sum of recoils. | Only one shot fires per launch. |
