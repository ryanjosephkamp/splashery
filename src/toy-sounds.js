// Every shelf toy's own tap sound, as a spec for the voice library
// (src/voices.js explains the format). Built from the Sound line of each toy
// in docs/TOY-PLAN.md. A toggle has { on, off }: the first plays when a tap
// switches the action on, the second when it switches it off. Toys that only
// hop still play their own sound.
//
// Rules (tests/unit.spec.mjs checks them): every shelf toy has an entry, no
// two entries are exactly the same, and every spec names real voices.
// `node tools/sound-audit.mjs` lists the toys and their voices;
// `node tools/sound-check.mjs` renders each one and checks its level.

export const TOY_SOUNDS = {
  // ---- Scans ------------------------------------------------------------------------
  cactus: [
    { voice: "pluck", notes: "E5 G5 B5 D6", step: 0.09, at: 0.15, decay: 0.35, bright: 0.3 },
    { voice: "rattle", at: 0.05, f: 1800, n: 6, decay: 0.8 },
  ],
  strawberry: [
    { voice: "squish", pitch: 1.2, bright: 0.6 },
    { voice: "drip", at: 0.08, f: 1100, n: 1 },
    { voice: "sparkle", at: 0.3, vol: 0.5 },
  ],
  cookie: [
    { voice: "crunch", f: 1500, n: 10, decay: 0.8 },
    { voice: "thud", at: 0.25, f: 70, bright: 0.1, decay: 0.8 },
    { voice: "thud", at: 0.55, f: 65, bright: 0.1, decay: 0.8, vol: 0.8 },
  ],
  bee: { voice: "buzz", f: 230, rate: 13, bright: 0.6, decay: 1.7 },
  "cluster-fly": [
    { voice: "scrape", f: 3000, rate: 12, decay: 0.9, vol: 0.4 },
    { voice: "scrape", at: 1.05, f: 3400, rate: 10, decay: 1.8, vol: 0.35 },
    { voice: "buzz", at: 2.35, f: 190, rate: 21, bright: 0.9, decay: 0.45, vol: 0.8 },
  ],
  "may-beetle": [
    { voice: "buzz", f: 85, rate: 9, bright: 0.3, decay: 0.9 },
    { voice: "ratchet", f: 1600, n: 8, rate: 20, vol: 0.6 },
  ],
  millipede: { voice: "patter", f: 2200, n: 30, decay: 2, vol: 0.8 },
  bumblebee: { voice: "buzz", f: 130, rate: 6, bright: 0.35, decay: 2.4 },
  raspberry: [
    { voice: "squish", pitch: 1.4, bright: 0.5, decay: 0.9 },
    { voice: "bubbles", at: 0.05, f: 900, n: 4, decay: 0.5 },
    { voice: "patter", at: 0.45, f: 1500, n: 14, decay: 1.6, vol: 0.7 },
  ],
  blackberry: [
    { voice: "squish", pitch: 0.8, bright: 0.2, decay: 1.2 },
    { voice: "bubbles", at: 0.06, f: 420, n: 3, decay: 0.6 },
    { voice: "patter", at: 0.75, f: 900, n: 12, decay: 0.8, vol: 0.8 },
  ],
  blueberry: [
    { voice: "tear", f: 900, to: 0.7, decay: 1.2, bright: 0.4, vol: 0.8 },
    { voice: "pop", at: 2.6, f: 520, decay: 1.3 },
  ],
  grape: [
    { voice: "tear", f: 1600, to: 0.6, decay: 0.8, bright: 0.7 },
    { voice: "squish", at: 2.3, pitch: 1.6, vol: 0.5 },
  ],
  "star-cookie": [
    { voice: "crunch", f: 2100, n: 18, decay: 1.3, bright: 0.7 },
    { voice: "patter", at: 0.2, f: 1300, n: 8, decay: 0.6, vol: 0.7 },
    { voice: "whoosh", at: 1.55, f: 600, to: 2, decay: 0.6, vol: 0.5 },
  ],
  tomatoes: [
    { voice: "thud", at: 0.4, f: 110, bright: 0.2 },
    { voice: "thud", at: 0.62, f: 125, bright: 0.2, vol: 0.7 },
    { voice: "thud", at: 0.85, f: 140, bright: 0.2, vol: 0.6 },
    { voice: "thud", at: 1.1, f: 150, bright: 0.2, vol: 0.45 },
  ],
  mandeltorus: { voice: "shimmer", f: "G4", rate: 7, to: 1.5, decay: 1.4 },
  basket: [
    { voice: "rattle", f: 1600, n: 6, decay: 0.8, vol: 0.6 },
    { voice: "clatter", at: 0.5, f: 2200, n: 14, kind: "shell", decay: 2.4 },
  ],
  "rubber-duck-real": { voice: "squeak", f: 2300, to: 1.25, decay: 1.4 },
  "garden-gnome": [
    { voice: "chuckle", f: 640, n: 4 },
    { voice: "switch", at: 0.45, f: 2600 },
  ],
  "wooden-elephant": [
    { voice: "wood", f: 520, decay: 1.2 },
    { voice: "brass", at: 0.35, f: "A4", decay: 2.4, vol: 0.8 },
  ],
  // SAL-VE, A-MI-CE: one murmur per syllable, as the jaw drops.
  "marble-bust": [
    { voice: "scrape", f: 500, rate: 13, decay: 1.2 },
    { voice: "murmur", at: 0.62, notes: "A2 G2", step: 0.2, decay: 0.3 },
    { voice: "murmur", at: 1.1, notes: "B2 A2 E2", step: 0.2, decay: 0.3 },
  ],
  // Four strums (down, down, up, down) on the ukulele's own tuning: C, F, G, C.
  ukulele: { voice: "nylon", notes: "G4+C4+E4+C5 - A4+C4+F4+A4 B4+D4+G4+B4 - G4+C4+E4+C5", step: 0.15, strum: 0.03, bright: 0.45, decay: 0.9 }, // prettier-ignore
  "alarm-clock": { voice: "bell", notes: Array(14).fill("A5 C6").join(" "), step: 0.06, decay: 0.3, bright: 0.8 }, // prettier-ignore
  "vintage-camera": [
    { voice: "switch", f: 3600, decay: 1.5 },
    { voice: "ratchet", at: 0.2, f: 1400, n: 9, rate: 26 },
  ],
  boombox: [
    { voice: "kick", notes: "C2 - C2 C2 - - C2 - C2 - C2 C2 - - C2 -", step: 0.15, vol: 0.55 },
    {
      voice: "snare",
      notes: "- - A3 - - - A3 - - - A3 - - - A3 -",
      step: 0.15,
      decay: 0.8,
      vol: 0.7,
    },
    { voice: "hat", notes: Array(16).fill("C8").join(" "), step: 0.15, vol: 0.45 },
  ],
  "croissant-real": [
    { voice: "tear", f: 1100, to: 1.8, decay: 1.1 },
    { voice: "crunch", at: 0.1, f: 2600, n: 7, decay: 0.8, vol: 0.5 },
    { voice: "hiss", at: 0.35, decay: 0.8, vol: 0.3 },
  ],
  "carrot-cake": [
    { voice: "scrape", f: 1400, rate: 3, decay: 1.4, vol: 0.6 },
    { voice: "thud", at: 2.5, f: 180, vol: 0.4 },
  ],
  pomegranate: [
    { voice: "crack", f: 1600, bright: 0.4 },
    { voice: "clatter", at: 0.45, f: 2600, n: 14, kind: "clack", decay: 1.1 },
  ],
  lantern: {
    on: [
      { voice: "scrape", f: 2400, rate: 40, decay: 0.3, vol: 0.8 },
      { voice: "whoosh", at: 0.15, f: 250, to: 3, decay: 0.8 },
    ],
    off: { voice: "breath", f: 900, to: 0.6, decay: 0.5, vol: 0.7 },
  },
  "cat-statue": [
    { voice: "scrape", f: 620, rate: 11, decay: 0.9 },
    { voice: "mew", at: 0.45, f: 700 },
  ],
  // Tap to play the Opera Game (each move clacks as it lands, from the recipe);
  // tap again and the pieces slide home.
  "chess-set": {
    on: { voice: "wood", notes: "D5 - A4", step: 0.12, decay: 0.9 },
    off: { voice: "scrape", f: 900, rate: 6, decay: 1.4, vol: 0.5 },
  },
  "horse-statue": [
    { voice: "scrape", f: 450, rate: 9, decay: 1.1 },
    { voice: "whinny", at: 0.4, f: 1150 },
  ],

  // ---- Shapes -----------------------------------------------------------------------
  blob: [
    { voice: "gloop", f: 140, decay: 1.2 },
    { voice: "gloop", at: 1.8, f: 110, decay: 0.9, vol: 0.7 },
  ],
  donut: [
    { voice: "crack", f: 900, bright: 0.2, vol: 0.7 },
    { voice: "patter", at: 0.3, f: 2600, n: 16, decay: 1.2 },
    { voice: "thud", at: 1.9, f: 150, bright: 0.3, vol: 0.5 },
  ],
  knot: { voice: "hum", f: 120, to: 1.4, bright: 0.8, decay: 2.4 },
  planet: { voice: "wind", f: 700, rate: 0.5, decay: 2 },

  // ---- Balls ------------------------------------------------------------------------
  basketball: [
    { voice: "boing", f: 95, to: 0.8, rate: 30, decay: 0.8 },
    { voice: "slap", f: 900, vol: 0.7 },
  ],
  "soccer-ball": [
    { voice: "thud", f: 100, bright: 0.5 },
    { voice: "slap", f: 1100, vol: 0.5 },
  ],
  "american-football": [
    { voice: "slap", f: 700, vol: 0.6 },
    { voice: "flutter", at: 0.1, f: 500, rate: 12, decay: 3, vol: 0.5 },
    { voice: "thud", at: 1.65, f: 100, bright: 0.3, vol: 0.7 },
  ],
  "tennis-ball": { voice: "pock", f: 820 },
  baseball: { voice: "crack", f: 2400, bright: 0.8 },
  softball: { voice: "thud", f: 130, bright: 0.25, decay: 0.8 },
  "beach-ball": { voice: "boing", f: 240, to: 1.4, rate: 9, decay: 0.8 },
  "golf-ball": [
    { voice: "clack", f: 3400, decay: 1.4 },
    { voice: "whoosh", f: 1200, to: 3, decay: 0.3, vol: 0.5 },
  ],
  "rugby-ball": [
    { voice: "thud", f: 85, bright: 0.4, decay: 1.1 },
    { voice: "thud", at: 1.45, f: 95, bright: 0.3, vol: 0.7 },
    { voice: "thud", at: 2.05, f: 110, bright: 0.3, vol: 0.4 },
  ],
  volleyball: { voice: "slap", f: 1500, decay: 1.2 },
  "water-polo-ball": { voice: "splash", f: 1300, bright: 0.6 },
  "ping-pong-ball": { voice: "pock", notes: "E6 - E6 E6 E6", step: 0.13, decay: 0.6 },
  "cricket-ball": [
    { voice: "wood", f: 900, decay: 0.8 },
    { voice: "pock", f: 1100, decay: 0.8 },
  ],
  "bowling-ball": [
    { voice: "rumble", f: 70, rate: 12, decay: 0.6 },
    { voice: "clatter", at: 1.0, f: 1100, n: 10, kind: "wood" },
  ],
  "pool-ball": { voice: "clack", f: 2900 },
  pickleball: { voice: "pock", f: 1250, bright: 0.2, decay: 1.3 },
  dodgeball: { voice: "boing", f: 150, to: 0.7, rate: 20, decay: 0.7 },
  "medicine-ball": { voice: "thud", f: 60, bright: 0.2, decay: 1.4 },
  "lacrosse-ball": { voice: "pock", f: 620, bright: 0.8 },
  "squash-ball": { voice: "pock", f: 380, bright: 0.1, decay: 1.2 },
  "bouncy-ball": { voice: "boing", f: 260, to: 2.6, rate: 16 },
  marble: { voice: "glass", f: 2350, decay: 0.6, bright: 0.7 },
  "hockey-puck": [
    { voice: "slap", f: 1700, vol: 0.9 },
    { voice: "scrape", at: 0.08, f: 3000, rate: 40, decay: 0.8, vol: 0.5 },
  ],
  shuttlecock: [
    { voice: "pock", f: 1500, bright: 0.9, decay: 0.7, vol: 0.7 },
    { voice: "flutter", at: 0.9, f: 2200, rate: 30, decay: 3.4, vol: 0.25 },
  ],
  "flying-disc": [
    { voice: "whoosh", f: 600, to: 2, decay: 0.9 },
    { voice: "wind", at: 0.4, f: 900, rate: 7, decay: 1.2, vol: 0.5 },
  ],

  // ---- Space ------------------------------------------------------------------------
  sun: { voice: "roar", f: 90, bright: 0.25, decay: 1.4 },
  "solar-system": { voice: "pad", notes: "C4+G4+E5", step: 0, decay: 1.2 },
  mercury: { voice: "tone", f: "E6", decay: 0.5 },
  venus: { voice: "wind", f: 260, rate: 0.4, decay: 1.2 },
  earth: [
    { voice: "wave", f: 500, decay: 0.9 },
    { voice: "wind", f: 900, rate: 0.6, decay: 1.1, vol: 0.5 },
  ],
  moon: { voice: "hollow", f: "A5", decay: 3 },
  mars: { voice: "hiss", f: 2200, decay: 1.2 },
  jupiter: { voice: "drone", f: 44, bright: 0.2 },
  saturn: { voice: "shimmer", f: "E5", rate: 5 },
  uranus: { voice: "tone", f: "B4", to: 1.02, kind: "triangle", decay: 3 },
  neptune: { voice: "wind", f: 330, rate: 0.9, decay: 1.4 },
  "aurora-planet": { voice: "whistle", f: 1500, to: 1.3, decay: 1.6, vol: 0.7 },
  asteroid: [
    { voice: "crack", f: 1300, bright: 0.3 },
    { voice: "kick", at: 0.05, f: 45, decay: 2 },
  ],
  comet: { voice: "whoosh", f: 200, to: 6, decay: 2.2 },
  meteor: [
    { voice: "sizzle", f: 4500, decay: 0.8 },
    { voice: "kick", at: 0.7, f: 50, decay: 2.2 },
  ],
  star: { voice: "pad", f: "A4", decay: 1.5 },
  pulsar: { voice: "ratchet", f: 1800, n: 14, rate: 5, to: 5 },
  "black-hole": { voice: "drone", f: 50, to: 0.5, bright: 0.1, decay: 1.3 },
  "star-cluster": { voice: "sparkle", f: 3100, n: 10, decay: 1.4 },
  "planetary-nebula": { voice: "pad", notes: "D4+A4", step: 0, decay: 1.4 },
  nebula: { voice: "sparkle", f: 2000, n: 6, decay: 1.8, bright: 0.3 },
  supernova: [
    { voice: "kick", f: 40, decay: 3 },
    { voice: "roar", f: 110, bright: 0.5, decay: 2.2 },
  ],
  "spiral-galaxy": { voice: "drone", f: 62, bright: 0.45, decay: 1.2 },

  // ---- Tiny things ------------------------------------------------------------------
  virus: [
    { voice: "squish", pitch: 1.6, decay: 0.6 },
    { voice: "pop", f: 600 },
  ],
  bacteriophage: [
    { voice: "boing", f: 120, to: 0.5, rate: 30, decay: 0.5 },
    { voice: "clack", f: 1300, decay: 1.5 },
    { voice: "squish", at: 0.5, pitch: 1.5, bright: 0.8 },
  ],
  bacterium: { voice: "pop", f: 380, decay: 1.4 },
  "red-blood-cell": { voice: "squeak", f: 900, to: 1.3, decay: 1.6, vol: 0.6 },
  neuron: [
    { voice: "zap", f: 2400, to: 0.1 },
    { voice: "crackle", at: 0.2, f: 3600, n: 16, decay: 0.9 },
  ],
  astrocyte: { voice: "shimmer", f: "C6", rate: 11, decay: 0.8 },
  "animal-cell": [
    { voice: "gloop", f: 180, decay: 0.9 },
    { voice: "pop", at: 0.3, f: 450 },
  ],
  dna: { voice: "ratchet", f: 3000, n: 26, rate: 40, to: 1.6 },
  "white-blood-cell": { voice: "gloop", f: 110, decay: 0.7 },
  microglia: { voice: "patter", f: 3200, n: 22, decay: 0.9, vol: 0.6 },
  diatom: { voice: "glass", f: 3000, decay: 0.4 },
  tardigrade: { voice: "squeak", notes: "C7 - D7", step: 0.18, decay: 0.5, vol: 0.6 },
  pollen: [
    { voice: "breath", f: 1300, to: 0.5, decay: 0.4 },
    { voice: "chirp", at: 0.3, f: 3200, n: 1 },
  ],
  snowflake: { voice: "sparkle", f: 4000, n: 8, decay: 0.9, bright: 0.8 },
  chromosome: [
    { voice: "twang", f: 90, decay: 0.8 },
    { voice: "clack", at: 0.25, f: 2000 },
  ],
  mitochondrion: { voice: "hum", f: 90, to: 2.5, bright: 0.5 },
  paramecium: { voice: "flutter", f: 2600, rate: 30, decay: 1.2, vol: 0.7 },
  amoeba: { voice: "gloop", f: 95, decay: 1.8 },

  // ---- Atoms ------------------------------------------------------------------------
  orbital: [
    { voice: "blip", f: 700, to: 2 },
    { voice: "blip", at: 0.12, f: 1400, to: 0.5 },
  ],
  atom: { voice: "hum", f: 220, to: 1.8, bright: 0.2, decay: 0.8 },
  molecule: { voice: "boing", f: 330, to: 1.3, rate: 11 },
  "crystal-lattice": { voice: "glass", notes: "C6 E6 G6 C7", step: 0.06, decay: 0.6 },

  // ---- Gems -------------------------------------------------------------------------
  diamond: { voice: "glass", f: 3520, decay: 1.2, bright: 0.9 },
  ruby: { voice: "bell", f: "C5", decay: 0.8, bright: 0.25 },
  emerald: { voice: "glass", f: "G5", decay: 1.1, bright: 0.35 },
  "amethyst-geode": {
    on: [
      { voice: "crack", f: 1100, bright: 0.3 },
      { voice: "glass", at: 0.35, notes: "E6 B6", step: 0.12, decay: 1.2 },
    ],
    off: [{ voice: "stone", f: 300, decay: 1.4 }],
  },
  sapphire: { voice: "bell", f: "E6", decay: 0.7, bright: 0.7 },
  "quartz-cluster": { voice: "chimes", f: 1760, n: 6, decay: 0.8 },
  opal: { voice: "shimmer", f: "A5", rate: 14 },
  pearl: {
    on: { voice: "clack", f: 1800, decay: 2.5, bright: 0.2 },
    off: { voice: "clack", f: 1500, decay: 2, bright: 0.2 },
  },
  "crystal-ball": [
    { voice: "shimmer", f: "D5", rate: 4, decay: 1.8 },
    { voice: "theremin", f: 440, to: 1.2, vol: 0.5 },
  ],

  // ---- Anatomy ----------------------------------------------------------------------
  heart: { voice: "heartbeat", f: 72, n: 4, rate: 1.3, to: 2 },
  brain: [
    { voice: "crackle", f: 4200, n: 18, decay: 0.7 },
    { voice: "ding", at: 0.6, f: "E6" },
  ],
  eye: { voice: "whoosh", f: 1500, to: 0.6, decay: 0.35, vol: 0.6 },
  lungs: [
    { voice: "breath", f: 700, to: 1.4, decay: 1.4 },
    { voice: "breath", at: 1.1, f: 900, to: 0.6, decay: 1.4 },
  ],
  tooth: [
    { voice: "squeak", f: 3000, to: 1.2, decay: 0.7, vol: 0.6 },
    { voice: "ding", at: 0.15, f: "C7", decay: 0.6 },
  ],
  kidney: { voice: "drip", f: 1300, n: 7, rate: 9, decay: 0.8 },

  // ---- Nature -----------------------------------------------------------------------
  oak: { voice: "flutter", f: 3000, rate: 35, decay: 1.6, vol: 0.6 },
  pine: { voice: "bell", notes: "E7 G7 E7 G7 E7", step: 0.05, decay: 0.15, bright: 0.9, vol: 0.6 }, // prettier-ignore
  palm: { voice: "hollow", notes: "D4 - A3", step: 0.2, decay: 0.8 },
  "cherry-blossom": [
    { voice: "wind", f: 1000, rate: 0.8, decay: 0.9, vol: 0.6 },
    { voice: "patter", at: 0.3, f: 2400, n: 14, decay: 1.4, vol: 0.5 },
  ],
  maple: { voice: "crunch", f: 3400, n: 24, decay: 2.2, bright: 0.8, vol: 0.6 },
  bonsai: { voice: "clack", notes: "A7 - A7", step: 0.07, decay: 0.7 },
  willow: { voice: "breath", f: 500, to: 0.6, decay: 2.2 },
  sunflower: { voice: "tone", f: "F4", to: 1.5, kind: "triangle", decay: 2 },
  rose: { voice: "harp", f: "E5" },
  dandelion: { voice: "breath", f: 1400, to: 0.6, decay: 0.7 },
  tulip: { voice: "pluck", f: "A4", decay: 0.5, bright: 0.2 },
  daisy: { voice: "switch", notes: "C6 C6 C6 C6", step: 0.14, decay: 0.6 },
  lotus: [
    { voice: "drip", f: 800, n: 1 },
    { voice: "bell", at: 0.12, f: "G5", decay: 0.8, bright: 0.2 },
  ],
  mushroom: { voice: "breath", f: 350, to: 0.4, decay: 0.35 },
  fern: { voice: "flutter", f: 2200, rate: 12, decay: 1.3, vol: 0.6 },
  saguaro: { voice: "zap", f: 3200, to: 0.7, decay: 1.2 },
  coral: { voice: "bubbles", f: 650, n: 9 },
  pinecone: { voice: "scrape", f: 350, rate: 25, decay: 0.8 },
  acorn: { voice: "pop", f: 1150, decay: 0.6 },
  succulent: { voice: "pluck", f: "C5", decay: 0.4, bright: 0.35 },
  bamboo: { voice: "hollow", notes: "G4 C5 E5", step: 0.12, decay: 0.7 },
  rocks: { voice: "clatter", f: 1600, n: 10 },
  kelp: { voice: "bubbles", f: 300, n: 12, decay: 1.4 },

  // ---- Weather ----------------------------------------------------------------------
  campfire: [
    { voice: "crackle", f: 2600, n: 20, decay: 1.4 },
    { voice: "roar", f: 60, bright: 0.2, decay: 0.8, vol: 0.4 },
  ],
  "storm-cloud": { voice: "rumble", f: 80, rate: 6 },
  "lava-lamp": { voice: "gloop", f: 75, decay: 2.4 },
  "snow-globe": [
    { voice: "rattle", f: 3500, n: 10, decay: 1.2, vol: 0.6 },
    { voice: "sparkle", at: 0.2, f: 3600, n: 7 },
  ],
  volcano: [
    { voice: "rumble", f: 55, rate: 4, decay: 1.3 },
    { voice: "kick", at: 0.4, f: 42, decay: 2.5 },
  ],
  "ice-statue": [
    { voice: "crackle", f: 5200, n: 12, decay: 0.6 },
    { voice: "drip", at: 0.4, f: 1500, n: 3, rate: 5 },
  ],
  candle: {
    on: [
      { voice: "scrape", f: 2600, rate: 45, decay: 0.25, vol: 0.8 },
      { voice: "whoosh", at: 0.1, f: 300, to: 2, decay: 0.5, vol: 0.7 },
    ],
    off: { voice: "breath", f: 1100, to: 0.4, decay: 0.5 },
  },
  tornado: { voice: "wind", f: 250, rate: 3, decay: 2 },
  rainbow: { voice: "harp", notes: "C5 D5 E5 G5 A5 C6 D6 E6", step: 0.06, decay: 0.6 },
  iceberg: [
    { voice: "crack", f: 1800, bright: 0.5, decay: 1.5 },
    { voice: "splash", at: 0.35, f: 900, decay: 1.4 },
  ],
  waterfall: { voice: "roar", f: 400, bright: 0.8, decay: 1.8 },
  "ocean-wave": { voice: "wave", f: 400 },
  geyser: [
    { voice: "hiss", f: 3000, decay: 1.6 },
    { voice: "whoosh", at: 0.3, f: 250, to: 4, decay: 1.3 },
  ],

  // ---- Food -------------------------------------------------------------------------
  "ice-cream": { voice: "drip", f: 1000, n: 3, rate: 2.5 },
  watermelon: [
    { voice: "crack", f: 1400, bright: 0.2, decay: 0.8 },
    { voice: "squish", at: 0.04, pitch: 1.1, bright: 0.7, decay: 1.2 },
  ],
  "birthday-cake": {
    on: [
      { voice: "horn", f: 740, decay: 0.8 },
      { voice: "glass", at: 0.35, notes: "C6 E6 G6", step: 0.07, decay: 0.8 },
    ],
    off: [
      { voice: "scrape", f: 2800, rate: 50, decay: 0.2, vol: 0.7 },
      { voice: "whoosh", at: 0.1, f: 400, to: 2, decay: 0.4, vol: 0.6 },
    ],
  },
  popcorn: { voice: "pop", notes: "C5 - E5 C6 - - G5 D6 - A5", step: 0.09, decay: 0.8 },
  jelly: { voice: "boing", f: 140, to: 1.3, rate: 7, decay: 1.4 },
  pancakes: [
    { voice: "sizzle", f: 4200, decay: 1 },
    { voice: "whoosh", at: 0.1, f: 500, to: 3, decay: 0.4, vol: 0.6 },
    { voice: "slap", at: 0.8, f: 800, vol: 0.6 },
  ],
  cupcake: [
    { voice: "thud", f: 150, bright: 0.5, decay: 0.6 },
    { voice: "patter", at: 0.1, f: 2900, n: 10, decay: 0.5, vol: 0.6 },
  ],
  lollipop: { voice: "hum", f: 180, to: 1.6, bright: 0.2, decay: 0.7 },
  "candy-cane": { voice: "crack", f: 3000, bright: 0.9, decay: 0.6 },
  macarons: { voice: "wood", notes: "E6 G6 E6", step: 0.11, decay: 0.5, vol: 0.6 },
  "gummy-bear": [
    { voice: "squeak", f: 700, to: 1.6, decay: 2, vol: 0.5 },
    { voice: "boing", at: 0.3, f: 200, to: 1.8, rate: 12 },
  ],
  pretzel: { voice: "squish", pitch: 0.7, bright: 0.2, decay: 2 },
  croissant: { voice: "ding", f: "A6", decay: 1.3 },
  pizza: {
    on: { voice: "tear", f: 700, to: 0.5, decay: 1.6, bright: 0.3 },
    off: { voice: "thud", f: 120, bright: 0.4, decay: 0.8 },
  },
  burger: {
    on: [
      { voice: "whoosh", f: 300, to: 5, decay: 0.5 },
      { voice: "sizzle", f: 3500, decay: 0.9, vol: 0.8 },
    ],
    off: [
      { voice: "sizzle", f: 3800, decay: 0.6, vol: 0.6 },
      { voice: "thud", at: 0.3, f: 110, bright: 0.3 },
    ],
  },
  sushi: { voice: "wood", notes: "B6 B6", step: 0.1, decay: 0.4 },
  taco: { voice: "crunch", f: 1300, n: 20, decay: 1.1, bright: 0.3 },
  egg: {
    on: [
      { voice: "clack", f: 1700, decay: 1.2, bright: 0.2 },
      { voice: "crack", at: 0.25, f: 1900, bright: 0.3, decay: 0.8 },
    ],
    off: { voice: "clack", notes: "E6 E6", step: 0.15, decay: 1.2, bright: 0.2 },
  },
  coffee: { voice: "glass", notes: "A6 C7 A6 C7 A6", step: 0.18, decay: 0.3 },
  apple: { voice: "crunch", f: 2400, n: 12, decay: 0.9, bright: 0.6 },
  banana: { voice: "tear", f: 900, to: 1.5, decay: 1.4, bright: 0.3 },
  orange: [
    { voice: "squish", pitch: 1.3, bright: 0.9, decay: 0.7 },
    { voice: "hiss", f: 3000, decay: 0.3, vol: 0.7 },
  ],
  kiwi: { voice: "scrape", f: 1800, rate: 4, decay: 0.6, vol: 0.6 },
  pineapple: [
    { voice: "wood", f: 380, decay: 1.2 },
    { voice: "crunch", f: 1100, n: 6, decay: 0.5, vol: 0.6 },
  ],
  cherries: { voice: "pop", notes: "G5 C6", step: 0.16, decay: 1.1 },
  grapes: { voice: "drip", f: 620, n: 6, rate: 11, decay: 1.2 },
  avocado: { voice: "wood", f: 240, decay: 1.6, bright: 0.2 },

  // ---- Toys -------------------------------------------------------------------------
  bricks: { voice: "clack", notes: "D6 - D6", step: 0.08, decay: 0.6, bright: 0.3 },
  "rubber-duck": { voice: "quack", f: 250, n: 2 },
  "spinning-top": { voice: "hum", f: 300, to: 1.2, bright: 0.4, decay: 2 },
  dice: { voice: "clatter", f: 1900, n: 8, kind: "wood", decay: 1.2 },
  "newtons-cradle": { voice: "clack", notes: "C7 - C7 - C7 - C7", step: 0.2, decay: 1.4 },
  "teddy-bear": { voice: "squeak", f: 1000, to: 1.2, decay: 2.2, vol: 0.7 },
  "yo-yo": [
    { voice: "whoosh", f: 800, to: 3, decay: 0.5 },
    { voice: "whoosh", at: 0.6, f: 2400, to: 0.33, decay: 0.5 },
  ],
  "puzzle-cube": { voice: "clack", notes: "F6 - F6", step: 0.05, decay: 0.8, bright: 0.2 },
  "spring-toy": { voice: "boing", f: 110, to: 2.4, rate: 22, decay: 1.8 },
  kite: [
    { voice: "wind", f: 600, rate: 1.5, decay: 0.8 },
    { voice: "flutter", at: 0.2, f: 900, rate: 16, decay: 0.8 },
  ],
  "paper-plane": { voice: "whoosh", f: 800, to: 3, decay: 1.4, vol: 0.8 },
  "origami-crane": { voice: "flutter", f: 1500, rate: 9, decay: 1.4 },
  "balloon-dog": [
    { voice: "squeak", f: 1400, to: 0.8, decay: 1.6, vol: 0.6 },
    { voice: "crack", at: 0.3, f: 1200, bright: 0.4, decay: 1.2 },
  ],
  "soap-bubbles": { voice: "pop", notes: "C7 - E7 - - A6 D7", step: 0.12, decay: 0.4, vol: 0.6 },
  robot: [
    { voice: "ratchet", f: 1900, n: 12, rate: 12 },
    { voice: "ratchet", at: 1.0, f: 1300, n: 16, rate: 20, vol: 0.5 },
  ],

  // ---- Maths ------------------------------------------------------------------------
  lorenz: { voice: "theremin", f: 360, to: 2.2, decay: 1.2 },
  mobius: { voice: "tone", notes: "C5 E5 G5 C5 E5 G5", step: 0.16, decay: 0.5, kind: "triangle" },
  "klein-bottle": [
    { voice: "bubbles", f: 180, n: 5, decay: 0.8 },
    { voice: "wave", at: 0.3, f: 300, decay: 0.6 },
  ],
  "menger-sponge": { voice: "blip", notes: "C6 G5 C5 G4 C4", step: 0.1, decay: 1.2 },
  hypercube: { voice: "drone", f: 110, to: 2, bright: 0.8, decay: 0.8 },
  "torus-knot": { voice: "twang", f: 150, decay: 1.2 },
  gyroid: { voice: "hum", f: 70, to: 0.8, bright: 0.15, decay: 1.4 },
  mandelbulb: { voice: "drone", f: 80, to: 0.7, bright: 0.6, decay: 1 },
  sierpinski: {
    on: { voice: "bell", notes: "C6 G5 C5", step: 0.1, decay: 0.5, bright: 0.6 },
    off: { voice: "bell", notes: "C5 G5 C6", step: 0.1, decay: 0.4, bright: 0.6 },
  },
  platonic: {
    on: { voice: "tine", notes: "C5 D5 E5 G5 A5", step: 0.1, decay: 0.8 },
    off: { voice: "tine", notes: "A5 G5 E5 D5 C5", step: 0.08, decay: 0.6 },
  },
  "seashell-spiral": { voice: "wave", f: 250, decay: 1.4, vol: 0.7 },

  // ---- Objects ----------------------------------------------------------------------
  chest: {
    on: [
      { voice: "scrape", f: 380, rate: 7, decay: 1.4 },
      { voice: "glass", at: 0.6, notes: "C6 E6 G6 C7", step: 0.08, decay: 1.2 },
    ],
    off: [
      { voice: "scrape", f: 330, rate: 9, decay: 0.8 },
      { voice: "wood", at: 0.5, f: 220, decay: 1.4 },
    ],
  },
  book: {
    on: { voice: "flutter", f: 2500, rate: 6, decay: 0.8, vol: 0.7 },
    off: { voice: "flutter", f: 2000, rate: 5, decay: 0.6, vol: 0.6 },
  },
  laptop: {
    on: [
      { voice: "clatter", f: 2800, n: 12, kind: "clack", decay: 0.9, vol: 0.5 },
      { voice: "pad", at: 0.6, notes: "F4+C5+F5", step: 0, decay: 0.8 },
    ],
    off: { voice: "wood", f: 300, decay: 1.2 },
  },
  "music-box": {
    on: { voice: "tine", notes: "E6 D6 C6 D6 E6 E6 E6 - D6 D6 D6 - E6 G6 G6", step: 0.24 },
    off: { voice: "wood", f: 450, decay: 1.1, vol: 0.8 },
  },
  clock: { voice: "blip", notes: "A6 A6 - A6 A6 - A6 A6", step: 0.09, to: 1, decay: 1.4 },
  "gift-box": {
    on: [
      { voice: "tear", f: 2000, to: 1.4, decay: 0.8, vol: 0.6 },
      { voice: "brass", at: 0.4, notes: "C5 G5", step: 0.14, decay: 1.2 },
    ],
    off: { voice: "flutter", f: 1600, rate: 18, decay: 0.6, vol: 0.6 },
  },
  umbrella: {
    on: { voice: "thud", f: 160, bright: 0.7, decay: 1.2 },
    off: { voice: "flutter", f: 1200, rate: 25, decay: 0.8, vol: 0.6 },
  },
  "desk-fan": {
    on: { voice: "hum", f: 60, to: 2, bright: 0.25, decay: 1.8 },
    off: { voice: "hum", f: 120, to: 0.5, bright: 0.25, decay: 1.6 },
  },
  lamp: {
    on: { voice: "switch", f: 3200 },
    off: { voice: "switch", f: 2500 },
  },
  "potion-bottle": [
    { voice: "pop", f: 480, decay: 1.2 },
    { voice: "bubbles", at: 0.1, f: 1200, n: 12, decay: 1.2, vol: 0.6 },
  ],
  telescope: {
    on: [
      { voice: "scrape", f: 1200, rate: 30, decay: 0.8, vol: 0.6 },
      { voice: "sparkle", at: 0.6, f: 3300, n: 5 },
    ],
    off: { voice: "scrape", f: 1000, rate: 30, decay: 0.7, vol: 0.6 },
  },

  // ---- Medieval ---------------------------------------------------------------------
  "sword-in-stone": {
    on: [
      { voice: "scrape", f: 2000, rate: 60, decay: 0.8, vol: 0.6 },
      { voice: "metal", at: 0.5, f: 700, decay: 2.5, bright: 0.8 },
    ],
    off: [
      { voice: "scrape", f: 1700, rate: 60, decay: 0.6, vol: 0.6 },
      { voice: "stone", at: 0.35, f: 250, decay: 1.5 },
    ],
  },
  shield: { voice: "metal", f: 260, decay: 1.4 },
  "bow-and-target": {
    on: [
      { voice: "twang", at: 0.42, f: 130 },
      { voice: "whoosh", at: 0.45, f: 900, to: 2, decay: 0.8, vol: 0.5 },
      { voice: "wood", at: 1.0, f: 180, decay: 1.4 },
    ],
    off: { voice: "wood", f: 320, decay: 0.8, vol: 0.6 },
  },
  trebuchet: [
    { voice: "scrape", f: 280, rate: 6, decay: 1.2 },
    { voice: "whoosh", at: 0.6, f: 200, to: 5, decay: 1.2 },
  ],
  crossbow: [
    { voice: "switch", f: 2000 },
    { voice: "twang", at: 0.1, f: 180, decay: 0.6 },
    { voice: "wood", at: 0.55, f: 240, decay: 1.2 },
  ],
  "knights-helmet": {
    on: { voice: "metal", f: 520, decay: 0.5, bright: 0.6 },
    off: { voice: "metal", f: 440, decay: 0.45, bright: 0.4 },
  },
  crown: { voice: "brass", notes: "C5 C5 C5 G5 - E5 G5+C6", step: 0.14, decay: 1.2 },
  "dragon-egg": {
    on: [
      { voice: "crack", f: 1500, bright: 0.5 },
      { voice: "roarlet", at: 0.4, f: 190 },
    ],
    off: { voice: "stone", f: 380, decay: 1.2 },
  },
  "wizards-orb": [
    { voice: "whoosh", f: 400, to: 5, decay: 0.6 },
    { voice: "sparkle", at: 0.3, f: 2800, n: 9, bright: 0.8 },
  ],

  // ---- Animals ----------------------------------------------------------------------
  jellyfish: { voice: "thud", f: 55, bright: 0.1, decay: 2.2 },
  "fish-school": { voice: "whoosh", f: 700, to: 1.6, decay: 0.7, vol: 0.7 },
  butterfly: { voice: "flutter", f: 3500, rate: 14, decay: 0.8, vol: 0.4 },
  pufferfish: [
    { voice: "whoosh", f: 200, to: 2.5, decay: 0.6 },
    { voice: "engine", at: 0.5, f: 30, to: 1.3, bright: 0.2, decay: 0.5, vol: 0.6 },
  ],
  nautilus: { voice: "hollow", f: 180, decay: 2.2, bright: 0.2 },
  ladybug: {
    on: { voice: "buzz", f: 300, rate: 25, bright: 0.8, decay: 0.8, vol: 0.6 },
    off: { voice: "buzz", f: 280, rate: 25, bright: 0.8, decay: 0.4, vol: 0.5 },
  },
  snail: {
    on: { voice: "squish", pitch: 0.9, bright: 0.3, decay: 1.5 },
    off: { voice: "squish", pitch: 1.1, bright: 0.3, decay: 2.5 },
  },
  octopus: [
    { voice: "squish", pitch: 0.6, bright: 0.6, decay: 1.2 },
    { voice: "whoosh", at: 0.1, f: 250, to: 3, decay: 0.8 },
  ],
  starfish: { voice: "pop", f: 300, decay: 1.8 },
  "sea-urchin": { voice: "rattle", f: 3000, n: 14, decay: 1.3, vol: 0.6 },
  frog: { voice: "ribbit", f: 320 },
  penguin: { voice: "squawk", f: 420 },
  owl: [
    { voice: "hoot", f: 360 },
    { voice: "hoot", at: 0.55, f: 340, decay: 1.4 },
  ],

  // ---- Holidays ---------------------------------------------------------------------
  "jack-o-lantern": {
    on: [
      { voice: "whoosh", f: 200, to: 3, decay: 0.8 },
      { voice: "theremin", f: 300, to: 0.7, decay: 0.8, vol: 0.4 },
    ],
    off: { voice: "whoosh", f: 600, to: 0.3, decay: 0.6 },
  },
  snowman: [
    { voice: "drip", f: 1000, n: 2, rate: 4 },
    { voice: "crunch", at: 0.5, f: 1000, n: 16, decay: 1.8, bright: 0.2 },
  ],
  fireworks: [
    { voice: "whistle", f: 900, to: 2.2, decay: 1 },
    { voice: "kick", at: 0.82, f: 60, decay: 1.8 },
    { voice: "crackle", at: 0.9, f: 2800, n: 18, decay: 1.4 },
  ],
  "decorated-tree": {
    on: { voice: "rattle", f: 5200, n: 16, decay: 1.6, vol: 0.7 },
    off: { voice: "rattle", f: 4600, n: 6, decay: 0.8, vol: 0.5 },
  },
  "patterned-egg": { voice: "clack", f: 2100, decay: 1.6, bright: 0.3 },
  "paper-lantern": { voice: "flutter", f: 1300, rate: 7, decay: 1.8, vol: 0.5 },
  diya: {
    on: { voice: "whoosh", f: 350, to: 2.5, decay: 0.7, vol: 0.7 },
    off: { voice: "breath", f: 800, to: 0.5, decay: 0.5 },
  },
  menorah: {
    on: [
      { voice: "scrape", f: 2300, rate: 50, decay: 0.25, vol: 0.8 },
      { voice: "bell", at: 0.3, f: "G5", decay: 0.9 },
    ],
    off: { voice: "breath", f: 900, to: 0.45, decay: 0.6 },
  },

  // ---- Music ------------------------------------------------------------------------
  // The guitar strums C, G, A minor and F across its three-second strum.
  guitar: {
    voice: "pluck",
    notes: "C3+E3+G3+C4+E4 - - G2+B2+D3+G3+B3+G4 - - A2+E3+A3+C4+E4 - - F2+C3+F3+A3+C4+F4",
    step: 0.25,
    strum: 0.035,
    bright: 0.55,
    decay: 1.2,
  },
  drum: { voice: "snare", notes: "C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4 C4", step: 0.1, bright: 0.6 },
  // The mallet strikes the eight bars left to right, 0.32 s apart.
  xylophone: { voice: "bar", notes: "C5 D5 E5 F5 G5 A5 B5 C6", step: 0.3214, at: 0.3 },

  // ---- Vehicles ---------------------------------------------------------------------
  rocket: [
    { voice: "roar", f: 140, bright: 0.6, decay: 2.2 },
    { voice: "rumble", f: 60, rate: 8, decay: 1.4 },
  ],
  helicopter: {
    on: { voice: "chop", f: 450, rate: 11, decay: 1.6 },
    off: { voice: "chop", f: 350, rate: 7, decay: 1.2, vol: 0.8 },
  },
  "hot-air-balloon": { voice: "roar", f: 250, bright: 0.35, decay: 1.2 },
  "steam-train": [
    { voice: "whistle", f: 740, kind: "steam", decay: 1.1 },
    { voice: "hiss", at: 0.9, f: 1800, decay: 0.3 },
    { voice: "hiss", at: 1.25, f: 1800, decay: 0.3 },
  ],
  "ocean-liner": { voice: "horn", f: 73, kind: "ship", decay: 1.3 },
  "sports-car": { voice: "engine", f: 42, to: 3.2, bright: 0.6, decay: 1.3 },
  bus: [
    { voice: "horn", f: 330 },
    { voice: "hiss", at: 0.5, f: 2500, decay: 0.8 },
  ],
  "propeller-plane": { voice: "engine", f: 75, to: 1.3, bright: 0.8, decay: 2.2 },
  jet: [
    { voice: "roar", f: 300, bright: 0.9, decay: 2 },
    { voice: "whistle", f: 2400, to: 1.3, decay: 2, vol: 0.4 },
  ],
  sailboat: [
    { voice: "wind", f: 800, rate: 1.2, decay: 0.9 },
    { voice: "splash", at: 0.4, f: 2000, bright: 0.3, decay: 0.8, vol: 0.6 },
  ],
  submarine: { voice: "sonar", f: 1180 },
  bicycle: { voice: "bell", notes: "A6 - A6", step: 0.14, decay: 0.35, bright: 0.9 },
  tractor: { voice: "engine", f: 22, to: 1.5, bright: 0.2, decay: 1.5 },
  ufo: {
    on: { voice: "theremin", f: 600, to: 1.6 },
    off: { voice: "theremin", f: 900, to: 0.6, decay: 0.8 },
  },

  // ---- Landmarks --------------------------------------------------------------------
  "eiffel-tower": [
    { voice: "sparkle", f: 3000, n: 10, decay: 1.6 },
    { voice: "kick", at: 0.3, f: 45, decay: 1.2, vol: 0.4 },
    { voice: "kick", at: 0.7, f: 50, decay: 1.2, vol: 0.3 },
  ],
  "washington-monument": { voice: "wind", f: 400, rate: 0.3, decay: 1.3 },
  pyramids: [
    { voice: "theremin", f: 330, to: 1.26, decay: 1.2, vol: 0.7 },
    { voice: "hiss", f: 6000, decay: 1.4, vol: 0.5 },
  ],
  supertall: [
    { voice: "tone", f: "C5", to: 2, kind: "sine", decay: 2, vol: 0.5 },
    { voice: "ding", at: 0.8, f: "E6" },
  ],
  lighthouse: {
    on: { voice: "horn", f: 62, kind: "fog", decay: 1.4 },
    off: { voice: "switch", f: 1800, decay: 1.5 },
  },
  "statue-of-liberty": [
    { voice: "whoosh", f: 300, to: 3, decay: 0.8 },
    { voice: "bell", at: 0.4, f: "D5", decay: 1.1, bright: 0.4 },
  ],
  "white-house": { voice: "splash", f: 2400, bright: 0.8, decay: 1.6 },
  "leaning-tower": [
    { voice: "thud", f: 140, bright: 0.3 },
    { voice: "thud", f: 75, bright: 0.2 },
  ],
  colosseum: { voice: "cheer", f: 200, n: 10 },
  parthenon: { voice: "harp", notes: "D4+A4+D5+F5", strum: 0.05, decay: 0.8 },
  stonehenge: [
    { voice: "drone", f: 65, bright: 0.25, decay: 1.4 },
    { voice: "bell", at: 0.5, f: "D5", decay: 1.3, bright: 0.2 },
  ],
  // The Westminster quarters, simplified: four notes, then the hour bell.
  "big-ben": [
    { voice: "bell", notes: "E5 C5 D5 G4 - G4 D5 E5 C5", step: 0.34, decay: 0.8 },
    { voice: "bell", at: 3.3, f: "E3", decay: 1.3 },
  ],
  "taj-mahal": { voice: "sitar", f: "D3" },
  castle: {
    // Raising (on): chains, then the bridge thuds shut. Lowering: a fanfare.
    on: [
      { voice: "rattle", f: 1600, n: 18, decay: 2.5 },
      { voice: "wood", at: 1.4, f: 130, decay: 1.6 },
    ],
    off: [
      { voice: "rattle", f: 1500, n: 14, decay: 2 },
      { voice: "brass", at: 0.7, notes: "G4 C5 E5 G5", step: 0.14, decay: 1.4 },
    ],
  },
  pagoda: { voice: "chimes", f: 1320, n: 7, decay: 1.1 },
  windmill: [
    { voice: "scrape", f: 260, rate: 3, decay: 2.4 },
    { voice: "wind", f: 550, rate: 0.6, decay: 1.2, vol: 0.7 },
  ],
};

// The toy's sound, or null when it has none (visitors' own splats).
export function toySound(id) {
  return TOY_SOUNDS[id] || null;
}
