# Retained task 100 evidence

Source `cf10f12f6fd15913059124a40391f3b2df8db5c4`. October 17, 2026.

The strict corrected native PNG transport probe passed 4/4 original drift cases
with four workers and two continuous burners, with zero skips or retries. This is
a diagnostic, not 30-repeat acceptance. All 48 paired PNGs had exactly equal
dimensions (90 by 112) and every RGBA byte matched, in both capture orders.
All 96 actual PNGs are retained. Median capture time was 2,191 ms through
Playwright and 1,211 ms through the direct native protocol.

The read-only native model observer saw 288 actual outputs, 77 unique inputs,
and 211 byte-identical repeated inputs. Every repeated input produced an exactly
identical raw depth output. No model, video, worker, clock, or answer was replaced.
The original native worker answer handler ran before the diagnostic observation.

The exact command, hashes, runtime, and load are in recipe.json. Exact executed
probe source is in probe-sources.zip. The earlier incorrect device-scale setup
failure is retained separately; no smaller PNGs or changed limits were accepted.
