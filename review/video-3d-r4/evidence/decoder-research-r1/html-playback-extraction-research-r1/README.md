# Sequential HTMLVideo extraction — bounded research

MIT original helper code, Made by Ryan with Codex (GPT-6). Outside-only research; no canonical/runtime/coordinator/protocol edits or native process signals. One owned Chromium151 browser uses the exact frozen native SwiftShader launch arguments. Local files only, muted playback1×, no device/camera request, upload, photo correction, or invented timestamp.

`summary.json` and the final table in `summary.md` are generated from raw `results.json`; every original outcome remains visible. This is extraction research under concurrent native/CPU/GPU load, not an isolated timing benchmark, physical-device result, bake, quality comparison, or acceptance claim.

## Fixed inputs, native counts, order

Predeclared sources: chameleon-flowers (plant), cat-plays, fremantle-orbit. Phone uses frozen R10phone maxFrames16/frameSide480; desktop uses high maxFrames60/frameSide960. Native3fps and smallest5/10/20s span covering each complete clip produce16phone frames for each, and30/24/36desktop frames respectively. Every planned window retains the same three trial targets from original windowTimes. No source/camera/feature/step/tier budget was reduced to create a faster completed result.

Phone pair order is sequential→seek for plant, seek→sequential for cat, sequential→seek for Fremantle. Desktop alternates again: seek→sequential for plant, sequential→seek for cat, seek→sequential for Fremantle. Every method opens a fresh local video on the SAME page/browser/arguments. The existing R10grabFrames/seekPresented code is copied byte-identically from immutable tools/product1cbccf108294437a2b6ae8b07dead9c56d3f3609. Its implementation, thresholds and JPEG quality remain unchanged. The fixed alternating order mitigates a single consistent warm-order advantage; it does not remove shared-load/cache variation.

The research orchestration has a120sper-case diagnostic abort and14minbrowser-collection bound so the overall task stays within its20minscope. These are external research limits, not a changed native bake/extraction setting or accepted product deadline. Any censored/incomplete case remains incomplete and cannot establish a timing win. Independent proof is timed separately and uses the frozen independent decoder; the overall browser watchdog bounds it if that decoder stalls.

The single page viewport stays1440×900 for both groups; “phone” and “desktop” here identify the native frame-count/picture-size settings, not a full mobile-context or physical-device simulation. The copied extraction code does not choose its tier from this viewport; those exact tier settings are supplied explicitly for this extraction-only experiment. This differs from the full native benchmark context and cannot replace its measurements.

## Sequential semantics

Fresh video starts at0, playbackRate1. Each RVFC records actual metadata.mediaTime. The next target selects the first callback at/after that target within its original window. Actual PTS must increase strictly. If a callback crosses its window or has already crossed the subsequent unprocessed trial target, the attempt rejects as a missed sample; no frame is relabelled with the requested time. The strict second-target guard was declared before results, and is more conservative than allowing duplicate/late trials.

The callback pauses video immediately before copying gray pixels and any improved full photograph synchronously through the SAME original HTMLVideo→2D path. Original fitSide/panoSafeCrop/sharpness and JPEG quality0.92 are used. JPEG encoding awaits while paused, then the next RVFC arms before resume. Every window evaluates all three trials; only its sharpest is kept, using the original strict `score > best` comparison. No WebCodecs, generated stream, color preset, rescaling fix, image postprocessor, or alternative camera is used.

Missed/cross-window/nonmonotonic callbacks, ended playback, copy/encode errors, abort and deadline return no completed photograph array. Internal diagnostic progress is not a published partial extraction result. Cleanup pauses playback and cancels the owned RVFC/listeners. Client then closes video and revokes object URL. Existing seek controls run separately so timing and identity evidence cannot be attributed to a fallback automatically. Complete photographs from a later proof failure remain raw negative evidence, never accepted output.

## Independent image and timestamp gate

Every selected JPEG is hashed and passed to a byte-identical frozen `sourceFrameReceipts`, with the same source file, FFprobe best_effort_timestamp_time inventory, crop, dimensions and JPEG encoder. Each selected hash must equal the independent source JPEG hash AND its repeated encoding hash. Every matched sourceTime must equal the photograph's recorded actual presentedTime within1microsecond. Recorded source times are never overwritten by the independently matched source time. Zero tolerance applies to image/JPEG bytes; timestamp tolerance is only the explicitly requested1microsecond.

No held-out pictures or bake metrics are read. Receipt views is empty. The copied function's generic method text mentions held-out disjointness, but that clause is inapplicable here: this experiment uses its training-picture source identity portion only and makes no held-out claim.

Successful sequential runs retain every RVFC's timestamp/wall time and trial/window diagnostic timing. Legacy progress records each original selected-window callback. A rejected early sequential attempt's local full RVFC buffer is not returned; its exact recorded error and completed-trial count remain, and no unobserved source time is inferred from that failure.

## Controls and extension policy

Six CPU scheduling/ownership tests cover all three actual trial captures, first actual winning PTS, cross-window and missed-target rejection, nonmonotonic timestamps, abort after the first trial without restarting playback, and immediate synchronous draw failure. Fake pixels are CPU ownership fixtures only, not source-image evidence.

The native cancellation control aborts after its first actual trial, if time remains after all six declared pairs. It must return no complete photographs and leave video paused/closed. Remaining17corpus sources can extend only if ALL six completed clip/profile pairs are exact-source-verified AND sequential extraction is faster than its completed verified seek control. Failure of that gate leaves extension disabled; no result-dependent source dropping or retry occurs.

Read `summary.md` for the captured mixed outcomes and precise limits. No source was integrated or enabled in product. Parent owns any later decision; R10 remains immutable. Reproduce only in a coordinated browser slot with `node probe.mjs`; CPU tests and summary generation can run without a browser.

## Captured outcome and next boundary

All six pairs and the actual abort control completed, browser/server normally closed2026-10-15T11:10:41Z. Only two of six sequential cases completed: phone cat16photos in10.173s versus seek29.181s; phone Fremantle16photos in16.509s versus seek46.468s. Every one of those32JPEGs independently matched the source decoder and repeated encoding exactly, and every matched sourceTime equalled recorded actual PTS within1microsecond. All six seek controls also verified, for170total selected JPEG/source-time proofs across methods. Proof time is separate from the quoted extraction time. No aggregate speed/quality or corpus-completion claim follows.

Failures are retained: plant phone missed a trial before any completed capture; desktop plant crossed a window after62of90trial captures; desktop cat crossed a window after8of72; desktop Fremantle ended before the final target after107of108. Each returned no complete photograph array and closed/paused its owned source. The native abort control stopped after its first trial, returned no complete photos, and verified paused/closed cleanup. All failures block the success gate, so no remaining17source extension ran. No retry or startup variant was launched.

R1 deliberately did NOT enforce exact ceil-source-frame selection. Its “first observed at/after” rule could accept a later source frame still inside a window and before the next trial target. Such a frame may lie outside the frozen benchmark's requested-time exclusion band; this experiment does not evaluate held-out overlap or acceptance. CPU audit `ceil-analysis.json` compares recorded times with the first FFprobe source PTS at/after each requested trial without relabelling any time. For both successful phone runs, all96trial timestamps (and all32selected source pictures) happen to equal that exact ceil frame. That observation does not turn the missing guard into a general guarantee. In the failed desktop Fremantle run,5of107captured trial timestamps were one frame after the exact ceil frame. Legacy selected-picture timing also sometimes lagged: Fremantle phone's16selected pictures were one frame afterceil; one desktop Fremantle picture was two afterceil. All retained original timestamps and image-identity checks remain unchanged.

The first plant failure may involve startup readiness, but its failing callback's local full RVFC buffer was not returned; the report does not invent its exact timestamp or isolate a cause. A preroll or exact-PTS-table alternative was NOT tested or enabled here. Root may authorize a separate R2 with stricter semantics; R1 remains frozen mixed evidence.

## Rights

Original sequential/client/probe/test/summary code and report text are own MIT. Frozen R10 source/protocol snapshots retain their original rights and are identified by source path and byte hash. Corpus authors/license/source URLs come verbatim from already verified corpus-manifest.json in source-credits.json. No third-party source asset or model was downloaded. Raw JPEGs are unmodified local extraction evidence under their source licenses. No existing source/spec/test was edited or weakened.

Rule check: none.
