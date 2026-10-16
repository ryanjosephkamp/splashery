# Rejected depth-buffer texture fill

These private prototypes reuse the existing depth buffer to guard a post-foreground texture pass.
They allocate no additional render target or camera, but their extra reflected RGB texture is still
counted. No memory, phone-cost, full-corpus, or production acceptance is claimed.

The valid unguarded forest screen reduced ribbons and texture loss, but worsened boundary color,
palette, edge displacement, transition width, and thin-line width. A two-pixel depth guard preserved
all 21 forest phone quality values and reduced ribbons by about 13%, but increased the street's
boundary error. A uniform source-color agreement rule and a projection-corrected guard also found
street counterexamples. The projection-corrected prototype changes only GLSL and is not a WebGPU
implementation. Every variant was cut.

The first extra pass was outside the original finder's material-discovery layer, so its UV and mask
diagnostics were incompatible. That raw attempt is explicitly labeled invalid and supplies no
quality or cost claim. All later color-bearing materials use the normal discovery path; the finder,
calibration, probes, and thresholds remain unchanged.

Two controls used exactly the original background colors in the added pass, with and without the
foreground's zero-alpha discard. All 36 native forest/street poses matched the baseline byte for
byte. This bounded control distinguishes the changed texture from the pass-order control; it is not
an improvement or a wider input test.

[evidence.json](evidence.json) lists exact source, method, raw-atlas, and integrity-report hashes.
Gzip files preserve original JSON bytes, including every early-stop and incomplete-corpus flag. The
independent check decoded all 117 actual native color poses and verified 585 artifact hashes across
13 repeated input/profile captures. One nine-pose capture has incompatible diagnostics; the other
108 poses include the 36 controls. These are repeated studies of three source inputs, not 13
distinct corpus inputs. Native images remain in the local capture workspace.

Source and method snapshots retain their exact local bytes and original workspace paths. Existing
source credits remain in the [main gallery](../CREDITS.md). These files are separate from the 54
retained-runtime videos and the three rejected mask videos. The
[code report](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-r5/docs/audits/photo-3d-r5-2026-10.md)
contains the numeric counterexamples.
