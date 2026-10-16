# Serial and parallel assessment inputs

These are the 12 original stage PNGs used by the recorded equivalence check. Each PNG is copied
without alteration and checked against its recorded SHA-256. The record compares every score, raw
capture hash, and all 576 reader outcomes.

[Verification record](../../../../results/review-pass/qualification-equivalence.json) ·
[Input paths and hashes](inputs.json) · [All diagnostics](../README.md)

To repeat the check from the repository root, restore each PNG to its originalPath in inputs.json.
Restore the two browser-review-pre-third JSONL files from the compressed repair-evidence manifest,
and copy the gallery's source PNGs into .cache/picture-qr-fidelity/review/sources/. Then run
tools/picture-qr-fidelity/verify-qualification.mjs under Node 22. The verification record identifies
the exact assessment-source hashes. The script rewrites that record only after every comparison
passes.

Source picture credits remain in CREDITS. Captures made by Ryan with Codex (GPT-6).
