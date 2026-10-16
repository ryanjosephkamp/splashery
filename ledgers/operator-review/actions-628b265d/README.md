# Final review CI evidence

[Full suite](https://github.com/ryanjosephkamp/splashery/actions/runs/38957277226): 345 files, 3,051
cases: **3,049 passed, 1 failed, 1 existing skip**. Initial failures remain counted. All eight
Moving photo files pass **73/73**, with zero failures, skips, or flaky outcomes. Classic Photo's
golden test passes **77/77**. Checks and the separate embed run pass.

The failed case is retained below, with its original report, screenshot, log, and isolated recheck.
`phy:64` is already in main's known list and passes the CI isolated recheck. No known entry or test
limit was changed. The workflow remains red for that original failure.

- `phy:64` Pebbles: stones pick up and stack into a new cairn; a careless one topples

## Exactly which source was tested

The run's PR head is `628b265df36444b717a8f13619f89d150a8d494b`. GitHub checks out merge preview
`4ea024f7a79b5efac37aca32c629dc814d4140a5`, incorporating main
`144cc80ec6f3aee0b248a076fbf6159f6008d84f`, which landed three seconds before the push. The later
normal main merge, `2a99420b98dd210b01d427f413f8c27d974c571a`, has exactly the same **entire tree**,
`75a92e53d5e7843a2f667f50967a24c1a1f69772`. The Moving photo application source hash remains
`9c18bf46aef4fc7de4a0f9668ff0b81ba2b75e15cc3faf514f7677e52c69e3a4`. The earlier local 73-case run
and calibration movies retain their earlier main host UI, `0b6f4bf26`. Their application and frozen
test/tool bytes are unchanged.

After the normal main merge, local preflight passes all seven checks, including **270/270**
shelf-wide cases. Its size allowlist contains only seven task-authorized long-film assets; no audit
JSON exceeds 300 KB. The local Photo golden comparison also matches all **76 samples at both
profiles**. Raw logs, exact commands, source pins, and file hashes are retained.

The [manifest](manifest.json) records every original and stored SHA-256. Download manifests retain
the GitHub artifact ZIP hashes, which are checked against GitHub's digest. Original reports and
isolated rechecks have separate paths. Earlier CI failures stay in the separate
[1299a32b archive](../actions-1299a32b/manifest.json); they are not relabeled.
