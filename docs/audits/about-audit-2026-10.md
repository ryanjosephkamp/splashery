# About audit — October 2, 2026

Codex built this audit and the accompanying help corrections. Baseline: `main` at
`ced2a55f9a45f4a9a29e667e9a6b4d1c34e0711d`, pulled before creating `codex/about-audit`.

Coverage: **341 shelf toys, 341 help entries, 26 shelves; 108 entries corrected.** Each shelf toy
was reconciled with `src/toys.js`, its pack recipe or `src/rigs.js`, and its help. Recipe
declarations, input notes, option choices, controls and relevant action handlers supplied the
behavior evidence. Outside links below were opened; general facts use encyclopedia entries, with
papers, museums and standards for the most consequential technical corrections. Source access
failures were not treated as confirmation.

“OK” means this review found no text issue requiring a change. “Fixed” identifies a baseline issue
corrected in `src/toy-help.js`. These are static editorial findings, not acceptance of every toy on
a physical device. Decorative colors are appearance choices, not separate scientific models. Long
math menus use brief default-shape descriptions in About; the existing input panel displays the
chosen equation, and the complete preset catalog below gives additional detail. Facts that could not
be established are identified explicitly rather than guessed.

## Verification

- Imported all pack recipes and reconciled every shelf ID with a nonempty how-to and About entry. No
  missing or extra IDs.
- Executed both Busy Beaver rules: two states halt after 6 steps with four 1s; the three-state
  preset halts after 13 with six. Checked the binary-only input ambiguity and the Difference
  Engine’s 100,000 modulus directly from the exported helpers.
- Ran
  `SPLASHERY_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test tests/help.spec.mjs tests/unit.spec.mjs`:
  **31 passed, 3 failed**. All failures were `tests/help.spec.mjs` console-cleanliness assertions,
  receiving Chrome/SwiftShader “GPU stall due to ReadPixels” warnings. The failing cases were
  pick/fade/help toggle, refresh/old links, and saved-scene loading. Their reported failure was the
  warning assertion, not a text assertion. This does not make the suite green.
- No browser was installed. The first sandbox attempt could not bind the test server’s local port;
  the authorized run with the existing browser completed. Test-generated tracked screenshots were
  restored, so only the three requested files are included.
- Final text-length, formatting and American English checks are recorded in the pull request. The
  report does not certify microphone, camera, custom-video training or all device-specific behavior.

- The additional help-list-only run passed all 3 checks. A final inventory check found 341 unique
  report rows, 118 element headings and 236 sourced facts; every About has two paragraphs and 40 to
  180 words, and every how-to is at most 110 characters.

## Photoreal (32)

- **Cactus** (`cactus`): **OK** — Bloom matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Cactus](https://en.wikipedia.org/wiki/Cactus).
- **Strawberry** (`strawberry`): **OK** — Pop seeds matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Strawberry](https://en.wikipedia.org/wiki/Strawberry).
- **Heart cookie** (`cookie`): **OK** — Heartbeat matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Cookie](https://en.wikipedia.org/wiki/Cookie).
- **Honeybee** (`bee`): **OK** — Fly matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Honey bee](https://en.wikipedia.org/wiki/Honey_bee).
- **Cluster fly** (`cluster-fly`): **OK** — Groom matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Pollenia](https://en.wikipedia.org/wiki/Pollenia).
- **May beetle** (`may-beetle`): **OK** — Open wings matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Cockchafer](https://en.wikipedia.org/wiki/Cockchafer).
- **Millipede** (`millipede`): **OK** — Crawl matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Millipede](https://en.wikipedia.org/wiki/Millipede).
- **Carder bumblebee** (`bumblebee`): **Fixed** — Could not independently confirm the precise
  species identification; narrowed the description. Unconfirmed: precise species identification from
  the captured model. The revised text avoids asserting one. [recipe](../../src/rigs.js);
  [Bumblebee](https://en.wikipedia.org/wiki/Bumblebee).
- **Raspberry** (`raspberry`): **OK** — Drop drupelets matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Raspberry](https://en.wikipedia.org/wiki/Raspberry).
- **Blackberry** (`blackberry`): **OK** — Burst matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Blackberry](https://en.wikipedia.org/wiki/Blackberry).
- **Blueberry** (`blueberry`): **Fixed** — Qualified the origin claim to cultivated blueberries.
  [recipe](../../src/rigs.js); [Blueberry](https://en.wikipedia.org/wiki/Blueberry).
- **Grape** (`grape`): **Fixed** — Added exceptions to the all-grapes color claim.
  [recipe](../../src/rigs.js); [Grape](https://en.wikipedia.org/wiki/Grape);
  [Colored grape flesh](https://en.wikipedia.org/wiki/Teinturier).
- **Cinnamon star cookie** (`star-cookie`): **Fixed** — Allowed flour-containing cinnamon-star
  recipes. [recipe](../../src/rigs.js); [Cinnamon stars](https://en.wikipedia.org/wiki/Zimtstern).
- **Tomatoes** (`tomatoes`): **OK** — Roll matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Tomato](https://en.wikipedia.org/wiki/Tomato).
- **Mandeltorus** (`mandeltorus`): **Fixed** — Could not confirm the sculpture’s exact generating
  formula; removed that attribution. Unconfirmed: the scan’s exact generating formula. The revised
  text makes no formula attribution. [recipe](../../src/rigs.js);
  [Torus](https://en.wikipedia.org/wiki/Torus).
- **Basket** (`basket`): **OK** — Shake matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Basket weaving](https://en.wikipedia.org/wiki/Basket_weaving);
  [Sand dollar](https://en.wikipedia.org/wiki/Sand_dollar).
- **Real rubber duck** (`rubber-duck-real`): **OK** — Squeeze matches the recipe; no factual
  correction identified. [recipe](../../src/rigs.js);
  [Rubber duck](https://en.wikipedia.org/wiki/Rubber_duck).
- **Garden gnome** (`garden-gnome`): **OK** — Light lantern matches the recipe; no factual
  correction identified. [recipe](../../src/rigs.js);
  [Garden gnome](https://en.wikipedia.org/wiki/Garden_gnome).
- **Wooden elephant** (`wooden-elephant`): **Fixed** — Corrected individual-muscle versus
  muscle-bundle terminology. [recipe](../../src/rigs.js);
  [Elephant](https://en.wikipedia.org/wiki/Elephant).
- **Marble bust** (`marble-bust`): **OK** — Speak matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js);
  [Bust (sculpture)](https://en.wikipedia.org/wiki/Bust_%28sculpture%29).
- **Ukulele** (`ukulele`): **OK** — Strum matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Ukulele](https://en.wikipedia.org/wiki/Ukulele).
- **Real alarm clock** (`alarm-clock`): **OK** — Ring matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Alarm clock](https://en.wikipedia.org/wiki/Alarm_clock).
- **Vintage camera** (`vintage-camera`): **Fixed** — Separated the sound effect from an unverified
  camera technology attribution. Unconfirmed: the scanned camera’s flash technology. The sound is
  described as a stylized effect. [recipe](../../src/rigs.js);
  [Camera](https://en.wikipedia.org/wiki/Camera).
- **Boombox** (`boombox`): **OK** — Play matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Boombox](https://en.wikipedia.org/wiki/Boombox).
- **Real croissant** (`croissant-real`): **OK** — Tear matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Croissant](https://en.wikipedia.org/wiki/Croissant).
- **Carrot cake** (`carrot-cake`): **Fixed** — Corrected carrots melting during baking.; Removed an
  unsupported ranking of vegetable sugar content. [recipe](../../src/rigs.js);
  [Carrot cake](https://en.wikipedia.org/wiki/Carrot_cake).
- **Pomegranate** (`pomegranate`): **OK** — Split open matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Pomegranate](https://en.wikipedia.org/wiki/Pomegranate).
- **Lantern** (`lantern`): **OK** — Light matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Lantern](https://en.wikipedia.org/wiki/Lantern).
- **Cat statue** (`cat-statue`): **OK** — Look around matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Cat](https://en.wikipedia.org/wiki/Cat).
- **Horse statue** (`horse-statue`): **OK** — Rear up matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Horse](https://en.wikipedia.org/wiki/Horse).
- **Real pencil** (`pencil-real`): **OK** — Spin matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Pencil](https://en.wikipedia.org/wiki/Pencil).
- **Real tin can** (`tin-can-real`): **OK** — Knock matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js);
  [Steel and tin cans](https://en.wikipedia.org/wiki/Steel_and_tin_cans).

## Shapes (3)

- **Torus** (`torus`): **OK** — Spin it on its edge matches the recipe; no factual correction
  identified. [recipe](../../src/packs/shapes-torus.js);
  [Torus](https://en.wikipedia.org/wiki/Torus).
- **Jelly blob** (`blob`): **OK** — Split matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Gelatin](https://en.wikipedia.org/wiki/Gelatin).
- **Neon knot** (`knot`): **OK** — Contort matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Trefoil knot](https://en.wikipedia.org/wiki/Trefoil_knot).

## Balls (25)

- **Basketball** (`basketball`): **OK** — Dribble and spin matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Basketball (ball)](https://en.wikipedia.org/wiki/Basketball_%28ball%29).
- **Soccer ball** (`soccer-ball`): **OK** — Keepy-uppy matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Football (ball)](https://en.wikipedia.org/wiki/Football_%28ball%29).
- **American football** (`american-football`): **OK** — Throw a spiral matches the recipe; no
  factual correction identified. [recipe](../../src/packs/balls.js);
  [Football (ball)](https://en.wikipedia.org/wiki/Football_%28ball%29).
- **Tennis ball** (`tennis-ball`): **OK** — Bounce it hard matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Tennis ball](https://en.wikipedia.org/wiki/Tennis_ball).
- **Baseball** (`baseball`): **OK** — Pitch a curveball matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Baseball (ball)](https://en.wikipedia.org/wiki/Baseball_%28ball%29).
- **Softball** (`softball`): **OK** — Pitch underhand matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Softball](https://en.wikipedia.org/wiki/Softball).
- **Beach ball** (`beach-ball`): **OK** — Toss it up matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Beach ball](https://en.wikipedia.org/wiki/Beach_ball).
- **Golf ball** (`golf-ball`): **OK** — Chip it matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Golf ball](https://en.wikipedia.org/wiki/Golf_ball).
- **Rugby ball** (`rugby-ball`): **OK** — Punt matches the recipe; no factual correction identified.
  [recipe](../../src/packs/balls.js); [Rugby ball](https://en.wikipedia.org/wiki/Rugby_ball).
- **Volleyball** (`volleyball`): **Fixed** — Added the block exception to the three-hit rule.
  [recipe](../../src/packs/balls.js); [Volleyball rules](https://en.wikipedia.org/wiki/Volleyball).
- **Water polo ball** (`water-polo-ball`): **OK** — Toss it in matches the recipe; no factual
  correction identified. [recipe](../../src/packs/balls.js);
  [Water polo ball](https://en.wikipedia.org/wiki/Water_polo_ball).
- **Ping-pong ball** (`ping-pong-ball`): **OK** — Drop it matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Table tennis](https://en.wikipedia.org/wiki/Table_tennis).
- **Cricket ball** (`cricket-ball`): **OK** — Seam-up flick matches the recipe; no factual
  correction identified. [recipe](../../src/packs/balls.js);
  [Cricket ball](https://en.wikipedia.org/wiki/Cricket_ball).
- **Bowling ball** (`bowling-ball`): **OK** — Bowl it matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Bowling ball](https://en.wikipedia.org/wiki/Bowling_ball).
- **Pool ball** (`pool-ball`): **OK** — Draw shot matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Billiard ball](https://en.wikipedia.org/wiki/Billiard_ball).
- **Pickleball** (`pickleball`): **OK** — Pop it up matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Pickleball](https://en.wikipedia.org/wiki/Pickleball).
- **Dodgeball** (`dodgeball`): **Fixed** — Removed the guarantee that impacts do not hurt.
  [recipe](../../src/packs/balls.js); [Dodgeball](https://en.wikipedia.org/wiki/Dodgeball).
- **Medicine ball** (`medicine-ball`): **OK** — Heave and drop matches the recipe; no factual
  correction identified. [recipe](../../src/packs/balls.js);
  [Medicine ball](https://en.wikipedia.org/wiki/Medicine_ball).
- **Lacrosse ball** (`lacrosse-ball`): **OK** — Slam it down matches the recipe; no factual
  correction identified. [recipe](../../src/packs/balls.js);
  [Lacrosse ball](https://en.wikipedia.org/wiki/Lacrosse_ball).
- **Squash ball** (`squash-ball`): **OK** — Warm it up matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Squash (sport)](https://en.wikipedia.org/wiki/Squash_%28sport%29).
- **Bouncy ball** (`bouncy-ball`): **OK** — Throw it down matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Bouncy ball](https://en.wikipedia.org/wiki/Bouncy_ball).
- **Marble** (`marble`): **OK** — Roll it matches the recipe; no factual correction identified.
  [recipe](../../src/packs/balls.js);
  [Marble (toy)](https://en.wikipedia.org/wiki/Marble_%28toy%29).
- **Hockey puck** (`hockey-puck`): **OK** — Slap shot matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Hockey puck](https://en.wikipedia.org/wiki/Hockey_puck).
- **Shuttlecock** (`shuttlecock`): **OK** — Hit it matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Shuttlecock](https://en.wikipedia.org/wiki/Shuttlecock).
- **Flying disc** (`flying-disc`): **OK** — Throw matches the recipe; no factual correction
  identified. [recipe](../../src/packs/balls.js);
  [Flying disc](https://en.wikipedia.org/wiki/Flying_disc).

## Space (24)

- **Sun** (`sun`): **Fixed** — Distinguished expelled plasma from a flare’s energy release.
  [recipe](../../src/packs/space.js); [Sun](https://en.wikipedia.org/wiki/Sun).
- **Solar system** (`solar-system`): **Fixed** — Added the scale limitation.
  [recipe](../../src/packs/space.js); [Solar System](https://en.wikipedia.org/wiki/Solar_System).
- **Mercury** (`mercury`): **OK** — Spin in the sunlight matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js);
  [Mercury (planet)](https://en.wikipedia.org/wiki/Mercury_%28planet%29).
- **Venus** (`venus`): **Fixed** — Corrected the greenhouse mechanism.
  [recipe](../../src/packs/space.js); [NASA Venus facts](https://science.nasa.gov/venus/facts/).
- **Earth** (`earth`): **OK** — Turn through a day matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js);
  [NASA Earth facts](https://science.nasa.gov/earth/facts/).
- **Moon** (`moon`): **OK** — Land or leave matches the recipe; no factual correction identified.
  [recipe](../../src/packs/space.js); [Moon](https://en.wikipedia.org/wiki/Moon).
- **Mars** (`mars`): **OK** — Raise a dust storm matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js); [Mars](https://en.wikipedia.org/wiki/Mars).
- **Jupiter** (`jupiter`): **OK** — Race the bands matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js); [Jupiter](https://en.wikipedia.org/wiki/Jupiter).
- **Saturn** (`saturn`): **OK** — Ripple the rings matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js); [Saturn](https://en.wikipedia.org/wiki/Saturn).
- **Uranus** (`uranus`): **Fixed** — Corrected the rolling-around-the-Sun analogy.
  [recipe](../../src/packs/space.js); [NASA Uranus facts](https://science.nasa.gov/uranus/facts/).
- **Neptune** (`neptune`): **Fixed** — Corrected the enhanced-color misconception using the 2024
  color analysis. [recipe](../../src/packs/space.js);
  [2024 planet-color analysis](https://ras.ac.uk/news-and-press/news/new-images-reveal-what-neptune-and-uranus-really-look);
  [NASA Neptune facts](https://science.nasa.gov/neptune/neptune-facts/).
- **Tiny planet** (`planet`): **OK** — Day and night matches the recipe; no factual correction
  identified. [recipe](../../src/rigs.js); [Planet](https://en.wikipedia.org/wiki/Planet).
- **Aurora world** (`aurora-planet`): **OK** — Auroral surge matches the recipe; no factual
  correction identified. [recipe](../../src/packs/space.js);
  [Aurora](https://en.wikipedia.org/wiki/Aurora).
- **Asteroid** (`asteroid`): **OK** — Break it apart matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js);
  [Asteroid](https://en.wikipedia.org/wiki/Asteroid).
- **Comet** (`comet`): **OK** — Swing past the Sun matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js); [Comet](https://en.wikipedia.org/wiki/Comet).
- **Meteor** (`meteor`): **OK** — Streak in and burst matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js);
  [Meteoroid](https://en.wikipedia.org/wiki/Meteoroid).
- **Star** (`star`): **Fixed** — Explained all four types and identified the shared, Sun-like
  animation and reset. [recipe](../../src/packs/space.js);
  [Star](https://en.wikipedia.org/wiki/Star).
- **Pulsar** (`pulsar`): **OK** — Spin up matches the recipe; no factual correction identified.
  [recipe](../../src/packs/space.js); [Pulsar](https://en.wikipedia.org/wiki/Pulsar).
- **Black hole** (`black-hole`): **OK** — Feed it a star matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js);
  [Black hole](https://en.wikipedia.org/wiki/Black_hole).
- **Star cluster** (`star-cluster`): **OK** — Breathe in and out matches the recipe; no factual
  correction identified. [recipe](../../src/packs/space.js);
  [Star cluster](https://en.wikipedia.org/wiki/Star_cluster).
- **Ring nebula** (`planetary-nebula`): **OK** — Blow a new shell matches the recipe; no factual
  correction identified. [recipe](../../src/packs/space.js);
  [Planetary nebula](https://en.wikipedia.org/wiki/Planetary_nebula).
- **Nebula** (`nebula`): **OK** — Light new stars matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js); [Nebula](https://en.wikipedia.org/wiki/Nebula).
- **Supernova** (`supernova`): **OK** — Explode matches the recipe; no factual correction
  identified. [recipe](../../src/packs/space.js);
  [Supernova](https://en.wikipedia.org/wiki/Supernova).
- **Spiral galaxy** (`spiral-galaxy`): **Fixed** — Qualified the density-wave explanation as one
  model. [recipe](../../src/packs/space.js);
  [Spiral galaxy](https://en.wikipedia.org/wiki/Spiral_galaxy).

## Tiny world (18)

- **Virus** (`virus`): **Fixed** — Allowed giant-virus exceptions.
  [recipe](../../src/packs/tiny.js); [Virus](https://en.wikipedia.org/wiki/Virus).
- **Bacteriophage** (`bacteriophage`): **Fixed** — Qualified this morphology to the tailed model;
  removed an uncertain universal abundance ratio. [recipe](../../src/packs/tiny.js);
  [Bacteriophage](https://en.wikipedia.org/wiki/Bacteriophage).
- **Bacterium** (`bacterium`): **Fixed** — Added swimming and color controls.
  [recipe](../../src/packs/tiny.js); [Bacteria](https://en.wikipedia.org/wiki/Bacteria).
- **Red blood cell** (`red-blood-cell`): **Fixed** — Qualified the nucleus claim to mature human
  cells. [recipe](../../src/packs/tiny.js);
  [Red blood cell](https://en.wikipedia.org/wiki/Red_blood_cell).
- **Neuron** (`neuron`): **OK** — Fire a signal matches the recipe; no factual correction
  identified. [recipe](../../src/packs/tiny.js); [Neuron](https://en.wikipedia.org/wiki/Neuron).
- **Astrocyte** (`astrocyte`): **OK** — Send a calcium wave matches the recipe; no factual
  correction identified. [recipe](../../src/packs/tiny.js);
  [Astrocyte](https://en.wikipedia.org/wiki/Astrocyte).
- **Animal cell** (`animal-cell`): **Fixed** — Corrected creation-of-energy wording.; Added cutaway
  control and distinguished the reset from division. [recipe](../../src/packs/tiny.js);
  [Cell (biology)](https://en.wikipedia.org/wiki/Cell_%28biology%29).
- **DNA** (`dna`): **Fixed** — Qualified the two-meter DNA claim.; Added the partner-strand control.
  [recipe](../../src/packs/tiny.js); [DNA](https://en.wikipedia.org/wiki/DNA).
- **White blood cell** (`white-blood-cell`): **OK** — Catch a bacterium matches the recipe; no
  factual correction identified. [recipe](../../src/packs/tiny.js);
  [White blood cell](https://en.wikipedia.org/wiki/White_blood_cell).
- **Microglia** (`microglia`): **OK** — Reach and sweep matches the recipe; no factual correction
  identified. [recipe](../../src/packs/tiny.js);
  [Microglia](https://en.wikipedia.org/wiki/Microglia).
- **Diatom** (`diatom`): **Fixed** — Distinguished the toy’s clam-like opening from a real diatom
  frustule. [recipe](../../src/packs/tiny.js); [Diatom](https://en.wikipedia.org/wiki/Diatom).
- **Tardigrade** (`tardigrade`): **Fixed** — Added the actual wiggle action and distinguished
  dormancy. [recipe](../../src/packs/tiny.js);
  [Tardigrade](https://en.wikipedia.org/wiki/Tardigrade).
- **Pollen grain** (`pollen`): **OK** — Burst matches the recipe; no factual correction identified.
  [recipe](../../src/packs/tiny.js); [Pollen](https://en.wikipedia.org/wiki/Pollen).
- **Snowflake** (`snowflake`): **Fixed** — Corrected vapor deposition wording.
  [recipe](../../src/packs/tiny.js); [Snowflake](https://en.wikipedia.org/wiki/Snowflake).
- **Chromosome** (`chromosome`): **OK** — Pull apart matches the recipe; no factual correction
  identified. [recipe](../../src/packs/tiny.js);
  [Chromosome](https://en.wikipedia.org/wiki/Chromosome).
- **Mitochondrion** (`mitochondrion`): **Fixed** — Qualified maternal inheritance.; Added the
  cutaway control. [recipe](../../src/packs/tiny.js);
  [Mitochondrion](https://en.wikipedia.org/wiki/Mitochondrion).
- **Paramecium** (`paramecium`): **OK** — Swim a loop matches the recipe; no factual correction
  identified. [recipe](../../src/packs/tiny.js);
  [Paramecium](https://en.wikipedia.org/wiki/Paramecium).
- **Amoeba** (`amoeba`): **OK** — Crawl matches the recipe; no factual correction identified.
  [recipe](../../src/packs/tiny.js); [Amoeba](https://en.wikipedia.org/wiki/Amoeba).

## Atoms (6)

- **Electron orbital** (`orbital`): **Fixed** — Explained notation, all orbital families, both looks
  and phase colors; qualified illustrative excitation. [recipe](../../src/packs/atoms.js);
  [Atomic orbital](https://en.wikipedia.org/wiki/Atomic_orbital).
- **Atom** (`atom`): **Fixed** — Qualified shells, cloud and representative isotopes; explained all
  display options and electron slider. [recipe](../../src/packs/atoms.js);
  [Atom](https://en.wikipedia.org/wiki/Atom).
- **Molecule** (`molecule`): **Fixed** — Explained every molecule preset by structure or role, file
  types and formula ambiguity; qualified heating animation. [recipe](../../src/packs/atoms.js);
  [Molecule](https://en.wikipedia.org/wiki/Molecule).
- **Protein** (`protein`): **Fixed** — Added ubiquitin, all color modes and file-sharing limits;
  distinguished display separation from unfolding. [recipe](../../src/packs/atoms.js);
  [Ubiquitin structure](https://www.rcsb.org/structure/1UBQ);
  [Insulin structure](https://www.rcsb.org/structure/4INS);
  [Fluorescent protein structure](https://www.rcsb.org/structure/1EMA);
  [Hemoglobin structure](https://www.rcsb.org/structure/4HHB).
- **Crystal lattice** (`crystal-lattice`): **Fixed** — Explained all eleven crystal presets;
  corrected sodium/chlorine to ions and qualified the wave. [recipe](../../src/packs/atoms.js);
  [Crystal structure](https://en.wikipedia.org/wiki/Crystal_structure).
- **Periodic table** (`periodic-table`): **Fixed** — Corrected commonest-isotope and spectral-line
  absolutes; explained tour orders and atom versus tile taps.
  [recipe](../../src/packs/chemistry.js);
  [Periodic table](https://en.wikipedia.org/wiki/Periodic_table).

## Gems (8)

- **Diamond** (`diamond`): **OK** — Turn it in the light matches the recipe; no factual correction
  identified. [recipe](../../src/packs/gems.js); [Diamond](https://en.wikipedia.org/wiki/Diamond).
- **Ruby** (`ruby`): **OK** — Make it glow matches the recipe; no factual correction identified.
  [recipe](../../src/packs/gems.js); [Ruby](https://en.wikipedia.org/wiki/Ruby).
- **Emerald** (`emerald`): **OK** — Run light round the steps matches the recipe; no factual
  correction identified. [recipe](../../src/packs/gems.js);
  [Emerald](https://en.wikipedia.org/wiki/Emerald).
- **Amethyst geode** (`amethyst-geode`): **OK** — Open or close matches the recipe; no factual
  correction identified. [recipe](../../src/packs/gems.js);
  [Amethyst](https://en.wikipedia.org/wiki/Amethyst).
- **Sapphire** (`sapphire`): **OK** — Catch the star matches the recipe; no factual correction
  identified. [recipe](../../src/packs/gems.js); [Sapphire](https://en.wikipedia.org/wiki/Sapphire).
- **Quartz cluster** (`quartz-cluster`): **OK** — Light the points matches the recipe; no factual
  correction identified. [recipe](../../src/packs/gems.js);
  [Quartz](https://en.wikipedia.org/wiki/Quartz).
- **Opal** (`opal`): **Fixed** — Distinguished precious, common and fire opal; qualified the
  stylized color effect. [recipe](../../src/packs/gems.js);
  [Opal](https://en.wikipedia.org/wiki/Opal).
- **Pearl** (`pearl`): **Fixed** — Removed the universal sand-grain pearl origin.
  [recipe](../../src/packs/gems.js); [Pearl](https://en.wikipedia.org/wiki/Pearl).

## Body (7)

- **Beating heart** (`heart`): **Fixed** — Explained anatomical versus symbolic heart modes.
  [recipe](../../src/packs/anatomy.js); [Heart](https://en.wikipedia.org/wiki/Heart).
- **Brain** (`brain`): **Fixed** — Explained both lobe-color modes.
  [recipe](../../src/packs/anatomy.js); [Human brain](https://en.wikipedia.org/wiki/Human_brain).
- **Eye** (`eye`): **OK** — Blink matches the recipe; no factual correction identified.
  [recipe](../../src/packs/anatomy.js); [Human eye](https://en.wikipedia.org/wiki/Human_eye).
- **Lungs** (`lungs`): **OK** — Take a deep breath matches the recipe; no factual correction
  identified. [recipe](../../src/packs/anatomy.js); [Lung](https://en.wikipedia.org/wiki/Lung).
- **Tooth** (`tooth`): **OK** — Polish matches the recipe; no factual correction identified.
  [recipe](../../src/packs/anatomy.js); [Human tooth](https://en.wikipedia.org/wiki/Human_tooth).
- **Kidney** (`kidney`): **OK** — Pump blood through matches the recipe; no factual correction
  identified. [recipe](../../src/packs/anatomy.js); [Kidney](https://en.wikipedia.org/wiki/Kidney).
- **Anatomy atlas** (`anatomy-atlas`): **OK** — Peel a layer matches the recipe; no factual
  correction identified. [recipe](../../src/packs/anatomy-atlas.js);
  [Human body](https://en.wikipedia.org/wiki/Human_body).

## Nature (23)

- **Oak tree** (`oak`): **OK** — Shake the tree matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js); [Oak](https://en.wikipedia.org/wiki/Oak).
- **Pine tree** (`pine`): **OK** — Shake off the snow matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js); [Pine](https://en.wikipedia.org/wiki/Pine).
- **Palm tree** (`palm`): **OK** — Shake down the coconuts matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js);
  [Arecaceae](https://en.wikipedia.org/wiki/Arecaceae).
- **Cherry blossom** (`cherry-blossom`): **OK** — Shake the blossom matches the recipe; no factual
  correction identified. [recipe](../../src/packs/nature.js);
  [Cherry blossom](https://en.wikipedia.org/wiki/Cherry_blossom).
- **Maple tree** (`maple`): **Fixed** — Distinguished revealed pigments from newly produced autumn
  reds. [recipe](../../src/packs/nature.js); [Maple](https://en.wikipedia.org/wiki/Maple).
- **Bonsai** (`bonsai`): **OK** — Grow a branch, then trim it matches the recipe; no factual
  correction identified. [recipe](../../src/packs/nature.js);
  [Bonsai](https://en.wikipedia.org/wiki/Bonsai).
- **Weeping willow** (`willow`): **OK** — Send a breeze through matches the recipe; no factual
  correction identified. [recipe](../../src/packs/nature.js);
  [Willow](https://en.wikipedia.org/wiki/Willow).
- **Sunflower** (`sunflower`): **OK** — Bring out the sun matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js);
  [Helianthus annuus](https://en.wikipedia.org/wiki/Helianthus_annuus).
- **Rose** (`rose`): **OK** — Open the bloom matches the recipe; no factual correction identified.
  [recipe](../../src/packs/nature.js); [Rose](https://en.wikipedia.org/wiki/Rose).
- **Dandelion** (`dandelion`): **OK** — Blow the seeds matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js);
  [Taraxacum](https://en.wikipedia.org/wiki/Taraxacum).
- **Tulips** (`tulip`): **OK** — Open to the sun matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js); [Tulip](https://en.wikipedia.org/wiki/Tulip).
- **Daisies** (`daisy`): **OK** — Loves me, loves me not matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js);
  [Bellis perennis](https://en.wikipedia.org/wiki/Bellis_perennis).
- **Lotus** (`lotus`): **OK** — Rise and open matches the recipe; no factual correction identified.
  [recipe](../../src/packs/nature.js);
  [Nelumbo nucifera](https://en.wikipedia.org/wiki/Nelumbo_nucifera).
- **Toadstool** (`mushroom`): **OK** — Puff out spores matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js);
  [Mushroom](https://en.wikipedia.org/wiki/Mushroom).
- **Fern** (`fern`): **OK** — Unfurl the fiddleheads matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js); [Fern](https://en.wikipedia.org/wiki/Fern).
- **Saguaro cactus** (`saguaro`): **OK** — Spines out, then a look inside matches the recipe; no
  factual correction identified. [recipe](../../src/packs/nature.js);
  [Saguaro](https://en.wikipedia.org/wiki/Saguaro).
- **Coral reef** (`coral`): **Fixed** — Qualified colony and hard-skeleton claims to reef-building
  coral. [recipe](../../src/packs/nature.js); [Coral](https://en.wikipedia.org/wiki/Coral).
- **Pinecone** (`pinecone`): **OK** — Open the scales matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js);
  [Conifer cone](https://en.wikipedia.org/wiki/Conifer_cone).
- **Acorns** (`acorn`): **OK** — Pop the caps matches the recipe; no factual correction identified.
  [recipe](../../src/packs/nature.js); [Acorn](https://en.wikipedia.org/wiki/Acorn).
- **Succulent** (`succulent`): **Fixed** — Allowed stem and root water storage.
  [recipe](../../src/packs/nature.js);
  [Succulent plant](https://en.wikipedia.org/wiki/Succulent_plant).
- **Bamboo** (`bamboo`): **OK** — Grow new shoots matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js); [Bamboo](https://en.wikipedia.org/wiki/Bamboo).
- **Pebbles** (`rocks`): **Fixed** — Explained both rock arrangements.
  [recipe](../../src/packs/nature.js);
  [Rock (geology)](https://en.wikipedia.org/wiki/Rock_%28geology%29).
- **Kelp** (`kelp`): **OK** — Fish come to nibble matches the recipe; no factual correction
  identified. [recipe](../../src/packs/nature.js); [Kelp](https://en.wikipedia.org/wiki/Kelp).

## Weather & fire (13)

- **Campfire** (`campfire`): **OK** — Stoke the fire matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js); [Fire](https://en.wikipedia.org/wiki/Fire).
- **Storm cloud** (`storm-cloud`): **Fixed** — Added the Rain slider.
  [recipe](../../src/packs/elements.js); [Thunderstorm](https://en.wikipedia.org/wiki/Thunderstorm).
- **Lava lamp** (`lava-lamp`): **Fixed** — Corrected density versus weight when wax heats.
  [recipe](../../src/packs/elements.js); [Lava lamp](https://en.wikipedia.org/wiki/Lava_lamp).
- **Snow globe** (`snow-globe`): **OK** — Shake the globe matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js);
  [Snow globe](https://en.wikipedia.org/wiki/Snow_globe).
- **Volcano** (`volcano`): **OK** — Erupt matches the recipe; no factual correction identified.
  [recipe](../../src/packs/elements.js); [Volcano](https://en.wikipedia.org/wiki/Volcano).
- **Ice swan** (`ice-statue`): **OK** — Melt and refreeze matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js);
  [Ice sculpture](https://en.wikipedia.org/wiki/Ice_sculpture).
- **Candle** (`candle`): **Fixed** — Removed the unsupported hottest-blue-base claim.
  [recipe](../../src/packs/elements.js); [Candle](https://en.wikipedia.org/wiki/Candle).
- **Tornado** (`tornado`): **Fixed** — Added the Power control.
  [recipe](../../src/packs/elements.js); [Tornado](https://en.wikipedia.org/wiki/Tornado).
- **Rainbow** (`rainbow`): **OK** — Draw the rainbow matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js);
  [Rainbow](https://en.wikipedia.org/wiki/Rainbow).
- **Iceberg** (`iceberg`): **OK** — Break off a chunk matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js);
  [Iceberg](https://en.wikipedia.org/wiki/Iceberg).
- **Waterfall** (`waterfall`): **OK** — Send a surge matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js);
  [Waterfall](https://en.wikipedia.org/wiki/Waterfall).
- **Ocean wave** (`ocean-wave`): **OK** — Break the wave matches the recipe; no factual correction
  identified. [recipe](../../src/packs/elements.js);
  [Wind wave](https://en.wikipedia.org/wiki/Wind_wave).
- **Geyser** (`geyser`): **OK** — Erupt matches the recipe; no factual correction identified.
  [recipe](../../src/packs/elements.js); [Geyser](https://en.wikipedia.org/wiki/Geyser).

## Food (28)

- **Ice cream** (`ice-cream`): **OK** — Melt and refreeze matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Ice cream](https://en.wikipedia.org/wiki/Ice_cream).
- **Watermelon** (`watermelon`): **OK** — Chop into slices matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Watermelon](https://en.wikipedia.org/wiki/Watermelon).
- **Birthday cake** (`birthday-cake`): **OK** — Blow out matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Birthday cake](https://en.wikipedia.org/wiki/Birthday_cake).
- **Popcorn** (`popcorn`): **OK** — Pop! matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Popcorn](https://en.wikipedia.org/wiki/Popcorn).
- **Jelly** (`jelly`): **OK** — Poke matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js);
  [Gelatin dessert](https://en.wikipedia.org/wiki/Gelatin_dessert).
- **Pancakes** (`pancakes`): **OK** — Flip the top one matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js); [Pancake](https://en.wikipedia.org/wiki/Pancake).
- **Cupcake** (`cupcake`): **OK** — Flick the cherry matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js); [Cupcake](https://en.wikipedia.org/wiki/Cupcake).
- **Lollipop** (`lollipop`): **OK** — Spin fast matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js); [Lollipop](https://en.wikipedia.org/wiki/Lollipop).
- **Candy cane** (`candy-cane`): **OK** — Twist and snap matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Candy cane](https://en.wikipedia.org/wiki/Candy_cane).
- **Macarons** (`macarons`): **OK** — Stack up matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Macaron](https://en.wikipedia.org/wiki/Macaron).
- **Donut** (`donut`): **OK** — Break apart matches the recipe; no factual correction identified.
  [recipe](../../src/rigs.js); [Doughnut](https://en.wikipedia.org/wiki/Doughnut).
- **Gummy bear** (`gummy-bear`): **OK** — Squish matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Gummy bear](https://en.wikipedia.org/wiki/Gummy_bear).
- **Pretzel** (`pretzel`): **Fixed** — Removed a drag/release instruction from a tap-only toy.
  [recipe](../../src/packs/food.js); [Pretzel](https://en.wikipedia.org/wiki/Pretzel).
- **Croissant** (`croissant`): **OK** — Open it matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Croissant](https://en.wikipedia.org/wiki/Croissant).
- **Pizza** (`pizza`): **OK** — Take a slice matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Pizza](https://en.wikipedia.org/wiki/Pizza).
- **Burger** (`burger`): **OK** — Explode view matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Hamburger](https://en.wikipedia.org/wiki/Hamburger).
- **Sushi** (`sushi`): **OK** — Pick up and dip matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js); [Sushi](https://en.wikipedia.org/wiki/Sushi).
- **Taco** (`taco`): **OK** — Break in half matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Taco](https://en.wikipedia.org/wiki/Taco).
- **Boiled egg** (`egg`): **OK** — Crack matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Egg as food](https://en.wikipedia.org/wiki/Egg_as_food).
- **Coffee** (`coffee`): **OK** — Stir matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Coffee](https://en.wikipedia.org/wiki/Coffee).
- **Apple** (`apple`): **OK** — Take a bite matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Apple](https://en.wikipedia.org/wiki/Apple).
- **Bananas** (`banana`): **OK** — Peel them matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Banana](https://en.wikipedia.org/wiki/Banana).
- **Orange** (`orange`): **OK** — Open into wedges matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Orange (fruit)](https://en.wikipedia.org/wiki/Orange_%28fruit%29).
- **Kiwi** (`kiwi`): **OK** — Cut open matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Kiwifruit](https://en.wikipedia.org/wiki/Kiwifruit).
- **Pineapple** (`pineapple`): **OK** — Slice into rings matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js);
  [Pineapple](https://en.wikipedia.org/wiki/Pineapple).
- **Cherries** (`cherries`): **OK** — Swing matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Cherry](https://en.wikipedia.org/wiki/Cherry).
- **Grapes** (`grapes`): **OK** — Drop grapes matches the recipe; no factual correction identified.
  [recipe](../../src/packs/food.js); [Grape](https://en.wikipedia.org/wiki/Grape).
- **Avocado** (`avocado`): **OK** — Pop the stone matches the recipe; no factual correction
  identified. [recipe](../../src/packs/food.js); [Avocado](https://en.wikipedia.org/wiki/Avocado).

## Toys (16)

- **Building bricks** (`bricks`): **Fixed** — Removed an unconfirmed count without specified brick
  dimensions. [recipe](../../src/packs/playthings.js);
  [Construction set](https://en.wikipedia.org/wiki/Construction_set).
- **Rubber duck** (`rubber-duck`): **OK** — Squeak matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [Rubber duck](https://en.wikipedia.org/wiki/Rubber_duck).
- **Spinning top** (`spinning-top`): **OK** — Spin it matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [Spinning top](https://en.wikipedia.org/wiki/Spinning_top).
- **Dice** (`dice`): **OK** — Roll matches the recipe; no factual correction identified.
  [recipe](../../src/packs/playthings.js); [Dice](https://en.wikipedia.org/wiki/Dice).
- **Newton's cradle** (`newtons-cradle`): **OK** — Lift and let go matches the recipe; no factual
  correction identified. [recipe](../../src/packs/playthings.js);
  [Newton's cradle](https://en.wikipedia.org/wiki/Newton%27s_cradle).
- **Teddy bear** (`teddy-bear`): **OK** — Wave hello matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [National Park Service history](https://www.nps.gov/thrb/learn/historyculture/storyofteddybear.htm).
- **Yo-yo** (`yo-yo`): **OK** — Throw matches the recipe; no factual correction identified.
  [recipe](../../src/packs/playthings.js); [Yo-yo](https://en.wikipedia.org/wiki/Yo-yo).
- **Puzzle cube** (`puzzle-cube`): **Fixed** — Corrected layer piece count and qualified the
  twenty-move metric. [recipe](../../src/packs/playthings.js);
  [Twenty-move research result](https://www.cube20.org/).
- **Spring toy** (`spring-toy`): **OK** — Make it walk matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [Spring (device)](https://en.wikipedia.org/wiki/Spring_%28device%29).
- **Kite** (`kite`): **OK** — Gust of wind matches the recipe; no factual correction identified.
  [recipe](../../src/packs/playthings.js); [Kite](https://en.wikipedia.org/wiki/Kite).
- **Paper plane** (`paper-plane`): **OK** — Barrel roll matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [Paper plane](https://en.wikipedia.org/wiki/Paper_plane).
- **Origami crane** (`origami-crane`): **OK** — Flap the wings matches the recipe; no factual
  correction identified. [recipe](../../src/packs/playthings.js);
  [Orizuru](https://en.wikipedia.org/wiki/Orizuru).
- **Balloon dog** (`balloon-dog`): **OK** — Pop matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [Balloon modelling](https://en.wikipedia.org/wiki/Balloon_modelling).
- **Soap bubbles** (`soap-bubbles`): **OK** — Blow bubbles matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js);
  [Soap bubble](https://en.wikipedia.org/wiki/Soap_bubble).
- **Wind-up robot** (`robot`): **OK** — Wind it up matches the recipe; no factual correction
  identified. [recipe](../../src/packs/playthings.js); [Robot](https://en.wikipedia.org/wiki/Robot).
- **Chess set** (`chess-set`): **OK** — Play the Opera Game matches the recipe; no factual
  correction identified. [recipe](../../src/packs/games.js);
  [Rules of chess](https://en.wikipedia.org/wiki/Rules_of_chess).

## Open me (14)

- **Treasure chest** (`chest`): **OK** — Open or close matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Chest (furniture)](https://en.wikipedia.org/wiki/Chest_%28furniture%29).
- **Storybook** (`book`): **OK** — Open or close matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js); [Book](https://en.wikipedia.org/wiki/Book).
- **Laptop** (`laptop`): **OK** — Open or close matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js); [Laptop](https://en.wikipedia.org/wiki/Laptop).
- **Music box** (`music-box`): **OK** — Open or close matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Music box](https://en.wikipedia.org/wiki/Music_box).
- **Alarm clock** (`clock`): **OK** — Ring the bell matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js); [Clock](https://en.wikipedia.org/wiki/Clock).
- **Gift box** (`gift-box`): **OK** — Open the present matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Gift wrapping](https://en.wikipedia.org/wiki/Gift_wrapping).
- **Umbrella** (`umbrella`): **OK** — Open or close matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Umbrella](https://en.wikipedia.org/wiki/Umbrella).
- **Desk fan** (`desk-fan`): **OK** — Switch on or off matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Fan (machine)](https://en.wikipedia.org/wiki/Fan_%28machine%29).
- **Desk lamp** (`lamp`): **OK** — Switch the light matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Incandescent light bulb](https://en.wikipedia.org/wiki/Incandescent_light_bulb).
- **Potion bottle** (`potion-bottle`): **OK** — Pop the cork matches the recipe; no factual
  correction identified. [recipe](../../src/packs/objects.js);
  [Potion](https://en.wikipedia.org/wiki/Potion).
- **Telescope** (`telescope`): **OK** — Extend or collapse matches the recipe; no factual correction
  identified. [recipe](../../src/packs/objects.js);
  [Telescope](https://en.wikipedia.org/wiki/Telescope).
- **Fountain pen** (`fountain-pen`): **OK** — Uncap and write matches the recipe; no factual
  correction identified. [recipe](../../src/packs/real-objects.js);
  [Fountain pen](https://en.wikipedia.org/wiki/Fountain_pen).
- **Water bottle** (`water-bottle`): **Fixed** — Qualified screw-cap turn count to the toy.
  [recipe](../../src/packs/real-objects.js); [Screw cap](https://en.wikipedia.org/wiki/Screw_cap).
- **Soda can** (`soda-can`): **OK** — Shake and open matches the recipe; no factual correction
  identified. [recipe](../../src/packs/real-objects.js);
  [Drink can](https://en.wikipedia.org/wiki/Drink_can).

## Clothing (4)

- **Running shoe** (`running-shoe`): **OK** — Untie and tie again matches the recipe; no factual
  correction identified. [recipe](../../src/packs/real-objects.js);
  [Square knot](https://en.wikipedia.org/wiki/Reef_knot).
- **Hoodie** (`hoodie`): **Fixed** — Qualified the material claim rather than asserting the scan’s
  fabric composition. [recipe](../../src/packs/real-objects.js);
  [Hoodie](https://en.wikipedia.org/wiki/Hoodie).
- **Sunglasses** (`sunglasses`): **Fixed** — Avoided implying that all photochromic materials work
  by molecule shape changes. [recipe](../../src/packs/real-objects.js);
  [Photochromic lens](https://en.wikipedia.org/wiki/Photochromic_lens).
- **Baseball cap** (`baseball-cap`): **OK** — Flip and spin matches the recipe; no factual
  correction identified. [recipe](../../src/packs/real-objects.js);
  [Baseball cap](https://en.wikipedia.org/wiki/Baseball_cap).

## Medieval (10)

- **Sword in the stone** (`sword-in-stone`): **OK** — Pull matches the recipe; no factual correction
  identified. [recipe](../../src/packs/medieval.js);
  [Excalibur](https://en.wikipedia.org/wiki/Excalibur).
- **Heraldic shield** (`shield`): **Fixed** — Explained all decorative shield choices.
  [recipe](../../src/packs/medieval.js); [Shield](https://en.wikipedia.org/wiki/Shield).
- **Bow and target** (`bow-and-target`): **OK** — Shoot matches the recipe; no factual correction
  identified. [recipe](../../src/packs/medieval.js);
  [Bow and arrow](https://en.wikipedia.org/wiki/Bow_and_arrow).
- **Trebuchet** (`trebuchet`): **OK** — Launch matches the recipe; no factual correction identified.
  [recipe](../../src/packs/medieval.js); [Trebuchet](https://en.wikipedia.org/wiki/Trebuchet).
- **Crossbow** (`crossbow`): **OK** — Shoot matches the recipe; no factual correction identified.
  [recipe](../../src/packs/medieval.js); [Crossbow](https://en.wikipedia.org/wiki/Crossbow).
- **Knight's helmet** (`knights-helmet`): **OK** — Open the visor matches the recipe; no factual
  correction identified. [recipe](../../src/packs/medieval.js);
  [Visor (armor)](https://en.wikipedia.org/wiki/Visor_%28armor%29).
- **Crown** (`crown`): **OK** — Light the jewels matches the recipe; no factual correction
  identified. [recipe](../../src/packs/medieval.js); [Crown](https://en.wikipedia.org/wiki/Crown).
- **Dragon egg** (`dragon-egg`): **OK** — Hatch matches the recipe; no factual correction
  identified. [recipe](../../src/packs/medieval.js); [Dragon](https://en.wikipedia.org/wiki/Dragon).
- **Wizard's orb** (`wizards-orb`): **OK** — Cast matches the recipe; no factual correction
  identified. [recipe](../../src/packs/medieval.js);
  [Magic (supernatural)](https://en.wikipedia.org/wiki/Magic_%28supernatural%29).
- **Crystal ball** (`crystal-ball`): **Fixed** — Added the Sparkle control.
  [recipe](../../src/packs/gems.js); [Crystal ball](https://en.wikipedia.org/wiki/Crystal_ball).

## Animals (13)

- **Jellyfish** (`jellyfish`): **OK** — Swim matches the recipe; no factual correction identified.
  [recipe](../../src/packs/animals.js); [Jellyfish](https://en.wikipedia.org/wiki/Jellyfish).
- **School of fish** (`fish-school`): **OK** — Bait ball matches the recipe; no factual correction
  identified. [recipe](../../src/packs/animals.js);
  [Shoaling and schooling](https://en.wikipedia.org/wiki/Shoaling_and_schooling).
- **Butterfly** (`butterfly`): **Fixed** — Corrected chrysalis formation versus wrapping a cocoon.
  [recipe](../../src/packs/animals.js); [Butterfly](https://en.wikipedia.org/wiki/Butterfly).
- **Pufferfish** (`pufferfish`): **OK** — Poke matches the recipe; no factual correction identified.
  [recipe](../../src/packs/animals.js);
  [Tetraodontidae](https://en.wikipedia.org/wiki/Tetraodontidae).
- **Nautilus** (`nautilus`): **OK** — Hide in the shell matches the recipe; no factual correction
  identified. [recipe](../../src/packs/animals.js);
  [Nautilus](https://en.wikipedia.org/wiki/Nautilus).
- **Ladybug** (`ladybug`): **OK** — Open the wings matches the recipe; no factual correction
  identified. [recipe](../../src/packs/animals.js);
  [Coccinellidae](https://en.wikipedia.org/wiki/Coccinellidae).
- **Snail** (`snail`): **OK** — Hide in the shell matches the recipe; no factual correction
  identified. [recipe](../../src/packs/animals.js); [Snail](https://en.wikipedia.org/wiki/Snail).
- **Octopus** (`octopus`): **OK** — Squirt ink matches the recipe; no factual correction identified.
  [recipe](../../src/packs/animals.js); [Octopus](https://en.wikipedia.org/wiki/Octopus).
- **Starfish** (`starfish`): **Fixed** — Corrected the simplified blood/seawater claim and qualified
  regeneration. [recipe](../../src/packs/animals.js);
  [Starfish](https://en.wikipedia.org/wiki/Starfish).
- **Sea urchin** (`sea-urchin`): **OK** — Wave the spines matches the recipe; no factual correction
  identified. [recipe](../../src/packs/animals.js);
  [Sea urchin](https://en.wikipedia.org/wiki/Sea_urchin).
- **Frog** (`frog`): **Fixed** — Allowed direct-developing frogs.
  [recipe](../../src/packs/animals.js); [Frog](https://en.wikipedia.org/wiki/Frog).
- **Penguin** (`penguin`): **OK** — Flap matches the recipe; no factual correction identified.
  [recipe](../../src/packs/animals.js); [Penguin](https://en.wikipedia.org/wiki/Penguin).
- **Owl** (`owl`): **OK** — Turn the head matches the recipe; no factual correction identified.
  [recipe](../../src/packs/animals.js); [Owl](https://en.wikipedia.org/wiki/Owl).

## Maths (17)

- **Lorenz attractor** (`lorenz`): **Fixed** — Qualified chaos to suitable parameters and the toy to
  a finite path. [recipe](../../src/packs/maths.js);
  [Lorenz system](https://en.wikipedia.org/wiki/Lorenz_system).
- **Möbius strip** (`mobius`): **Fixed** — Clarified position versus orientation; added glow and
  color controls. [recipe](../../src/packs/maths.js);
  [Möbius strip](https://en.wikipedia.org/wiki/M%C3%B6bius_strip).
- **Klein bottle** (`klein-bottle`): **Fixed** — Distinguished intrinsic dimension from embedding
  dimension. [recipe](../../src/packs/maths.js);
  [Klein bottle](https://en.wikipedia.org/wiki/Klein_bottle).
- **Menger sponge** (`menger-sponge`): **Fixed** — Explained both selectable finite levels.
  [recipe](../../src/packs/maths.js); [Menger sponge](https://en.wikipedia.org/wiki/Menger_sponge).
- **Hypercube** (`hypercube`): **Fixed** — Explained the resting-turn slider.
  [recipe](../../src/packs/maths.js); [Tesseract](https://en.wikipedia.org/wiki/Tesseract).
- **Torus knot** (`torus-knot`): **Fixed** — Explained every winding preset and appearance control.
  [recipe](../../src/packs/maths.js); [Torus knot](https://en.wikipedia.org/wiki/Torus_knot).
- **Gyroid** (`gyroid`): **Fixed** — Separated the approximate implicit surface from the exact
  gyroid. [recipe](../../src/packs/maths.js);
  [Schoen’s 1970 NASA report](https://ntrs.nasa.gov/citations/19700020472).
- **Mandelbulb** (`mandelbulb`): **Fixed** — Removed unlimited-detail promise for finite geometry.
  [recipe](../../src/packs/maths.js);
  [MathWorld Mandelbulb](https://mathworld.wolfram.com/Mandelbulb.html).
- **Sierpinski tetrahedron** (`sierpinski`): **Fixed** — Explained all selectable levels.
  [recipe](../../src/packs/maths.js);
  [Sierpiński triangle](https://en.wikipedia.org/wiki/Sierpi%C5%84ski_triangle).
- **Platonic solids** (`platonic`): **Fixed** — Qualified the uniqueness claim to convex regular
  polyhedra. [recipe](../../src/packs/maths.js);
  [Platonic solid](https://en.wikipedia.org/wiki/Platonic_solid).
- **Seashell spiral** (`seashell-spiral`): **OK** — Hear the sea matches the recipe; no factual
  correction identified. [recipe](../../src/packs/maths.js);
  [Logarithmic spiral](https://en.wikipedia.org/wiki/Logarithmic_spiral);
  [Shell resonance](https://en.wikipedia.org/wiki/Seashell_resonance).
- **Graph plotter** (`graph-plotter`): **Fixed** — Explained all 42 default preset shapes, the three
  input systems, files and parameter controls; equations and full catalog remain available.
  [recipe](../../src/packs/maths.js);
  [Graph of a function](https://en.wikipedia.org/wiki/Graph_of_a_function).
- **Surface plotter** (`surface-plotter`): **Fixed** — Explained all sixteen presets, input formats,
  parameter and transformed optimization surfaces. [recipe](../../src/packs/maths.js);
  [Graph of a function](https://en.wikipedia.org/wiki/Graph_of_a_function).
- **Circle and waves** (`unit-circle`): **Fixed** — Explained every path, both views, repeated turns
  and text-file input; limited Euler explanation to circle. [recipe](../../src/packs/maths.js);
  [Unit circle](https://en.wikipedia.org/wiki/Unit_circle).
- **Fourier circles** (`fourier-circles`): **Fixed** — Qualified finite Fourier approximation;
  explained all shapes, input modes and views. [recipe](../../src/packs/maths.js);
  [Fourier series](https://en.wikipedia.org/wiki/Fourier_series).
- **Pythagoras proof** (`pythagoras-proof`): **Fixed** — Removed an unconfirmed historical ranking
  of this specific proof. [recipe](../../src/packs/maths.js);
  [Pythagorean theorem](https://en.wikipedia.org/wiki/Pythagorean_theorem).
- **Splat equation** (`splat-equation`): **Fixed** — Explained all programs, fields, input-file
  option, time and rendering controls. [recipe](../../src/packs/splat-equation.js);
  [Parametric equation](https://en.wikipedia.org/wiki/Parametric_equation).

## AI and computing (17)

- **Perceptron** (`perceptron`): **Fixed** — Distinguished the illustrative weight change from
  persistent training. [recipe](../../src/packs/computing.js);
  [Perceptron](https://en.wikipedia.org/wiki/Perceptron).
- **Multilayer perceptron** (`multilayer-perceptron`): **OK** — Try all four inputs matches the
  recipe; no factual correction identified. [recipe](../../src/packs/computing.js);
  [Multilayer perceptron](https://en.wikipedia.org/wiki/Multilayer_perceptron).
- **Neural network** (`neural-network`): **Fixed** — Separated backpropagation from optimization;
  identified scripted animation. [recipe](../../src/packs/computing.js);
  [Neural network (machine learning)](https://en.wikipedia.org/wiki/Neural_network_%28machine_learning%29).
- **Convolutional network** (`cnn`): **Fixed** — Explained all three views, pixel pad and typed
  digit; separated the diagram from actual inference. [recipe](../../src/packs/computing.js);
  [Convolutional neural network](https://en.wikipedia.org/wiki/Convolutional_neural_network).
- **Recurrent network** (`rnn`): **Fixed** — Identified the prepared sequence and the role of both
  RNN styles. [recipe](../../src/packs/computing.js);
  [Recurrent neural network](https://en.wikipedia.org/wiki/Recurrent_neural_network).
- **Transformer** (`transformer`): **Fixed** — Qualified next-token prediction, explained both
  diagrams and views, and identified scripted examples. [recipe](../../src/packs/computing.js);
  [2017 attention paper](https://arxiv.org/abs/1706.03762);
  [Encoder-only example: BERT](https://arxiv.org/abs/1810.04805).
- **Looped transformer** (`looped-transformer`): **Fixed** — Removed guaranteed refinement and
  certainty; identified the three-lap illustration. [recipe](../../src/packs/computing.js);
  [Universal Transformers paper](https://arxiv.org/abs/1807.03819).
- **Diffusion model** (`diffusion-model`): **Fixed** — Identified staged denoising and clarified the
  counter and distinction from splat rendering. [recipe](../../src/packs/computing.js);
  [Denoising diffusion paper](https://arxiv.org/abs/2006.11239).
- **Gradient descent** (`gradient-descent`): **Fixed** — Corrected the gradient direction and
  clarified convergence limits. [recipe](../../src/packs/computing.js);
  [Gradient descent](https://en.wikipedia.org/wiki/Gradient_descent).
- **Gaussian splatting** (`gaussian-splatting`): **Fixed** — Corrected random initialization and 2D
  versus 3D; explained all views and photo input. [recipe](../../src/packs/splatting.js);
  [Original 3D Gaussian splatting paper and project](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/).
- **Word vectors** (`word-vectors`): **Fixed** — Added candidate-vocabulary limit, runner-up, file
  input and limits of analogies. [recipe](../../src/packs/computing.js);
  [GloVe project](https://nlp.stanford.edu/projects/glove/);
  [Embedding-bias research](https://arxiv.org/abs/1607.06520).
- **Sorting machine** (`sorting-machine`): **Fixed** — Explained all eight algorithms and qualified
  the move counter. [recipe](../../src/packs/computing.js);
  [Princeton sorting textbook](https://algs4.cs.princeton.edu/20sorting/).
- **Half adder** (`half-adder`): **Fixed** — Corrected the missing OR gate; explained all input
  cases and the fixed demonstration. [recipe](../../src/packs/computing.js);
  [Adder (electronics)](https://en.wikipedia.org/wiki/Adder_%28electronics%29).
- **Turing machine** (`turing-machine`): **Fixed** — Explained all three programs, binary-input
  ambiguity, blank-tape resets and printed-ones versus runtime records.
  [recipe](../../src/packs/computing-history.js);
  [Turing machine](https://en.wikipedia.org/wiki/Turing_machine);
  [Busy Beaver survey](https://www.scottaaronson.com/papers/busybeaver.pdf).
- **Difference engine** (`difference-engine`): **Fixed** — Explained differences, custom-input
  limits, start control and five-digit wraparound. [recipe](../../src/packs/computing-history.js);
  [Science Museum history](https://blog.sciencemuseum.org.uk/wonderful-things-babbages-brain/).
- **Enigma machine** (`enigma-machine`): **Fixed** — Corrected odometer and always-different claims;
  clarified controls, message limit and matching settings.
  [recipe](../../src/packs/computing-history.js);
  [Enigma machine](https://en.wikipedia.org/wiki/Enigma_machine).
- **Bombe** (`bombe`): **Fixed** — Explained input-generated ciphertext and known crib;
  distinguished brute-force search from the historical Bombe. Scope: the code searches fixed-rotor
  settings with a known plugboard; it does not implement the historical diagonal board.
  [recipe](../../src/packs/computing-history.js);
  [National Museum of Computing](https://www.tnmoc.org/bombe).

## Pictures and pages (5)

- **Picture lab** (`picture-lab`): **Fixed** — Explained both built-in samples.
  [recipe](../../src/packs/pictures.js); [PDF](https://en.wikipedia.org/wiki/PDF).
- **Your book** (`your-book`): **OK** — Turn the page matches the recipe; no factual correction
  identified. [recipe](../../src/packs/pictures.js); [Codex](https://en.wikipedia.org/wiki/Codex).
- **Photo album** (`photo-album`): **OK** — Turn the page matches the recipe; no factual correction
  identified. [recipe](../../src/packs/pictures.js);
  [Photograph album](https://en.wikipedia.org/wiki/Photograph_album).
- **Picture frame** (`picture-frame`): **OK** — Swing the frame matches the recipe; no factual
  correction identified. [recipe](../../src/packs/pictures.js);
  [Picture frame](https://en.wikipedia.org/wiki/Picture_frame).
- **Screen** (`screen`): **Fixed** — Added the sample choices. [recipe](../../src/packs/screens.js);
  [Cathode-ray tube](https://en.wikipedia.org/wiki/Cathode-ray_tube).

## Studio (7)

- **Song landscape** (`song-landscape`): **Fixed** — Added microphone mode and background choices;
  qualified pitch interpretation and explained every look and view.
  [recipe](../../src/packs/studio.js); [Spectrogram](https://en.wikipedia.org/wiki/Spectrogram).
- **Chladni plate** (`chladni-plate`): **Fixed** — Added microphone play and explained every mode
  pair, sign and pitch scale; qualified the model. Microphone pitch tracking was checked in code,
  not with a physical microphone. [recipe](../../src/packs/studio.js);
  [Cymatics](https://en.wikipedia.org/wiki/Cymatics).
- **Room echo meter** (`room-echo`): **Fixed** — Added sample tap; qualified RT60 extrapolation and
  temporary audio processing. A physical-room measurement was not performed; microphone calibration
  and reported RT60 accuracy remain unverified. [recipe](../../src/packs/live.js);
  [Reverberation](https://en.wikipedia.org/wiki/Reverberation).
- **Splat mirror** (`splat-mirror`): **Fixed** — Added flatten tap and depth control. A live camera
  feed was not exercised; performance and depth quality remain device-dependent.
  [recipe](../../src/packs/live.js);
  [Depth model authors’ project](https://depth-anything-v2.github.io/).
- **Model to splats** (`model-splats`): **Fixed** — Qualified guaranteed coverage; added sample,
  axis, baked-light and import-limit explanations. [recipe](../../src/packs/studio-models.js);
  [Polygon mesh](https://en.wikipedia.org/wiki/Polygon_mesh).
- **Photo to 3D** (`photo-3d`): **Fixed** — Corrected metric-depth implication; explained samples,
  repeated flatten tap, layers and formats. [recipe](../../src/packs/photo-3d.js);
  [Depth model authors’ project](https://depth-anything-v2.github.io/).
- **Video to 3D** (`video-3d`): **Fixed** — Qualified reconstruction requirements; explained all
  clip choices and sample modes. Live reconstruction quality, WebGPU support and timing were not
  accepted across devices. [recipe](../../src/packs/video3d.js);
  [Structure from motion](https://en.wikipedia.org/wiki/Structure_from_motion).

## Lab (2)

- **Splat field** (`splat-field`): **Fixed** — Qualified the detail-dependent count and physical
  interpretation. [recipe](../../src/packs/lab.js);
  [Parametric equation](https://en.wikipedia.org/wiki/Parametric_equation).
- **Fluid lab** (`fluid-lab`): **Fixed** — Removed unsupported flame-temperature sequence; explained
  every scene and liquid and tap-only blowing. [recipe](../../src/packs/fluid-lab.js);
  [Position Based Fluids paper](https://mmacklin.com/pbf_sig_preprint.pdf).

## Science (3)

- **Thermal ellipsoids** (`thermal-ellipsoids`): **Fixed** — Corrected exact-Gaussian and slowdown
  claims; explained all structures, display modes and input formats.
  [recipe](../../src/packs/science.js);
  [IUCr displacement-parameter standard](https://www.iucr.org/who-we-are/commissions/commission-on-crystallographic-nomenclature/published-reports/adp).
- **Super-resolution microscope** (`smlm-microscope`): **Fixed** — Corrected visibility versus
  resolution, uncertainty model and repeated blinks; explained all data and display modes. This
  review checks the viewer’s explanation, not scientific validation of a localization dataset.
  [recipe](../../src/packs/science.js);
  [Original localization-microscopy paper](https://pubmed.ncbi.nlm.nih.gov/16902090/);
  [Super-resolution overview](https://en.wikipedia.org/wiki/Super-resolution_microscopy).
- **Galaxy in a box** (`galaxy-box`): **Fixed** — Explained source, approximation, both color modes,
  box and reversible cold-gas filter. [recipe](../../src/packs/science.js);
  [FIRE-2 methods paper](https://arxiv.org/abs/1702.06148).

## Holidays (8)

- **Jack-o'-lantern** (`jack-o-lantern`): **OK** — Lift the lid matches the recipe; no factual
  correction identified. [recipe](../../src/packs/holidays.js);
  [Jack-o'-lantern](https://en.wikipedia.org/wiki/Jack-o%27-lantern).
- **Snowman** (`snowman`): **OK** — Melt and rebuild matches the recipe; no factual correction
  identified. [recipe](../../src/packs/holidays.js);
  [Snowman](https://en.wikipedia.org/wiki/Snowman).
- **Fireworks** (`fireworks`): **OK** — Launch matches the recipe; no factual correction identified.
  [recipe](../../src/packs/holidays.js); [Fireworks](https://en.wikipedia.org/wiki/Fireworks).
- **Decorated tree** (`decorated-tree`): **OK** — Lights on or off matches the recipe; no factual
  correction identified. [recipe](../../src/packs/holidays.js);
  [Christmas tree](https://en.wikipedia.org/wiki/Christmas_tree).
- **Patterned egg** (`patterned-egg`): **OK** — Spin matches the recipe; no factual correction
  identified. [recipe](../../src/packs/holidays.js);
  [Pysanka](https://en.wikipedia.org/wiki/Pysanka).
- **Paper lantern** (`paper-lantern`): **OK** — Swing matches the recipe; no factual correction
  identified. [recipe](../../src/packs/holidays.js);
  [Paper lantern](https://en.wikipedia.org/wiki/Paper_lantern).
- **Diya** (`diya`): **Fixed** — Clarified the Blow control rather than real blowing.
  [recipe](../../src/packs/holidays.js);
  [Diya (lamp)](https://en.wikipedia.org/wiki/Diya_%28lamp%29).
- **Menorah** (`menorah`): **OK** — Light the candles matches the recipe; no factual correction
  identified. [recipe](../../src/packs/holidays.js);
  [Hanukkah menorah](https://en.wikipedia.org/wiki/Hanukkah_menorah).

## Music (8)

- **Acoustic guitar** (`guitar`): **OK** — Strum matches the recipe; no factual correction
  identified. [recipe](../../src/packs/music.js); [Guitar](https://en.wikipedia.org/wiki/Guitar).
- **Snare drum** (`drum`): **OK** — Play a roll matches the recipe; no factual correction
  identified. [recipe](../../src/packs/music.js); [Drum](https://en.wikipedia.org/wiki/Drum).
- **Xylophone** (`xylophone`): **Fixed** — Added the continuous bar-drag action.
  [recipe](../../src/packs/music.js); [Xylophone](https://en.wikipedia.org/wiki/Xylophone).
- **Toy piano** (`toy-piano`): **OK** — Play Twinkle, Twinkle matches the recipe; no factual
  correction identified. [recipe](../../src/packs/music.js);
  [Toy piano](https://en.wikipedia.org/wiki/Toy_piano).
- **Grand piano** (`grand-piano`): **Fixed** — Allowed the high treble strings without dampers.
  [recipe](../../src/packs/pianos.js); [Piano](https://en.wikipedia.org/wiki/Piano).
- **Upright piano** (`upright-piano`): **OK** — Play the opening matches the recipe; no factual
  correction identified. [recipe](../../src/packs/pianos.js);
  [Piano](https://en.wikipedia.org/wiki/Piano).
- **Harpsichord** (`harpsichord`): **OK** — Play the opening matches the recipe; no factual
  correction identified. [recipe](../../src/packs/pianos.js);
  [Harpsichord](https://en.wikipedia.org/wiki/Harpsichord).
- **Electronic keyboard** (`electronic-keyboard`): **OK** — Play the opening matches the recipe; no
  factual correction identified. [recipe](../../src/packs/pianos.js);
  [Electronic keyboard](https://en.wikipedia.org/wiki/Electronic_keyboard).

## Vehicles (14)

- **Rocket** (`rocket`): **OK** — Launch matches the recipe; no factual correction identified.
  [recipe](../../src/packs/vehicles.js); [Rocket](https://en.wikipedia.org/wiki/Rocket).
- **Helicopter** (`helicopter`): **OK** — Take off or land matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Helicopter](https://en.wikipedia.org/wiki/Helicopter).
- **Hot-air balloon** (`hot-air-balloon`): **OK** — Fire the burner matches the recipe; no factual
  correction identified. [recipe](../../src/packs/vehicles.js);
  [Hot air balloon](https://en.wikipedia.org/wiki/Hot_air_balloon).
- **Steam train** (`steam-train`): **OK** — Blow the whistle matches the recipe; no factual
  correction identified. [recipe](../../src/packs/vehicles.js);
  [Steam locomotive](https://en.wikipedia.org/wiki/Steam_locomotive).
- **Ocean liner** (`ocean-liner`): **OK** — Sound the horn matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Ocean liner](https://en.wikipedia.org/wiki/Ocean_liner).
- **Sports car** (`sports-car`): **OK** — Rev the engine matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Downforce](https://en.wikipedia.org/wiki/Downforce).
- **Bus** (`bus`): **OK** — Stop for passengers matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [School bus](https://en.wikipedia.org/wiki/School_bus).
- **Propeller plane** (`propeller-plane`): **Fixed** — Corrected the first-piloted-airplane claim,
  which ignored earlier gliders. [recipe](../../src/packs/vehicles.js);
  [Wright Flyer](https://en.wikipedia.org/wiki/Wright_Flyer).
- **Jet airliner** (`jet`): **OK** — Climb and bank matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Jet engine](https://en.wikipedia.org/wiki/Jet_engine).
- **Sailboat** (`sailboat`): **Fixed** — Qualified keel and capsize claims.
  [recipe](../../src/packs/vehicles.js); [Sailboat](https://en.wikipedia.org/wiki/Sailboat).
- **Submarine** (`submarine`): **OK** — Dive and surface matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Submarine](https://en.wikipedia.org/wiki/Submarine).
- **Bicycle** (`bicycle`): **OK** — Ring the bell matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Bicycle](https://en.wikipedia.org/wiki/Bicycle).
- **Tractor** (`tractor`): **OK** — Chug chug matches the recipe; no factual correction identified.
  [recipe](../../src/packs/vehicles.js); [Tractor](https://en.wikipedia.org/wiki/Tractor).
- **Flying saucer** (`ufo`): **OK** — Beam on or off matches the recipe; no factual correction
  identified. [recipe](../../src/packs/vehicles.js);
  [Flying saucer](https://en.wikipedia.org/wiki/Flying_saucer).

## Landmarks (16)

- **Eiffel Tower** (`eiffel-tower`): **OK** — Sparkle and fireworks matches the recipe; no factual
  correction identified. [recipe](../../src/packs/landmarks.js);
  [Tower history](https://en.wikipedia.org/wiki/Eiffel_Tower);
  [Official lights description](https://www.toureiffel.paris/en/the-monument/lights).
- **Washington Monument** (`washington-monument`): **OK** — Sun and shadow matches the recipe; no
  factual correction identified. [recipe](../../src/packs/landmarks.js);
  [Washington Monument](https://en.wikipedia.org/wiki/Washington_Monument).
- **Pyramids of Giza** (`pyramids`): **OK** — A visitor from space matches the recipe; no factual
  correction identified. [recipe](../../src/packs/landmarks.js);
  [Giza pyramid complex](https://en.wikipedia.org/wiki/Giza_pyramid_complex).
- **Twisting supertall** (`supertall`): **OK** — Twist and light up matches the recipe; no factual
  correction identified. [recipe](../../src/packs/landmarks.js);
  [Skyscraper](https://en.wikipedia.org/wiki/Skyscraper).
- **Lighthouse** (`lighthouse`): **OK** — Light on or off matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Fresnel lens](https://en.wikipedia.org/wiki/Fresnel_lens).
- **Statue of Liberty** (`statue-of-liberty`): **OK** — Light the torch matches the recipe; no
  factual correction identified. [recipe](../../src/packs/landmarks.js);
  [Statue of Liberty](https://en.wikipedia.org/wiki/Statue_of_Liberty).
- **White House** (`white-house`): **OK** — Fountain and lights matches the recipe; no factual
  correction identified. [recipe](../../src/packs/landmarks.js);
  [White House](https://en.wikipedia.org/wiki/White_House).
- **Leaning Tower of Pisa** (`leaning-tower`): **OK** — Drop two balls matches the recipe; no
  factual correction identified. [recipe](../../src/packs/landmarks.js);
  [Leaning Tower of Pisa](https://en.wikipedia.org/wiki/Leaning_Tower_of_Pisa).
- **Colosseum** (`colosseum`): **OK** — A chariot race matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Colosseum](https://en.wikipedia.org/wiki/Colosseum).
- **Parthenon** (`parthenon`): **OK** — A procession matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Parthenon](https://en.wikipedia.org/wiki/Parthenon).
- **Stonehenge** (`stonehenge`): **OK** — Solstice sunrise matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Stonehenge](https://en.wikipedia.org/wiki/Stonehenge).
- **Big Ben** (`big-ben`): **OK** — Chime the bell matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Big Ben](https://en.wikipedia.org/wiki/Big_Ben).
- **Taj Mahal** (`taj-mahal`): **OK** — Moonlight matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Taj Mahal](https://en.wikipedia.org/wiki/Taj_Mahal).
- **Castle** (`castle`): **Fixed** — Removed universal stone and moat claims.
  [recipe](../../src/packs/landmarks.js); [Castle](https://en.wikipedia.org/wiki/Castle).
- **Pagoda** (`pagoda`): **OK** — Ring the bells matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Pagoda](https://en.wikipedia.org/wiki/Pagoda).
- **Windmill** (`windmill`): **OK** — A gust of wind matches the recipe; no factual correction
  identified. [recipe](../../src/packs/landmarks.js);
  [Windmill](https://en.wikipedia.org/wiki/Windmill).

## Worst problems and remaining limits

1. **Programs were named but not explained.** The Turing text now distinguishes binary tape symbols
   from machine states, explains all three presets and separates the most-1s record from longest
   runtime. The half-adder text now includes the OR gate needed when combining two half adders into
   a full adder. The Difference Engine describes finite differences and its finite display. Enigma
   stepping and the Bombe’s deliberately restricted search are explicit. See the computing rows and
   their opened sources.
2. **Animations could be mistaken for working models.** The transformer, looped transformer,
   diffusion and learning diagrams now identify prepared examples. The CNN separates the diagram
   from the trained digit reader; the splatting toy separates a single-photo 2D fit from multi-view
   3D reconstruction. The real network forward pass remains a computation; its displayed backward
   pulses do not constitute ongoing training. See the computing recipes and paper links above.
3. **Scientific visualizations implied stronger measurements than they provide.** Thermal ellipsoids
   use a Gaussian approximation including possible disorder. Localization precision does not
   establish microscope image resolution. Galaxy splats approximate a non-Gaussian kernel. Monocular
   depth is relative. Room echo extrapolates a decay slope. The revised copy states these limits,
   and physical-input accuracy is still unverified.
4. **Several broad claims were false or too strong.** Corrections include Klein-bottle embedding
   dimension, convex Platonic-solid uniqueness, photochromic mechanisms, pearl formation, diatom
   opening, butterfly pupation, density in lava lamps, candle heat, Neptune color, and the first
   piloted airplane. References are attached to their rows. Unconfirmed scan-specific species and
   generating-formula claims were narrowed, not reconstructed.
5. **Independent acceptance remains.** Three browser tests failed on graphics-driver warnings. No
   test, camera or microphone implementation was changed. Device testing, scientific validation and
   owner/Operator review remain separate from this editorial handback.

## Complete math preset catalog

These descriptions come from the equations in [maths.js](../../src/packs/maths.js). Names refer to
the recipe’s default shape; changing `a` may distort that shape. The plotter clips singularities and
samples finite curves. Cartesian input gives `y` from `x`; polar input gives `r` from `θ`;
parametric input gives `x` and `y` from `t`. Those three systems, text-file entry, and the `a` and
`b` controls are explained in the revised help. This catalog preserves the 180-word in-app limit
without leaving individual presets unexplained in the audit.

### Graph plotter: 42 built-in presets

| Preset                | What this equation shows                                                                |
| --------------------- | --------------------------------------------------------------------------------------- |
| Sine wave             | Repeating oscillations; `a` changes their height.                                       |
| Bell curve            | A normalized Gaussian profile; `a` changes its spread.                                  |
| Parabola              | A quadratic bowl or arch; `a` sets opening and direction.                               |
| Cubic                 | A third-degree curve; `a` changes its turning points.                                   |
| Double well           | A fourth-degree profile with two valleys for suitable `a`.                              |
| Tangent               | Repeating branches separated by poles; `a` changes frequency.                           |
| Hyperbola             | Reciprocal branches, undefined at zero.                                                 |
| Exponential           | Multiplicative growth or decay.                                                         |
| Logarithm             | The inverse-growth profile, defined for positive `x`.                                   |
| Square root           | The nonnegative square-root branch, scaled by `a`.                                      |
| Sinc                  | Oscillations under a decreasing envelope; the formula is `sin(a·x)/x`.                  |
| Damped wave           | A cosine whose amplitude fades exponentially.                                           |
| Square wave (Fourier) | Five odd harmonics approximating abrupt alternation; `a` scales the added harmonics.    |
| Beats                 | Two nearby frequencies that alternately reinforce and cancel.                           |
| S-curve (logistic)    | A bounded rise between two plateaus.                                                    |
| Catenary              | A hyperbolic-cosine curve, the ideal uniform hanging-chain profile.                     |
| Witch of Agnesi       | A smooth rounded peak with long tails.                                                  |
| x·sin(1/x)            | Faster oscillations approaching zero inside a shrinking envelope.                       |
| Circle                | Constant polar radius.                                                                  |
| Cardioid              | A one-lobed polar curve; the default has a cusp.                                        |
| Limaçon               | A dimpled or looped polar curve controlled by `a`.                                      |
| Rose (8 petals)       | Eight petals at the default; varying `a` warps them.                                    |
| Rose (3 petals)       | Three petals at the default; `a` offsets the radius.                                    |
| Butterfly             | A long polar trace with wing-like lobes.                                                |
| Heart                 | A closed parametric heart outline.                                                      |
| Lissajous             | Horizontal and vertical waves at a 3:2 frequency ratio.                                 |
| Lissajous 5:4         | A different frequency ratio produces more crossings.                                    |
| Archimedean spiral    | Radius grows evenly with angle.                                                         |
| Logarithmic spiral    | Radius grows exponentially with angle.                                                  |
| Hyperbolic spiral     | Radius decreases as the reciprocal of angle.                                            |
| Lemniscate (infinity) | A figure-eight loop.                                                                    |
| Astroid               | A four-cusped outline at its default setting.                                           |
| Deltoid               | A three-cusped outline at its default setting.                                          |
| Nephroid              | A two-cusped outline at its default setting.                                            |
| Cycloid               | An arch traced by a point on a rolling circle at the default.                           |
| Spirograph            | A closed pattern from combined rotating motions.                                        |
| Epitrochoid           | A looping trace related to a circle rolling outside another.                            |
| Involute of a circle  | The trace of the end of an unwinding taut string at the default.                        |
| Conic sections        | `a` changes eccentricity, moving among ellipse-like, parabolic and hyperbolic profiles. |
| Folium of Descartes   | A loop and open branches; the denominator has a pole.                                   |
| Tractrix              | A tapering dragged-point profile, vertically scaled by `a`.                             |
| Freeth’s nephroid     | A two-turn polar trace with an inner loop at the default.                               |

### Surface plotter: 16 built-in presets

| Preset                     | What this equation shows                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Saddle                     | Opposite quadratic curvatures along the two axes.                                                          |
| Monkey saddle              | Three alternating rising and falling directions; `a` rotates them.                                         |
| Sombrero                   | Circular, decaying cosine ripples; this is the recipe’s chosen profile, not a Bessel-function calculation. |
| Egg crate                  | Repeating sine hills and hollows.                                                                          |
| Gaussian hill              | A bell-shaped peak; negative `a` makes a hollow.                                                           |
| Rosenbrock’s banana valley | A curved optimization valley with `log(1 + value)` height compression.                                     |
| Paraboloid (bowl)          | A radial quadratic bowl or dome.                                                                           |
| Ocean waves                | Two traveling sine waves superimposed.                                                                     |
| Two-source ripples         | Waves radiating from two fixed sources and interfering.                                                    |
| Pinwheel                   | A radial wave with three spiral arms.                                                                      |
| Twisted sheet              | The profile `sin(a·x·y)`.                                                                                  |
| Three peaks                | A mix of polynomial-weighted Gaussian hills and hollows.                                                   |
| Himmelblau’s four valleys  | Four minima at the default, with `log(1 + value)` height compression.                                      |
| Bumpy (Rastrigin)          | A quadratic landscape with many cosine-induced local minima.                                               |
| Volcano                    | A raised circular rim around a center that fills or empties.                                               |
| Cosine bumps               | A product of two cosines; `a` changes height and sign.                                                     |

The element proposal is [element-facts.md](element-facts.md): 118 entries and 236 individually
linked facts. It is content only. Heavy-element appearance predictions and volatile
isotope-count/half-life lists were omitted.

## Molecule preset sources

The revised About identifies every built-in molecule by a structure or role. The public PubChem
description API was read directly because its compound pages required JavaScript in the web reader.
Unavailable API responses were not used; the alternatives below were opened. DNA entries are
illustrative fragments from the recipe, not whole chromosomes.

| Preset            | Structure or role                                   | Opened source                                                                                                            |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Water             | A small molecule with one oxygen and two hydrogens. | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/water/description/JSON)                    |
| Carbon dioxide    | One carbon joined to two oxygens.                   | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/carbon%20dioxide/description/JSON)         |
| Methane           | One carbon with four hydrogens.                     | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/methane/description/JSON)                  |
| Ammonia           | One nitrogen with three hydrogens.                  | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/ammonia/description/JSON)                  |
| Ethanol           | An alcohol.                                         | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/ethanol/description/JSON)                  |
| Benzene           | An aromatic carbon ring.                            | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/benzene/description/JSON)                  |
| Caffeine          | A stimulant.                                        | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/caffeine/description/JSON)                 |
| Buckyball         | A cage of sixty carbons.                            | [Encyclopedia description](https://en.wikipedia.org/wiki/Buckminsterfullerene)                                           |
| Glucose           | A simple sugar.                                     | [Encyclopedia description](https://en.wikipedia.org/wiki/Glucose)                                                        |
| Sucrose           | A sugar joining glucose and fructose.               | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/sucrose/description/JSON)                  |
| Aspirin           | A medicine.                                         | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/description/JSON)                  |
| Paracetamol       | A medicine, also called acetaminophen.              | [Encyclopedia description](https://en.wikipedia.org/wiki/Paracetamol)                                                    |
| Ibuprofen         | A medicine.                                         | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/ibuprofen/description/JSON)                |
| Penicillin G      | An antibiotic.                                      | [Encyclopedia description](https://en.wikipedia.org/wiki/Benzylpenicillin)                                               |
| Vitamin C         | Ascorbic acid, a vitamin.                           | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/ascorbic%20acid/description/JSON)          |
| Dopamine          | A signaling molecule.                               | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/dopamine/description/JSON)                 |
| Serotonin         | A neurotransmitter.                                 | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/serotonin/description/JSON)                |
| Adrenaline        | A hormone.                                          | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/epinephrine/description/JSON)              |
| Melatonin         | A hormone.                                          | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/melatonin/description/JSON)                |
| Tryptophan        | An amino acid.                                      | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/tryptophan/description/JSON)               |
| Capsaicin         | A contributor to chili spiciness.                   | [Encyclopedia description](https://en.wikipedia.org/wiki/Capsaicin)                                                      |
| Vanillin          | A contributor to vanilla flavor.                    | [Encyclopedia description](https://en.wikipedia.org/wiki/Vanillin)                                                       |
| Menthol           | Produces a cooling sensation.                       | [Encyclopedia description](https://en.wikipedia.org/wiki/Menthol)                                                        |
| Citric acid       | An acid.                                            | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/citric%20acid/description/JSON)            |
| Cholesterol       | A sterol, in the steroid family.                    | [Encyclopedia description](https://en.wikipedia.org/wiki/Cholesterol)                                                    |
| Testosterone      | A steroid hormone.                                  | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/testosterone/description/JSON)             |
| ATP               | Carries chemical energy.                            | [PubChem description](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/adenosine%20triphosphate/description/JSON) |
| DNA base pair A·T | Complementary adenine and thymine.                  | [DNA reference](https://en.wikipedia.org/wiki/DNA); [recipe](../../src/packs/atoms.js)                                   |
| DNA base pair G·C | Complementary guanine and cytosine.                 | [DNA reference](https://en.wikipedia.org/wiki/DNA); [recipe](../../src/packs/atoms.js)                                   |
| DNA double helix  | The recipe displays four base pairs in two strands. | [DNA reference](https://en.wikipedia.org/wiki/DNA); [recipe](../../src/packs/atoms.js)                                   |
