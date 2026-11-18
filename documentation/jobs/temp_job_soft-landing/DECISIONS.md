# Decisions: soft-landing

- **D1** Variants from the current files, no new takes (ffmpeg): A quieter + 3.5 kHz high cut; B 1.8 kHz cut, 12 ms attack, click compressed; C −3 semitones, 2.2 kHz cut, 10 ms attack, compressed; D −5 semitones, 1.1 kHz cut, 20 ms attack. Gain baked into the files (jump now −14.4 LUFS, land −20.8 LUFS; C: −21.4 / −25.4), so the mix code is unchanged. Recommendation: C for both.
- **D2** Squash variants: S1 same pose, amount 0.2 + 0.8 × impact, 0.2 s, more overshoot (in band); S2 1.3 × 0.72 with a one-wobble spring, 0.2 s (axis past `JUICE_SQUASH.maxScale` 1.25, area 0.94 in band); S3 1.34 × 0.7, 0.26 s, two wobbles (past the squash window too). Recommendation: S2. Crouch already sinks to 1.18 × 0.68 (area 0.80), so a deeper land is not the deepest pose.
- **D3** Listening page: https://claude.ai/artifact/BFNRixxWcBLe2Ee8fxnXyS
