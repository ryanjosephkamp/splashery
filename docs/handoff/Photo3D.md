## Song live (the song landscape's Live view)

Model: Sonnet 5.5. Branch `claude/lane-song-live`, one draft PR "Phase Song live: the song
landscape's Live view (Sonnet 5.5)".

- **Brief** (the Operator, September 29, 2026): the owner's note on the song landscape was "I was
  expecting the actual landscape to move with the music or something". Build a View option, "Whole
  song" (the default, so old links keep loading) and "Live": a scrolling spectrogram (a waterfall)
  where the part playing now sits on a fixed line near the front, the next seconds come toward you
  from the back, what has played slides away and loud bands rise at the line. No engine changes.
- **How it is built** (`src/packs/studio.js`, no engine change): the landscape is the same one, and
  while it plays the whole body slides toward you by exactly as far as the song has gone (a rigid
  scroll keeps the draw order, so nothing needs sorting again). Every cell, the floor and the
  waveform take the fade kind on morph channel 0 (= how far through the song), so what has played
  fades away over about 1.5 s as it crosses the line. The old marker and 48 small "caps" (tokens,
  one per group of bands) stay on the line: each cap is lifted to the loudness the song has there,
  interpolated between slices, so the loud bands rise at the line. Paused shows a still landscape; a
  tap still plays and pauses.
- **Costs:** none in the Whole song view (no fade splats or caps; a test checks it). Live adds 192
  cap splats.
- **Known issues:** the toy is framed for the whole song, so the front strip is small on a long
  song; the caps are a bright bar, not a filled crest.
