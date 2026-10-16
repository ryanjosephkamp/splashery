# Prospective review follow-up: all 12 phone groups

This separate cohort contains all 72 planned fresh-browser cases: three adjacent AB/BA/AB pairs for
each of three toys and four inputs. It preserves the original measurement tool, five-second
real-clock motion window, and strict gates. Both revisions include the same upstream UI. The
[prospective plan](../benchmark-plan.json) predates measurement; source commits, runtime hashes,
tool hashes, protocol hashes, fixture hashes, and renderer metadata are in the raw records.

The [main records](main.json), [corrected-source records](round2.json), [comparison](comparison.md),
and [individual checks](comparison.json) retain every result. The
[artifact manifest](artifacts.json) maps every case to its exact, unchanged source and rendered PNG
crops with SHA-256 hashes. The root [fixture archive](../../fixtures/README.md) retains the same
cached input bytes. No favorable reruns, threshold changes, or case omissions are used.

The three `*-text-native.png` sheets use repeat 1 throughout. Their image pixels are neither resized
nor sharpened; captions show the three-pair medians. Each revision's independent reference crop is
archived, although the scanning sheet shows only main's reference. All images are below 1 MB.
Original comparison contributions are CC0, made by Ryan with Codex (GPT-6); existing photo credits
remain in CREDITS.md.

The benchmark ran without capture, test, or encoding jobs. These are Chromium software-renderer
measurements at 390×844 CSS pixels, device scale 2 with the normal low-tier 1.5 rendering cap.
Physical-phone performance is unmeasured. The original Goal cohort remains unchanged in the root
`benchmark/` archive; results from the two cohorts must not be pooled.

Rule check: none.
