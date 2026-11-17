# Decisions — fire-clusters

Job: `temp_job_fire-clusters`
Updated: 2026-11-17

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D2 | How the merged outline is made | closed | Body slabs (one rounded rect per row run of burning blocks) plus flames on the cluster's top edge, all drawn in ink first and in colour on top | loop-refine | clear-winner on frame cost (architecture § Performance cost risk). Rejected: a marching-squares contour of a heat field every frame (the terrain rebuilds its contour only when terrain changes; fire flickers every frame, so it would re-contour ~1 500 samples and re-tessellate hundreds of pieces per frame on a 400-unit fire) and a circle per block (as many shapes as today). The slab design draws about 30–45 shapes where today's draws about 200 on the options page's fire. It reuses the terrain's idea (ink = the shape grown, under the fills), not its contour code |
| D3 | Char darkening (fire-visuals D1) | closed | Dropped: the fire body covers burning cardboard | loop-refine | clear-winner: the owner asked for one fire shape over a bunch of flames; the char would sit under it unseen. Stated on the options page. Scorch on earth stays |
| D4 | Sim, sounds, spray, blobs | closed | Unchanged; render only | loop-refine | clear-winner: the request is about the look of terrain flames |

## Open

| id | topic | status | options briefly | blocked phase |
|----|-------|--------|-----------------|---------------|
| D1 | Flame rule in a cluster | open | A joined crown / B big flames (recommended) / C bonfire peak | refine |

## Log

- 2026-11-17 — D2–D4 closed via loop-refine (clear-winner)
- 2026-11-17 — D1 asked (options page https://claude.ai/artifact/YAC5wKnfBroT1Rjzde5bq6)
