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

const TOY_PIANO_SONG = "C5 C5 G5 G5 A5 A5 G5 - F5 F5 E5 E5 D5 D5 C5";

export const TOY_SOUNDS = {
  // ---- Photoreal r2 (lane Photoreal r2) ----
  "heart-donut": { voice: "squish", pitch: 1.3, bright: 0.5, decay: 0.5 },
  "sushi-boat": [
    { voice: "wood", f: 420, decay: 0.4 },
    { voice: "pop", at: 0.2, f: 700, decay: 0.3 },
  ],
  "seeded-loaf": [
    { voice: "crunch", f: 1200, n: 8, decay: 0.6 },
    { voice: "thud", at: 0.3, f: 90, decay: 0.5 },
  ],
  steak: [
    { voice: "squish", pitch: 0.8, bright: 0.2, decay: 0.6 },
    { voice: "hiss", at: 0.05, f: 3500, decay: 0.5, vol: 0.4 },
  ],
  stollen: [
    { voice: "rustle", f: 2400, decay: 0.5 },
    { voice: "pluck", at: 0.15, notes: "G5 C6", step: 0.08, decay: 0.3 },
  ],
  "orange-photo": [
    { voice: "pop", f: 900, decay: 0.4 },
    { voice: "drip", at: 0.1, f: 1400, n: 2 },
  ],
  physalis: [
    { voice: "rustle", f: 3000, decay: 0.6, vol: 0.7 },
    { voice: "sparkle", at: 0.2, vol: 0.4 },
  ],
  "crystal-gem": [
    { voice: "glass", f: 1700, decay: 0.9 },
    { voice: "sparkle", at: 0.15, vol: 0.6 },
  ],
  "alum-crystal": [
    { voice: "glass", f: 1200, decay: 0.7 },
    { voice: "thud", at: 0.2, f: 140, decay: 0.4 },
  ],
  puffin: [
    { voice: "flutter", f: 600, decay: 0.5 },
    { voice: "pock", at: 0.25, f: 900 },
  ],
  "toy-trex": [
    { voice: "roar", f: 110, decay: 0.9, vol: 0.7 },
    { voice: "thud", at: 0.4, f: 60, decay: 0.6 },
  ],
  "monkey-doll": [
    { voice: "boing", f: 500, decay: 0.5 },
    { voice: "rustle", at: 0.15, f: 1800, decay: 0.4, vol: 0.5 },
  ],
  "elephant-souvenir": [
    { voice: "roar", f: 260, to: 0.7, decay: 0.8, vol: 0.6 },
    { voice: "thud", at: 0.5, f: 55, decay: 0.7 },
  ],
  "turtle-souvenir": [
    { voice: "scrape", f: 1100, decay: 0.5, vol: 0.6 },
    { voice: "thud", at: 0.25, f: 100, decay: 0.5 },
  ],
  "cave-lioness": [
    { voice: "breath", f: 300, decay: 0.8 },
    { voice: "roar", at: 0.3, f: 150, decay: 0.9, vol: 0.6 },
  ],
  "dog-plush": [
    { voice: "boing", f: 380, decay: 0.5 },
    { voice: "squish", at: 0.2, pitch: 0.9, vol: 0.5 },
  ],
  "bmx-bike": [
    { voice: "click", f: 2200, n: 10, decay: 0.5 },
    { voice: "bell", at: 0.3, f: 2400, decay: 0.8, vol: 0.5 },
  ],
  "murex-shell": [
    { voice: "glass", f: 2100, decay: 0.4 },
    { voice: "rattle", at: 0.1, f: 2600, n: 5, decay: 0.5 },
  ],
  "sunflower-photo": [
    { voice: "rustle", f: 1500, decay: 0.7 },
    { voice: "flutter", at: 0.2, f: 500, decay: 0.4, vol: 0.5 },
  ],
  "white-roses": [
    { voice: "glass", f: 1500, decay: 0.6, vol: 0.6 },
    { voice: "rustle", at: 0.1, f: 2800, decay: 0.5, vol: 0.5 },
  ],
  "bonsai-photo": [
    { voice: "rustle", f: 2000, decay: 0.8 },
    { voice: "wood", at: 0.25, f: 520, decay: 0.4, vol: 0.5 },
  ],
  "mushroom-photo": [
    { voice: "pop", f: 420, decay: 0.6 },
    { voice: "rustle", at: 0.15, f: 2200, decay: 0.6, vol: 0.5 },
  ],
  "cactus-real": [
    { voice: "pluck", notes: "D6 A5 F6", step: 0.06, decay: 0.3, bright: 0.5 },
    { voice: "rattle", at: 0.05, f: 2200, n: 8, decay: 0.6 },
  ],
  "crochet-earth": [
    { voice: "boing", f: 300, decay: 0.7, vol: 0.6 },
    { voice: "sparkle", at: 0.2, vol: 0.4 },
  ],
  "desk-globe": [
    { voice: "click", f: 1400, n: 3, decay: 0.5 },
    { voice: "whoosh", at: 0.1, f: 600, decay: 0.5, vol: 0.5 },
  ],
  "cherry-blossom-photo": [
    { voice: "flutter", f: 800, decay: 0.7, vol: 0.6 },
    { voice: "sparkle", at: 0.2, vol: 0.5 },
  ],
  "maple-tree": [
    { voice: "rustle", f: 1700, decay: 0.9 },
    { voice: "whoosh", at: 0.1, f: 900, decay: 0.5, vol: 0.4 },
  ],
  peony: [
    { voice: "rustle", f: 2600, decay: 0.5 },
    { voice: "glass", at: 0.15, f: 1100, decay: 0.5, vol: 0.5 },
  ],
  "money-tree": [
    { voice: "rustle", f: 1300, decay: 0.6 },
    { voice: "pock", at: 0.2, f: 700, vol: 0.5 },
  ],
  "knight-horse": [
    { voice: "clack", f: 1800, n: 4, decay: 0.5 },
    { voice: "bell", at: 0.25, f: 1500, decay: 0.7, vol: 0.5 },
  ],

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
    {
      voice: "sample",
      file: "raspberry-squish.mp3",
      len: 0.45,
      pitch: 1.25,
      vol: 1.1,
      fallback: { voice: "squish", pitch: 1.4 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 0.55,
      pitch: 2.6,
      vol: 0.8,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 0.68,
      pitch: 2.9,
      vol: 0.7,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 0.8,
      pitch: 2.4,
      vol: 0.75,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 0.97,
      pitch: 2.8,
      vol: 0.65,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.12,
      pitch: 2.5,
      vol: 0.6,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.33,
      pitch: 3,
      vol: 0.5,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.55,
      pitch: 2.6,
      vol: 0.45,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.8,
      pitch: 2.8,
      vol: 0.35,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: "raspberry-squish.mp3",
      at: 2.25,
      len: 0.35,
      pitch: 1.5,
      vol: 0.5,
      fallback: { voice: "squish", pitch: 1.6, vol: 0.4 },
    },
  ],
  blackberry: [
    {
      voice: "sample",
      file: "raspberry-squish.mp3",
      len: 0.55,
      pitch: 0.95,
      vol: 1.2,
      fallback: { voice: "squish", pitch: 0.8 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 0.85,
      pitch: 2.1,
      vol: 0.85,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 0.93,
      pitch: 2.3,
      vol: 0.75,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1,
      pitch: 1.9,
      vol: 0.8,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.08,
      pitch: 2.2,
      vol: 0.65,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.17,
      pitch: 2,
      vol: 0.55,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: ["raspberry-land-1.mp3", "raspberry-land-2.mp3"],
      at: 1.27,
      pitch: 2.4,
      vol: 0.45,
      fallback: { voice: "thud", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: "raspberry-squish.mp3",
      at: 1.75,
      len: 0.4,
      pitch: 1.15,
      vol: 0.55,
      fallback: { voice: "squish", pitch: 1, vol: 0.4 },
    },
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
    {
      voice: "sample",
      file: "star-cookie-snap.mp3",
      vol: 1.5,
      fallback: { voice: "crack", f: 2000 },
    },
    {
      voice: "sample",
      file: "star-cookie-crumble.mp3",
      at: 0.12,
      len: 0.8,
      vol: 1.1,
      fallback: { voice: "crunch", n: 6 },
    },
    {
      voice: "sample",
      file: "star-cookie-crumble.mp3",
      at: 1.65,
      from: 0.2,
      len: 0.8,
      pitch: 1.15,
      vol: 0.5,
      fallback: { voice: "crunch", n: 4, vol: 0.4 },
    },
  ],
  tomatoes: [
    { voice: "thud", at: 0.4, f: 110, bright: 0.2 },
    { voice: "thud", at: 0.62, f: 125, bright: 0.2, vol: 0.7 },
    { voice: "thud", at: 0.85, f: 140, bright: 0.2, vol: 0.6 },
    { voice: "thud", at: 1.1, f: 150, bright: 0.2, vol: 0.45 },
  ],
  // Modeled on the Mandelbulb (the owner likes its sound): a low drone and a
  // ratchet as the rings start to turn, and again as they lock back.
  mandeltorus: [
    { voice: "drone", f: 62, bright: 0.35, decay: 1.9, vol: 0.5 },
    { voice: "ratchet", at: 0.1, f: 1650, n: 7, rate: 9 },
    { voice: "ratchet", at: 1.65, f: 1400, n: 7, rate: 8 },
  ],
  basket: [
    { voice: "rattle", f: 1600, n: 6, decay: 0.8, vol: 0.6 },
    { voice: "clatter", at: 0.5, f: 2200, n: 14, kind: "shell", decay: 2.4 },
  ],
  "rubber-duck-real": { voice: "squeak", f: 2300, to: 1.25, decay: 1.4 },
  "garden-gnome": [
    { voice: "thud", at: 0.4, f: 120, bright: 0.25, decay: 0.8, vol: 0.9 },
    {
      voice: "sample",
      file: "lantern-match.mp3",
      at: 0.38,
      from: 0.08,
      len: 0.7,
      vol: 0.5,
      fallback: { voice: "roar", f: 200, decay: 0.4, vol: 0.4 },
    },
    { voice: "roar", at: 0.42, f: 220, bright: 0.3, decay: 0.5, vol: 0.35 },
  ],
  "wooden-elephant": [
    { voice: "wood", f: 520, decay: 0.8, vol: 0.5 },
    {
      voice: "sample",
      file: "wooden-elephant-trumpet.mp3",
      at: 0.33,
      vol: 0.85,
      fallback: { voice: "brass", f: "A4", decay: 2 },
    },
  ],
  // SAL-VE, A-MI-CE: one murmur per syllable, as the jaw drops.
  "marble-bust": [
    { voice: "scrape", f: 500, rate: 13, decay: 1.2 },
    { voice: "murmur", at: 0.62, notes: "A2 G2", step: 0.2, decay: 0.3 },
    { voice: "murmur", at: 1.1, notes: "B2 A2 E2", step: 0.2, decay: 0.3 },
  ],
  // Four strums (down, down, up, down) on the ukulele's own tuning: C, F, G, C.
  ukulele: { voice: "nylon", notes: "G4+C4+E4+C5 - A4+C4+F4+A4 B4+D4+G4+B4 - G4+C4+E4+C5", step: 0.15, strum: 0.03, bright: 0.45, decay: 0.9 }, // prettier-ignore
  "alarm-clock": {
    voice: "sample",
    file: "alarm-clock-bell.mp3",
    len: 2.3,
    vol: 1.4,
    fallback: { voice: "bell", notes: "A5 C6 A5 C6 A5 C6 A5 C6", step: 0.06, decay: 0.3 },
  },
  "vintage-camera": {
    voice: "sample",
    file: "vintage-camera-flash.mp3",
    from: 0.03,
    vol: 0.8,
    fallback: { voice: "switch", f: 3600 },
  },
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
    { voice: "scrape", f: 1100, rate: 3, decay: 1.4, vol: 0.5 },
    {
      voice: "sample",
      file: "raspberry-squish.mp3",
      at: 0.15,
      len: 0.5,
      pitch: 0.5,
      vol: 0.3,
      fallback: { voice: "squish", pitch: 0.5, vol: 0.3 },
    },
    { voice: "thud", at: 2.5, f: 180, vol: 0.45 },
  ],
  pomegranate: [
    { voice: "crack", f: 1600, bright: 0.4 },
    { voice: "clatter", at: 0.45, f: 2600, n: 14, kind: "clack", decay: 1.1 },
  ],
  lantern: {
    on: [
      {
        voice: "sample",
        file: "lantern-match.mp3",
        vol: 0.9,
        fallback: { voice: "crack", f: 1800 },
      },
      { voice: "roar", at: 0.25, f: 240, bright: 0.3, decay: 0.6, vol: 0.35 },
    ],
    off: {
      voice: "sample",
      file: "lantern-blow.mp3",
      vol: 0.6,
      fallback: { voice: "breath", f: 900, to: 0.6, decay: 0.5, vol: 0.7 },
    },
  },
  "cat-statue": [
    { voice: "scrape", f: 520, rate: 9, decay: 0.8, vol: 0.45 },
    {
      voice: "sample",
      file: "cat-statue-meow.mp3",
      at: 0.42,
      vol: 0.7,
      fallback: { voice: "mew", f: 700 },
    },
  ],
  // Tap to play the Opera Game (each move clacks as it lands, from the recipe);
  // tap again and the pieces slide home.
  // Sound B: pieces set down on a felted wooden board (the moves are cues).
  "chess-set": {
    on: { voice: "sample", file: "chess-set-move.mp3", vol: 1.3, fallback: { voice: "chessmove", f: 520 } }, // prettier-ignore
    off: { voice: "scrape", f: 900, rate: 6, decay: 1.4, vol: 0.5 },
  },
  "horse-statue": [
    { voice: "scrape", f: 420, rate: 8, decay: 0.9, vol: 0.45 },
    {
      voice: "sample",
      file: "horse-statue-whinny.mp3",
      at: 0.35,
      vol: 0.7,
      fallback: { voice: "whinny", f: 1150 },
    },
    { voice: "thud", at: 2.3, f: 110, bright: 0.3, decay: 0.7, vol: 0.7 },
  ],
  "pencil-real": [
    { voice: "wood", f: 1500, decay: 0.5, vol: 0.8 },
    { voice: "scrape", at: 0.05, f: 900, rate: 7, decay: 4.2, vol: 0.45 },
  ],
  // Sound C (his note of October 2: no drum, no coin): one real recording of an empty can rolling
  // on a hard floor, slowing and settling (CC0, cower on Freesound).
  "tin-can-real": {
    voice: "sample",
    file: "tin-can-real-roll.mp3",
    from: 0.04,
    vol: 0.9,
    fallback: { voice: "scrape", f: 2000, rate: 20, decay: 2, vol: 0.3 },
  },
  // ---- Shapes -----------------------------------------------------------------------
  // A soft pop onto its edge, a roll that circles faster as it leans lower, and a settle.
  torus: [
    { voice: "thud", f: 120, bright: 0.2, vol: 0.55 },
    { voice: "rumble", at: 0.35, f: 150, rate: 5, decay: 1.4, vol: 0.32 },
    { voice: "rumble", at: 1.05, f: 175, rate: 8, decay: 1.3, vol: 0.34 },
    { voice: "rumble", at: 1.75, f: 205, rate: 12, decay: 1.0, vol: 0.36 },
    { voice: "rumble", at: 2.35, f: 235, rate: 18, decay: 0.7, vol: 0.36 },
    { voice: "thud", at: 3.05, f: 100, bright: 0.25, vol: 0.65 },
  ],
  blob: [
    { voice: "gloop", f: 140, decay: 1.2 },
    { voice: "gloop", at: 1.8, f: 110, decay: 0.9, vol: 0.7 },
  ],
  // Sound C (his note of October 2: too wet): a soft, dry tear as it pulls apart (a real bread
  // tear, CC0, spanrucker on Freesound), and a soft pat as the halves meet again (1.62 s).
  donut: [
    {
      voice: "sample",
      file: "donut-tear.mp3",
      pitch: 0.85,
      vol: 0.9,
      fallback: { voice: "rustle", f: 900, n: 6, decay: 0.4, vol: 0.4 },
    },
    { voice: "thud", at: 1.62, f: 170, bright: 0.15, decay: 0.4, vol: 0.3 },
  ],
  // Sound C (his note of October 2: no buzz; like jelly wiggling): a real jelly wobbling (CC0,
  // lolamadeus on Freesound), then a softer wobble as it settles.
  knot: [
    {
      voice: "sample",
      file: "knot-jelly.mp3",
      vol: 1.1,
      fallback: { voice: "boing", f: 150, to: 1.1, rate: 8, decay: 1.2 },
    },
    {
      voice: "sample",
      file: "knot-jelly.mp3",
      at: 1.2,
      from: 0.05,
      len: 1,
      pitch: 0.9,
      vol: 0.6,
      fallback: { voice: "boing", f: 140, to: 1.05, rate: 7, decay: 1, vol: 0.6 },
    },
  ],
  planet: [
    { voice: "wind", f: 300, rate: 0.4, decay: 1.6, vol: 0.45 },
    { voice: "whoosh", at: 0.25, f: 180, to: 1.3, decay: 1.2, vol: 0.3 },
  ],
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
  "tennis-ball": {
    voice: "sample",
    file: "tennis-ball-slam.mp3",
    vol: 1.1,
    fallback: { voice: "pock", f: 500, bright: 0.2 },
  },
  // The pitch's whoosh, then the crack of the bat as it comes back.
  baseball: [
    { voice: "whoosh", at: 0.24, f: 900, to: 3, decay: 0.5, vol: 0.4 },
    {
      voice: "sample",
      file: "baseball-bat.mp3",
      at: 0.82,
      vol: 1.6,
      fallback: { voice: "crack", f: 2400, bright: 0.8 },
    },
  ],
  // The underhand release, then a muffled thud where it lands far off.
  softball: [
    { voice: "whoosh", at: 0.52, f: 500, to: 2, decay: 0.6, vol: 0.3 },
    {
      voice: "sample",
      file: "tennis-ball-slam.mp3",
      at: 1.4,
      pitch: 0.6,
      vol: 1.1,
      fallback: { voice: "thud", f: 130, bright: 0.25, decay: 0.8 },
    },
  ],
  // A soft punch up, then the plasticky boing as it lands.
  "beach-ball": [
    {
      voice: "sample",
      file: "beach-ball-bounce.mp3",
      len: 0.3,
      pitch: 1.35,
      vol: 0.6,
      fallback: { voice: "slap", f: 600, vol: 0.35 },
    },
    {
      voice: "sample",
      file: "beach-ball-bounce.mp3",
      at: 1.42,
      vol: 0.9,
      fallback: { voice: "thud", f: 200, vol: 0.6 },
    },
  ],
  "golf-ball": [
    { voice: "clack", f: 3400, decay: 1.4 },
    { voice: "whoosh", f: 1200, to: 3, decay: 0.3, vol: 0.5 },
  ],
  "rugby-ball": [
    { voice: "thud", f: 85, bright: 0.4, decay: 1.1 },
    { voice: "thud", at: 1.45, f: 95, bright: 0.3, vol: 0.7 },
    { voice: "thud", at: 2.05, f: 110, bright: 0.3, vol: 0.4 },
  ],
  // A soft slap for the set, a hard one for the spike.
  volleyball: [
    { voice: "slap", f: 1400, decay: 1, vol: 0.45 },
    { voice: "slap", at: 0.69, f: 1700, decay: 1.2 },
  ],
  // A light toss, then the splash as it plunges in.
  "water-polo-ball": [
    { voice: "slap", f: 800, vol: 0.3 },
    { voice: "splash", at: 0.55, f: 1300, bright: 0.6 },
  ],
  // The flick's tik (each bounce after it is a cue from the recipe).
  "ping-pong-ball": { voice: "pock", f: 2000, bright: 0.7, decay: 0.5 },
  "cricket-ball": [
    { voice: "wood", f: 900, decay: 0.8 },
    { voice: "pock", f: 1100, decay: 0.8 },
  ],
  // The roll's rumble, then the pins crash far off.
  "bowling-ball": [
    {
      voice: "sample",
      file: "bowling-ball-roll.mp3",
      at: 0.32,
      from: 0.1,
      len: 1.75,
      vol: 0.9,
      fallback: { voice: "rumble", f: 70, rate: 12, decay: 0.9 },
    },
    {
      voice: "sample",
      file: "bowling-ball-pins.mp3",
      at: 2.02,
      vol: 0.8,
      fallback: { voice: "clatter", f: 1100, n: 10, kind: "wood" },
    },
  ],
  "pool-ball": {
    voice: "sample",
    file: "pool-ball-cue.mp3",
    vol: 1.1,
    fallback: { voice: "clack", f: 1800 },
  },
  // The paddle's hollow pop, and air whistling through the holes.
  pickleball: { voice: "pock", f: 1250, bright: 0.2, decay: 1.3 },
  // Lifted, then the rubbery bwong as it is slammed down.
  dodgeball: [
    { voice: "whoosh", f: 400, to: 2, decay: 0.3, vol: 0.25 },
    { voice: "boing", at: 0.43, f: 150, to: 0.7, rate: 20, decay: 0.7 },
  ],
  // A heave, then the heavy thud.
  "medicine-ball": [
    { voice: "breath", f: 500, to: 0.8, decay: 0.8, vol: 0.25 },
    { voice: "thud", at: 0.81, f: 55, bright: 0.15, decay: 1.6 },
  ],
  "lacrosse-ball": { voice: "pock", f: 620, bright: 0.8 },
  // A racket's tap, then the dead, low thock of a cold squash ball.
  "squash-ball": [
    { voice: "pock", f: 700, bright: 0.3, decay: 0.5, vol: 0.4 },
    { voice: "pock", at: 0.2, f: 380, bright: 0.1, decay: 1.2 },
  ],
  "bouncy-ball": { voice: "boing", f: 260, to: 2.6, rate: 16 },
  // Sound A: the real glass marble rolling (Sound C: about 6 dB quieter, his note of October 2).
  marble: {
    voice: "sample",
    file: "marble-roll.mp3",
    len: 2.4,
    vol: 0.4,
    fallback: { voice: "rumble", f: 380, rate: 28, decay: 1.2, vol: 0.09 },
  },

  "hockey-puck": [
    { voice: "slap", f: 1700, vol: 0.9 },
    { voice: "scrape", at: 0.08, f: 3000, rate: 40, decay: 1.9, vol: 0.5 },
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
  // The flare's roar, and the whoosh as its top breaks away (1.4 s).
  sun: [
    { voice: "roar", f: 90, bright: 0.25, decay: 1.4 },
    { voice: "whoosh", at: 1.4, f: 160, to: 4, decay: 2.4, vol: 0.8 },
  ],
  // A chord rising as the planets swing into line, a shimmer at the eclipse.
  "solar-system": [
    { voice: "whoosh", f: 200, to: 1.8, decay: 1.8, vol: 0.45 },
    { voice: "roar", at: 3.1, f: 160, bright: 0.3, decay: 1.15, vol: 0.45 },
    { voice: "whoosh", at: 3.9, f: 300, to: 0.6, decay: 1, vol: 0.4 },
  ],
  // A bright tone as it spins, then the sizzle of the day side's heat.
  mercury: [
    { voice: "whoosh", f: 400, to: 1.5, decay: 0.6, vol: 0.35 },
    { voice: "roar", at: 0.1, f: 120, bright: 0.35, decay: 2.2, vol: 0.6 },
    { voice: "sizzle", at: 0.25, f: 2600, decay: 1.8, vol: 0.3 },
  ],
  venus: { voice: "wind", f: 260, rate: 0.4, decay: 2.4 },
  // Surf and wind through the day, a soft chime as the city lights come on.
  earth: [
    { voice: "wave", f: 500, decay: 1.4, vol: 0.6 },
    { voice: "wind", f: 700, rate: 0.6, decay: 1.4, vol: 0.18 },
    { voice: "ding", at: 1.6, f: "E6", decay: 1.2, vol: 0.5 },
  ],
  // A hollow chime at full moon, a lower one at new moon (2.8 s).
  // The descent engine's rumble and hiss (the touchdown thud, the flag's
  // clink and the lift-off roar are cues from the drive).
  moon: {
    on: [
      { voice: "rumble", f: 55, rate: 3, decay: 1.7, vol: 0.8 },
      { voice: "hiss", f: 2600, decay: 1.5, vol: 0.25 },
    ],
    off: { voice: "breath", f: 700, to: 0.8, decay: 0.6, vol: 0.5 },
  },
  mars: [
    { voice: "hiss", f: 1500, decay: 2.4, vol: 0.45 },
    { voice: "wind", at: 0.3, f: 450, rate: 1.2, decay: 2, vol: 0.45 },
  ],
  jupiter: { voice: "drone", f: 44, bright: 0.2, decay: 1.8 },
  // A shimmer for each ripple across the rings.
  saturn: [
    { voice: "whoosh", f: 2500, to: 1.5, decay: 1, vol: 0.35 },
    { voice: "whoosh", at: 0.8, f: 3000, to: 1.4, decay: 0.9, vol: 0.28 },
    { voice: "sparkle", at: 0.1, f: 4200, n: 5, decay: 1.4, vol: 0.2 },
  ],
  uranus: [
    { voice: "rumble", f: 60, rate: 4, decay: 1.2, vol: 0.5 },
    { voice: "rumble", at: 2.05, f: 55, rate: 4, decay: 1.2, vol: 0.45 },
  ],
  neptune: { voice: "wind", f: 330, rate: 0.9, decay: 2.4 },
  // Sound C: the aurora's air, much lower and gentler (his note: less dramatic wind).
  "aurora-planet": [
    { voice: "whoosh", f: 300, to: 1.05, decay: 2.4, vol: 0.16 },
    { voice: "breath", at: 0.1, f: 600, to: 0.85, decay: 2, vol: 0.12 },
  ],
  // The crack, a boom as it falls apart, and a knock as the pieces meet again.
  asteroid: [
    { voice: "crack", f: 900, bright: 0.25, vol: 0.9 },
    {
      voice: "sample",
      file: "meteor-boom.mp3",
      len: 0.7,
      pitch: 1.5,
      vol: 0.45,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    {
      voice: "sample",
      file: "asteroid-crumble.mp3",
      at: 0.45,
      len: 1.9,
      vol: 0.8,
      fallback: { voice: "crunch", f: 900, n: 10 },
    },
    {
      voice: "sample",
      file: "asteroid-crumble.mp3",
      at: 2.9,
      from: 1.2,
      len: 1.4,
      pitch: 0.8,
      vol: 0.35,
    },
    { voice: "stone", at: 4.5, f: 260, decay: 1.2 },
  ],
  comet: [
    {
      voice: "sample",
      file: "comet-fire.mp3",
      at: 0.1,
      pitch: 0.9,
      vol: 0.85,
      fallback: { voice: "roar", f: 180, decay: 2 },
    },
    { voice: "roar", at: 0.3, f: 150, bright: 0.3, decay: 2.8, vol: 0.35 },
  ],
  // Sound A: the streak's fire; Sound C: it bursts with the star's own burst (his note of October
  // 2), in time with the fireball at 0.38 s, over a short crack; then the next one streaks in.
  meteor: [
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      len: 0.45,
      vol: 0.8,
      fallback: { voice: "roar", f: 300, decay: 0.3 },
    },
    {
      voice: "sample",
      file: "meteor-boom.mp3",
      at: 0.37,
      len: 0.5,
      vol: 0.55,
      fallback: { voice: "thud", f: 70, decay: 0.6 },
    },
    {
      voice: "sample",
      file: "supernova-boom.mp3",
      at: 0.37,
      from: 0.2,
      len: 2.2,
      pitch: 1.1,
      vol: 0.95,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 3.4,
      len: 0.6,
      pitch: 0.9,
      vol: 0.5,
      fallback: { voice: "roar", f: 280, decay: 0.4, vol: 0.6 },
    },
  ],
  // Swelling to a giant and the whoosh as it puffs off its shell; the
  // recipe rings a bell when the new star lights (6.6 s).
  star: [
    { voice: "roar", f: 90, bright: 0.2, decay: 2, vol: 0.45 },
    {
      voice: "sample",
      file: "meteor-boom.mp3",
      at: 2.1,
      len: 0.6,
      pitch: 0.6,
      vol: 0.35,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    {
      voice: "sample",
      file: "meteor-boom.mp3",
      at: 2.7,
      len: 0.6,
      pitch: 0.62,
      vol: 0.35,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    {
      voice: "sample",
      file: "supernova-boom.mp3",
      at: 3.6,
      len: 2.2,
      pitch: 1.1,
      vol: 0.9,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    { voice: "roar", at: 6.5, f: 200, bright: 0.3, decay: 1.2, vol: 0.3 },
  ],
  // It hums as it spins up; the recipe adds a tick at each flash.
  pulsar: [
    { voice: "roar", f: 70, bright: 0.2, decay: 3.5, vol: 0.5 },
    {
      voice: "sample",
      file: "supernova-boom.mp3",
      len: 1.5,
      pitch: 0.5,
      vol: 0.35,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
  ],
  // The fall, and a deep boom as the star plunges in (3.2 s).
  "black-hole": [
    { voice: "roar", f: 50, bright: 0.15, decay: 2.4, vol: 0.55 },
    { voice: "whoosh", at: 1.8, f: 150, to: 3, decay: 1.2, vol: 0.35 },
    {
      voice: "sample",
      file: "supernova-boom.mp3",
      at: 3.15,
      len: 2.6,
      pitch: 0.55,
      vol: 0.85,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    { voice: "whoosh", at: 3.5, f: 400, to: 0.4, decay: 1.8, vol: 0.3 },
  ],
  // Sound C: a faint, soft air as the stars swarm (his note: less wind, less overwhelming), no
  // hiss.
  "star-cluster": [
    { voice: "breath", f: 700, to: 1.1, decay: 1.2, vol: 0.13 },
    { voice: "breath", at: 1.4, f: 800, to: 0.8, decay: 1.4, vol: 0.11 },
  ],
  // A pad, and a shimmer as the shock reaches the ring (1.7 s).
  "planetary-nebula": [
    {
      voice: "sample",
      file: "meteor-boom.mp3",
      len: 0.8,
      pitch: 1.3,
      vol: 0.5,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    { voice: "whoosh", at: 0.05, f: 250, to: 2, decay: 1.2, vol: 0.45 },
    {
      voice: "sample",
      file: "supernova-boom.mp3",
      at: 1.7,
      len: 1.8,
      pitch: 0.8,
      vol: 0.45,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
  ],
  // A ping for each new star as it lights.
  nebula: [
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 0.4,
      len: 0.45,
      pitch: 1,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 0.76,
      len: 0.45,
      pitch: 0.85,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 1.12,
      len: 0.45,
      pitch: 1.15,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 1.48,
      len: 0.45,
      pitch: 0.9,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 1.84,
      len: 0.45,
      pitch: 1.1,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 2.2,
      len: 0.45,
      pitch: 0.8,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
    {
      voice: "sample",
      file: "meteor-fire.mp3",
      at: 2.56,
      len: 0.45,
      pitch: 1.05,
      vol: 0.55,
      fallback: { voice: "roar", f: 260, bright: 0.3, decay: 0.35, vol: 0.4 },
    },
  ],
  supernova: [
    {
      voice: "sample",
      file: "supernova-boom.mp3",
      vol: 1.1,
      fallback: { voice: "rumble", f: 50, rate: 4, decay: 1.5, vol: 0.6 },
    },
    { voice: "roar", f: 110, bright: 0.5, decay: 2.2, vol: 0.55 },
  ],
  "spiral-galaxy": [
    { voice: "drone", f: 62, bright: 0.45, decay: 1.8 },
    { voice: "whoosh", at: 0.3, f: 120, to: 3, decay: 2.2, vol: 0.6 },
  ],

  // ---- Tiny things ------------------------------------------------------------------
  // The spikes ripple, two copies bud off (0.9 s, 1.05 s) and fade (2.3 s).
  virus: [
    { voice: "flutter", f: 900, rate: 18, decay: 1.6, vol: 0.5 },
    { voice: "squish", at: 0.55, pitch: 1.6, decay: 0.6 },
    { voice: "pop", at: 0.9, f: 600 },
    { voice: "pop", at: 1.05, f: 720, vol: 0.8 },
  ],
  bacteriophage: [
    { voice: "boing", f: 120, to: 0.5, rate: 30, decay: 0.5 },
    { voice: "clack", f: 1300, decay: 1.5 },
    { voice: "squish", at: 0.5, pitch: 1.5, bright: 0.8 },
  ],
  // Pinches in, the daughters part (1.45 s), then slide back and merge (3.4 s).
  bacterium: [
    { voice: "gloop", f: 160, decay: 1.2, vol: 0.6 },
    { voice: "pop", at: 1.45, f: 380, decay: 1.4 },
    { voice: "squish", at: 3.4, pitch: 0.9, decay: 0.8, vol: 0.6 },
  ],
  // Curls into a sickle, then relaxes back (2.5 s).
  "red-blood-cell": [
    { voice: "squish", pitch: 0.7, bright: 0.2, decay: 1.4, vol: 0.8 },
    { voice: "gloop", at: 2.5, f: 140, decay: 0.6, vol: 0.5 },
  ],
  neuron: [
    {
      voice: "sample",
      file: "neuron-arc.mp3",
      len: 1.5,
      vol: 0.8,
      fallback: { voice: "zap", f: 2400, to: 0.1 },
    },
    { voice: "sample", file: "neuron-arc.mp3", at: 1.6, from: 0.5, len: 0.35, vol: 1.3 },
  ],
  // The wave spreads out along the arms; the vessel swells (1.8 s).
  astrocyte: [
    { voice: "breath", f: 1200, to: 0.5, decay: 2.2, vol: 0.45 },
    { voice: "wave", at: 1.8, f: 180, decay: 0.8, vol: 0.45 },
  ],
  // The nucleus splits, the cell pinches in two (2.1 s), then rejoins (3.2 s).
  "animal-cell": [
    { voice: "gloop", f: 180, decay: 1.4 },
    { voice: "pop", at: 2.1, f: 450 },
    { voice: "gloop", at: 3.2, f: 140, decay: 1.2, vol: 0.7 },
  ],
  // Sound A: a real zipper. Sound C (his note of October 2: in sync): the zip as the strands fly
  // open (fast at first, most of it in the first second), then a slower zip as it closes back up
  // (3.3 s to 5.2 s).
  dna: [
    {
      voice: "sample",
      file: "dna-zipper.mp3",
      at: 0.02,
      from: 0.45,
      len: 0.95,
      pitch: 1.05,
      vol: 0.8,
      fallback: { voice: "tear", f: 900, decay: 0.9 },
    },
    {
      voice: "sample",
      file: "dna-zipper.mp3",
      at: 3.45,
      from: 0.35,
      len: 1.15,
      pitch: 0.72,
      vol: 0.55,
      fallback: { voice: "tear", f: 700, decay: 1.2, vol: 0.6 },
    },
  ],
  // A bacterium wriggles in, is gulped (2.1 s) and digested (3.6 s).
  "white-blood-cell": [
    { voice: "squish", pitch: 0.6, bright: 0.2, decay: 1.6, vol: 0.5 },
    { voice: "gloop", at: 2.1, f: 110, decay: 0.7 },
    { voice: "sizzle", at: 3.6, f: 2500, decay: 1, vol: 0.2 },
  ],
  // Reaches out, sweeps twice (0.9 s, 2.1 s), draws back.
  microglia: [
    { voice: "scrape", f: 2600, rate: 10, decay: 1.4, vol: 0.4 },
    { voice: "patter", at: 0.9, f: 3200, n: 12, decay: 0.7, vol: 0.5 },
    { voice: "patter", at: 2.1, f: 3000, n: 12, decay: 0.7, vol: 0.5 },
  ],
  // A glint runs across, the halves part (0.8 s) and close again (4 s).
  diatom: [
    { voice: "sparkle", f: 5000, n: 5, decay: 0.6, vol: 0.5 },
    { voice: "glass", at: 0.8, f: 3000, decay: 0.4 },
    { voice: "glass", at: 4, f: 2400, decay: 0.5, vol: 0.7 },
  ],
  tardigrade: { voice: "squeak", notes: "C7 - D7", step: 0.18, decay: 0.5, vol: 0.6 },
  // Sound C: the puff and its tiny chirp, quieter (his note of October 2).
  pollen: [
    { voice: "breath", at: 0.18, f: 1300, to: 0.5, decay: 0.6, vol: 0.6 },
    { voice: "chirp", at: 0.4, f: 3200, n: 1, vol: 0.55 },
  ],
  // The arms melt back, then a new flake grows out (1.2 s).
  snowflake: [
    { voice: "sparkle", f: 3000, n: 5, decay: 0.8, bright: 0.5, vol: 0.5 },
    { voice: "glass", at: 1.2, notes: "E6 G6 B6 D7 E7", step: 0.45, decay: 0.5, vol: 0.45 },
  ],
  // The fibres pull the chromatids apart (0.5 s); they rejoin (3.9 s).
  chromosome: [
    {
      voice: "sample",
      file: "protein-velcro.mp3",
      at: 0.45,
      pitch: 0.6,
      vol: 0.6,
      fallback: { voice: "tear", f: 500, decay: 0.8 },
    },
    { voice: "squish", at: 0.5, pitch: 0.8, bright: 0.2, decay: 0.8, vol: 0.5 },
    { voice: "squish", at: 3.9, pitch: 0.9, bright: 0.2, decay: 0.6, vol: 0.45 },
  ],
  // Sound C (his note of October 2: the powerhouse of the cell, no motor or buzz): a real gas
  // furnace lighting with a soft whoomp and burning with a warm roar as it powers up (CC0, ldezem
  // on Freesound), and the ATP sparks' soft pops. The Sound Board has the candidates.
  mitochondrion: [
    {
      voice: "sample",
      file: "mitochondrion-furnace.mp3",
      vol: 1,
      fallback: { voice: "roar", f: 160, bright: 0.2, decay: 1.6, vol: 0.4 },
    },
    { voice: "pop", at: 0.95, f: 900, vol: 0.3 },
    { voice: "pop", at: 1.3, f: 1000, vol: 0.27 },
    { voice: "pop", at: 1.65, f: 1100, vol: 0.24 },
  ],
  // Sound C (his note of October 2: swimming, not a shuffle or wind): a hand moving gently through
  // water (CC0, Daen23 on Freesound), soft strokes through its loop.
  paramecium: {
    voice: "sample",
    file: "paramecium-swim.mp3",
    vol: 1,
    fallback: [
      { voice: "swim", at: 0.1, f: 520, n: 3, rate: 2.6, vol: 0.55 },
      { voice: "swim", at: 1.25, f: 480, n: 5, rate: 2.4, vol: 0.7 },
    ],
  },
  // Sound C (his note of October 2: louder, a rubbery jelly bounce like the gummy bear's, with no
  // whistle or ding): a soft squelch and a low rubbery wobble as each pseudopod pushes out (0.05 s,
  // 2.5 s).
  amoeba: [
    { voice: "squish", pitch: 0.55, bright: 0.15, decay: 1.4, vol: 0.9 },
    { voice: "boing", at: 0.08, f: 140, to: 1.15, rate: 8, decay: 1.4, vol: 1.2 },
    { voice: "squish", at: 2.5, pitch: 0.5, bright: 0.15, decay: 1.4, vol: 0.8 },
    { voice: "boing", at: 2.58, f: 128, to: 1.12, rate: 7, decay: 1.4, vol: 1.1 },
  ],

  // ---- Atoms ------------------------------------------------------------------------
  // Up as the photon is taken in (0.45 s), down as it is given out (3 s).
  orbital: [
    {
      voice: "sample",
      file: "neuron-arc.mp3",
      at: 0.45,
      len: 0.3,
      vol: 0.7,
      fallback: { voice: "zap", f: 1200, to: 0.5 },
    },
    { voice: "whoosh", at: 0.45, f: 600, to: 1.6, decay: 0.8, vol: 0.3 },
    { voice: "sample", file: "neuron-arc.mp3", at: 3, from: 0.4, len: 0.35, pitch: 1.2, vol: 0.8 },
    { voice: "whoosh", at: 3, f: 1200, to: 0.6, decay: 0.7, vol: 0.3 },
  ],
  // Sound C: the periodic table's atom sound, which he likes (October 2): the electrons' soft
  // electric blip as they speed up, and the ping as they blur into rings. No motor.
  atom: [
    { voice: "blip", at: 0.05, f: 660, to: 2, decay: 0.5, vol: 0.5 },
    { voice: "ding", at: 1.45, f: 1700, decay: 0.45, vol: 0.55 },
  ],
  // Sound C (his note of October 2: no wind, not building blocks): soft little ticks of the atoms
  // jostling on their bonds as it heats, thinning out as it cools and settles.
  molecule: [
    0, 0.12, 0.2, 0.31, 0.39, 0.52, 0.63, 0.78, 0.94, 1.15, 1.38, 1.7, 2.05, 2.5, 3.05,
  ].map((at, i) => ({
    voice: "clack",
    at,
    f: Math.round(1900 + 700 * ((i * 0.618) % 1)),
    decay: 0.7,
    bright: 0.2,
    vol: Math.round((0.32 - 0.015 * i) * 1000) / 1000,
  })),
  // An airy rush as the pieces fly apart, and soft clicks as they lock back.
  protein: [
    {
      voice: "sample",
      file: "protein-velcro.mp3",
      vol: 0.8,
      fallback: { voice: "tear", f: 900, decay: 0.8 },
    },
    { voice: "whoosh", at: 0.1, f: 260, to: 2, decay: 1.2, vol: 0.4 },
    { voice: "sample", file: "protein-velcro.mp3", at: 3.3, pitch: 1.3, vol: 0.4 },
    { voice: "thud", at: 3.45, f: 170, bright: 0.3, decay: 0.6, vol: 0.5 },
  ],
  // Sound A: the light metallic chime of the lattice's links; Sound C (his note of October 2: fine,
  // could be better): one cleaner, softer chime with a faint glassy ring, no rattle after.
  "crystal-lattice": [
    {
      voice: "sample",
      file: "crystal-lattice-chain.mp3",
      at: 0.3,
      pitch: 0.95,
      vol: 0.55,
      fallback: { voice: "clatter", f: 1400, n: 8 },
    },
    { voice: "glass", at: 0.32, f: 2637, decay: 0.8, vol: 0.18 },
  ],
  // Sound C: the atom's whoosh much quieter (his note of October 2); a faint tick for each proton
  // and neutron as it packs into the nucleus comes from the recipe (src/packs/chemistry.js), in
  // sync.
  "periodic-table": {
    on: [
      { voice: "whoosh", f: 300, to: 1.6, decay: 1.4, vol: 0.13 },
      { voice: "thud", at: 0.05, f: 160, bright: 0.3, decay: 0.5, vol: 0.3 },
    ],
    off: [
      { voice: "whoosh", f: 700, to: 0.4, decay: 0.9, vol: 0.13 },
      { voice: "thud", at: 0.85, f: 160, bright: 0.3, decay: 0.6, vol: 0.4 },
    ],
  },
  // ---- Gems -------------------------------------------------------------------------
  diamond: [
    {
      voice: "sample",
      file: "diamond-tap.mp3",
      vol: 0.9,
      fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
    },
    {
      voice: "sample",
      file: "diamond-tap.mp3",
      at: 0.45,
      pitch: 1.25,
      vol: 0.3,
      fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
    },
    {
      voice: "sample",
      file: "diamond-tap.mp3",
      at: 1,
      pitch: 1.4,
      vol: 0.25,
      fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
    },
    {
      voice: "sample",
      file: "diamond-tap.mp3",
      at: 1.7,
      pitch: 1.15,
      vol: 0.22,
      fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
    },
  ],
  // A warm chime, and a softer one on each throb of the glow.
  ruby: [
    {
      voice: "sample",
      file: "diamond-tap.mp3",
      pitch: 0.75,
      vol: 0.9,
      fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
    },
    { voice: "drone", at: 0.1, f: 98, bright: 0.3, decay: 1.6, vol: 0.35 },
  ],
  // Sound A: a crisp tap on a cut gem (Sound C: no whoosh, his note of October 2).
  emerald: {
    voice: "sample",
    file: "diamond-tap.mp3",
    pitch: 0.9,
    vol: 0.9,
    fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
  },
  "amethyst-geode": {
    on: [
      { voice: "crack", f: 1100, bright: 0.3 },
      { voice: "glass", at: 0.35, notes: "E6 B6", step: 0.12, decay: 1.2 },
    ],
    off: [{ voice: "stone", f: 300, decay: 1.4 }],
  },
  // Sound A: a crisp tap on a cut gem, a little higher than the emerald's (Sound C: no wind or
  // sandy shuffle).
  sapphire: {
    voice: "sample",
    file: "diamond-tap.mp3",
    pitch: 1.05,
    vol: 0.9,
    fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
  },
  // A chime for each point as it lights, left to right.
  "quartz-cluster": {
    voice: "glass",
    notes: "C6 D6 E6 G6 A6 C7 D7 E7 G7 A7",
    step: 0.29,
    at: 0.2,
    decay: 0.7,
  },
  opal: [
    {
      voice: "sample",
      file: "diamond-tap.mp3",
      pitch: 0.6,
      len: 0.12,
      vol: 0.8,
      fallback: { voice: "glass", f: 3000, decay: 0.3, vol: 0.5 },
    },
    { voice: "stone", at: 0.35, f: 420, decay: 0.5, vol: 0.35 },
    { voice: "stone", at: 1.6, f: 400, decay: 0.5, vol: 0.3 },
  ],
  pearl: {
    on: { voice: "clack", f: 1800, decay: 2.5, bright: 0.2 },
    off: { voice: "clack", f: 1500, decay: 2, bright: 0.2 },
  },
  "crystal-ball": [
    { voice: "whoosh", f: 400, to: 1.5, decay: 1.6, vol: 0.35 },
    {
      voice: "sample",
      file: "crystal-ball-ring.mp3",
      at: 0.6,
      vol: 0.9,
      fallback: { voice: "glass", f: 1200, decay: 1.2, vol: 0.4 },
    },
  ],
  // ---- Anatomy ----------------------------------------------------------------------
  // Sound A: a real heartbeat for each beat (the beats come faster in the middle, as the heart
  // works harder). Sound C: louder, the same beats and tempo (his note of October 2).
  heart: [
    [0.16, 0.64, 1.25],
    [0.61, 0.72, 1.35],
    [0.99, 0.8, 1.4],
    [1.38, 0.8, 1.4],
    [1.76, 0.8, 1.4],
    [2.15, 0.8, 1.4],
    [2.54, 0.8, 1.4],
    [2.93, 0.76, 1.35],
    [3.36, 0.68, 1.25],
    [3.91, 0.6, 1.15],
  ].map(([at, v, pitch]) => ({
    voice: "sample",
    file: "heart-beat.mp3",
    at,
    vol: Math.round(v * 1.6 * 100) / 100,
    pitch,
    fallback: { voice: "heartbeat", f: 72, vol: Math.round(v * 1.25 * 1.6 * 100) / 100 },
  })),
  // Sound C (his note of October 2): a subtle electric current as the thought's sparks race round
  // the folds (a softer, lower crackle than the neuron's spike, from the same recording), and a
  // small snap as the whole side lights up. No wind.
  brain: [
    {
      voice: "sample",
      file: "neuron-arc.mp3",
      at: 0.05,
      from: 0.25,
      len: 0.7,
      pitch: 0.7,
      vol: 0.32,
      fallback: { voice: "crackle", n: 4, vol: 0.25 },
    },
    {
      voice: "sample",
      file: "neuron-arc.mp3",
      at: 0.95,
      from: 0.3,
      len: 0.6,
      pitch: 0.78,
      vol: 0.28,
      fallback: { voice: "crackle", n: 3, vol: 0.2 },
    },
    {
      voice: "sample",
      file: "neuron-arc.mp3",
      at: 2.05,
      from: 0.2,
      len: 0.4,
      pitch: 0.9,
      vol: 0.42,
      fallback: { voice: "crackle", n: 3, vol: 0.3 },
    },
  ],
  eye: [
    { voice: "pock", at: 0.1, f: 1800, bright: 0.1, decay: 0.25, vol: 0.8 },
    { voice: "pock", at: 0.26, f: 1500, bright: 0.1, decay: 0.2, vol: 0.4 },
  ],
  // A deep breath in (1.7 s), held, then out (2.2 s).
  lungs: {
    voice: "sample",
    file: "lungs-breath.mp3",
    vol: 0.8,
    fallback: { voice: "breath", f: 700, to: 1.4, decay: 2.4 },
  },
  // A squeaky polish across it, a ding as it gleams (1.1 s), twinkles after.
  tooth: [
    { voice: "whoosh", f: 2500, to: 0.8, decay: 0.8, vol: 0.2 },
    { voice: "ding", at: 1.1, f: "C7", decay: 0.35, vol: 0.8 },
    { voice: "sparkle", at: 1.7, f: 4200, n: 4, decay: 0.9, vol: 0.4 },
  ],
  // Three pulses (0, 1.15, 2.3 s), each with a drop down the ureter a second later.
  kidney: [
    { voice: "wave", f: 220, decay: 0.45, vol: 0.4 },
    { voice: "drip", at: 1.1, f: 1300, n: 1 },
    { voice: "wave", at: 1.15, f: 240, decay: 0.45, vol: 0.4 },
    { voice: "drip", at: 2.25, f: 1200, n: 1 },
    { voice: "wave", at: 2.3, f: 200, decay: 0.45, vol: 0.4 },
    { voice: "drip", at: 3.4, f: 1100, n: 1 },
  ],
  // Lane Anatomy: a soft paper-and-cloth slide for each peel (the low chime as
  // the layers return is a cue from the recipe).
  "anatomy-atlas": [
    { voice: "breath", f: 1300, to: 0.55, decay: 1.5, vol: 0.5 },
    { voice: "flutter", f: 900, rate: 12, decay: 1.4, vol: 0.22, at: 0.12 },
  ],
  // ---- Nature -----------------------------------------------------------------------
  // E4: timed to the tap effects in src/packs/nature.js; later hits (the
  // palm's coconuts, the daisy's plucks, the bamboo's sections, the pebbles'
  // clacks, the pine's snow, the saguaro's cut) are cues from drive().
  // Sound B: the crown's leaves rustle as it rocks (to 1.6 s), then the
  // loose leaves land softly on the grass one by one (2.5 to 4.8 s).
  oak: [
    { voice: "rustle", f: 2800, n: 34, decay: 1.4, vol: 0.8 },
    { voice: "sample", file: "oak-leaves.mp3", at: 2.3, vol: 0.45, fallback: { voice: "rustle", f: 2200, n: 16, decay: 1.9, vol: 0.4 } }, // prettier-ignore
  ],
  // Sound B: the needles rustle as it rocks, with a soft jingle of sleigh
  // bells (the snow's hiss and thump are cues from the recipe).
  pine: [
    { voice: "rustle", f: 3200, n: 22, decay: 1, vol: 0.6 },
    { voice: "jingle", at: 0.05, n: 3, decay: 0.8, vol: 0.45 },
  ],
  palm: { voice: "flutter", f: 1800, rate: 18, decay: 1.4, vol: 0.5 },
  // Sound B: the opening of the traditional "Sakura Sakura" (public domain),
  // calm on a plucked koto-like string, over the petals' faint rustle.
  "cherry-blossom": [
    { voice: "pluck", notes: "A4 A4 B4 - A4 A4 B4 - A4 B4 C5 B4 A4 B4 A4 F4", step: 0.26, decay: 0.7, bright: 0.45, vol: 0.55 }, // prettier-ignore
    { voice: "rustle", at: 0.1, f: 2600, n: 18, decay: 1.6, vol: 0.3 },
  ],
  // Sound B: a soft gust (no loud wind) and the leaves rustling as they
  // swirl and land.
  maple: [
    { voice: "whoosh", f: 350, to: 1.6, decay: 1.4, vol: 0.35 },
    { voice: "rustle", at: 0.2, f: 2600, n: 30, decay: 2, vol: 0.6 },
    { voice: "rustle", at: 2.6, f: 2000, n: 12, decay: 1.4, vol: 0.35 },
  ],
  // Sound B: the new branch creaks as it grows (to 1.3 s), its leaves
  // rustle open; the scissors open (1.6 s) and snip it (2.3 s), and the cut
  // piece drops onto the moss (2.8 s).
  bonsai: [
    { voice: "creak", f: 340, rate: 30, to: 1.3, decay: 1.5, vol: 0.5 },
    { voice: "rustle", at: 0.7, f: 3000, n: 12, decay: 0.6, vol: 0.4 },
    { voice: "snip", at: 1.6, f: 4200, vol: 0.35 },
    { voice: "sample", file: "bonsai-snip.mp3", at: 2.22, vol: 1.8, fallback: { voice: "snip", f: 5000, vol: 0.9 } }, // prettier-ignore
    { voice: "thud", at: 2.8, f: 110, bright: 0.2, decay: 0.5, vol: 0.35 },
  ],
  // Sound B: the same breath of wind, quieter, with the strands rustling.
  willow: [
    { voice: "breath", f: 500, to: 0.6, decay: 2.8, vol: 0.5 },
    { voice: "rustle", at: 0.3, f: 2400, n: 20, decay: 2, vol: 0.35 },
  ],
  // Sound B: a warm low swell as the sun comes out (not a rising tone), and
  // the petals opening.
  sunflower: [
    { voice: "glow", notes: "F2+C3+F3", decay: 1.6, bright: 0.2, vol: 0.5 },
    { voice: "rustle", at: 0.6, f: 2600, n: 12, decay: 1, vol: 0.35 },
  ],
  rose: [
    { voice: "harp", f: "E5" },
    { voice: "harp", at: 1.5, f: "B4", vol: 0.6 },
  ],
  dandelion: { voice: "breath", f: 1400, to: 0.6, decay: 0.7 },
  tulip: { voice: "pluck", notes: "A4 C#5 E5", step: 0.18, decay: 0.5, bright: 0.2 },
  // Sound B: a soft whirr of the spin; each petal's landing on the grass is
  // a cue from the recipe (no ticks as they fly off).
  daisy: { voice: "whoosh", f: 700, to: 1.3, decay: 1.2, vol: 0.3 },
  lotus: [
    { voice: "drip", at: 0.55, f: 800, n: 1 },
    { voice: "bell", at: 2.0, f: "G5", decay: 0.8, bright: 0.2 },
  ],
  mushroom: [
    { voice: "breath", f: 350, to: 0.4, decay: 0.35 },
    { voice: "sparkle", at: 0.25, f: 2200, n: 9, decay: 2.4, vol: 0.5 },
  ],
  // Sound B: a soft leafy stretch as each frond unrolls (0 and 0.35 s) and
  // its leaflets spread, and again as they roll back up.
  fern: [
    { voice: "rustle", f: 2400, n: 14, decay: 1.1, vol: 0.5 },
    { voice: "creak", at: 0.1, f: 700, rate: 26, to: 1.2, decay: 1, vol: 0.2 },
    { voice: "rustle", at: 0.35, f: 2200, n: 14, decay: 1.1, vol: 0.45 },
    { voice: "rustle", at: 3.6, f: 2000, n: 12, decay: 1.1, vol: 0.3 },
  ],
  saguaro: { voice: "scrape", f: 900, rate: 40, decay: 0.3, vol: 0.4 },
  coral: { voice: "bubbles", f: 650, n: 14, decay: 2.2 },
  pinecone: [
    { voice: "scrape", f: 350, rate: 25, decay: 1.2 },
    { voice: "flutter", at: 0.8, f: 1200, rate: 22, decay: 1.6, vol: 0.4 },
    { voice: "crackle", at: 1.35, f: 2600, n: 10, decay: 1.8, vol: 0.5 },
    { voice: "rattle", at: 4.35, f: 1800, n: 8, decay: 0.9, vol: 0.5 },
  ],
  acorn: [
    { voice: "pop", f: 1150, decay: 0.6 },
    { voice: "pop", at: 0.22, f: 980, decay: 0.6 },
    { voice: "wood", at: 0.66, f: 900, decay: 0.6, vol: 0.5 },
    { voice: "wood", at: 0.88, f: 780, decay: 0.6, vol: 0.5 },
  ],
  succulent: { voice: "pluck", notes: "C5 E5 G5 C6", step: 0.3, at: 0.6, decay: 0.4, bright: 0.35 },
  bamboo: { voice: "hollow", f: "G3", decay: 0.7 },
  // Sound B: stones knocking as the pile shifts (the stacking knocks and the
  // tumble home are cues from the recipe).
  rocks: { voice: "sample", file: "rocks-pebbles.mp3", vol: 0.9, fallback: { voice: "pebble", f: 2400, n: 4, vol: 0.8 } }, // prettier-ignore
  kelp: [
    { voice: "bubbles", f: 300, n: 12, decay: 1.4 },
    { voice: "click", at: 1.4, notes: "C7 - C7 - C7", step: 0.1, vol: 0.5 },
  ],

  // ---- Weather ----------------------------------------------------------------------
  // Sound B: fire like the volcano's flame (a low flickering rush), with a
  // few soft pops of wood instead of clicks.
  campfire: [
    { voice: "flame", f: 75, rate: 5, n: 3, bright: 0.45, decay: 1.5 },
    { voice: "rumble", f: 55, rate: 4, decay: 1.2, vol: 0.35 },
  ],
  "storm-cloud": { voice: "rumble", f: 80, rate: 6 },
  // Heats up: the blobs gloop faster, then it cools (Sound B: no rising hum).
  "lava-lamp": [
    { voice: "gloop", at: 0.1, f: 75, decay: 1.6 },
    { voice: "gloop", at: 0.9, f: 95, decay: 1.4 },
    { voice: "bubbles", at: 1.3, f: 240, n: 9, decay: 2.2, vol: 0.6 },
    { voice: "gloop", at: 2.3, f: 85, decay: 1.4 },
  ],
  // Sound B: the water sloshes as it is shaken, then the twinkle (no rattle).
  "snow-globe": [
    { voice: "slosh", f: 700, rate: 3, n: 0, decay: 0.6, vol: 0.5 },
    { voice: "sparkle", at: 0.2, f: 3600, n: 7 },
  ],
  volcano: [
    { voice: "rumble", f: 55, rate: 4, decay: 1.3 },
    { voice: "kick", at: 0.4, f: 42, decay: 2.5 },
  ],
  // Thaws with a sigh and drips, then crackles as it refreezes and the
  // frost sweeps up it.
  "ice-statue": [
    { voice: "drip", at: 0.4, f: 1400, n: 10, rate: 2.6 },
    { voice: "drip", at: 2.2, f: 1150, n: 8, rate: 4 },
  ],
  candle: {
    on: [
      { voice: "scrape", f: 2600, rate: 45, decay: 0.25, vol: 0.8 },
      { voice: "whoosh", at: 0.1, f: 300, to: 2, decay: 0.5, vol: 0.7 },
    ],
    off: { voice: "breath", f: 1100, to: 0.4, decay: 0.5 },
  },
  // Spins up with a howl, then the debris clatters back down.
  tornado: [
    { voice: "wind", f: 250, rate: 3, decay: 2.6 },
    { voice: "whoosh", at: 0.3, f: 180, to: 5, decay: 2.2, vol: 0.8 },
    { voice: "clatter", at: 3.9, f: 900, n: 10, kind: "wood", decay: 1.4, vol: 0.8 },
  ],
  // Wiped with a swish, drawn again a note per colour, then sparkles.
  rainbow: [
    { voice: "whoosh", f: 1200, to: 0.3, decay: 0.7, vol: 0.5 },
    { voice: "harp", at: 0.8, notes: "C5 D5 E5 G5 A5 C6 D6", step: 0.4, decay: 0.8 },
    { voice: "sparkle", at: 3.5, f: 3000, n: 9, decay: 1.4 },
  ],
  // The crack as the chunk breaks and a groan as it tips; the splash is a
  // cue from the recipe, when it hits the water.
  // Sound B: real ice breaking (a deep crack, its groan and splinters).
  iceberg: [
    { voice: "sample", file: "iceberg-crack.mp3", vol: 1.8, fallback: { voice: "shellcrack", f: 1800, n: 4, kind: "ice", decay: 1.4 } }, // prettier-ignore
    { voice: "rumble", at: 0.1, f: 60, rate: 4, decay: 0.8, vol: 0.7 },
  ],
  // A surge: a rush over the lip, the roar swelling, a thump in the pool.
  waterfall: [
    { voice: "whoosh", f: 500, to: 3, decay: 0.9, vol: 0.8 },
    { voice: "roar", at: 0.4, f: 320, bright: 0.8, decay: 2.2 },
    { voice: "rumble", at: 0.95, f: 65, rate: 3, decay: 1.1, vol: 0.7 },
  ],
  // The lip rushes over, crashes, and the foam fizzes away.
  "ocean-wave": [
    { voice: "whoosh", f: 220, to: 3, decay: 1.2, vol: 0.8 },
    { voice: "rumble", at: 0.75, f: 60, rate: 3, decay: 0.8, vol: 0.8 },
    { voice: "splash", at: 0.8, f: 900, decay: 2.2 },
    { voice: "hiss", at: 1.05, f: 3500, decay: 2.6, vol: 0.5 },
  ],
  geyser: [
    { voice: "hiss", f: 3000, decay: 1.6 },
    { voice: "whoosh", at: 0.3, f: 250, to: 4, decay: 1.3 },
  ],

  // ---- Food -------------------------------------------------------------------------
  // Sound B: a slow, thick melt with heavy drops plopping down (not bubbles).
  "ice-cream": { voice: "melt", f: 200, n: 4, decay: 1.3 },
  // Each chop and the fan are cues from the recipe; Sound B: no whoosh as
  // the knife swings, only a soft settle of the melon.
  watermelon: { voice: "thud", f: 120, bright: 0.2, decay: 0.4, vol: 0.3 },
  // Sound B: blown out with a breath, then the last line of "Happy Birthday
  // to You" (public domain) on the piano, with its chords. Sound C (the owner's
  // call of October 2): on the concert grand's recorded notes, same tempo.
  "birthday-cake": {
    on: [
      { voice: "breath", f: 1300, to: 0.5, decay: 0.5, vol: 0.7 },
      { voice: "concert", at: 0.5, notes: "F5 - - F5 E5 - - - C5 - - - D5", step: 0.15, hold: 0.35, vol: 0.6 }, // prettier-ignore
      { voice: "concert", at: 2.9, f: "C5", hold: 1.2, vol: 0.6 },
      { voice: "concert", at: 0.5, notes: "- - - - F3+A3+C4 - - - - - - - G3+B3+F4 - - - C3+E3+G3", step: 0.15, hold: 1.2, vol: 0.35 }, // prettier-ignore
    ],
    off: [
      { voice: "scrape", f: 2800, rate: 50, decay: 0.2, vol: 0.7 },
      { voice: "whoosh", at: 0.1, f: 400, to: 2, decay: 0.4, vol: 0.6 },
    ],
  },
  // Sound C (his note of October 2: real, dry pops): a dry pop for each kernel as it jumps (14,
  // from 0.07 s to 0.68 s, at the recipe's own times), cut from a real pot of popcorn popping (CC0,
  // elricadavis on Freesound).
  popcorn: [
    0.071, 0.073, 0.116, 0.168, 0.263, 0.259, 0.318, 0.351, 0.427, 0.489, 0.549, 0.59, 0.633, 0.679,
  ].map((at, i) => ({
    voice: "sample",
    file: "popcorn-pops.mp3",
    at,
    from: i % 2 ? 0.495 : 0.045,
    len: 0.12,
    pitch: Math.round((0.9 + 0.25 * ((i * 0.618) % 1)) * 100) / 100,
    vol: Math.round((0.55 + 0.35 * ((i * 0.382) % 1)) * 100) / 100,
    fallback: { voice: "kernel", f: 1200 + 40 * i, vol: 0.6 },
  })),
  // Sound B: a wet, heavy wobble instead of a cartoon boing.
  jelly: [
    { voice: "squish", pitch: 0.6, bright: 0.2, decay: 1.4 },
    { voice: "stretch", at: 0.05, f: 420, rate: 28, to: 0.7, decay: 1.4, vol: 0.5 },
  ],
  // Sound B: a smooth sizzle in the pan (no crackling ticks), the flip and
  // the soft slap as it lands.
  pancakes: [
    { voice: "hiss", f: 4500, decay: 1.4, vol: 0.45 },
    { voice: "whoosh", at: 0.1, f: 500, to: 3, decay: 0.4, vol: 0.6 },
    { voice: "slap", at: 0.8, f: 800, vol: 0.6 },
  ],
  // The frosting flicks the cherry up; its plop and the sprinkles are cues.
  cupcake: { voice: "boing", f: 260, to: 1.8, rate: 9, decay: 0.5, vol: 0.6 },
  // Sound B: the wind as it spins, without the rising hum.
  lollipop: { voice: "wind", at: 0.1, f: 900, rate: 3, decay: 1.4, vol: 0.5 },
  // Sound B: the sugar strains as it twists (no squeak); the snaps and the
  // mends are cues.
  "candy-cane": { voice: "creak", f: 900, rate: 40, to: 1.3, decay: 1.4, vol: 0.3 },
  // A hop; each landing is a cue.
  macarons: { voice: "whoosh", f: 900, to: 1.6, decay: 0.3, vol: 0.4 },
  // Sound B: only the bounce (no whistle before it).
  "gummy-bear": { voice: "boing", at: 0.3, f: 200, to: 1.8, rate: 12 },
  // Sound B: soft dough pulled and stretching.
  pretzel: [
    { voice: "squish", pitch: 0.7, bright: 0.2, decay: 2, vol: 0.7 },
    { voice: "stretch", at: 0.1, f: 520, rate: 40, to: 0.7, decay: 1.6, vol: 0.7 },
  ],
  // Flaky crust crackling as it is sliced open; the butter's sizzle and the
  // top settling back are cues.
  // Sound B: the flaky layers shattering softly under the knife (no clicks).
  croissant: [
    { voice: "rustle", f: 3600, n: 24, decay: 0.45, vol: 0.8 },
    { voice: "bite", at: 0.02, f: 2200, vol: 0.35 },
  ],
  // Sound B: a bite into the crust and the cheese stretching; Sound C: the stretch softer and
  // shorter (his note of October 2: not so windy).
  pizza: {
    on: [
      { voice: "bite", f: 1800, vol: 0.3 },
      { voice: "stretch", at: 0.1, f: 600, rate: 45, to: 0.65, decay: 1.5, vol: 0.45 },
    ],
    off: { voice: "thud", f: 120, bright: 0.4, decay: 0.8 },
  },
  // Sound B: the patty's smooth sizzle, no clicking.
  burger: {
    on: [
      { voice: "whoosh", f: 300, to: 5, decay: 0.5 },
      { voice: "hiss", f: 4200, decay: 1.2, vol: 0.5 },
    ],
    off: [
      { voice: "hiss", f: 4500, decay: 0.8, vol: 0.4 },
      { voice: "thud", at: 0.3, f: 110, bright: 0.3 },
    ],
  },
  sushi: { voice: "wood", notes: "B6 B6", step: 0.1, decay: 0.4 },
  // Sound B: a hard shell cracking open.
  taco: { voice: "sample", file: "taco-crack.mp3", vol: 1.3, fallback: { voice: "shellcrack", f: 2200, n: 6, decay: 1.2 } }, // prettier-ignore
  egg: {
    on: [
      { voice: "clack", f: 1700, decay: 1.2, bright: 0.2 },
      { voice: "crack", at: 0.25, f: 1900, bright: 0.3, decay: 0.8 },
    ],
    off: { voice: "clack", notes: "E6 E6", step: 0.15, decay: 1.2, bright: 0.2 },
  },
  // Sound B (his Sound Board note): a simple "tap tap" of a spoon on the
  // cup, as if asking for a refill.
  coffee: { voice: "glass", notes: "E7 - E7", step: 0.13, decay: 0.12, bright: 0.3, vol: 0.6 },
  apple: {
    // Sound B: a real bite into a crisp apple.
    on: { voice: "sample", file: "apple-bite.mp3", vol: 1.3, fallback: { voice: "bite", f: 3000 } }, // prettier-ignore
    off: { voice: "pop", f: 520, decay: 1.2, vol: 0.6 },
  },
  // Sound C (his note of October 2: the peel too loud and zipper-like): a soft rustle as the bunch
  // comes apart; each banana's peel is a real, quiet banana peel from the recipe's cues
  // (src/packs/food.js).
  banana: { voice: "rustle", f: 1500, n: 3, decay: 0.2, vol: 0.3 },
  orange: [
    { voice: "squish", pitch: 1.3, bright: 0.9, decay: 0.7 },
    { voice: "hiss", f: 3000, decay: 0.3, vol: 0.7 },
  ],
  kiwi: { voice: "scrape", f: 1800, rate: 4, decay: 0.6, vol: 0.6 },
  pineapple: [
    { voice: "wood", f: 380, decay: 1.2 },
    { voice: "crunch", f: 1100, n: 6, decay: 0.5, vol: 0.6 },
  ],
  // The flick; each knock of the pair is a cue.
  // Sound B: no string note, only the stems' soft swish.
  cherries: { voice: "whoosh", f: 900, to: 1.3, decay: 0.25, vol: 0.25 },
  // A rustle as the bunch shakes; each grape's plop is a cue.
  grapes: { voice: "rattle", f: 900, n: 5, decay: 0.7, vol: 0.5 },
  // The stone pops out; its thocks as it lands are cues.
  avocado: { voice: "pop", f: 330, decay: 1, vol: 0.7 },

  // ---- Toys -------------------------------------------------------------------------
  // Sound B: a lower plastic clack.
  bricks: { voice: "clack", notes: "G5 - G5", step: 0.08, decay: 0.7, bright: 0.25 },
  "rubber-duck": { voice: "quack", f: 250, n: 2 },
  // Sound C (his note of October 2): a soft flick as it is set spinning; its spin is heard from the
  // recipe (src/packs/playthings.js), softly, louder and a little higher the faster it turns,
  // fading as it slows, also when a drag spins it.
  "spinning-top": {
    voice: "sample",
    file: "spinning-top-spin.mp3",
    from: 0.1,
    len: 0.3,
    vol: 0.35,
    fallback: { voice: "rustle", f: 2000, n: 2, decay: 0.1, vol: 0.3 },
  },
  // Sound B: two dice thrown on a wooden table, bouncing and settling.
  dice: { voice: "sample", file: "dice-throw.mp3", vol: 1.7, fallback: { voice: "dice", f: 2300, n: 2 } }, // prettier-ignore
  // The lift is a soft tick; each strike clacks as it lands (cues from the recipe).
  "newtons-cradle": { voice: "clack", f: 5200, decay: 0.3, vol: 0.25 },
  // Sound C (his note of October 2: not grainy or creaky): the soft rustle of a plush bear's fabric
  // and stuffing (CC0, lemigoga on Freesound).
  "teddy-bear": {
    voice: "sample",
    file: "teddy-bear-plush.mp3",
    vol: 0.7,
    fallback: { voice: "breath", f: 900, to: 0.8, decay: 0.5, vol: 0.2 },
  },
  // Sound B: the string unwinding, the whirr at the bottom, the smack back
  // into the hand (1.8 s).
  "yo-yo": { voice: "yoyo", f: 140, decay: 1.5 },
  // Sound B: a layer sliding round and seating (each turn is a cue too).
  "puzzle-cube": { voice: "sample", file: "puzzle-cube-turn.mp3", vol: 1.4, fallback: { voice: "twist", f: 1800 } }, // prettier-ignore
  // Sound C (his note of October 2: like a real Slinky): a real metal Slinky's shimmering coils as
  // it walks (CC0, foxraid on Freesound).
  "spring-toy": {
    voice: "sample",
    file: "spring-toy-slinky.mp3",
    vol: 0.9,
    fallback: { voice: "rustle", f: 4200, n: 24, decay: 1.4, bright: 0.8, vol: 0.4 },
  },
  // Sound B: the same, with the wind dialed back.
  kite: [
    { voice: "wind", f: 600, rate: 1.5, decay: 0.8, vol: 0.3 },
    { voice: "flutter", at: 0.2, f: 900, rate: 16, decay: 0.8, vol: 0.7 },
  ],
  // Sound C: the fold's paper rustle and the glide's air, a little lower (his note: almost perfect,
  // a bit loud).
  "paper-plane": [
    { voice: "rustle", f: 3000, n: 6, decay: 0.25, vol: 0.35 },
    { voice: "whoosh", at: 0.05, f: 700, to: 2, decay: 1.4, vol: 0.18 },
  ],
  "origami-crane": { voice: "flutter", f: 1500, rate: 9, decay: 1.4 },
  // Sound B: a real balloon bursting (no whistle first).
  "balloon-dog": { voice: "sample", file: "balloon-dog-pop.mp3", at: 0.3, vol: 0.45, fallback: { voice: "balloonpop", f: 90, vol: 0.8 } }, // prettier-ignore
  // Sound C (his note of October 2: softer blowing, louder bubbles): a soft breath through the wand
  // (CC0, yehdawgo on Freesound); each bubble pops softly as it bursts, from the recipe's cues
  // (src/packs/playthings.js).
  "soap-bubbles": {
    voice: "sample",
    file: "soap-bubbles-blow.mp3",
    vol: 0.5,
    fallback: { voice: "breath", f: 1500, to: 0.7, decay: 0.6, vol: 0.2 },
  },
  // Sound B: the key's few winding clicks, then clockwork whirring as it
  // unwinds and its tin feet clanking along.
  robot: [
    { voice: "sample", file: "robot-wind.mp3", vol: 0.45, fallback: { voice: "ratchet", f: 2600, n: 5, rate: 8, vol: 0.4 } }, // prettier-ignore
    { voice: "clockwork", at: 0.3, f: 2600, rate: 2.7, decay: 1.1 },
  ],

  // ---- Maths ------------------------------------------------------------------------
  // Sound B: something epic for the strange attractor: a deep hit, a dark
  // slow rush and a wide low chord (no whistling howl).
  lorenz: [
    { voice: "hit", f: 45, vol: 0.4 },
    { voice: "glow", notes: "D2+A2+D3+F3", decay: 1.8, bright: 0.5, vol: 0.7 },
    { voice: "whoom", at: 0.3, f: 220, decay: 2, vol: 0.45 },
  ],
  // Sound B: no step tune; a soft push as the rider sets off, and each
  // rider's own sound on the ride is a cue from the recipe (a race car, a
  // rolling beach ball, a bicycle with one quack, the ant's feet).
  mobius: { voice: "whoosh", f: 400, to: 1.5, decay: 0.4, vol: 0.25 },
  // Sound B: water moving in a bottle, sloshing and glugging.
  "klein-bottle": { voice: "sample", file: "klein-bottle-slosh.mp3", vol: 0.8, fallback: { voice: "slosh", f: 480, rate: 2.2, n: 3, decay: 1.6 } }, // prettier-ignore
  // The plugs fly in, it closes (0.65 s), then each level is carved out,
  // falling blips a size down each time (1.05, 1.95, 2.75 s).
  "menger-sponge": [
    { voice: "blip", notes: "C4 G4 C5", step: 0.2, decay: 0.8, vol: 0.6 },
    { voice: "thud", at: 0.65, f: 90, decay: 0.8 },
    { voice: "blip", at: 1.05, notes: "C6 G5 C5", step: 0.08, decay: 1.2 },
    { voice: "blip", at: 1.95, notes: "G5 C5 G4", step: 0.08, decay: 1.2 },
    { voice: "blip", at: 2.75, notes: "C5 G4 C4", step: 0.08, decay: 1.2 },
  ],
  // Sweeps up as it turns inside out (to 2.2 s), and down as it turns home.
  // Sound B: no rising drone; a great slow rush as it turns inside out and
  // again as it turns home, over a low chord.
  hypercube: [
    { voice: "whoom", f: 300, decay: 1.6, vol: 0.7 },
    { voice: "glow", at: 0.2, notes: "A2+E3+A3", decay: 1.1, bright: 0.6, vol: 0.5 },
    { voice: "whoom", at: 2.9, f: 250, decay: 1.2, vol: 0.6 },
  ],
  // Sound B: it strains as it is pulled and lets go with a real thump and
  // swish, not a banjo string.
  "torus-knot": [
    { voice: "creak", at: 0.2, f: 420, rate: 30, to: 1.5, decay: 0.8, vol: 0.5 },
    { voice: "bowstring", at: 0.85, f: 120 },
    { voice: "whoom", at: 0.9, f: 400, decay: 0.8, vol: 0.4 },
  ],
  // Sound B: swells one way (0.95 s), then the other (2.75 s), as slow
  // rushes over a low chord (no rising hum, no bubbles).
  gyroid: [
    { voice: "whoom", f: 260, decay: 1.3, vol: 0.6 },
    { voice: "whoom", at: 1.9, f: 220, decay: 1.3, vol: 0.55 },
    { voice: "glow", notes: "E2+B2+E3", decay: 1.8, bright: 0.25, vol: 0.4 },
  ],
  // The discs click round like a combination lock, top to bottom (from
  // 0.75 s), then back, bottom to top (from 2.7 s), over a low hum.
  mandelbulb: [
    { voice: "drone", f: 70, bright: 0.4, decay: 1.6, vol: 0.5 },
    { voice: "ratchet", at: 0.75, f: 1800, n: 7, rate: 10 },
    { voice: "ratchet", at: 2.7, f: 1500, n: 7, rate: 10 },
  ],
  sierpinski: {
    on: { voice: "bell", notes: "C6 G5 C5", step: 0.1, decay: 0.5, bright: 0.6 },
    off: { voice: "bell", notes: "C5 G5 C6", step: 0.1, decay: 0.4, bright: 0.6 },
  },
  platonic: {
    on: { voice: "tine", notes: "C5 D5 E5 G5 A5", step: 0.1, decay: 0.8 },
    off: { voice: "tine", notes: "A5 G5 E5 D5 C5", step: 0.08, decay: 0.6 },
  },
  // A pen touches down; then drive() hums a tone that follows the curve's
  // height as the pen draws (cues every 0.09 s).
  "graph-plotter": { voice: "scrape", f: 2600, rate: 22, decay: 0.3, vol: 0.25 },
  // A low whoosh that rises with the surface (0.45 to 2.1 s), then a soft
  // swell while its parameter plays.
  // Sound B: subtle: a soft low chord swelling as the surface rises (no
  // wave, no rising hum).
  "surface-plotter": [
    { voice: "glow", at: 0.35, notes: "C3+G3+C4", decay: 1.8, bright: 0.3, vol: 0.45 },
    { voice: "whoom", at: 0.35, f: 300, decay: 1.2, vol: 0.25 },
  ],
  // Sound B: warmer and less electronic: a soft low chord that swells with
  // the turn, and a gentle rush a quarter turn later.
  "unit-circle": [
    { voice: "glow", at: 0.3, notes: "A2+E3+A3", decay: 1.5, bright: 0.3, vol: 0.5 },
    { voice: "whoom", at: 1.25, f: 400, decay: 1.2, vol: 0.35 },
  ],
  // Each circle's hum joins in, building into a chord.
  "fourier-circles": { voice: "pad", notes: "C3 G3 C4 E4 G4 C5", step: 0.35, at: 0.3, decay: 1.6 },
  // A wooden slide; drive() adds a slide and a click for each piece.
  "pythagoras-proof": { voice: "scrape", at: 0.3, f: 700, rate: 9, decay: 0.35, vol: 0.35 },
  // Lane Manual, Sound B (his note: too robotic and loud, change entirely):
  // the quiet scratch of chalk as t plays (4 s).
  "splat-equation": { voice: "rustle", f: 2600, n: 30, decay: 2.6, bright: 0.3, vol: 0.3 },
  // Three hushing waves, each at its loudest as a swell reaches the mouth
  // (0.7, 1.8, 2.9 s).
  "seashell-spiral": [
    { voice: "wave", at: 0.07, f: 250, decay: 0.9, vol: 0.7 },
    { voice: "wave", at: 1.17, f: 230, decay: 0.9, vol: 0.6 },
    { voice: "wave", at: 2.27, f: 270, decay: 0.9, vol: 0.55 },
  ],

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
  // Sound B: real paper pages turning (no wind).
  book: {
    on: [
      { voice: "sample", file: "book-page.mp3", vol: 1.5, fallback: { voice: "pageflip", f: 1800 } }, // prettier-ignore
      { voice: "sample", file: "book-page.mp3", at: 0.3, pitch: 1.1, vol: 0.9, fallback: { voice: "pageflip", f: 2000, decay: 0.9, vol: 0.6 } }, // prettier-ignore
    ],
    off: [
      { voice: "sample", file: "book-page.mp3", pitch: 0.9, vol: 1.5, fallback: { voice: "pageflip", f: 1600, decay: 1.1 } }, // prettier-ignore
      { voice: "sample", file: "book-page.mp3", at: 0.35, pitch: 0.85, vol: 0.8, fallback: { voice: "pageflip", f: 1500, decay: 0.9, vol: 0.5 } }, // prettier-ignore
    ],
  },
  // Sound B (the laptop is locked: only these): opening keeps only the
  // screen-on sound (no twinkle); closing has no thunk, just the lid's
  // faint air. The keys are cues from the recipe.
  laptop: {
    on: { voice: "pad", at: 0.6, notes: "F4+C5+F5", step: 0, decay: 0.8 },
    off: { voice: "breath", f: 600, to: 0.7, decay: 0.3, vol: 0.12 },
  },
  "music-box": {
    on: { voice: "tine", notes: "E6 D6 C6 D6 E6 E6 E6 - D6 D6 D6 - E6 G6 G6", step: 0.24 },
    off: { voice: "wood", f: 450, decay: 1.1, vol: 0.8 },
  },
  // Sound B: a real wind-up alarm clock: the hammer rattling between its
  // two bells, in two rings.
  clock: [
    { voice: "alarmbell", f: 2100, decay: 0.6 },
    { voice: "alarmbell", at: 0.75, f: 2100, decay: 0.6 },
  ],
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
  // Sound B: the blades' soft thrum of air, swelling in as it starts and
  // fading as it stops (no rising motor hum).
  "desk-fan": {
    on: { voice: "fan", f: 650, rate: 16, decay: 1.4 },
    off: { voice: "fan", f: 500, rate: 10, decay: 1.2, vol: 0.7 },
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

  // ---- Real objects (lane Real objects) ---------------------------------------------
  // A cap click, the posted cap's click, a smooth nib scratch, and the cap clicking back on.
  "fountain-pen": [
    { voice: "click", f: 2600, vol: 0.9 },
    { voice: "click", at: 1.08, f: 2100, vol: 0.8 },
    { voice: "scrape", at: 1.62, f: 2400, rate: 26, decay: 2.3, vol: 0.18 },
    { voice: "click", at: 3.97, f: 2600, vol: 0.9 },
  ],
  // Sound B (his note: the clicks are weird, the water too bubbly): the cap
  // twisted off, a real pour (a splashing stream and the water sloshing in
  // the glass) and the cap twisted back on.
  "water-bottle": [
    { voice: "twist", f: 1400, vol: 0.4 },
    { voice: "twist", at: 0.35, f: 1300, vol: 0.35 },
    { voice: "roar", at: 1.66, f: 400, bright: 0.6, decay: 1.2, vol: 0.35 },
    { voice: "slosh", at: 1.8, f: 700, rate: 3, n: 0, decay: 1, vol: 0.4 },
    { voice: "twist", at: 4.05, f: 1400, vol: 0.4 },
  ],
  // Sound B (his Sound Board note: no bubbles; the pssht and fizz need
  // work): the soda sloshing as it shakes, a sharp pssht as the tab opens,
  // and a fine, soft fizz that dies away.
  "soda-can": [
    { voice: "slosh", f: 800, rate: 4, n: 0, decay: 0.6, vol: 0.5 },
    { voice: "crack", at: 0.93, f: 2600, decay: 0.5, vol: 0.5 },
    { voice: "hiss", at: 0.94, f: 3800, decay: 0.7, vol: 0.45 },
    { voice: "rustle", at: 1.05, f: 6000, n: 60, decay: 1.8, bright: 0.2, vol: 0.3 },
  ],
  // Laces zipping through the eyelets, a soft tug as the bow pulls tight, two toe taps.
  "running-shoe": [
    { voice: "tear", f: 1100, to: 1.8, decay: 1.4, vol: 0.4 },
    { voice: "tear", at: 1.05, f: 1300, to: 0.7, decay: 1.2, vol: 0.35 },
    { voice: "slap", at: 2.72, f: 900, vol: 0.5 },
    { voice: "thud", at: 3.34, f: 140, vol: 0.7 },
    { voice: "thud", at: 3.84, f: 150, vol: 0.7 },
  ],
  // Sound C: the fabric's soft brushes and the zip, with much less wind (his note of October 2).
  hoodie: [
    { voice: "breath", f: 700, to: 0.6, decay: 0.8, vol: 0.22 },
    { voice: "breath", at: 0.62, f: 900, to: 1.4, decay: 0.8, vol: 0.2 },
    { voice: "tear", at: 1.2, f: 1600, to: 2.4, decay: 0.35, vol: 0.3 },
    { voice: "whoosh", at: 1.25, f: 250, to: 2, decay: 1.1, vol: 0.1 },
    { voice: "whoosh", at: 2.95, f: 300, to: 1.8, decay: 1.1, vol: 0.09 },
  ],
  // Sound B (his note: too robotic and tacky): each fold is a plastic hinge
  // sliding shut and seating; the lenses darken silently.
  sunglasses: [
    { voice: "twist", at: 0.4, f: 2200, vol: 0.5 },
    { voice: "twist", at: 0.7, f: 2000, vol: 0.5 },
    { voice: "twist", at: 2.95, f: 2000, vol: 0.45 },
    { voice: "twist", at: 3.2, f: 2200, vol: 0.45 },
  ],
  // A flick off the stand, a soft landing and a second flip (Sound B, his
  // note "a bit too windy": fabric rustles instead of whooshes).
  "baseball-cap": [
    { voice: "slap", f: 1800, vol: 0.5 },
    { voice: "rustle", at: 0.35, f: 1600, n: 12, decay: 0.9, vol: 0.4 },
    { voice: "thud", at: 1.62, f: 180, vol: 0.5 },
    { voice: "rustle", at: 1.95, f: 1500, n: 8, decay: 0.5, vol: 0.4 },
    { voice: "thud", at: 2.55, f: 170, vol: 0.45 },
  ],
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
  // A clang, crackling sparks and a shimmer as the gleam crosses it.
  // Sound B: no crackling clicks.
  shield: [
    { voice: "metal", f: 260, decay: 1.4 },
    { voice: "shimmer", at: 0.4, f: 1600, decay: 1.1, vol: 0.4 },
  ],
  "bow-and-target": {
    on: [
      // Sound B: a real bowstring's thump, not a note.
      { voice: "sample", file: "bow-and-target-release.mp3", at: 0.42, vol: 0.95, fallback: { voice: "bowstring", f: 110 } }, // prettier-ignore
      { voice: "whoosh", at: 0.45, f: 900, to: 2, decay: 0.8, vol: 0.5 },
      { voice: "wood", at: 1.0, f: 180, decay: 1.4 },
    ],
    off: { voice: "wood", f: 320, decay: 0.8, vol: 0.6 },
  },
  // Sound B: the timber beam creaks and strains, then a softer swing.
  trebuchet: [
    { voice: "creak", f: 260, rate: 22, to: 1.6, decay: 0.8, vol: 0.9 },
    { voice: "creak", at: 0.6, f: 320, rate: 30, to: 0.7, decay: 0.6, vol: 0.6 },
    { voice: "whoosh", at: 0.6, f: 200, to: 3, decay: 1.2, vol: 0.45 },
  ],
  // Sound B: no click; the string's real thump, then the bolt hitting.
  crossbow: [
    { voice: "sample", file: "bow-and-target-release.mp3", at: 0.1, pitch: 0.85, vol: 1, fallback: { voice: "bowstring", f: 130 } }, // prettier-ignore
    { voice: "wood", at: 0.55, f: 240, decay: 1.2 },
  ],
  "knights-helmet": {
    on: { voice: "metal", f: 520, decay: 0.5, bright: 0.6 },
    off: { voice: "metal", f: 440, decay: 0.45, bright: 0.4 },
  },
  // A royal fanfare, and a ping for each jewel as it lights.
  crown: [
    // Sound B: a natural trumpet's fanfare instead of the synthetic brass.
    { voice: "trumpet", notes: "C5 C5 C5 G5 - E5 G5", step: 0.14, decay: 0.9 },
    { voice: "trumpet", at: 0.84, f: "C6", decay: 2.2 },
    {
      voice: "glass",
      at: 0.4,
      notes: "C6 D6 E6 G6 A6 C7 D7 E7",
      step: 0.175,
      decay: 0.8,
      vol: 0.35,
    },
  ],
  "dragon-egg": {
    on: [
      { voice: "crack", f: 1500, bright: 0.5 },
      { voice: "roarlet", at: 0.4, f: 190 },
    ],
    off: { voice: "stone", f: 380, decay: 1.2 },
  },
  // Sound B: a deep, slow hum of power swelling in the glass, not wind or
  // twinkles.
  "wizards-orb": [
    { voice: "whoom", f: 300, decay: 1.2, vol: 0.6 },
    { voice: "glow", at: 0.1, notes: "D3+A3+D4", decay: 1, bright: 0.35, vol: 0.6 },
  ],

  // ---- Animals ----------------------------------------------------------------------
  // Sound C: two soft swimming pulses, a little louder (his note of October 2).
  jellyfish: { voice: "swim", f: 380, n: 2, rate: 1.1, vol: 1.35 },
  // Water swishes as the school swirls into a ball, then bursts apart.
  "fish-school": [
    { voice: "whoosh", f: 500, to: 1.8, decay: 2.6, vol: 0.6 },
    { voice: "whoosh", at: 2.15, f: 900, to: 2.5, decay: 0.7, vol: 0.8 },
    { voice: "bubbles", at: 2.25, f: 600, n: 12, decay: 1.4, vol: 0.6 },
  ],
  butterfly: { voice: "flutter", f: 3500, rate: 14, decay: 0.8, vol: 0.4 },
  pufferfish: [
    { voice: "whoosh", f: 200, to: 2.5, decay: 0.6 },
    { voice: "engine", at: 0.5, f: 30, to: 1.3, bright: 0.2, decay: 0.5, vol: 0.6 },
  ],
  // A jet of water as it pulls in, the hollow shell ringing, and a knock and
  // a few bubbles as it peeks out again.
  nautilus: [
    { voice: "whoosh", f: 260, to: 0.6, decay: 0.7, vol: 0.7 },
    { voice: "hollow", at: 0.1, f: 180, decay: 2.2, bright: 0.2 },
    { voice: "bubbles", at: 0.05, f: 420, n: 6, decay: 0.9, vol: 0.5 },
    { voice: "hollow", at: 2.05, f: 200, decay: 1.6, bright: 0.2, vol: 0.6 },
    { voice: "bubbles", at: 3.1, f: 380, n: 5, decay: 1, vol: 0.4 },
  ],
  // Sound C: the wings' soft whirr on take-off and landing, quieter (his note of October 2).
  ladybug: {
    on: { voice: "flybuzz", f: 95, bright: 0.6, decay: 0.8, vol: 0.27 },
    off: [
      { voice: "flybuzz", f: 90, bright: 0.6, decay: 0.4, vol: 0.22 },
      { voice: "patter", at: 0.4, f: 2000, n: 2, decay: 0.2, vol: 0.2 },
    ],
  },
  // Sound B: wetter and slimier.
  snail: {
    on: [
      { voice: "squish", pitch: 0.9, bright: 0.3, decay: 1.5 },
      { voice: "stretch", at: 0.1, f: 900, rate: 35, to: 0.8, decay: 1.4, vol: 0.5 },
    ],
    off: [
      { voice: "squish", pitch: 1.1, bright: 0.3, decay: 2.5 },
      { voice: "stretch", at: 0.2, f: 800, rate: 30, to: 0.8, decay: 1.8, vol: 0.45 },
    ],
  },
  // Sound B: a squirt, then the ink bubbling out as a liquid.
  octopus: [
    { voice: "squish", pitch: 0.6, bright: 0.6, decay: 1.2 },
    { voice: "gurgle", at: 0.1, f: 240, n: 12, decay: 1.2 },
  ],
  // Sound B: the pop is kept; each arm makes a soft wet lift as it rises
  // and a soft pat as it settles, one after another.
  starfish: [
    { voice: "pop", f: 300, decay: 1.8 },
    { voice: "squish", at: 0.05, pitch: 1.5, bright: 0.2, decay: 0.4, vol: 0.3 },
    { voice: "squish", at: 0.24, pitch: 1.4, bright: 0.2, decay: 0.4, vol: 0.3 },
    { voice: "squish", at: 0.43, pitch: 1.6, bright: 0.2, decay: 0.4, vol: 0.3 },
    { voice: "squish", at: 0.62, pitch: 1.45, bright: 0.2, decay: 0.4, vol: 0.3 },
    { voice: "squish", at: 0.81, pitch: 1.55, bright: 0.2, decay: 0.4, vol: 0.3 },
    { voice: "patter", at: 0.94, f: 900, n: 1, decay: 0.1, vol: 0.5 },
    { voice: "patter", at: 1.13, f: 950, n: 1, decay: 0.1, vol: 0.5 },
    { voice: "patter", at: 1.32, f: 850, n: 1, decay: 0.1, vol: 0.5 },
    { voice: "patter", at: 1.51, f: 900, n: 1, decay: 0.1, vol: 0.5 },
    { voice: "patter", at: 1.7, f: 1000, n: 1, decay: 0.1, vol: 0.5 },
  ],
  // The spines rustle wave after wave.
  "sea-urchin": { voice: "rattle", f: 3000, n: 40, decay: 10, vol: 0.55 },
  // The fly buzzes in, the tongue flicks out and back, a gulp, two croaks.
  // Sound B: a real fly's wandering buzz, and real croaks.
  frog: [
    { voice: "sample", file: "frog-fly.mp3", len: 1.1, vol: 0.3, fallback: { voice: "flybuzz", f: 210, decay: 0.9, vol: 0.4 } }, // prettier-ignore
    { voice: "whoosh", at: 0.98, f: 1400, to: 2, decay: 0.25, vol: 0.6 },
    { voice: "pop", at: 1.56, f: 500, vol: 0.6 },
    { voice: "gloop", at: 1.82, f: 140, vol: 0.7 },
    { voice: "sample", file: "frog-croak.mp3", at: 2.55, vol: 1.4, fallback: { voice: "croak", f: 280, n: 2, rate: 30 } }, // prettier-ignore
  ],
  penguin: { voice: "squawk", f: 420 },
  // Sound C (his note of October 2: too long, like a dog): a short, natural owl hoot, h'HOO-oo and
  // a soft hoo (CC0, Gerent on Freesound).
  owl: {
    voice: "sample",
    file: "owl-hoot-short.mp3",
    len: 1.15,
    vol: 0.8,
    fallback: { voice: "owlhoot", f: 330 },
  },

  // ---- Holidays ---------------------------------------------------------------------
  "jack-o-lantern": {
    on: [
      { voice: "whoosh", f: 200, to: 3, decay: 0.8 },
      { voice: "theremin", f: 300, to: 0.7, decay: 0.8, vol: 0.4 },
    ],
    off: { voice: "whoosh", f: 600, to: 0.3, decay: 0.6 },
  },
  // Drips as it melts, then the crunch of snow as it builds itself again
  // and a twinkle as the pieces hop back.
  snowman: [
    { voice: "drip", at: 0.3, f: 1000, n: 6, rate: 3.5 },
    { voice: "crunch", at: 3.1, f: 1000, n: 16, decay: 1.6, bright: 0.2 },
    { voice: "chimes", at: 3.95, f: "E6", n: 4, decay: 0.8, vol: 0.4 },
  ],
  // Sound B: a real firework: the thump and rush of the launch (no
  // whistle), a deep boom as it bursts (0.82 s) and the stars' soft crackle.
  fireworks: [
    { voice: "launch", f: 90, decay: 0.9 },
    { voice: "sample", file: "fireworks-burst.mp3", at: 0.82, vol: 1.8, fallback: { voice: "bang", f: 55, n: 14, decay: 1.4 } }, // prettier-ignore
  ],
  // Sound C (his note of October 2: a nicer instrument): lighting up, Jingle Bells on a real
  // glockenspiel (CC0, sgossner on Freesound; its C6 note pitched to each), with a shake of real
  // sleigh bells (CC0, Selector on Freesound); off, a soft rustle.
  "decorated-tree": {
    on: [
      ...[
        [0, 1.2513],
        [0.2, 1.2513],
        [0.4, 1.2513],
        [0.8, 1.2513],
        [1.0, 1.2513],
        [1.2, 1.2513],
        [1.6, 1.2513],
        [1.8, 1.4881],
        [2.0, 0.9932],
        [2.3, 1.1148],
        [2.4, 1.2513],
      ].map(([at, pitch]) => ({
        voice: "sample",
        file: "decorated-tree-bell.mp3",
        at,
        pitch,
        vol: 0.55,
        fallback: { voice: "bell", f: Math.round(1054 * pitch), decay: 0.6, vol: 0.4 },
      })),
      {
        voice: "sample",
        file: "decorated-tree-sleigh.mp3",
        vol: 0.35,
        fallback: { voice: "jingle", vol: 0.3 },
      },
      {
        voice: "sample",
        file: "decorated-tree-sleigh.mp3",
        at: 1.6,
        pitch: 1.05,
        vol: 0.3,
        fallback: { voice: "jingle", vol: 0.25 },
      },
    ],
    off: { voice: "rustle", f: 2800, n: 10, decay: 0.6, vol: 0.4 },
  },
  "patterned-egg": { voice: "clack", f: 2100, decay: 1.6, bright: 0.3 },
  "paper-lantern": { voice: "flutter", f: 1300, rate: 7, decay: 1.8, vol: 0.5 },
  diya: {
    on: { voice: "whoosh", f: 350, to: 2.5, decay: 0.7, vol: 0.7 },
    off: { voice: "breath", f: 800, to: 0.5, decay: 0.5 },
  },
  // Sound B: a match struck, then each wick catching with a soft flame as
  // it lights (the helper first, then one by one); going out, a small puff
  // as each flame goes out in turn (no big gust).
  menorah: {
    on: [
      { voice: "scrape", f: 2300, rate: 50, decay: 0.25, vol: 0.8 },
      { voice: "flame", at: 0.18, f: 120, n: 0, bright: 0.7, decay: 0.2, vol: 0.35 },
      { voice: "flame", at: 0.6, f: 120, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 1.1, f: 125, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 1.59, f: 115, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 2.09, f: 120, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 2.58, f: 125, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 3.08, f: 115, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 3.57, f: 120, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
      { voice: "flame", at: 4.07, f: 125, n: 0, bright: 0.7, decay: 0.2, vol: 0.3 },
    ],
    off: [
      { voice: "breath", at: 0.5, f: 1400, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 1, f: 1350, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 1.49, f: 1450, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 1.99, f: 1400, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 2.48, f: 1350, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 2.98, f: 1450, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 3.47, f: 1400, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 3.97, f: 1350, to: 0.6, decay: 0.15, vol: 0.35 },
      { voice: "breath", at: 4.29, f: 1450, to: 0.6, decay: 0.15, vol: 0.35 },
    ],
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
  // A tap on one bar plays its note as the mallet lands (pickAt).
  xylophone: {
    voice: "bar",
    notes: "C5 D5 E5 F5 G5 A5 B5 C6",
    step: 0.3214,
    at: 0.3,
    pickAt: 0.12,
  },
  // Pianos (lane Pianos): a tap on a key plays that key (pick), held for
  // about as long as the key stays down; here, a run up every key. Their
  // songs, and the electronic keyboard's keys (in the voice picked on its
  // panel), are played by the recipes (src/packs/pianos.js).
  "grand-piano": {
    voice: "concert",
    notes:
      "A0 A#0 B0 C1 C#1 D1 D#1 E1 F1 F#1 G1 G#1 A1 A#1 B1 C2 C#2 D2 D#2 E2 F2 F#2 G2 G#2 A2 A#2 B2 C3 C#3 D3 D#3 E3 F3 F#3 G3 G#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5 C6 C#6 D6 D#6 E6 F6 F#6 G6 G#6 A6 A#6 B6 C7 C#7 D7 D#7 E7 F7 F#7 G7 G#7 A7 A#7 B7 C8",
    step: 0.028,
    hold: 0.9,
  },
  "upright-piano": {
    voice: "upright",
    notes:
      "A0 A#0 B0 C1 C#1 D1 D#1 E1 F1 F#1 G1 G#1 A1 A#1 B1 C2 C#2 D2 D#2 E2 F2 F#2 G2 G#2 A2 A#2 B2 C3 C#3 D3 D#3 E3 F3 F#3 G3 G#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5 C6 C#6 D6 D#6 E6 F6 F#6 G6 G#6 A6 A#6 B6 C7 C#7 D7 D#7 E7 F7 F#7 G7 G#7 A7 A#7 B7 C8",
    step: 0.028,
    hold: 0.9,
  },
  harpsichord: {
    voice: "harpsichord",
    notes:
      "F1 F#1 G1 G#1 A1 A#1 B1 C2 C#2 D2 D#2 E2 F2 F#2 G2 G#2 A2 A#2 B2 C3 C#3 D3 D#3 E3 F3 F#3 G3 G#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5 C6 C#6 D6 D#6 E6 F6",
    step: 0.036,
    hold: 0.9,
  },
  "electronic-keyboard": {
    voice: "synth",
    notes:
      "C2 C#2 D2 D#2 E2 F2 F#2 G2 G#2 A2 A#2 B2 C3 C#3 D3 D#3 E3 F3 F#3 G3 G#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5 C#5 D5 D#5 E5 F5 F#5 G5 G#5 A5 A#5 B5 C6 C#6 D6 D#6 E6 F6 F#6 G6 G#6 A6 A#6 B6 C7",
    step: 0.036,
    hold: 0.5,
  },
  // Twinkle, Twinkle, Little Star on struck steel rods: a bright tine a hair
  // out of tune with itself (the rod shimmers) and each hammer's tick. A tap
  // on one key plays that key's note as a cue from the recipe instead.
  "toy-piano": [
    { voice: "tine", notes: TOY_PIANO_SONG, step: 0.28, at: 0.29, decay: 0.45, bright: 0.85 },
    { voice: "tine", notes: TOY_PIANO_SONG, step: 0.28, at: 0.29, pitch: 1.004, decay: 0.38, bright: 0.6, vol: 0.45 }, // prettier-ignore
    {
      voice: "clack",
      notes: TOY_PIANO_SONG,
      step: 0.28,
      at: 0.29,
      pitch: 6.5,
      decay: 0.6,
      vol: 0.18,
    },
  ],

  // ---- Vehicles ---------------------------------------------------------------------
  // Sound B: more like a real launch: the flickering roar of the exhaust
  // over a deep rumble.
  rocket: [
    { voice: "flame", f: 60, rate: 7, n: 0, bright: 0.6, decay: 1.9 },
    { voice: "roar", f: 110, bright: 0.4, decay: 2.2, vol: 0.6 },
    { voice: "rumble", f: 55, rate: 8, decay: 1.4 },
  ],
  // Sound C (his note of October 2: real rotor chop): a real helicopter's blades chopping (CC0,
  // mil0001 on Freesound); landing, the chop slowing as it fades.
  helicopter: {
    on: {
      voice: "sample",
      file: "helicopter-chop.mp3",
      vol: 0.95,
      fallback: { voice: "rotor", f: 340, rate: 9, decay: 1.8 },
    },
    off: {
      voice: "sample",
      file: "helicopter-chop.mp3",
      pitch: 0.85,
      len: 2.4,
      vol: 0.75,
      fallback: { voice: "rotor", f: 280, rate: 6, decay: 1.3, vol: 0.8 },
    },
  },
  "hot-air-balloon": { voice: "roar", f: 250, bright: 0.35, decay: 1.2 },
  // Sound C (his note of October 2: no bell or horn; a real chug): a real steam locomotive chuffing
  // (CC0, relwin on Freesound), fading with its steam (2 s).
  "steam-train": {
    voice: "sample",
    file: "steam-train-chuff.mp3",
    len: 2.1,
    vol: 0.85,
    fallback: { voice: "chug", f: 600, n: 8, rate: 3.6 },
  },
  "ocean-liner": { voice: "horn", f: 73, kind: "ship", decay: 1.3 },
  // Sound B: a real sports car revving. Sound C (his note of October 2): the engine fades out with
  // the exhaust (gone at 1.8 s).
  "sports-car": {
    voice: "sample",
    file: "sports-car-rev.mp3",
    vol: 0.9,
    fallback: [
      { voice: "motor", f: 40, to: 1.6, kind: "car", bright: 0.6, decay: 0.9 },
      { voice: "motor", at: 0.9, f: 42, to: 1.8, kind: "car", bright: 0.65, decay: 0.8 },
    ],
  },
  bus: [
    { voice: "horn", f: 330 },
    { voice: "hiss", at: 0.5, f: 2500, decay: 0.8 },
  ],
  // Sound B: a real piston engine and the propeller's beat.
  "propeller-plane": { voice: "sample", file: "propeller-plane-engine.mp3", vol: 1.4, fallback: { voice: "motor", f: 70, kind: "prop", bright: 0.5, decay: 2.4 } }, // prettier-ignore
  // Sound B: no whistle; a softer, more natural rush of the engines.
  jet: [
    { voice: "roar", f: 260, bright: 0.45, decay: 2, vol: 0.6 },
    { voice: "wind", f: 500, rate: 0.6, decay: 1, vol: 0.25 },
  ],
  sailboat: [
    { voice: "wind", f: 800, rate: 1.2, decay: 0.9 },
    { voice: "splash", at: 0.4, f: 2000, bright: 0.3, decay: 0.8, vol: 0.6 },
  ],
  submarine: { voice: "sonar", f: 1180 },
  // Sound C (his note of October 2: a real bell): a real bicycle bell's ding-ding (CC0, PanosA on
  // Freesound).
  bicycle: {
    voice: "sample",
    file: "bicycle-bell.mp3",
    vol: 0.8,
    fallback: { voice: "bell", notes: "A6 - A6", step: 0.14, decay: 0.35, bright: 0.9 },
  },
  // Sound B: a slow diesel's putt-putt and clatter.
  tractor: { voice: "sample", file: "tractor-engine.mp3", vol: 1.5, fallback: { voice: "motor", f: 13, to: 1.3, kind: "tractor", bright: 0.25, decay: 1.8 } }, // prettier-ignore
  // Sound B: less childish: a deep pulsing hum and a heavy rush as it lifts
  // (no whistling theremin).
  ufo: {
    on: [
      { voice: "hum", f: 55, bright: 0.2, decay: 1.8, vol: 0.6 },
      { voice: "whoom", at: 0.2, f: 350, decay: 1.2, vol: 0.5 },
    ],
    off: [
      { voice: "whoom", f: 300, decay: 1, vol: 0.5 },
      { voice: "hum", f: 50, bright: 0.2, decay: 1.2, vol: 0.5 },
    ],
  },

  // ---- Landmarks --------------------------------------------------------------------
  // The lights sparkle, and a boom for each of the four bursts.
  // Sound B: real fireworks bursting, four of them (no twinkling lights).
  "eiffel-tower": [
    { voice: "launch", f: 85, decay: 0.4, vol: 0.4 },
    { voice: "sample", file: "fireworks-burst.mp3", at: 0.38, len: 1.4, vol: 1.1, fallback: { voice: "bang", f: 50, n: 8, decay: 1, vol: 0.5 } }, // prettier-ignore
    { voice: "sample", file: "fireworks-burst.mp3", at: 0.93, pitch: 1.12, len: 1.4, vol: 1, fallback: { voice: "bang", f: 58, n: 6, decay: 1, vol: 0.45 } }, // prettier-ignore
    { voice: "sample", file: "fireworks-burst.mp3", at: 1.48, pitch: 0.9, len: 1.4, vol: 1.1, fallback: { voice: "bang", f: 46, n: 8, decay: 1, vol: 0.5 } }, // prettier-ignore
    { voice: "sample", file: "fireworks-burst.mp3", at: 2.13, pitch: 1.05, vol: 1, fallback: { voice: "bang", f: 54, n: 10, decay: 1.2, vol: 0.45 } }, // prettier-ignore
  ],
  // Sound B: only the soft chime at noon (no wind).
  "washington-monument": { voice: "chimes", at: 2.2, f: "G5", n: 3, decay: 1.2, vol: 0.35 },
  // The saucer arrives, sand hisses up into the beam, and it zips away.
  pyramids: [
    { voice: "theremin", f: 330, to: 1.26, decay: 1.2, vol: 0.7 },
    { voice: "hiss", at: 1.4, f: 6000, decay: 2.2, vol: 0.5 },
    { voice: "theremin", at: 4.3, f: 440, to: 2.2, decay: 0.5, vol: 0.6 },
  ],
  // Sound B (his note: less cute): the lift's low whir as the floors wring
  // round, and a soft low bell each time the ring of light reaches the top.
  supertall: [
    { voice: "hum", f: 80, bright: 0.15, decay: 1.6, vol: 0.35 },
    { voice: "whoom", at: 0.2, f: 300, decay: 1.2, vol: 0.3 },
    { voice: "bell", at: 1.55, f: "G4", decay: 0.6, bright: 0.1, vol: 0.3 },
    { voice: "bell", at: 3.55, f: "C5", decay: 0.6, bright: 0.1, vol: 0.25 },
  ],
  lighthouse: {
    on: { voice: "horn", f: 62, kind: "fog", decay: 1.4 },
    off: { voice: "switch", f: 1800, decay: 1.5 },
  },
  // The flame whooshes up, sparks crackle and a harbour bell rings.
  "statue-of-liberty": [
    // Sound B: no crackling clicks.
    { voice: "whoosh", f: 300, to: 3, decay: 0.8 },
    { voice: "bell", at: 0.5, f: "D5", decay: 1.3, bright: 0.4 },
  ],
  // The jet shoots up and its spray patters back into the basin.
  // Sound B: no patter of clicks; the spray falls back as a soft, steady
  // rush of water.
  "white-house": [
    { voice: "splash", f: 2400, bright: 0.8, decay: 1.6 },
    { voice: "roar", at: 0.4, f: 500, bright: 0.7, decay: 2.2, vol: 0.35 },
  ],
  // The tower grinds as it leans, then both balls land at the same moment.
  "leaning-tower": [
    { voice: "scrape", f: 240, rate: 9, decay: 1.4, vol: 0.35 },
    { voice: "thud", at: 1.9, f: 140, bright: 0.3 },
    { voice: "thud", at: 1.9, f: 75, bright: 0.2 },
  ],
  // The crowd cheers over the drumming hooves.
  // Sound B: a real crowd in the stands, and horses' hooves trotting.
  colosseum: [
    { voice: "sample", file: "colosseum-crowd.mp3", vol: 0.8, fallback: { voice: "crowd", f: 200, n: 16, to: 1.15, decay: 1.4, vol: 0.8 } }, // prettier-ignore
    { voice: "sample", file: "colosseum-hooves.mp3", at: 0.3, vol: 1.6, fallback: { voice: "hooves", f: 480, n: 8, rate: 2.6 } }, // prettier-ignore
    { voice: "sample", file: "colosseum-crowd.mp3", at: 2.3, from: 0.6, len: 2.3, vol: 0.6, fallback: { voice: "crowd", f: 210, n: 14, to: 1.3, decay: 1.2, vol: 0.75 } }, // prettier-ignore
  ],
  // A lyre plays a walking tune for the procession.
  parthenon: { voice: "harp", notes: "D4 A4 D5 F5 E5 D5 A4 D5", step: 0.45, decay: 0.9 },
  // A low drone as the sun rises, and a bell as it lights the stones.
  stonehenge: [
    { voice: "drone", f: 65, bright: 0.25, decay: 2 },
    { voice: "bell", at: 1.9, f: "D5", decay: 1.4, bright: 0.2 },
  ],
  // The Westminster quarters, simplified: four notes, then the hour bell.
  "big-ben": [
    { voice: "bell", notes: "E5 C5 D5 G4 - G4 D5 E5 C5", step: 0.34, decay: 0.8 },
    { voice: "bell", at: 3.3, f: "E3", decay: 1.3 },
  ],
  // A slow sitar phrase for the moonlight.
  "taj-mahal": { voice: "sitar", notes: "D3 A3 D4 - C4 A3", step: 0.55, decay: 0.9 },
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

  // ---- AI and computing -----------------------------------------------------------
  // Blips as the two live inputs fire (0.3 s, then again at 2.1 s), a click as
  // the lamp decides wrong (1.4 s), a rising tone as it learns, a click as the
  // lamp snaps on (3.15 s).
  perceptron: [
    { voice: "blip", at: 0.3, f: 660, to: 1.3 },
    { voice: "blip", at: 0.36, f: 880, to: 1.3 },
    { voice: "click", at: 1.4, f: 900 },
    { voice: "tone", at: 1.55, f: 330, to: 2, decay: 1.2, vol: 0.8 },
    { voice: "blip", at: 2.1, f: 660, to: 1.3 },
    { voice: "blip", at: 2.16, f: 880, to: 1.3 },
    { voice: "click", at: 3.15, f: 2200 },
    { voice: "ding", at: 3.17, f: "E6", decay: 0.6, vol: 0.5 },
  ],
  // XOR, one input pair at a time (every 1.15 s from 0.15 s): a blip for
  // each lit input, a tick as the hidden layer fires, and a ding only when
  // the answer is 1 (01 and 10), a low knock when it is 0.
  "multilayer-perceptron": [
    { voice: "wood", at: 1.08, f: 300, decay: 0.8 },
    { voice: "blip", at: 1.33, f: 700, to: 1.3 },
    { voice: "ding", at: 2.14, f: "E6", decay: 0.5, vol: 0.6 },
    { voice: "blip", at: 2.48, f: 700, to: 1.3 },
    { voice: "ding", at: 3.29, f: "G6", decay: 0.5, vol: 0.6 },
    { voice: "blip", at: 3.63, f: 700, to: 1.3 },
    { voice: "blip", at: 3.67, f: 880, to: 1.3 },
    { voice: "wood", at: 4.38, f: 300, decay: 0.8 },
  ],
  // A rising arpeggio as each layer lights (0.05, 1.1, 2.1 s), a falling one
  // as the red pulses run back (2.5 to 3.55 s).
  // Sound B: more intense: an electric surge as each layer lights (0.05,
  // 1.1, 2.1 s) over a dark chord, a deep hit at the answer, and crackling
  // current as the red pulses run back (2.5 s).
  "neural-network": [
    { voice: "glow", notes: "A2+E3", decay: 1.6, bright: 0.5, vol: 0.45 },
    { voice: "arc", at: 0.05, f: 2200, decay: 1.2, vol: 0.6 },
    { voice: "arc", at: 1.1, f: 2600, decay: 1.2, vol: 0.7 },
    { voice: "arc", at: 2.1, f: 3000, decay: 1.4, vol: 0.8 },
    { voice: "hit", at: 2.1, f: 50, vol: 0.45 },
    { voice: "arc", at: 2.5, f: 1800, rate: 70, decay: 3, vol: 0.45 },
  ],
  // A tick at each of the filter's 25 steps, a chime as the answer rises.
  cnn: [
    { voice: "click", at: 0.28, f: 2600, notes: "C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7", step: 0.084 }, // prettier-ignore
    { voice: "glass", at: 3.5, notes: "C6 E6 G6", step: 0.09, decay: 1.2 },
  ],
  // A pulse as each word goes in (0.55, 1.75, 2.95 s), and the loop's hum
  // climbing as the memory builds.
  // Sound B: a soft pulse of current as each word goes in (0.55, 1.75,
  // 2.95 s), and the loop's chord growing a note each time as the memory
  // builds (no rising hum).
  rnn: [
    { voice: "arc", at: 0.55, f: 2400, decay: 0.6, vol: 0.5 },
    { voice: "glow", at: 0.6, notes: "A2", decay: 0.55, bright: 0.4, vol: 0.5 },
    { voice: "arc", at: 1.75, f: 2600, decay: 0.6, vol: 0.5 },
    { voice: "glow", at: 1.8, notes: "A2+E3", decay: 0.55, bright: 0.45, vol: 0.5 },
    { voice: "arc", at: 2.95, f: 2800, decay: 0.6, vol: 0.5 },
    { voice: "glow", at: 3, notes: "A2+E3+A3", decay: 0.7, bright: 0.5, vol: 0.5 },
  ],
  // A shimmering chord for each layer's attention (0.05, 1.6 s), a pop for
  // the next word (3.1 s) and a knock as it lands.
  // Sound B: the two attention layers as warm swells of current, not
  // electronic shimmers.
  transformer: [
    { voice: "glow", at: 0.05, notes: "D3+A3", decay: 0.6, bright: 0.5, vol: 0.6 },
    { voice: "arc", at: 0.1, f: 2400, decay: 0.8, vol: 0.4 },
    { voice: "glow", at: 1.6, notes: "E3+B3", decay: 0.6, bright: 0.5, vol: 0.6 },
    { voice: "arc", at: 1.65, f: 2800, decay: 0.8, vol: 0.4 },
    { voice: "pop", at: 3.1, f: 900 },
    { voice: "wood", at: 3.95, f: 600, decay: 0.8 },
  ],
  // A tone a step higher as the tiles pass through the block on each lap,
  // then the chord resolves as the answer settles.
  "looped-transformer": [
    { voice: "tone", at: 0.75, f: "C5", decay: 1.4, vol: 0.7 },
    { voice: "tone", at: 2.0, f: "E5", decay: 1.4, vol: 0.7 },
    { voice: "tone", at: 3.2, f: "G5", decay: 1.4, vol: 0.7 },
    { voice: "tine", at: 3.85, notes: "C5+E5+G5+C6", strum: 0.04, decay: 0.55 },
  ],
  // A white-noise hiss that fades as the specks clear, and a clean chord at
  // step 0.
  // Sound B: a soft dark swell as the noise clears (no sandy hiss), and a
  // chord rolled on the piano as the duck appears (2.9 s).
  "diffusion-model": [
    { voice: "glow", notes: "A2+E3", decay: 1.3, bright: 0.3, vol: 0.5 },
    { voice: "grand", at: 2.9, notes: "C3+G3+C4+E4+G4", strum: 0.06, hold: 1.4, vol: 0.55 },
  ],
  // Sound B: a soft tap as the ball lands each of its 21 hops down (0.3 s,
  // one every 0.165 s), and a last one as it lands home (4.45 s).
  "gradient-descent": [
    { voice: "thud", at: 0.465, notes: "F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3 F3", step: 0.165, bright: 0.5, decay: 0.35, vol: 0.45 }, // prettier-ignore
    { voice: "thud", at: 4.45, f: 150, bright: 0.4, decay: 0.4, vol: 0.4 },
  ],
  // Sound C (his notes of October 2): each view plays its own sound from the recipe
  // (src/packs/splatting.js): training, a soft tone falling as the loss curve draws; one splat, a
  // soft airy swell; many splats, a faint twinkle; sorting, a pebble's click as each splat is
  // placed. This is the training view's.
  "gaussian-splatting": { voice: "glide", at: 0.35, f: 740, to: 0.45, decay: 1.5, vol: 0.45 },
  // Three chimes as the arrows run (0.15, 0.85, 1.55 s), a bright ding as
  // QUEEN lights.
  "word-vectors": [
    { voice: "chimes", at: 0.15, f: 1047, n: 1, decay: 0.8 },
    { voice: "chimes", at: 0.85, f: 1175, n: 1, decay: 0.8 },
    { voice: "chimes", at: 1.55, f: 1319, n: 1, decay: 0.8 },
    { voice: "ding", at: 2.25, f: "C7", decay: 1.2 },
  ],
  // Each swap plays the height of the bar moving right (bubble sort, a swap
  // every 0.225 s), then the sorted bars play their rising scale.
  "sorting-machine": [
    { voice: "marimba", at: 0.44, notes: "A4 C5 C5 C5 C5 C5 A4 B4 B4 B4 E4 A4 A4 A4 F4 E4", step: 0.225, decay: 0.6 }, // prettier-ignore
    { voice: "marimba", at: 3.95, notes: "C4 D4 E4 F4 G4 A4 B4 C5", step: 0.06, decay: 0.8 },
  ],
  // Two switch clicks, a ding as the carry lamp lights, and the switches
  // flipping back (Sound B: the buzz is gone).
  "half-adder": [
    { voice: "switch", at: 0.1, f: 2800 },
    { voice: "switch", at: 0.35, f: 2500 },
    { voice: "ding", at: 2.0, f: "G6", decay: 0.8 },
    { voice: "switch", at: 2.88, f: 2200, vol: 0.7 },
  ],
  // ---- Machines that compute (lane Machines A) ------------------------------------
  // The start lever's relay; then drive() plays each step as it runs: a
  // relay click as the feeler reads, a wooden clack as a tile flips, a
  // short whir as the tape slides, and a bell at the halt.
  "turing-machine": { voice: "switch", f: 1900, decay: 0.8, vol: 0.6 },
  // The crank's catch; then drive() plays each turn: the ratchet, a brass
  // click for each wheel step, a snap for each carry and a small bell.
  "difference-engine": { voice: "click", f: 1100, decay: 0.7, vol: 0.5 },
  // The operator's hand on the first key; then drive() plays each letter:
  // a heavy key clack, the rotors' ratchet and a faint lamp click.
  "enigma-machine": { voice: "wood", f: 330, decay: 0.4, vol: 0.4 },
  // The motor switch; then drive() plays the drums' clatter (Sound B: no
  // motor buzz), and a sharp stop with a bell when a setting is found.
  bombe: { voice: "switch", f: 1200, decay: 1.2, vol: 0.7 },

  // ---- Pictures and pages (lane Pictures) -------------------------------------------
  // A page turning: a soft paper swish, then a light tap as it lands.
  // Sound B: a real paper page turning.
  "picture-lab": { voice: "sample", file: "book-page.mp3", vol: 1.3, fallback: { voice: "pageflip", f: 1700, decay: 0.9, vol: 0.8 } }, // prettier-ignore

  // ---- Pictures and pages (lane Books) ----------------------------------------------
  // Sound C (his note of October 2: a page sound per book type): each style plays its own real page
  // from the recipe (src/packs/pictures.js): glossy for the magazine, light for the paperback,
  // fuller for the hardcover (this one).
  "your-book": [
    {
      voice: "sample",
      file: "your-book-hardcover.mp3",
      vol: 1.1,
      fallback: { voice: "pageflip", f: 1900, decay: 1.4, vol: 0.7 },
    },
    { voice: "thud", at: 0.82, f: 150, decay: 0.35, vol: 0.3 },
  ],
  // A thick card page: a lower swish and a firmer thud.
  "photo-album": [
    { voice: "sample", file: "book-page.mp3", pitch: 0.8, vol: 1.2, fallback: { voice: "pageflip", f: 1200, decay: 1.6, vol: 0.7 } }, // prettier-ignore
    { voice: "thud", at: 0.88, f: 115, decay: 0.45, vol: 0.45 },
  ],
  // The frame knocks the wall, the wire creaks on the nail, and a softer knock.
  "picture-frame": [
    { voice: "wood", f: 250, decay: 0.35, vol: 0.5 },
    { voice: "scrape", at: 0.12, f: 1500, decay: 0.3, vol: 0.12 },
    { voice: "wood", at: 0.55, f: 225, decay: 0.3, vol: 0.28 },
  ],
  // ---- Studio (lane Studio Sound) ---------------------------------------------------
  // The plate's real hum follows its mode and is a cue from drive(); this is
  // the sample the Sound Board plays (the default mode's 780 Hz).
  "chladni-plate": {
    on: [
      { voice: "tone", f: 780, decay: 9, kind: "sine", vol: 0.9 },
      // Sound B (his note): the sand slides, it doesn't patter.
      { voice: "breath", at: 0.1, f: 2600, to: 0.8, decay: 3, vol: 0.25 },
    ],
    off: { voice: "hiss", f: 3000, decay: 0.7, vol: 0.3 },
  },
  // The song landscape plays the song itself; this is its tap's start chime.
  "song-landscape": [
    { voice: "pluck", notes: "C5 E5 G5", step: 0.09, decay: 0.5, bright: 0.4, vol: 0.6 },
  ],
  // Lane Studio Models: the splats lift off in a rising whoosh and settle back as falling notes.
  "model-splats": [
    { voice: "zap", f: 420, to: 4, decay: 2.4, vol: 0.35 },
    {
      voice: "pluck",
      at: 1.6,
      notes: "B5 F#5 D5 B4",
      step: 0.16,
      decay: 0.7,
      bright: 0.5,
      vol: 0.45,
    },
  ],
  // Lane Live input: a hand clap that rings like the sample room; the mirror's depth rises and falls.
  "room-echo": [{ voice: "clap", f: 1400, decay: 4.4, vol: 0.8 }],
  "splat-mirror": {
    on: { voice: "whoosh", f: 240, to: 5, decay: 1.6, vol: 0.5 },
    off: { voice: "whoosh", f: 1800, to: 0.2, decay: 1.2, vol: 0.45 },
  },
  // Lane Live input r3: Moving photo to 3D pauses and plays with a soft click.
  "moving-photo-3d": {
    on: { voice: "click", f: 1200, decay: 0.05, vol: 0.35 },
    off: { voice: "click", f: 900, decay: 0.05, vol: 0.3 },
  },
  // Lane Photo to 3D, Sound B (his note: no wind, no whoosh): the photo's
  // paper lifting as the depth comes up and settling back as it lies flat.
  "photo-3d": {
    on: [
      { voice: "rustle", f: 2200, n: 10, decay: 0.8, vol: 0.35 },
      { voice: "thud", at: 1.8, f: 130, bright: 0.2, decay: 0.4, vol: 0.25 },
    ],
    off: [
      { voice: "rustle", f: 2000, n: 8, decay: 0.7, vol: 0.3 },
      { voice: "thud", at: 1.2, f: 120, bright: 0.2, decay: 0.4, vol: 0.25 },
    ],
  },
  // Lane Video 3D: a soft, level breath of air as the flight sets off and as the camera comes home
  // (no rising sweep; the video's own sound plays during the flight of a video you opened).
  "video-3d": {
    on: { voice: "whoosh", f: 700, to: 1, decay: 1.2, vol: 0.22 },
    off: { voice: "whoosh", f: 600, to: 1, decay: 1.0, vol: 0.18 },
  },
  // Lane Screens: the old TV's click and hum (each style plays its own
  // cues as it switches on: the flat TV's soft tone, the cinema's curtains,
  // the hologram's shimmer).
  // The old TV: on, a click and a crackle (Sound B: no hum, his note); off, the knob's click
  // and the whine falling away (lane Screens r2). The Screen plays each
  // style's own sounds from its recipe (src/packs/screens.js).
  screen: {
    on: [
      { voice: "switch", f: 1800, vol: 0.9 },
      { voice: "zap", at: 0.1, f: 5200, to: 0.9, decay: 0.5, vol: 0.18 },
    ],
    off: [
      { voice: "switch", f: 1500, vol: 0.9 },
      { voice: "zap", at: 0.05, f: 7800, to: 0.35, decay: 1.4, vol: 0.12 },
      { voice: "hum", at: 0.02, f: 62, to: 0.6, decay: 0.7, bright: 0.12, vol: 0.35 },
    ],
  },
  // Sound C (his note of October 2: no robotic pulse): each field plays its own sound from the
  // recipe (src/packs/lab.js): a soft hush for the galaxy's ring, a stone's plop and a gentle wash
  // for the ocean, a warm swelling tone for the knot. This is the galaxy's.
  // Lane QR: the tap bursts the code (a soft pop, a whoosh, pieces landing);
  // Assemble and Flip play their own through the recipe's cues.
  "qr-code": [
    { voice: "thud", f: 110, decay: 0.3, vol: 0.4 },
    { voice: "breath", f: 700, to: 0.5, decay: 0.9, vol: 0.2 },
    { voice: "wood", at: 1.05, f: 900, decay: 0.12, vol: 0.12 },
    { voice: "breath", at: 2.15, f: 600, to: 1.2, decay: 1.0, vol: 0.16 },
  ],
  "splat-field": { voice: "breath", f: 520, to: 0.75, decay: 3.4, vol: 0.2 },
  // ---- Science (lane Science) ----------------------------------------------------------
  // Quiet and subtle (PACKS.md 7e): atoms make no sound, so the jiggle is a faint
  // jostle of tiny taps under a soft breath, and it settles with a softer one.
  "thermal-ellipsoids": {
    on: [
      { voice: "patter", f: 2400, n: 18, decay: 1.4, vol: 0.35 },
      { voice: "breath", f: 700, to: 1, decay: 1.2, vol: 0.3 },
    ],
    off: { voice: "breath", f: 600, to: 0.6, decay: 1, vol: 0.3 },
  },
  // A microscope's focus knob turning smoothly while the slice comes in, and
  // turning back, a little lower, as it goes.
  "smlm-microscope": {
    on: { voice: "scrape", f: 420, rate: 4, decay: 4.4, vol: 0.35 },
    off: { voice: "scrape", f: 360, rate: 4, decay: 4, vol: 0.3 },
  },
  // Space is silent: a long, soft breath as the hot gas thins away, and a lower
  // one as it comes back.
  "galaxy-box": {
    on: { voice: "breath", f: 500, to: 0.8, decay: 2.8, vol: 0.35 },
    off: { voice: "breath", f: 400, to: 1.2, decay: 2.4, vol: 0.3 },
  },
  // ---- Fluid lab (lane Fluids) ------------------------------------------------------
  // A pour's splash and glug (each scene plays its own through cues: a pour,
  // a thick gloop for honey and lava, a splash, a breath on the candle).
  "fluid-lab": [
    { voice: "splash", f: 520, decay: 1.2, vol: 0.55 },
    { voice: "bubbles", at: 0.25, n: 7, rate: 9, decay: 1.4, vol: 0.45 },
  ],
  // ---- Tiny world r2 (lane Tiny world r2) ----
  // The story's own cues (tRNAs docking, the stop codon, the fold) come from
  // drive() in src/packs/tiny-r2.js; the tap starts it with a soft swell.
  "dna-to-protein": [
    { voice: "glass", f: 784, decay: 1.6, vol: 0.7, bright: 0.25 },
    { voice: "glass", f: 1175, at: 0.18, decay: 1.4, vol: 0.45, bright: 0.25 },
  ],
  // Cell division: a soft swell as the chromatin condenses, a light tick
  // as the sisters part (7.6 s) and a low wooden pop as the cells pinch
  // apart (13 s).
  mitosis: [
    { voice: "breath", f: 900, to: 0.7, decay: 2.2, vol: 0.7 },
    { voice: "tine", f: 1319, at: 7.7, decay: 1.2, vol: 0.6 },
    { voice: "hollow", f: 260, at: 13.1, decay: 0.8, vol: 0.9 },
  ],
  // Apoptosis: a low sigh as the cell shrinks, soft bubbling as it blebs and
  // a few quiet pops as the bodies part (6.6 s).
  apoptosis: [
    { voice: "breath", f: 500, to: 0.5, decay: 1.8, vol: 0.25 },
    { voice: "boing", f: 300, at: 2.6, decay: 0.4, vol: 0.6 },
    { voice: "boing", f: 360, at: 3.4, decay: 0.4, vol: 0.3 },
    { voice: "boing", f: 330, at: 4.2, decay: 0.4, vol: 0.3 },
    { voice: "pock", f: 520, at: 6.7, decay: 0.3, vol: 0.5 },
    { voice: "pock", f: 600, at: 7.1, decay: 0.3, vol: 0.45 },
  ],
  // Phagocytosis: a soft stretch as the pseudopods reach out, a gulp as the
  // phagosome closes (4.5 s) and a low fizz as it is digested.
  phagocytosis: [
    { voice: "breath", f: 1100, to: 0.6, at: 2.0, decay: 2.0, vol: 0.3 },
    { voice: "thud", f: 140, at: 4.5, decay: 0.5, vol: 0.7 },
    { voice: "hollow", f: 420, at: 4.55, decay: 0.5, vol: 0.5 },
    { voice: "breath", f: 2400, to: 0.4, at: 8.9, decay: 2.0, vol: 0.2 },
  ],
};

// The toy's sound, or null when it has none (visitors' own splats).
export function toySound(id) {
  return TOY_SOUNDS[id] || null;
}
