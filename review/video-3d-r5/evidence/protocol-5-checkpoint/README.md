# Protocol 5 checkpoint

This is a partial checkpoint of the active twelve-hour Goal, not a corpus pass. Product runtime
files are frozen at b9be49f4, evaluator tools at 0406a781, and the baseline at 5a55f5cc. The
complete new corpus began at 3:34:57 UTC on October 16, 2026. All measurements remain
software-device-profile measurements; physical-phone performance is not established.

The independent verifier retained every exact JPEG and disjointness check. A fresh source-decoder
control now verifies all 24 training pictures and six held-out pictures from the retained desktop
failure, including 2.125 seconds. That is a separate diagnostic; the original failed row is never
promoted or relabeled. The live full-suite report records 3,006 passes, three failures, and one
existing skip. All three failures passed alone, but still count.

The direct MP4 decoder, NV12 repacking attempt, and midpoint-frame camera-only experiment are
rejected diagnostics, not shipped quality improvements. The camera experiment stops before any
seeding or training; its zero-camera result is retained. One superseded unfinished protocol-4
baseline was explicitly interrupted at the protocol restart, and remains incomplete.

The native corpus inputs, pictures, and reconstructions retain the per-clip author and license
records in the parent corpus manifest. In particular, cat-track derives from Clément Bucco-Lechat,
CC BY-SA 3.0; cat-plays from Riverarvi, CC BY-SA 4.0; and chameleon-flowers from Ventrovert, CC BY
4.0. No original corpus input was replaced or enhanced. Tools are MIT, made by Ryan with Codex
(GPT-6).

Every `.gz` stores the original bytes; decompress it to recover its original filename. The inventory
contains both original and stored-file SHA-256 checksums. PNG and PLY evidence is copied without
changing its bytes. This evidence branch must never be merged.
