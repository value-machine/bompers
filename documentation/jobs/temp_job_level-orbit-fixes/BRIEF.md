# Level orbit fixes (owner test of the AI level creator)

Repro: an AI-written "rotating planet with trees" level (`<g data-motion="spin 20s center">` holding three circles and five upright tree objects, spawns near the planet top). Owner: a spawn sat inside a tree; every tree pointed up. Import: W14 "sweeps over a spawn point". The fixed version ships as `public/level-kit/v2/orbit-test-level.html`.

## Findings

- Trees can't turn: an object stands upright on its rect's bottom centre, and any `transform` was W3.
- The spawn problem was mostly the pivot: `center` was the bounding box of every piece in the group, trees included, so the planet spun about (902, 605) instead of its centre (900, 680) and swung ~75 units through the spawns. The trees passing the spawns is real but secondary.
- In the game a covered spawn was already skipped on respawn (moving-parts D15) but not when a player joins; a part sweeping into a standing player pushes it (or crushes it against static terrain).
- `data-variant="snowy-pine"` is a valid id: no W23. No alias needed.

## Decisions (agent, no owner tie)

- **D1 Orientation:** an object rect may carry its own SVG `transform="rotate(a [cx cy])"`; the object is built upright and turned as a whole. Picked over `data-orient="surface"`: standard SVG, so the preview shows exactly what the game builds, and an AI repeats one upright rect on the planet top and changes only the angle. Other transforms, and transforms on ancestors, stay W3. Objects stay terrain objects (#125 rule).
- **D2 Pivot:** a named pivot is measured on the part's terrain shapes; objects riding the part don't count (all pieces when the part is only objects).
- **D3 W24 footing:** an object whose base is > 12 units off / inside the terrain shapes, or leans > 30° from the surface's outward direction, warns with the `rotate(a x y)` that fits. Validation the AI can act on.
- **D4 Joining:** joining players also skip spawns a moving part covers.
- **D5 W14 spawns:** one warning per covered spawn, naming it and what the game does; spin / swing name the clearing distance from the pivot. Prompt: spawns never ride a part; for spinning parts put spawns outside the circle the farthest carried object sweeps.
