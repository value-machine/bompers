# Decisions — fire-clusters

Job: `temp_job_fire-clusters`
Updated: 2026-11-17

## Closed

| id | topic | status | choice | source | notes |
|----|-------|--------|--------|--------|-------|
| D1 | Flame rule in a cluster | closed | B "Big flames": neighbours pool into fewer, bigger flames; plus flames taller toward the cluster's middle and a fixed per-flame size jitter | loop-refine | Owner, 2026-11-17, options page, over A joined crown and C bonfire: "but i want a bit of randomness in the size or more to the center of the burn flames should be higher if we can make that happen without perf impact". Both additions add no shapes (a few map lookups per top-edge flame), so both are in |
| D2 | How the merged outline is made | closed | Body slabs (one rounded rect per row run of burning blocks) plus flames on the cluster's top edge, all drawn in ink first and in colour on top | loop-refine | clear-winner on frame cost (architecture § Performance cost risk). Rejected: a marching-squares contour of a heat field every frame (the terrain rebuilds its contour only when terrain changes; fire flickers every frame, so it would re-contour ~1 500 samples and re-tessellate hundreds of pieces per frame on a 400-unit fire) and a circle per block (as many shapes as today). The slab design draws about 30–45 shapes where today's draws about 200 on the options page's fire. It reuses the terrain's idea (ink = the shape grown, under the fills), not its contour code |
| D3 | Char darkening (fire-visuals D1) | closed | Dropped: the fire body covers burning cardboard | loop-refine | clear-winner: the owner asked for one fire shape over a bunch of flames; the char would sit under it unseen. Stated on the options page. Scorch on earth stays |
| D4 | Sim, sounds, spray, blobs | closed | Unchanged; render only | loop-refine | clear-winner: the request is about the look of terrain flames |
| D5 | Fire pace (tuning of blast-power D6) | closed | Spread 13 units / s (was 40, about 3 × slower); a lit sample burns 7.5 s before it is destroyed (was 1.5 s, 5 × slower) | loop-build | Owner, 2026-11-17, Change on PR #58: "fire should spread way slower and destroy waaaay slower". Starting values for the owner to nudge. Unchanged: blob burn (2 s, ticks at 1 s and 2 s), torch lights on contact, burn-out batches every 0.25 s. Knock-on: the burning band is 98 units deep (was 60), so up to 1.6 × more samples burn at once along a front; drawing stays a body slab per row run plus top-edge flames (a fully burning 400 × 224 slab: 28 rows, at most 50 flames). A blob standing by a fire can now catch from the same spot for 7.5 s instead of 1.5 s |

## Log

- 2026-11-17 — D2–D4 closed via loop-refine (clear-winner)
- 2026-11-17 — D1 asked (options page https://claude.ai/artifact/YAC5wKnfBroT1Rjzde5bq6)
- 2026-11-17 — D1 closed via loop-refine (asked; relayed by the orchestrator); the picked variant was added to the options page
- 2026-11-17 — D5 closed via loop-build (asked: owner Change on PR #58, relayed by the orchestrator)
