# Retained task 100 evidence

Four low-light cases with twenty observations and one real-motion negative
control passed. Four workers, two continuous CPU burners, zero skips or retries.
All original first-six data remain included, plus fourteen more observations.
The original median definition, 20-frame fixture, noise, limits, and 600-second
timeout remain. The current native-cadence helper is unchanged from 21dad2293.

Low-light cases took 246.3 to 263.9 seconds. Their full height medians were
0.0022410, 0.0016510, 0.0011351, and 0.0042966 against 0.0135. Every pair,
every six-observation window, and the full twenty-observation median are logged.
No short window failed in this pilot, so it does not reproduce the rare failure
or establish 30-repeat acceptance. One full median increased relative to the
first-six median (0.0011573 to 0.0016510); no value is discarded or selected.

Real native rotation with twenty observations produced height 0.0354118 and
shown drift 25.3967, exceeding both original clips' numeric limits. The
negative-control test used the original still limits 0.00055 and 0.95.

Immutable parent 21dad2293c05e36d985bdafa71cb2dc0c625a9e3. Exact commands,
hashes, runtime, source, CPU burner, report, and complete log are retained.
This is validation of the proposed count increase, not stress acceptance.
