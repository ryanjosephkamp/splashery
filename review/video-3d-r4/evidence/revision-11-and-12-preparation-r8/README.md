# Publication R8 packet: completed evidence, not native candidate R8

This is the eighth publication batch. Its native measurements are the completed **R11** generation at commit `636a7605fd15f3aa1e41d43cc6b5ff35432750b6`. The separately completed **R12 sample-only preservation check** uses commit `64ec9ad5b7a90b590b289f6a02f0bbd50138db08`. No R12 native result, live control, or snapshot is included. Publication does not turn a failed/interrupted check or a partial cohort into acceptance.

Start with STATUS.md and ATTRIBUTION.md. Original payload paths stay recognizable under `payload/`. A stored filename ending in an additional `.gz` contains a lossless archive of the original file; restore it before running tools that expect raw PLY/PNG/JSON bytes. No image was resized, re-encoded, sharpened, or relabeled. Images originally above1,000,000bytes are archived, so they are not oversized inline PR images. Human reports, original test/diagnostic source, and license notices remain readable.

The paired R11 final snapshot is `payload/candidate-r11-final-reconcile-snapshots-r1/0001/`. It contains its captured baseline reference and exact joined input copies. All13 raw R11 attempts remain separately under `payload/candidate-r11-v1-shards/`; paired8 and unpaired5 provenance are never merged. The reconciliation control copies are completed historical receipts. The machine logs, large JSON, expanded trace resources, and beneficial binary compression retain original/restored SHA256 mappings.

`payload/samples-r11-r1/` and `payload/samples-r12-r1/` are distinct source generations, each12cases/74exact views. Their own launch/runtime receipts and logs remain separate. The R12 completion observation is root's actual historical receipt, copied without inspecting a live PID. R11 native results must not be attributed to the R12 source.

Shrink R1/R2 preparation folders preserve both attempts. R2 corrects R1's claims: internal validation selects color magnitude, so this is validation-constrained fitting, not independent validation; opt-in can read remaining validation cameras after legacy would have rejected. The corrected integrated66 receipt remains unchanged. The wiring17 receipt is newly captured and binds actual Git64ec object bytes now; it does not claim those source bytes were historically captured from the earlier server. The quarantined invalid placeholder is excluded, listed only by source path/hash/reason in exclusions.json.

The interrupted R11 regression remains interrupted. Its passing tail repeat and separate calibration failures are preserved with the cross-run coverage receipt; coverage is not a completed single-suite pass. The original-spec audit reports file bytes only, not pass status. CI11c is a separate root-owned publication packet and is intentionally not duplicated.

## Exact restoration and verification

Only Python's standard library is required. Verification does not fetch anything, launch a browser, train, signal a process, or modify the original evidence:

```sh
python3 restore-and-verify.py --packet /ABSOLUTE/PATH/TO/publication-r8-r1
python3 restore-and-verify.py --packet /ABSOLUTE/PATH/TO/publication-r8-r1 --restore /ABSOLUTE/FRESH/RESTORED-DIRECTORY
```

Restoration refuses existing or overlapping destinations. Every stored file hash and every decompressed/written original hash must match `mappings.jsonl.gz`. Gzip output uses a zero timestamp and empty filename for reproducibility. `source-inventory.json.gz` records absolute original sources and their original byte hashes; originals were checked again after packet construction. `restoration-verification.json` and `freeze.json` record the actual verification and final packet inventory.

The original source files remain untouched. Original JSON references to workspace paths are preserved literally. The licensed input corpus and complete product repository are existing external prerequisites, not duplicated here. `build-packet.py` is the exact preparation source and requires the original workspace and source Git objects; consumers can use the standalone restorer without them. Source inventories are evidence bindings, not a claim that the packet is a standalone browser deployment.

All native wall times remain shared-load software-GPU/emulated-device observations, not physical-phone or isolated performance. Missing cases, failures, and unpaired models remain visible. No full-corpus speed/quality pass or10completed review movies is established by this packet.

Own scripts and reports: made by Ryan with Codex (GPT-6), MIT. Asset derivatives retain their individual source licenses; the root LICENSE applies to own code, not to all embedded assets. See ATTRIBUTION.md and the preserved vendor/source notices.

Rule check: none.
