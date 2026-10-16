# ASCII export: integration brief

Prepared by Codex with GPT-6.1 Sol at Extra High effort on October 6, 2026. This is a design and
handoff update to the existing draft, not production integration.

## Current position

The owner accepted the local capture/encoding demo and approved proceeding. The concrete next step
is to review capture ownership and implementation scope before connecting it to Splashery. The
earlier instruction to leave the existing export menu unchanged still applies. Merging, deployment,
Operator messaging, and other chats/agents remain outside this task.

| Piece                              | Position                                                                    | Remaining work                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Deterministic ASCII core           | [PR #335](https://github.com/ryanjosephkamp/splashery/pull/335), open draft | Operator review and integration into main                                           |
| Capture, encoding, and demo        | [PR #352](https://github.com/ryanjosephkamp/splashery/pull/352), open draft | Review the reusable parts and their production boundaries                           |
| Browser capture from a fresh toy   | Proven by the local CLI in owned pages                                      | Implement and verify browser-managed ownership and cleanup                          |
| Capture of an arbitrary live scene | Not supported                                                               | Separate design if it is wanted later                                               |
| Site integration                   | Not implemented                                                             | Scoped integration lane, browser/device checks, then owner/Operator release process |
| PDF motion and text QR             | Separate experiments                                                        | Resume only after their next step is explicitly selected                            |

At this review, both drafts were open and main still pointed to
`7488008708c6f6123b47a5abc8f634f84d37d3ec`. The capture package before this documentation update was
`799f7f2791b28b1c9bf7485b1fc4fabfbe2f1537`. No GitHub checks were listed for #352; its verification
is the recorded local evidence, not a green CI claim.

## Recommended first integration

Start with a small lab that makes a fresh four-second example of grapes, whole orange, or
strawberry. Label it “Fresh toy animation.” Keep the original camera-home behavior and a single tap
at frame 4. Do not call it a recording of the person's current interaction. Initially omit user
files, live inputs, sound, custom scenes, other toys, and camera matching.

Use one disposable capture document with one player per job. A dedicated same-origin iframe is the
recommended browser prototype to test; the existing CLI uses separate browser pages, so the iframe
architecture itself has not been verified. Create it only after a Capture tap, keep it renderable,
and remove it after success, cancellation, timeout, navigation, or failure. A separate document
isolates lifetime; it is not a security boundary or proof that GPU memory is released immediately.
Measure repeated-job cleanup before choosing it for production.

Use a minimal capture host, not the full app or the existing embed page. Pass only a validated toy
ID, the known whole-orange option, fixed capture settings, and an opaque job ID. Do not send a
`Player` object or the owner's scene. Keep the capture surface noninteractive. With an iframe,
validate message source, origin, job ID, and message type, and bound payloads and outstanding
messages. Retain an iframe handle so teardown still works when the child fails to reply.

The main page owns progress, Cancel, converted frames, encoders, attribution, and the final explicit
download. Video encoding remains in the visible main document. The capture document owns only its
fresh player and render loop. Keep conversion independent of engine internals and reuse
`src/export/ascii.js` after #335 is accepted; the copy in this audit is for independent review.

## Why ownership needs its own implementation

The current adapter takes a `Player`, changes its clock/camera/render controls, runs its action, and
restores the controls it changed in `finally`. It advances toy history and cannot rewind an
arbitrary live toy. The stage lock prevents competing captures on that stage; it does not make a
live player safe to borrow.

The inspected player also registers a theme listener and a window device-motion listener in `init()`
/ `watchDeviceShake()`. Its current `destroy()` calls picture/media/painter/stage cleanup but does
not explicitly remove those listeners. Repeatedly creating players in the main document therefore
needs a lifecycle audit. The separate-document recommendation avoids relying solely on that destroy
method; it still needs measured cleanup. No engine fix was made here.

Source anchors at the package's main baseline: [Player](../../../src/player.js),
[Viewer](../../../src/viewer.js), [Stage](../../../src/stage.js),
[capture adapter](capture-adapter.js), and [CLI ownership](capture.mjs).

## Resource and failure contract to verify

- Only one capture/export job at a time. Reject another start instead of queuing more players.
- Keep the tested first preset at 420 pixels, 40 frames, 10 fps, and four seconds. Existing maximum
  bounds remain 512 pixels, 64 frames, and a 1.5-million-pixel export canvas; they are validation
  limits, not measurements of mobile safety.
- Convert each returned frame before accepting the next. Keep one converted sequence and one output;
  release decoded source surfaces promptly. A source-sequence download can be an explicit optional
  mode rather than always retaining every PNG and data URI.
- Use a per-render deadline and a proposed 30-second whole-job deadline. If the browser cannot
  finish, explain the failure and let the person retry; do not silently lower settings or reuse an
  incomplete clip.
- Abort when the main document becomes hidden. Always remove the capture document, end recorder
  tracks, clear timers/listeners, and revoke replaced output URLs. Cleanup must be idempotent and
  independent of a successful child reply.
- Load existing local modules/assets only. Make no camera, microphone, device-motion permission,
  upload, or unrelated network request. Do not write scene/settings to storage. A same-origin
  document can access storage, so privacy requires implementation and tests, not an iframe label.
- Preserve visible source/author/license/change notices in every output frame. Structured GIF
  metadata and reference MP4 comments are additional evidence. Browser video currently relies on the
  visible credit; do not claim it carries those container comments.
- Offer GIF first. Browser MP4/WebM remains a capability-checked, real-time option with actual
  encode/decode validation. Do not label it an exact-frame video. FFmpeg references stay build-time
  files; do not ship a new video encoder or binary merely to match their exact timeline.

## Acceptance checks for the browser prototype

| Check                         | Required result                                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three presets                 | Fresh captures load, move, and preserve attribution; selected ASCII settings change the export                                                                          |
| Original player               | Scene/camera/settings references, controls, and storage receive no capture-induced writes; a normally moving live toy need not freeze for byte comparisons              |
| Success/failure/cancel        | Capture document, tracks, timers, owned listeners, URLs, and in-flight work are released; no partial download is offered                                                |
| Repeated jobs                 | Ten sequential jobs and repeated mid-capture cancellation show no accumulating documents or owned handles; measure resource use rather than promising a numeric GPU cap |
| Background/navigation         | Hidden page and page exit abort; no late child message restarts a finished job                                                                                          |
| Unsupported renderer/recorder | Clear failure or GIF option; no format-success claim based only on a support flag                                                                                       |
| Privacy                       | No permission prompts, unexpected external requests, uploads, or scene/storage writes                                                                                   |
| Physical devices              | Record exact device/browser versions, successful downloads and decoded playback; a 390 × 844 viewport alone is not phone evidence                                       |
| Production regressions        | Run the scoped ASCII checks and the required full suite after actual source integration, including the existing embed-transfer limit                                    |

The previous eight package tests and 36 decoded shipped/reproduced media files remain useful
prototype evidence. They do not establish the proposed iframe host, production UI, repeated-job GPU
lifetime, all-toy support, or a complete physical-device matrix. The owner reported that the
reviewed demo passed; individual checks and device/browser versions were not supplied.

## Work remaining, in order

1. The Operator reviews #335 and #352 and assigns the browser-capture integration scope. This brief
   is ready for the owner to pass along; Codex has not sent it.
2. Implement the minimal disposable capture host and job coordinator in an isolated prototype. Prove
   the ownership, cancellation, resource, privacy, and download checks above.
3. Promote only the reviewed core/encoders/host into the assigned production paths, with one
   production ASCII core. Add a lab entry first if that is the selected route. Wiring the existing
   export menu needs an explicit change to the standing instruction before Codex does it.
4. Run production regression checks and physical-device review. The Operator handles review and
   merges under repository rules; the owner decides public release. These drafts stay drafts here.

No additional AI model is needed to perform capture, conversion, or export. GPT-6.1 Sol can
implement the remaining lifecycle work in this task when it has a concrete scope. No other model,
chat, agent, installation, or large new capture bundle was used for this documentation step.

## Prepared Operator handoff

This is text for the owner to send, not an automatically dispatched message:

```text
Please review the ASCII export work in draft PRs #335 and #352. Ryan accepted the local demo.
Read docs/audits/ascii-capture-encoding-prototype/integration-brief.md in #352. Keep both drafts
draft until your review process decides otherwise; this handoff does not authorize merging.

Recommend and assign a narrow browser-capture integration lane. Begin with grapes, whole orange,
and the credited strawberry, a fresh fixed-home-camera animation, no user files or live input,
one disposable capture document/player per job, and GIF first. Verify the proposed iframe host
rather than treating the separate-page CLI as proof of iframe behavior. Reuse the reviewed ASCII
core instead of adding another production copy. Scope engine/lifecycle work separately if needed.

Name the branch and exact allowed files before implementation. Preserve the existing export menu,
other work, and current behavior. Keep PDF and text QR experiments separate. Include cancellation,
hidden-page/timeout cleanup, repeated-job resource checks, main-player preservation, attribution,
privacy, actual decoded media, and physical-device evidence in acceptance. Report what remains
before any production release decision.
```
