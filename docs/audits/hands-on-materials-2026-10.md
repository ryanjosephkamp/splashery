# Hands-on materials audit — October 3, 2026

## Summary

Codex built this reference dataset for 79 toys or explicitly identified moving components, including
all 25 Balls shelf entries. It uses the Hands-on Plan at main commit
`d2c43327019e83d6c5b94217ab6def2742c1d2c4` and changes only the two authorized output files.
Official sport dimensions and mass limits are distinguished from selected midpoints, manufacturer
references, calculated values, and estimates. Every quantity links to evidence; quoted excerpts and
locations are stored in JSON, once per source URL and referenced thereafter. Contact, flight,
moisture, loading, and ballast conditions are explicit. This is reference data, not an implemented
or experimentally validated engine. All unverified choices carry `unconfirmed: true` and a reason;
Earth and pulsar contact/fluid values are inapplicable. The report flags passive-motion
contradictions and gives waterline estimates for stated geometry and fluid conditions.

## Materials table

Mass is in kg; size is in m, either diameter (`d`) or length × width × height. A cylinder adds axial
height (`h`). Restitution is the normal hard-floor reference; drag is dimensionless in air using the
JSON area convention. `†` means unconfirmed, including estimated water immersion; `N/A` means
physically inapplicable. A source-defined nominal or limit without `†` is not a measurement of the
rendered toy. Components in parentheses identify what actually moves.

| Toy                             |  Mass (kg) | Size (m)                 | Restitution |  Drag | Floats?                  |
| ------------------------------- | ---------: | ------------------------ | ----------: | ----: | ------------------------ |
| `acorn` (nut)                   |     0.005† | 0.025† × 0.018† × 0.018† |       0.25† |  0.5† | No†; sinks               |
| `american-football`             |     0.4111 | 0.2826 × 0.1708 × 0.1708 |       0.55† | 0.18† | Yes†; depth 0.01627† m   |
| `apple`                         |      0.18† | d 0.075†                 |       0.15† | 0.47† | Yes†; depth 0.05438† m   |
| `asteroid`                      |         1† | d 0.09†                  |       0.15† | 0.47† | No†; sinks               |
| `balloon-dog`                   |     0.015† | 0.3† × 0.1† × 0.22†      |        0.4† |  0.8† | Yes†; depth 0.00165† m   |
| `baseball`                      |     0.1453 | d 0.07378                |       0.55† | 0.35† | Yes†; depth 0.0465† m    |
| `baseball-cap`                  |      0.08† | 0.28† × 0.2† × 0.12†     |        0.1† |  0.8† | No†; sinks               |
| `basketball`                    |        0.6 | d 0.2419                 |      0.7674 | 0.47† | Yes†; depth 0.04227† m   |
| `beach-ball`                    |      0.07† | d 0.4†                   |        0.6† | 0.47† | Yes†; depth 0.01065† m   |
| `bicycle`                       |        12† | 1.8† × 0.6† × 1.1†       |       0.15† |    1† | No†; sinks               |
| `bouncy-ball`                   |     0.072† | d 0.05†                  |       0.95† | 0.47† | No†; sinks               |
| `bow-and-target` (arrow)        |     0.025† | 0.7† × 0.05† × 0.05†     |        0.1† |  0.6† | No†; sinks               |
| `bowling-ball`                  |      6.804 | d 0.2171                 |       0.35† | 0.47† | No†; sinks               |
| `bus`                           |   1.2e+04† | 12† × 2.5† × 3.2†        |       0.05† | 0.65† | No†; sinks               |
| `butterfly`                     |    0.0003† | 0.03† × 0.08† × 0.01†    |       0.02† |    1† | Yes†; depth 0.0075† m    |
| `cherry-blossom` (petal)        |     1e-05† | 0.02† × 0.012† × 0.0002† |       0.05† |  1.1† | Yes†; depth 0.0001818† m |
| `cricket-ball`                  |     0.1595 | d 0.0721                 |        0.5† |  0.4† | Yes†; depth 0.05214† m   |
| `crossbow` (bolt)               |      0.03† | 0.4† × 0.04† × 0.04†     |        0.1† |  0.6† | No†; sinks               |
| `crystal-ball`                  |      1.31† | d 0.1†                   |       0.35† | 0.47† | No†; sinks               |
| `dandelion` (seed)              |     5e-07† | 0.025† × 0.012† × 0.012† |       0.02† |  1.1† | Yes†; depth 0.01† m      |
| `dice` (one die)                |    0.0045† | 0.016† × 0.016† × 0.016† |       0.45† | 1.05† | No†; sinks               |
| `dodgeball`                     |       0.14 | d 0.178                  |       0.55† | 0.47† | Yes†; depth 0.02343† m   |
| `donut`                         |      0.08† | d 0.09† × h 0.025†       |       0.25† |  0.8† | No†; sinks               |
| `earth`                         |  5.972e+24 | d 1.274e+07              |         N/A |   N/A | N/A                      |
| `eye`                           |    0.0075† | d 0.024†                 |       0.05† | 0.47† | No†; sinks               |
| `flying-disc`                   |      0.175 | d 0.273† × h 0.032†      |        0.2† | 0.12† | Yes†; depth 0.0304† m    |
| `frog` (fly prey)               |     1e-05† | 0.007† × 0.012† × 0.004† |       0.02† |    1† | Yes†; depth 0.003636† m  |
| `golf-ball`                     |    0.04593 | d 0.04267                |        0.8† | 0.25† | No†; sinks               |
| `gradient-descent` (ball)       |     0.033† | d 0.02†                  |        0.3† | 0.47† | No†; sinks               |
| `grapes` (grape)                |     0.006† | d 0.022†                 |       0.15† | 0.47† | No†; sinks               |
| `helicopter` (rotor)            |        80† | 10† × 0.3† × 0.15†       |        0.1† |  0.8† | No†; sinks               |
| `hockey-puck`                   |      0.163 | d 0.076 × h 0.025        |       0.35† |  0.8† | No†; sinks               |
| `hot-air-balloon`               |      2471† | 22† × 17† × 17†          |       0.03† |  0.5† | No†; sinks               |
| `iceberg`                       | 4.402e+05† | 10† × 8† × 6†            |       0.05† |  0.9† | Yes†; depth 5.502† m     |
| `kelp` (blade)                  |      0.05† | 0.5† × 0.05† × 0.002†    |       0.03† |  1.1† | No†; sinks               |
| `kite`                          |      0.12† | 0.9† × 0.75† × 0.015†    |       0.05† |  0.2† | No†; sinks               |
| `lacrosse-ball`                 |     0.1453 | d 0.06368                |     0.8077† | 0.47† | No†; sinks               |
| `leaning-tower` (one ball)      |         1† | d 0.09†                  |       0.15† | 0.47† | No†; sinks               |
| `lotus`                         |      0.05† | 0.15† × 0.15† × 0.06†    |       0.05† |  1.1† | Yes†; depth 0.05769† m   |
| `maple` (leaf)                  |    0.0005† | 0.1† × 0.08† × 0.0001†   |       0.03† |  1.1† | Yes†; depth 9.091e-05† m |
| `marble`                        |   0.00536† | d 0.016†                 |        0.6† | 0.47† | No†; sinks               |
| `marble-bust`                   |        20† | 0.45† × 0.35† × 0.6†     |       0.05† |  0.9† | No†; sinks               |
| `medicine-ball`                 |        10† | d 0.28†                  |        0.1† | 0.47† | Yes†; depth 0.2168† m    |
| `model-splats` (fallback block) |       0.5† | 0.2† × 0.1† × 0.1†       |       0.25† |  0.9† | Yes†; depth 0.05† m      |
| `oak` (leaf)                    |    0.0004† | 0.1† × 0.06† × 0.0001†   |       0.03† |  1.1† | Yes†; depth 8e-05† m     |
| `ocean-liner`                   |     7e+07† | 300† × 35† × 55†         |       0.02† |  0.8† | Yes†; depth 10† m        |
| `palm` (coconut)                |       1.4† | d 0.16†                  |       0.25† | 0.47† | Yes†; depth 0.09653† m   |
| `paper-plane`                   |   0.00499† | 0.21† × 0.14† × 0.035†   |       0.05† |  0.1† | No†; sinks               |
| `patterned-egg`                 |      0.06† | 0.058† × 0.044† × 0.044† |       0.08† |  0.5† | No†; sinks               |
| `pencil-real`                   |     0.007† | 0.18† × 0.007† × 0.007†  |       0.25† |  0.9† | Yes†; depth 0.006125† m  |
| `pickleball`                    |     0.0243 | d 0.07415                |      0.6224 |  0.5† | Yes†; depth 0.07† m      |
| `ping-pong-ball`                |     0.0027 | d 0.04                   |       0.87† | 0.47† | Yes†; depth 0.006973† m  |
| `pool-ball`                     |      0.163 | d 0.05715                |        0.6† | 0.47† | No†; sinks               |
| `popcorn` (kernel)              |   0.00012† | d 0.018†                 |       0.15† |  0.7† | Yes†; depth 0.002147† m  |
| `propeller-plane` (propeller)   |        20† | 2† × 0.15† × 0.12†       |        0.1† |  0.8† | No†; sinks               |
| `pulsar`                        |  2.784e+30 | d 2e+04                  |         N/A |   N/A | N/A                      |
| `rose` (petal)                  |     4e-05† | 0.04† × 0.03† × 0.00015† |       0.03† |  1.1† | Yes†; depth 0.0001333† m |
| `rubber-duck`                   |      0.05† | 0.09† × 0.08† × 0.08†    |        0.3† |  0.7† | Yes†; depth 0.01667† m   |
| `rubber-duck-real`              |      0.05† | 0.09† × 0.08† × 0.08†    |        0.3† |  0.7† | Yes†; depth 0.01667† m   |
| `rugby-ball`                    |      0.435 | 0.29 × 0.191 × 0.191     |       0.55† |  0.3† | Yes†; depth 0.015† m     |
| `sailboat`                      |       4120 | 9.53 × 2.99 × 15.96      |       0.02† |  0.8† | Yes†; depth 2.3 m        |
| `shuttlecock`                   |    0.00512 | 0.085† × 0.063 × 0.063   |        0.1† |   0.7 | Yes†; depth 0.04032† m   |
| `soccer-ball`                   |       0.43 | d 0.2196                 |       0.65† | 0.25† | Yes†; depth 0.0375† m    |
| `softball`                      |     0.1882 | d 0.09708                |       0.47† |  0.4† | Yes†; depth 0.04156† m   |
| `spinning-top`                  |     0.035† | d 0.04† × h 0.05†        |       0.25† |  0.6† | Yes†; depth 0.04375† m   |
| `sports-car`                    |      1500† | 4.5† × 1.9† × 1.3†       |       0.05† |  0.3† | No†; sinks               |
| `squash-ball`                   |      0.024 | d 0.04                   |        0.4† | 0.47† | Yes†; depth 0.02594† m   |
| `steam-train`                   |     8e+04† | 20† × 3† × 4†            |       0.05† |  0.8† | No†; sinks               |
| `submarine`                     |     8e+06† | 100† × 10† × 12†         |       0.02† | 0.25† | Yes†; depth 9† m         |
| `tennis-ball`                   |     0.0577 | d 0.067                  |     0.7451† | 0.55† | Yes†; depth 0.02747† m   |
| `tin-can-real`                  |     0.045† | d 0.073† × h 0.11†       |       0.25† |  0.8† | No†; sinks               |
| `tomatoes` (one tomato)         |      0.12† | d 0.06†                  |       0.15† | 0.47† | No†; sinks               |
| `tractor`                       |      4000† | 3.8† × 2† × 2.5†         |       0.05† |  0.8† | No†; sinks               |
| `trebuchet` (stone)             |         1† | d 0.09†                  |       0.15† | 0.47† | No†; sinks               |
| `ufo` (cow)                     |       600† | 2.4† × 0.8† × 1.4†       |       0.05† |  0.9† | Yes†; depth 1.292† m     |
| `volleyball`                    |       0.27 | d 0.2101                 |        0.7† |  0.3† | Yes†; depth 0.03008† m   |
| `water-polo-ball`               |      0.425 | d 0.2212                 |       0.65† |  0.3† | Yes†; depth 0.03711† m   |
| `windmill` (sail rotor)         |     2e+04† | 20† × 20† × 1†           |        0.1† |  0.8† | Yes†; depth 0.8† m       |
| `yo-yo`                         |      0.06† | d 0.055† × h 0.035†      |       0.25† |  0.7† | No†; sinks               |

## Provenance and calculations

Each numeric field is a quantity object with `value`, `basis`, `unconfirmed`, and `source_ids`;
estimates include `reason`, and derived values include `calculation`. A `sources` entry either
contains short verbatim excerpts with their location or a `quote_ref` to the earlier toy’s source
entry. Follow that reference to the quoted line; the repeated URL remains directly usable. Quotes
retain source spelling. Citation links on estimates establish context or a formula, not the selected
numeric value.

Sport standards usually specify intervals, rather than the mass of a particular ball. Midpoints and
SI conversions are shown in JSON. Golf uses its upper mass and lower diameter limits; bowling uses a
selected 15 lb ball, not the maximum allowed weight. Size-7 basketball, adult men’s
soccer/rugby/water polo, women’s field lacrosse, and foam-format dodgeball are explicit reference
choices. Other permitted formats need separate entries.

Restitution uses normal relative separation/approach speed. For a vertical drop with negligible air
loss and matching clearance-height conventions, `e = sqrt(h_rebound / h_drop)`. The
[FIBA floor test](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-official-basketball-rules-and-basketball-equipment.pdf)
specifies underside heights. The
[pickleball standard](https://equipment.usapickleball.org/docs/Equipment-Standards-Manual.pdf)
specifies top heights, so the calculation subtracts diameter from each height. These are effective
drop-test references. Tennis and lacrosse conversions remain unconfirmed because both height
endpoints were not established in the inspected text. Table rebound, softball fixture COR, and the
suspended USBC bowling COR requirement do not establish a universal hard-floor coefficient.

The
[NASA shape reference](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/)
makes coefficient and projected-area conventions explicit. JSON stores the area and attitude for
each body. `F_drag = 0.5 * rho_air * Cd * A * speed^2`; lift uses the same form with `Cl` and the
declared lifting area. The
[badminton study](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/Cohen_2015_New_J._Phys._17_063001.pdf)
supports the shuttlecock’s measured axial drag interval. Planform areas for gliders cannot be
interchanged with edge areas or rotor blade sections.

The
[buoyancy reference](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy)
gives `rho_body = mass / displacing_volume`, density ratio `rho_body / rho_water`, and floating
submerged-volume fraction equal to that ratio. Fresh water uses an explicit rounded 1000 kg/m³
convention. Ideal sealed spheres solve `x²(3 − x)/4 = f`, where `x = immersion_depth / radius`; a
volume fraction is not generally a height fraction. Irregular bodies use clearly marked
prism-surrogate depths or an independently stated operating draft. Flooded caps, cans, discs and
perforated pickleballs exclude open air gaps.

The hot-air balloon keeps heated gas in its flight inertial mass:
`rho_hot = rho_ambient * T_ambient / T_hot`, `mass_total = mass_dry + rho_hot * envelope_volume`.
Its water case is a separate flooded state with vented gas. The
[manufacturer’s envelope table](https://www.cameronballoons.co.uk/c/download/Lightweight-Envelope-Components.pdf)
supplies volume and takeoff mass limits; the
[NASA balloon derivation](https://www.grc.nasa.gov/WWW/K-12/Numbers/Math/Mathematical_Thinking/designing_a_high_altitude.htm)
includes gas mass. Assumed temperatures, air density and dry mass remain unconfirmed.

## Unconfirmed values and why

- **Specimens and scale:** Nonstandard masses, dimensions, and displacing volumes are representative
  estimates because the plan does not identify measured specimens. Moving-part entries describe
  their named component, not the full tree, launcher or vehicle. The user-model fallback has no
  recoverable real material. Astronomical quantities retain their real scale and require a separate
  tabletop proxy before use.
- **Contact:** Nearly all hard-floor restitution and every applicable sliding/rolling friction value
  are estimates. Surface pair, speed, inflation, temperature, moisture, deformation and damage were
  not measured. Grass, cloth and ice profiles are separate working estimates. Rolling resistance is
  dimensionless `F_roll = C_rr * N`; it does not replace contact friction or tip torque. The
  [friction text](https://openstax.org/books/university-physics-volume-1/pages/6-2-friction)
  supports surface dependence, not a measurement for these objects.
- **Flight:** Except the stated shuttlecock test range, drag and lift snapshots are estimates. Cap
  and paper-plane coefficients, rotor section lift, pappus drag and wingbeat averages need
  specimen-specific force curves. The
  [paper-airplane experiment](https://lactea.ufpr.br/wp-content/uploads/2018/08/On_the_Aerodynamics_of_Paper_Airplanes.pdf)
  supports shape/attitude dependence; it does not measure this folded plane. The
  [disc research page](https://research.engineering.ucdavis.edu/biosport/sample-page/test-page-1/frisbee-flight-simulation-and-throw-biomechanics/)
  describes force and moment dependence, but its linked quantitative thesis was unavailable. Neither
  source verifies the estimated coefficients.
- **Spin:** Fingertip, chip, racket, disc, top, propeller and release rates are illustrative
  estimates. Baseball’s confirmed reference is the
  [2016 four-seam mean](https://www.mlb.com/news/what-statcast-spin-rate-means-for-fastballs-c212735620),
  not a current average or casual flick. Golf’s short-chip estimate is kept separate from the
  [recommended full pitching-wedge target](https://www.trackman.com/blog/3-steps-to-improve-your-spin-rate-in-golf).
  Null spin means no characteristic release rate was established.
- **Water:** Float and depth predictions are unconfirmed for actual toys because seals, material,
  wetting, hull lines, loading and orientation were not measured. Pure-ice density comes from the
  [NRC report](https://publications-cnrc.canada.ca/eng/view/ft/?id=4995d5c2-329b-4b3d-89f6-46aaac49bdbd);
  its chosen berg dimensions remain estimates. The
  [sailing-yacht specification](https://www.beneteau.com/oceanis/oceanis-301) supplies a lightship
  mass and maximum deep-keel draft, not every loaded waterline. Water restitution zero is an
  explicitly artificial entry placeholder; a fluid solver must handle splash, buoyancy, added mass
  and drag. Water has no solid-contact sliding/rolling coefficient.
- **Unavailable or older evidence:** Squash uses the
  [published older double-yellow-dot specification](https://worldsquashofficiating.com/wp-content/uploads/2023/03/Rules-of-Singles-Squash-2020-V2.pdf);
  the current linked specification could not be retrieved. Tennis drop procedure comes from an older
  ITF test-method document alongside the current rules. These limitations are retained in the
  relevant source records and notes.

## Plan behavior versus real physics

- Beach balls and air-filled balloon dogs can fall slowly, but they do not hover in still air just
  because they are light. The beach ball’s lifting coefficient is an axial nonspinning
  approximation; drag delays descent, while water buoyancy is a separate effect. This follows from
  the
  [NASA drag model](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/)
  and the
  [buoyancy model](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy)
  under the stated mass/volume assumptions.
- A baseball cap may briefly glide in a favorable shape/attitude; its flexible crown and brim do not
  guarantee disc-like flight. Paper planes and discs need lift curves and moments. Shuttlecock
  cork-first recovery needs aerodynamic torque, not just drag. These are model inferences from the
  [disc dynamics research](https://research.engineering.ucdavis.edu/biosport/sample-page/test-page-1/frisbee-flight-simulation-and-throw-biomechanics/)
  and the
  [badminton study](https://rainbow.ldeo.columbia.edu/~alexeyk/Papers/Cohen_2015_New_J._Phys._17_063001.pdf);
  the cap itself was not experimentally tested.
- Golf backspin and pool draw require a tangential impulse and a suitable initial spin. A low-speed
  flick alone does not reverse a pool ball. The
  [spinning-ball contact paper](https://arxiv.org/abs/2208.11685) shows that tangential contact
  compliance can permit slip reversal; normal restitution alone cannot.
- Squash bounce can change as temperature changes; it does not necessarily become livelier on every
  throw. A soft filled medicine ball thuds; a rubber rebound medicine ball is a different reference.
  A heavy marble bust’s mass alone does not explain a low bounce, and brittle objects can fracture.
  The temperature distinction comes from the
  [squash specification](https://worldsquashofficiating.com/wp-content/uploads/2023/03/Rules-of-Singles-Squash-2020-V2.pdf);
  the other contact distinctions are model inferences from
  [inelastic-collision physics](https://openstax.org/books/university-physics-volume-1/pages/9-4-types-of-collisions).
- Passive ping-pong impacts lose energy. Their intervals can shorten toward chatter, but speed does
  not grow without energy input. A very bouncy ball still loses energy unless restitution is ideal;
  its near-height-preserving ricochets are not perpetual motion. This follows from energy loss in
  the
  [inelastic-collision model](https://openstax.org/books/university-physics-volume-1/pages/9-4-types-of-collisions);
  shortening intervals should not be described as increasing impact speed.
- A hockey puck slides far on ice, not on every hard floor. Bowling hooks need the spin/contact/oil
  history. A top requires tip torque; a yo-yo climbs only with string/axle dynamics. Windmill and
  aircraft rotors coast down unless wind or a motor supplies energy. These are contact/torque model
  inferences using
  [surface-dependent friction](https://openstax.org/books/university-physics-volume-1/pages/6-2-friction)
  and the
  [drag model](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/), not
  matched mechanism tests.
- A hot-air balloon rises only while its heated/loaded state has positive lift; cooling can reverse
  the motion. A submarine’s ballast permits positive, neutral or negative buoyancy, so surfacing
  after every push is conditional. Ships need watertight hulls; a sailing yacht’s return from heel
  also depends on stability. These are state-dependent inferences from
  [buoyancy](https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy)
  and
  [balloon gas accounting](https://www.grc.nasa.gov/WWW/K-12/Numbers/Math/Mathematical_Thinking/designing_a_high_altitude.htm);
  specific ballast and righting curves were not confirmed.
- The
  [Kew lotus profile](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:605422-1/general-information)
  describes mud-rooted rhizomes. An anchored flower’s recovery needs plant geometry and stem forces;
  treating it as a free sealed buoy is a stylization. Kelp blades without gas floats may sink, yet
  attached fronds can return through their constraints.
- Asteroid fragments need gravity or an explicit field to regroup. A fictional beam lifting a cow
  needs an external force. Hand-spinning Earth or a pulsar and damping it to a prescribed background
  rate are scaled controls rather than literal astronomical mechanics. These are explicit model
  limitations; the
  [NASA Earth reference](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html) and
  [neutron-star scale](https://science.nasa.gov/missions/hubble/hubble-sees-bare-neutron-star-streaking-across-space/)
  establish the actual astronomical scale.
- The tower’s two balls land together exactly under equal release conditions in vacuum. Air drag can
  give different arrival times if their drag-to-mass ratios differ. Falling maple leaves are leaves,
  not the winged seeds often used for autorotation examples. The equal-time statement is an
  idealized model inference:
  [drag depends on shape and area](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/shape-effects-on-drag/),
  while acceleration divides force by body mass. The leaf/seed distinction is read directly from the
  plan.

## Verification and limits

Coverage reconciles every strict behavior-word match (without treating “spine” as “spin”), all 25
Balls shelf ids, every named task example, and additional explicit rolling, fluttering, falling,
swooping, projectile, and floating-component actions. JSON toy ids are checked against
`src/toys.js`; keys are sorted, all numeric values are finite, quantity citations resolve, and all
estimates/nulls explain their uncertainty. The report table is checked against the reopened JSON.
Density, spherical-cap immersion and drop-ratio calculations are independently checked.

Only the requested JSON and Markdown report are changed. No source code, dependencies, assets or
live pages were changed. No physical experiments or engine/Playwright behavior tests were performed;
this task supplies reference data only.

Required pre-push checks: `npx prettier --check .` and `node tools/us-english.mjs --diff`. Their
executed outcomes are recorded in the draft pull request.
