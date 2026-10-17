# Full-suite evidence before the final Neuron r2 main merge

Code head 652fe9449839bce3ce2ed9f305ef058f3a7e1a62, main aedbe4433. Workflow 39007527856 covered all
401 spec files. The original run had 3,412 passing tests, three failures, and one existing
private-fixture skip. Isolated rechecks of all three failures passed. A single full-shard rerun
ended with 3,413 passes, two failures (Pebbles and quartz), and the same skip; both remaining
failures also passed isolated rechecks. Original failure and recheck receipts are retained. No test
was weakened or skipped, and no repeated retry-until-green campaign followed.

Main then advanced with the approved Neuron r2 sharpness update (ea9a9d193). Task 107 requires a
final main merge and preflight, so that update was merged normally. Its diff changes no panorama,
Classic, shared renderer, physics, or existing test-source byte. Every recorded phone/model/cache
source hash remains identical. The new merged revision receives fresh related checks, preflight, and
a full matrix. This folder remains the immutable earlier full-suite outcome.
