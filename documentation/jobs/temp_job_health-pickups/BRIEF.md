# Brief — health-pickups

**Owner ask:** "I want health pickups, same design pattern as the other pickups." Then, after the options page: "make it a hard jelly, and also change the other UI health chunks to hearts".

## Problem

A hurt blob can't get health back until it's knocked out. Levels need a placeable health pickup in the existing pickup family. The health UI should speak the same heart language.

## Success check

- A `health` collectible can be placed in a level file and is taught in LEVEL_FORMAT and the level prompt with an example. Ball Playground has 4.
- A hurt blob touching one gets +1 chunk, never above max. A full-health blob passes through and it stays. It is gone 12 s, then back.
- The pickup looks like a hard cherry candy heart. It plays the `pickup` take pitched by the collector.
- HUD card pips, the over-head bar and the lost-chunk pieces are hearts. Hurt and heal pops work on the HUD and over-head.

## Scope and edges

- In: the fixed-pickup sim + look, the combat heal, sound cue, catalog, level kit, Ball Playground, heart UI.
- Out: new sounds; changes to other levels.
- Size: M. The fixed pickups move to their own feature, because the collectibles services layer was at budget.
