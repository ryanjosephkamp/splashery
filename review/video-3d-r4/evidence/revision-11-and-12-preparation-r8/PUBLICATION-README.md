# Exact evidence packet and source attribution

This packet preserves the completed revision-11 corpus attempts, separate revision-11 and
revision-12 sample checks, analytic and GPU controls, and every retained failed or interrupted
check. The [original packet README](README.md) explains those results and their limitations.

The raw source-credit snapshot contains existing source titles and license names with British
spelling. Its bytes are preserved as `payload/source-r11/CREDITS.md.gz`; no attribution, title,
or license text was rewritten. This is an additional storage layer around the unchanged original
packet, whose freeze SHA-256 remains
`c93fc283eaac8498fcb18a4f1c2e154a2bbdf2925346c2be7e9d2e339e4ba360`.

Run `python3 restore-root-packet.py --check` to verify all original packet bytes without writing.
Run `python3 restore-root-packet.py /new/empty/path` to restore the exact original packet into a
fresh directory, then use its `restore-and-verify.py` instructions to restore the original payload.
The root inventory, storage map, and original packet inventories retain every original path and
SHA-256. The uncompressed original attribution remains outside the repository with the frozen
source packet. The English checker and all test assertions are unchanged.

Rule check: none.
