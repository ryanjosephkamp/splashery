# Quartz evidence index (restored after workspace replacement)

Engine ordering proof: native-before.log/json records the native reseat
regression failing on unchanged code; native-after.log/json records15/15
passes after draining collision reports before joint reseating. Exact
immutable source modules and complete V8 generation/pin/free timelines are
in immutable-sources.json and offline-native-proof.json.

Initial actual quartz comparison: stress-before and stress-after each passed
10/10, with23 intact neighboring joint bodies incorrectly unpinned in each
phase. Neither phase reproduced the target's final-position failure. All
original actions and expectation expressions remained unchanged. Reports
embed the full native observation attachments, including hit generation and
consumption timestamps and body/joint states. Archives and source hashes
were restored byte for byte from persistent backups after replacement.

Independent invariant proof: guard-before.log/json records a real native
projectile freeing an intact break-body while leaving broken=false; the
new strict pin assertion fails. The generic knock guard preserves intact
posed joints and leaves explicit joint impact breaks, ordinary pieces, and
ordinary socket knock-outs working. guard-final-native.log/json records17/17
passes. socket-order-proof.mjs/json proves the hit-order fix remains needed
with the intact-break guard, using an ordinary socket.

Broad related native validation passed52/53 initially; the sole failure was
a SoftParts.step-only wall-clock microbenchmark at1.086 ms under concurrent
root browser probes. The same unchanged isolated benchmark passed0.410 ms
in the subsequent quiet window (soft-quiet.log/json). It does not call the
changed HandsOn methods. The full final Gems browser gate passed5/5 in
guard-gate.log and guard-gate/report.json before replacement.

No final original100/final30 phase has started. final-stress-metadata.json
contains the frozen source/probe hashes and planned4-worker/2-burner recipe.
The before route overrides only HandsOn with immutable original source;
the final route uses the exact published guard source. Historical quartz
attribution remains qualified until a natural target failure is captured.
