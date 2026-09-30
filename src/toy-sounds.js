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
  "pencil-real": [
    { voice: "wood", f: 1500, decay: 0.5, vol: 0.8 },
    { voice: "scrape", at: 0.05, f: 900, rate: 7, decay: 4.2, vol: 0.45 },
  ],
  "tin-can-real": [
    { voice: "metal", f: 520, decay: 0.5, bright: 0.7 },
    { voice: "ratchet", at: 0.1, f: 3200, n: 22, rate: 9, to: 2.6, vol: 0.45 },
    { voice: "metal", at: 2.3, f: 470, decay: 0.7, bright: 0.6, vol: 0.9 },
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
  // The pitch's whoosh, then the crack of the bat as it comes back.
  baseball: [
    { voice: "whoosh", at: 0.24, f: 900, to: 3, decay: 0.5, vol: 0.4 },
    { voice: "crack", at: 0.82, f: 2400, bright: 0.8 },
  ],
  // The underhand release, then a muffled thud where it lands far off.
  softball: [
    { voice: "whoosh", at: 0.52, f: 500, to: 2, decay: 0.6, vol: 0.3 },
    { voice: "thud", at: 1.4, f: 130, bright: 0.25, decay: 0.8 },
  ],
  // A soft punch up, then the plasticky boing as it lands.
  "beach-ball": [
    { voice: "slap", f: 600, vol: 0.35 },
    { voice: "boing", at: 1.42, f: 240, to: 1.4, rate: 9, decay: 0.8 },
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
    { voice: "rumble", at: 0.32, f: 70, rate: 12, decay: 0.9 },
    { voice: "clatter", at: 2.02, f: 1100, n: 10, kind: "wood" },
  ],
  "pool-ball": { voice: "clack", f: 2900 },
  // The paddle's hollow pop, and air whistling through the holes.
  pickleball: [
    { voice: "pock", f: 1250, bright: 0.2, decay: 1.3 },
    { voice: "whistle", f: 1800, to: 0.8, decay: 0.9, vol: 0.35 },
  ],
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
  // A glassy clink, and a soft whirr as it rolls.
  marble: [
    { voice: "glass", f: 2350, decay: 0.6, bright: 0.7 },
    { voice: "rumble", f: 380, rate: 28, decay: 1.2, vol: 0.18 },
  ],
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
    { voice: "pad", notes: "C4 G4 C5+E5", step: 0.7, decay: 1.2 },
    { voice: "shimmer", at: 3.3, f: "E6", rate: 6, decay: 1.2, vol: 0.8 },
  ],
  // A bright tone as it spins, then the sizzle of the day side's heat.
  mercury: [
    { voice: "tone", f: "E6", decay: 0.5 },
    { voice: "sizzle", at: 0.5, f: 3200, decay: 1.8, vol: 0.5 },
  ],
  venus: { voice: "wind", f: 260, rate: 0.4, decay: 2.4 },
  // Surf and wind through the day, a soft chime as the city lights come on.
  earth: [
    { voice: "wave", f: 500, decay: 1.4 },
    { voice: "wind", f: 900, rate: 0.6, decay: 2.2, vol: 0.5 },
    { voice: "ding", at: 1.6, f: "E6", decay: 1.2, vol: 0.4 },
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
    { voice: "hiss", f: 2200, decay: 2.4 },
    { voice: "wind", at: 0.3, f: 700, rate: 1.4, decay: 2, vol: 0.6 },
  ],
  jupiter: { voice: "drone", f: 44, bright: 0.2, decay: 1.8 },
  // A shimmer for each ripple across the rings.
  saturn: [
    { voice: "shimmer", f: "E5", rate: 5 },
    { voice: "shimmer", at: 0.8, f: "B5", rate: 6, decay: 0.8, vol: 0.7 },
  ],
  uranus: { voice: "tone", f: "B4", to: 1.02, kind: "triangle", decay: 3 },
  neptune: { voice: "wind", f: 330, rate: 0.9, decay: 2.4 },
  "aurora-planet": { voice: "whistle", f: 1500, to: 1.3, decay: 2.4, vol: 0.7 },
  // The crack, a boom as it falls apart, and a knock as the pieces meet again.
  asteroid: [
    { voice: "crack", f: 1300, bright: 0.3 },
    { voice: "kick", at: 0.3, f: 45, decay: 2 },
    { voice: "stone", at: 4.5, f: 260, decay: 1.2 },
  ],
  comet: { voice: "whoosh", f: 200, to: 6, decay: 2.2 },
  // It sizzles in and bursts (0.36 s); the next one sizzles in (3.4 s).
  meteor: [
    { voice: "sizzle", f: 4500, decay: 0.5 },
    { voice: "kick", at: 0.36, f: 50, decay: 2.2 },
    { voice: "sizzle", at: 3.4, f: 3800, decay: 0.8, vol: 0.7 },
  ],
  // Swelling to a giant and the whoosh as it puffs off its shell; the
  // recipe rings a bell when the new star lights (6.6 s).
  star: [
    { voice: "pad", notes: "A3 E4", step: 1.2, decay: 1.6 },
    { voice: "whoosh", at: 3.6, f: 250, to: 3, decay: 2 },
  ],
  // It hums as it spins up; the recipe adds a tick at each flash.
  pulsar: { voice: "hum", f: 110, to: 3, bright: 0.4, decay: 2.4 },
  // The fall, and a deep boom as the star plunges in (3.2 s).
  "black-hole": [
    { voice: "drone", f: 70, to: 0.5, bright: 0.1, decay: 1.8 },
    { voice: "kick", at: 3.2, f: 38, decay: 2.4 },
  ],
  "star-cluster": { voice: "sparkle", f: 3100, n: 12, decay: 2.4 },
  // A pad, and a shimmer as the shock reaches the ring (1.7 s).
  "planetary-nebula": [
    { voice: "pad", notes: "D4+A4", step: 0, decay: 1.4 },
    { voice: "shimmer", at: 1.7, f: "A5", rate: 8, decay: 1, vol: 0.7 },
  ],
  // A ping for each new star as it lights.
  nebula: {
    voice: "ding",
    notes: "E6 B6 G6 D7 A6 E7 C7",
    step: 0.36,
    at: 0.4,
    decay: 0.8,
    vol: 0.6,
  },
  supernova: [
    { voice: "kick", f: 40, decay: 3 },
    { voice: "roar", f: 110, bright: 0.5, decay: 2.2 },
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
    { voice: "shimmer", at: 2.3, f: "E6", rate: 9, decay: 1.2, vol: 0.35 },
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
    { voice: "squeak", f: 900, to: 1.3, decay: 1.6, vol: 0.6 },
    { voice: "squeak", at: 2.5, f: 1150, to: 0.8, decay: 1.4, vol: 0.45 },
  ],
  neuron: [
    { voice: "zap", f: 2400, to: 0.1 },
    { voice: "crackle", at: 0.2, f: 3600, n: 16, decay: 0.9 },
  ],
  // The wave spreads out along the arms; the vessel swells (1.8 s).
  astrocyte: [
    { voice: "shimmer", f: "C6", rate: 11, decay: 2.2 },
    { voice: "wave", at: 1.8, f: 180, decay: 0.8, vol: 0.45 },
  ],
  // The nucleus splits, the cell pinches in two (2.1 s), then rejoins (3.2 s).
  "animal-cell": [
    { voice: "gloop", f: 180, decay: 1.4 },
    { voice: "pop", at: 2.1, f: 450 },
    { voice: "gloop", at: 3.2, f: 140, decay: 1.2, vol: 0.7 },
  ],
  dna: { voice: "ratchet", f: 3000, n: 26, rate: 40, to: 1.6 },
  // A bacterium wriggles in, is gulped (2.1 s) and digested (3.6 s).
  "white-blood-cell": [
    { voice: "flutter", f: 1800, rate: 24, decay: 3, vol: 0.35 },
    { voice: "gloop", at: 2.1, f: 110, decay: 0.7 },
    { voice: "sizzle", at: 3.6, f: 3500, decay: 1, vol: 0.35 },
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
  // It swells and bursts (0.2 s), a puff of granules drifts away.
  pollen: [
    { voice: "breath", at: 0.18, f: 1300, to: 0.5, decay: 0.6 },
    { voice: "chirp", at: 0.4, f: 3200, n: 1 },
  ],
  // The arms melt back, then a new flake grows out (1.2 s).
  snowflake: [
    { voice: "sparkle", f: 3000, n: 5, decay: 0.8, bright: 0.5, vol: 0.5 },
    { voice: "glass", at: 1.2, notes: "E6 G6 B6 D7 E7", step: 0.45, decay: 0.5, vol: 0.45 },
  ],
  // The fibres pull the chromatids apart (0.5 s); they rejoin (3.9 s).
  chromosome: [
    { voice: "twang", at: 0.45, f: 90, decay: 1.6 },
    { voice: "clack", at: 0.55, f: 2000 },
    { voice: "clack", at: 3.9, f: 1600, vol: 0.6 },
  ],
  // Powers up along the cristae; ATP pops out in three waves (0.95 s on).
  mitochondrion: [
    { voice: "hum", f: 90, to: 2.5, bright: 0.5 },
    { voice: "blip", at: 0.95, notes: "C6 E6 G6", step: 0.35, decay: 0.6, vol: 0.5 },
  ],
  // The cilia beat hard while it swims its loop.
  paramecium: [
    { voice: "flutter", f: 2600, rate: 30, decay: 5, vol: 0.7 },
    { voice: "flutter", at: 1.5, f: 2300, rate: 28, decay: 4, vol: 0.5 },
  ],
  // A pod pushes out and it oozes over; then back the other way (2.5 s).
  amoeba: [
    { voice: "gloop", f: 95, decay: 1.8 },
    { voice: "gloop", at: 2.5, f: 85, decay: 1.8, vol: 0.8 },
  ],

  // ---- Atoms ------------------------------------------------------------------------
  // Up as the photon is taken in (0.45 s), down as it is given out (3 s).
  orbital: [
    { voice: "blip", at: 0.45, f: 700, to: 2 },
    { voice: "blip", at: 3, f: 1400, to: 0.5 },
  ],
  atom: { voice: "hum", f: 220, to: 1.8, bright: 0.2, decay: 2.6 },
  molecule: { voice: "boing", f: 330, to: 1.3, rate: 11, decay: 2 },
  // An airy rush as the pieces fly apart, and soft clicks as they lock back.
  protein: [
    { voice: "whoosh", f: 260, to: 3, decay: 1.4, vol: 0.8 },
    { voice: "clatter", at: 3.4, f: 900, n: 6, kind: "wood", decay: 0.9, vol: 0.7 },
  ],
  // A ping as the wave passes each part of the lattice.
  "crystal-lattice": { voice: "glass", notes: "C6 E6 G6 C7", step: 0.55, at: 0.3, decay: 0.6 },

  // Lane Chemistry. On: the tile's soft click and a rising shimmer as the
  // atom builds (each shell's note and the photon's ping are cues from the
  // recipe). Off: a soft falling hush as it sinks back into its tile.
  "periodic-table": {
    on: [
      { voice: "click", f: 2400, vol: 0.6 },
      { voice: "shimmer", at: 0.15, f: 880, to: 2, decay: 2.2, vol: 0.45 },
    ],
    off: [
      { voice: "whoosh", f: 700, to: 0.4, decay: 0.9, vol: 0.45 },
      { voice: "click", at: 0.85, f: 1600, vol: 0.5 },
    ],
  },

  // ---- Gems -------------------------------------------------------------------------
  diamond: [
    { voice: "glass", f: 3520, decay: 1.2, bright: 0.9 },
    { voice: "sparkle", at: 0.3, f: 4200, n: 8, decay: 2.4, vol: 0.7 },
  ],
  // A warm chime, and a softer one on each throb of the glow.
  ruby: [
    { voice: "bell", f: "C5", decay: 0.8, bright: 0.25 },
    { voice: "bell", at: 1.3, f: "C5", decay: 0.5, bright: 0.2, vol: 0.4 },
  ],
  emerald: { voice: "glass", f: "G5", decay: 2, bright: 0.35 },
  "amethyst-geode": {
    on: [
      { voice: "crack", f: 1100, bright: 0.3 },
      { voice: "glass", at: 0.35, notes: "E6 B6", step: 0.12, decay: 1.2 },
    ],
    off: [{ voice: "stone", f: 300, decay: 1.4 }],
  },
  sapphire: { voice: "bell", f: "E6", decay: 0.7, bright: 0.7 },
  // A chime for each point as it lights, left to right.
  "quartz-cluster": {
    voice: "glass",
    notes: "C6 D6 E6 G6 A6 C7 D7 E7 G7 A7",
    step: 0.29,
    at: 0.2,
    decay: 0.7,
  },
  opal: { voice: "shimmer", f: "A5", rate: 14, decay: 2 },
  pearl: {
    on: { voice: "clack", f: 1800, decay: 2.5, bright: 0.2 },
    off: { voice: "clack", f: 1500, decay: 2, bright: 0.2 },
  },
  "crystal-ball": [
    { voice: "shimmer", f: "D5", rate: 4, decay: 1.8 },
    { voice: "theremin", f: 440, to: 1.2, vol: 0.5 },
  ],

  // ---- Anatomy ----------------------------------------------------------------------
  // Lub-dub on each squeeze: racing to 155 bpm by 0.5 s, calming by 4.6 s.
  heart: [
    { voice: "heartbeat", at: 0.16, f: 72, vol: 0.8 },
    { voice: "heartbeat", at: 0.61, f: 72, vol: 0.9 },
    { voice: "heartbeat", at: 0.99, f: 72, vol: 1 },
    { voice: "heartbeat", at: 1.38, f: 72, vol: 1 },
    { voice: "heartbeat", at: 1.76, f: 72, vol: 1 },
    { voice: "heartbeat", at: 2.15, f: 72, vol: 1 },
    { voice: "heartbeat", at: 2.54, f: 72, vol: 1 },
    { voice: "heartbeat", at: 2.93, f: 72, vol: 0.95 },
    { voice: "heartbeat", at: 3.36, f: 72, vol: 0.85 },
    { voice: "heartbeat", at: 3.91, f: 72, vol: 0.75 },
  ],
  // Sparks crackle over the lobes; every lobe flashes at once (1.75 s).
  brain: [
    { voice: "crackle", f: 4200, n: 26, decay: 2 },
    { voice: "ding", at: 1.75, f: "E6" },
  ],
  eye: { voice: "whoosh", f: 1500, to: 0.6, decay: 0.35, vol: 0.6 },
  // A deep breath in (1.7 s), held, then out (2.2 s).
  lungs: [
    { voice: "breath", f: 700, to: 1.4, decay: 2.4 },
    { voice: "breath", at: 2.2, f: 900, to: 0.6, decay: 2.1 },
  ],
  // A squeaky polish across it, a ding as it gleams (1.1 s), twinkles after.
  tooth: [
    { voice: "squeak", f: 3000, to: 1.2, decay: 4, vol: 0.6 },
    { voice: "ding", at: 1.1, f: "C7", decay: 0.6 },
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
  oak: [
    { voice: "flutter", f: 2600, rate: 30, decay: 1.8, vol: 0.6 },
    { voice: "patter", at: 2.4, f: 1800, n: 10, decay: 2.4, vol: 0.4 },
  ],
  pine: { voice: "bell", notes: "E7 G7 E7 G7 E7", step: 0.05, decay: 0.15, bright: 0.9, vol: 0.6 }, // prettier-ignore
  palm: { voice: "flutter", f: 1800, rate: 18, decay: 1.4, vol: 0.5 },
  "cherry-blossom": [
    { voice: "wind", f: 1000, rate: 0.8, decay: 0.9, vol: 0.6 },
    { voice: "patter", at: 0.3, f: 2400, n: 14, decay: 1.4, vol: 0.5 },
  ],
  maple: [
    { voice: "whoosh", f: 400, to: 1.8, decay: 1.6, vol: 0.7 },
    { voice: "crunch", at: 0.3, f: 3400, n: 24, decay: 2.6, bright: 0.8, vol: 0.5 },
  ],
  bonsai: [
    { voice: "tone", f: "C4", to: 1.5, kind: "triangle", decay: 1.2, vol: 0.35 },
    { voice: "clack", at: 2.28, notes: "A7 - A7", step: 0.07, decay: 0.7 },
  ],
  willow: { voice: "breath", f: 500, to: 0.6, decay: 2.8 },
  sunflower: { voice: "tone", f: "F4", to: 1.5, kind: "triangle", decay: 2 },
  rose: [
    { voice: "harp", f: "E5" },
    { voice: "harp", at: 1.5, f: "B4", vol: 0.6 },
  ],
  dandelion: { voice: "breath", f: 1400, to: 0.6, decay: 0.7 },
  tulip: { voice: "pluck", notes: "A4 C#5 E5", step: 0.18, decay: 0.5, bright: 0.2 },
  daisy: { voice: "whoosh", f: 900, to: 1.4, decay: 0.8, vol: 0.5 },
  lotus: [
    { voice: "drip", at: 0.55, f: 800, n: 1 },
    { voice: "bell", at: 2.0, f: "G5", decay: 0.8, bright: 0.2 },
  ],
  mushroom: [
    { voice: "breath", f: 350, to: 0.4, decay: 0.35 },
    { voice: "sparkle", at: 0.25, f: 2200, n: 9, decay: 2.4, vol: 0.5 },
  ],
  fern: [
    { voice: "flutter", f: 2200, rate: 12, decay: 2.4, vol: 0.6 },
    { voice: "flutter", at: 0.8, f: 2000, rate: 10, decay: 2, vol: 0.5 },
    { voice: "flutter", at: 1.6, f: 1800, rate: 9, decay: 2, vol: 0.4 },
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
  rocks: { voice: "clatter", f: 1600, n: 10 },
  kelp: [
    { voice: "bubbles", f: 300, n: 12, decay: 1.4 },
    { voice: "click", at: 1.4, notes: "C7 - C7 - C7", step: 0.1, vol: 0.5 },
  ],

  // ---- Weather ----------------------------------------------------------------------
  campfire: [
    { voice: "crackle", f: 2600, n: 20, decay: 1.4 },
    { voice: "roar", f: 60, bright: 0.2, decay: 0.8, vol: 0.4 },
  ],
  "storm-cloud": { voice: "rumble", f: 80, rate: 6 },
  // Heats up: a warm hum swells, the blobs gloop faster, then it cools.
  "lava-lamp": [
    { voice: "hum", f: 70, to: 1.5, decay: 3.2, bright: 0.1, vol: 0.5 },
    { voice: "gloop", at: 0.1, f: 75, decay: 1.6 },
    { voice: "gloop", at: 0.9, f: 95, decay: 1.4 },
    { voice: "bubbles", at: 1.3, f: 240, n: 9, decay: 2.2, vol: 0.6 },
    { voice: "gloop", at: 2.3, f: 85, decay: 1.4 },
  ],
  "snow-globe": [
    { voice: "rattle", f: 3500, n: 10, decay: 1.2, vol: 0.6 },
    { voice: "sparkle", at: 0.2, f: 3600, n: 7 },
  ],
  volcano: [
    { voice: "rumble", f: 55, rate: 4, decay: 1.3 },
    { voice: "kick", at: 0.4, f: 42, decay: 2.5 },
  ],
  // Thaws with a sigh and drips, then crackles as it refreezes and the
  // frost sweeps up it.
  "ice-statue": [
    { voice: "breath", f: 800, to: 0.5, decay: 1.4, vol: 0.5 },
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
  iceberg: [
    { voice: "crack", f: 1800, bright: 0.5, decay: 1.5 },
    { voice: "crackle", at: 0.05, f: 2600, n: 8, decay: 0.8, vol: 0.7 },
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
  "ice-cream": { voice: "drip", f: 1000, n: 3, rate: 2.5 },
  // The knife swings down; each chop and the fan are cues from the recipe.
  watermelon: { voice: "whoosh", f: 500, to: 3, decay: 0.3, vol: 0.6 },
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
  // The frosting flicks the cherry up; its plop and the sprinkles are cues.
  cupcake: { voice: "boing", f: 260, to: 1.8, rate: 9, decay: 0.5, vol: 0.6 },
  lollipop: [
    { voice: "hum", f: 150, to: 1.8, bright: 0.2, decay: 1.8, vol: 0.8 },
    { voice: "wind", at: 0.2, f: 900, rate: 3, decay: 1.2, vol: 0.5 },
  ],
  // A creak as it twists; the snaps and the mends are cues.
  "candy-cane": { voice: "squeak", f: 520, to: 1.25, decay: 3, vol: 0.35 },
  // A hop; each landing is a cue.
  macarons: { voice: "whoosh", f: 900, to: 1.6, decay: 0.3, vol: 0.4 },
  "gummy-bear": [
    { voice: "squeak", f: 700, to: 1.6, decay: 2, vol: 0.5 },
    { voice: "boing", at: 0.3, f: 200, to: 1.8, rate: 12 },
  ],
  pretzel: { voice: "squish", pitch: 0.7, bright: 0.2, decay: 2 },
  // Flaky crust crackling as it is sliced open; the butter's sizzle and the
  // top settling back are cues.
  croissant: [
    { voice: "crackle", f: 2400, n: 9, decay: 0.5, vol: 0.6 },
    { voice: "tear", at: 0.05, f: 1400, to: 1.3, decay: 0.5, vol: 0.4 },
  ],
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
  apple: {
    on: { voice: "crunch", f: 2400, n: 12, decay: 0.9, bright: 0.6 },
    off: { voice: "pop", f: 520, decay: 1.2, vol: 0.6 },
  },
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
  // The flick; each knock of the pair is a cue.
  cherries: { voice: "pluck", f: "C5", decay: 0.4, bright: 0.2, vol: 1 },
  // A rustle as the bunch shakes; each grape's plop is a cue.
  grapes: { voice: "rattle", f: 900, n: 5, decay: 0.7, vol: 0.5 },
  // The stone pops out; its thocks as it lands are cues.
  avocado: { voice: "pop", f: 330, decay: 1, vol: 0.7 },

  // ---- Toys -------------------------------------------------------------------------
  bricks: { voice: "clack", notes: "D6 - D6", step: 0.08, decay: 0.6, bright: 0.3 },
  "rubber-duck": { voice: "quack", f: 250, n: 2 },
  "spinning-top": { voice: "hum", f: 300, to: 1.2, bright: 0.4, decay: 2 },
  dice: { voice: "clatter", f: 1900, n: 8, kind: "wood", decay: 1.2 },
  // The lift is a soft tick; each strike clacks as it lands (cues from the recipe).
  "newtons-cradle": { voice: "clack", f: 5200, decay: 0.3, vol: 0.25 },
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
  // A step tune as the ant walks two laps: it drops an octave while the ant
  // is underneath (2.4 s) and comes back up as it returns on top (3.3 s).
  mobius: {
    voice: "tone",
    notes: "C5 E5 G5 C6 E4 G4 C5 E5",
    step: 0.55,
    at: 0.2,
    decay: 0.6,
    kind: "triangle",
  },
  "klein-bottle": [
    { voice: "bubbles", f: 180, n: 5, decay: 0.8 },
    { voice: "wave", at: 0.3, f: 300, decay: 0.6 },
  ],
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
  hypercube: [
    { voice: "drone", f: 110, to: 2, bright: 0.8, decay: 1.1 },
    { voice: "drone", at: 2.9, f: 220, to: 0.5, bright: 0.8, decay: 0.9 },
  ],
  // A creak as it is pulled, a twang as it is let go (0.85 s).
  "torus-knot": [
    { voice: "scrape", at: 0.2, f: 500, rate: 14, decay: 1.2, vol: 0.3 },
    { voice: "twang", at: 0.85, f: 150, decay: 2.4 },
    { voice: "twang", at: 1.9, f: 140, decay: 1.4, vol: 0.5 },
  ],
  // Swells one way (0.95 s), then the other (2.75 s), with a bubble.
  gyroid: [
    { voice: "hum", f: 70, to: 1.25, bright: 0.15, decay: 1.9 },
    { voice: "hum", at: 1.9, f: 88, to: 0.8, bright: 0.15, decay: 1.8 },
    { voice: "bubbles", at: 0.6, f: 500, n: 4, decay: 1, vol: 0.4 },
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
  "surface-plotter": [
    { voice: "whoosh", at: 0.35, f: 90, to: 5, decay: 2.4, vol: 0.8 },
    { voice: "hum", at: 2.3, f: 98, to: 1.2, bright: 0.2, decay: 2.5, vol: 0.5 },
  ],
  // Two pure tones a quarter turn apart (the turn takes 3.8 s), swelling
  // and fading with the waves.
  "unit-circle": [
    { voice: "pad", at: 0.3, f: "A4", decay: 1.9, vol: 0.9 },
    { voice: "pad", at: 1.25, f: "E5", decay: 1.5, vol: 0.8 },
  ],
  // Each circle's hum joins in, building into a chord.
  "fourier-circles": { voice: "pad", notes: "C3 G3 C4 E4 G4 C5", step: 0.35, at: 0.3, decay: 1.6 },
  // A wooden slide; drive() adds a slide and a click for each piece.
  "pythagoras-proof": { voice: "scrape", at: 0.3, f: 700, rate: 9, decay: 0.35, vol: 0.35 },
  // Lane Manual: a soft tone that rises an octave as t plays (4 s).
  "splat-equation": { voice: "pad", f: "G3", to: 2, decay: 2, vol: 0.9 },
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

  // ---- Real objects (lane Real objects) ---------------------------------------------
  // A cap click, the posted cap's click, a smooth nib scratch, and the cap clicking back on.
  "fountain-pen": [
    { voice: "click", f: 2600, vol: 0.9 },
    { voice: "click", at: 1.08, f: 2100, vol: 0.8 },
    { voice: "scrape", at: 1.62, f: 2400, rate: 26, decay: 2.3, vol: 0.18 },
    { voice: "click", at: 3.97, f: 2600, vol: 0.9 },
  ],
  // The cap ratchets off, then a glug-glug pour that rises in pitch as the glass fills.
  "water-bottle": [
    { voice: "ratchet", f: 1900, n: 7, rate: 12, vol: 0.5 },
    { voice: "gloop", at: 1.66, notes: "G2 A2 C3 D3 E3 G3", step: 0.17, decay: 0.45, vol: 0.55 },
    { voice: "drip", at: 1.95, f: 700, n: 4, rate: 5, vol: 0.4 },
    { voice: "ratchet", at: 4.05, f: 1700, n: 7, rate: 14, vol: 0.45 },
  ],
  // A rattle as it shakes, the sharp pssht of the can opening, then a fizz that dies away.
  "soda-can": [
    { voice: "rattle", f: 1600, n: 10, decay: 2.2, vol: 0.55 },
    { voice: "crack", at: 0.93, f: 2600, vol: 0.7 },
    { voice: "hiss", at: 0.95, f: 3200, decay: 0.9, vol: 0.55 },
    { voice: "bubbles", at: 1.1, f: 900, n: 16, decay: 2.2, vol: 0.4 },
    { voice: "sizzle", at: 1.3, f: 6000, decay: 1.5, vol: 0.25 },
  ],
  // Laces zipping through the eyelets, a soft tug as the bow pulls tight, two toe taps.
  "running-shoe": [
    { voice: "tear", f: 1100, to: 1.8, decay: 1.4, vol: 0.4 },
    { voice: "tear", at: 1.05, f: 1300, to: 0.7, decay: 1.2, vol: 0.35 },
    { voice: "slap", at: 2.72, f: 900, vol: 0.5 },
    { voice: "thud", at: 3.34, f: 140, vol: 0.7 },
    { voice: "thud", at: 3.84, f: 150, vol: 0.7 },
  ],
  // Soft fabric swishes as the hood flips and the sleeves swing, and a zip-like flick.
  hoodie: [
    { voice: "breath", f: 700, to: 0.6, decay: 0.8, vol: 0.5 },
    { voice: "breath", at: 0.62, f: 900, to: 1.4, decay: 0.8, vol: 0.45 },
    { voice: "tear", at: 1.2, f: 1600, to: 2.4, decay: 0.35, vol: 0.3 },
    { voice: "whoosh", at: 1.25, f: 250, to: 4, decay: 1.1, vol: 0.35 },
    { voice: "whoosh", at: 2.95, f: 300, to: 3, decay: 1.1, vol: 0.3 },
  ],
  // Two hinge clicks, a soft shimmer as the lenses darken, and two clicks as they unfold.
  sunglasses: [
    { voice: "click", at: 0.4, f: 3200, vol: 0.8 },
    { voice: "click", at: 0.7, f: 2900, vol: 0.8 },
    { voice: "shimmer", at: 1.35, f: "E6", decay: 0.8, vol: 0.35 },
    { voice: "click", at: 2.95, f: 2900, vol: 0.7 },
    { voice: "click", at: 3.2, f: 3200, vol: 0.7 },
  ],
  // A flick off the stand, the whoosh of the spin, a soft landing, and a second flip.
  "baseball-cap": [
    { voice: "slap", f: 1800, vol: 0.5 },
    { voice: "whoosh", at: 0.35, f: 400, to: 5, decay: 1.6, vol: 0.4 },
    { voice: "thud", at: 1.62, f: 180, vol: 0.5 },
    { voice: "flutter", at: 1.95, f: 1500, decay: 0.9, vol: 0.25 },
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
  shield: [
    { voice: "metal", f: 260, decay: 1.4 },
    { voice: "crackle", at: 0.02, f: 4200, n: 14, decay: 1, vol: 0.5 },
    { voice: "shimmer", at: 0.4, f: 1600, decay: 1.1, vol: 0.4 },
  ],
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
  // A royal fanfare, and a ping for each jewel as it lights.
  crown: [
    { voice: "brass", notes: "C5 C5 C5 G5 - E5 G5+C6", step: 0.14, decay: 1.2 },
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
  "wizards-orb": [
    { voice: "whoosh", f: 400, to: 5, decay: 0.6 },
    { voice: "sparkle", at: 0.3, f: 2800, n: 9, bright: 0.8 },
  ],

  // ---- Animals ----------------------------------------------------------------------
  jellyfish: { voice: "thud", f: 55, bright: 0.1, decay: 2.2 },
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
  // The spines rustle wave after wave.
  "sea-urchin": { voice: "rattle", f: 3000, n: 40, decay: 10, vol: 0.55 },
  // The fly buzzes in, the tongue flicks out and back, a gulp, two croaks.
  frog: [
    { voice: "buzz", f: 230, rate: 13, decay: 1.25, vol: 0.4 },
    { voice: "whoosh", at: 0.98, f: 1400, to: 2, decay: 0.25, vol: 0.6 },
    { voice: "pop", at: 1.56, f: 500, vol: 0.6 },
    { voice: "gloop", at: 1.82, f: 140, vol: 0.7 },
    { voice: "ribbit", at: 2.55, f: 320 },
    { voice: "ribbit", at: 3.05, f: 300 },
  ],
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
  // Drips as it melts, then the crunch of snow as it builds itself again
  // and a twinkle as the pieces hop back.
  snowman: [
    { voice: "drip", at: 0.3, f: 1000, n: 6, rate: 3.5 },
    { voice: "crunch", at: 3.1, f: 1000, n: 16, decay: 1.6, bright: 0.2 },
    { voice: "chimes", at: 3.95, f: "E6", n: 4, decay: 0.8, vol: 0.4 },
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
    voice: "grand",
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
  // The lights sparkle, and a boom for each of the four bursts.
  "eiffel-tower": [
    { voice: "sparkle", at: 0.25, f: 3000, n: 18, decay: 4.5, vol: 0.8 },
    { voice: "kick", at: 0.38, f: 48, decay: 1.4, vol: 0.45 },
    { voice: "kick", at: 0.93, f: 55, decay: 1.4, vol: 0.4 },
    { voice: "kick", at: 1.48, f: 45, decay: 1.4, vol: 0.45 },
    { voice: "kick", at: 2.13, f: 52, decay: 1.6, vol: 0.4 },
  ],
  // A day's breeze while the sun crosses, and a soft chime at noon.
  "washington-monument": [
    { voice: "wind", f: 400, rate: 0.3, decay: 2.6 },
    { voice: "chimes", at: 2.2, f: "G5", n: 3, decay: 1.2, vol: 0.35 },
  ],
  // The saucer arrives, sand hisses up into the beam, and it zips away.
  pyramids: [
    { voice: "theremin", f: 330, to: 1.26, decay: 1.2, vol: 0.7 },
    { voice: "hiss", at: 1.4, f: 6000, decay: 2.2, vol: 0.5 },
    { voice: "theremin", at: 4.3, f: 440, to: 2.2, decay: 0.5, vol: 0.6 },
  ],
  // A rising lift tone as the floors wring round, and a ding each time the
  // ring of light reaches the top.
  supertall: [
    { voice: "tone", f: "C5", to: 2, kind: "sine", decay: 1.4, vol: 0.5 },
    { voice: "ding", at: 1.55, f: "E6" },
    { voice: "ding", at: 3.55, f: "G6", vol: 0.7 },
  ],
  lighthouse: {
    on: { voice: "horn", f: 62, kind: "fog", decay: 1.4 },
    off: { voice: "switch", f: 1800, decay: 1.5 },
  },
  // The flame whooshes up, sparks crackle and a harbour bell rings.
  "statue-of-liberty": [
    { voice: "whoosh", f: 300, to: 3, decay: 0.8 },
    { voice: "crackle", at: 0.2, f: 2600, n: 16, decay: 2.6, vol: 0.5 },
    { voice: "bell", at: 0.5, f: "D5", decay: 1.3, bright: 0.4 },
  ],
  // The jet shoots up and its spray patters back into the basin.
  "white-house": [
    { voice: "splash", f: 2400, bright: 0.8, decay: 1.6 },
    { voice: "patter", at: 0.5, f: 2200, n: 30, decay: 4.5, vol: 0.5 },
  ],
  // The tower grinds as it leans, then both balls land at the same moment.
  "leaning-tower": [
    { voice: "scrape", f: 240, rate: 9, decay: 1.4, vol: 0.35 },
    { voice: "thud", at: 1.9, f: 140, bright: 0.3 },
    { voice: "thud", at: 1.9, f: 75, bright: 0.2 },
  ],
  // The crowd cheers over the drumming hooves.
  colosseum: [
    { voice: "cheer", f: 200, n: 10, decay: 1.8 },
    { voice: "patter", at: 0.4, f: 500, n: 48, decay: 7, vol: 0.8 },
    { voice: "cheer", at: 2.4, f: 220, n: 10, decay: 1.4, vol: 0.8 },
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
  "neural-network": [
    { voice: "tine", at: 0.05, notes: "C5 E5", step: 0.45, decay: 0.7 },
    { voice: "tine", at: 1.1, notes: "G5 B5", step: 0.45, decay: 0.7 },
    { voice: "tine", at: 2.1, f: "D6", decay: 0.9 },
    { voice: "glass", at: 2.5, notes: "D6 B5 G5 E5", step: 0.35, decay: 0.6, vol: 0.7 },
  ],
  // A tick at each of the filter's 25 steps, a chime as the answer rises.
  cnn: [
    { voice: "click", at: 0.28, f: 2600, notes: "C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7 C7", step: 0.084 }, // prettier-ignore
    { voice: "glass", at: 3.5, notes: "C6 E6 G6", step: 0.09, decay: 1.2 },
  ],
  // A pulse as each word goes in (0.55, 1.75, 2.95 s), and the loop's hum
  // climbing as the memory builds.
  rnn: [
    { voice: "blip", at: 0.55, f: 520, to: 0.7 },
    { voice: "hum", at: 0.62, f: 110, to: 1.06, decay: 1.1, vol: 0.6 },
    { voice: "blip", at: 1.75, f: 620, to: 0.7 },
    { voice: "hum", at: 1.82, f: 139, to: 1.06, decay: 1.1, vol: 0.6 },
    { voice: "blip", at: 2.95, f: 740, to: 0.7 },
    { voice: "hum", at: 3.02, f: 175, to: 1.06, decay: 1.1, vol: 0.6 },
  ],
  // A shimmering chord for each layer's attention (0.05, 1.6 s), a pop for
  // the next word (3.1 s) and a knock as it lands.
  transformer: [
    { voice: "shimmer", at: 0.05, f: 784, decay: 0.9 },
    { voice: "shimmer", at: 1.6, f: 988, decay: 0.9 },
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
  "diffusion-model": [
    { voice: "hiss", f: 3000, decay: 5, vol: 1.2 },
    { voice: "pad", at: 2.9, notes: "C4+E4+G4+C5", decay: 0.9 },
  ],
  // A rolling tone that falls as the loss drops, and a whoosh back to the
  // start.
  "gradient-descent": [
    { voice: "tone", at: 0.3, f: 720, to: 0.4, decay: 8.5, vol: 0.55 },
    { voice: "whoosh", at: 3.95, f: 500, decay: 0.8, vol: 0.6 },
  ],
  // Lane Screens: a soft rising chime as the picture forms (each view plays
  // its own cues; this is the training view's).
  "gaussian-splatting": [
    { voice: "shimmer", f: 523, to: 2, decay: 3.3, vol: 0.35 },
    { voice: "glass", notes: "C5 E5 G5 B5 D6", step: 0.7, at: 0.4, vol: 0.3 },
  ],
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
  // Two switch clicks, a buzz as the gates fire, a ding as the carry lamp
  // lights, and the switches flipping back.
  "half-adder": [
    { voice: "switch", at: 0.1, f: 2800 },
    { voice: "switch", at: 0.35, f: 2500 },
    { voice: "buzz", at: 1.2, f: 180, decay: 0.5, vol: 0.6 },
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
  // The motor switch; then drive() plays the drums' clatter and the motor's
  // whirr, and a sharp stop with a bell when a setting is found.
  bombe: { voice: "switch", f: 1200, decay: 1.2, vol: 0.7 },

  // ---- Pictures and pages (lane Pictures) -------------------------------------------
  // A page turning: a soft paper swish, then a light tap as it lands.
  "picture-lab": [
    { voice: "whoosh", f: 1500, decay: 0.45, vol: 0.35 },
    { voice: "click", at: 0.2, f: 1300, decay: 0.7, vol: 0.4 },
  ],

  // ---- Pictures and pages (lane Books) ----------------------------------------------
  // A page turning over (a paper swish and a flutter) and a soft thud as it
  // lands (the cover's thud when it opens).
  "your-book": [
    { voice: "whoosh", f: 2000, decay: 0.55, vol: 0.28 },
    { voice: "flutter", at: 0.08, decay: 0.4, vol: 0.12 },
    { voice: "thud", at: 0.82, f: 150, decay: 0.35, vol: 0.3 },
  ],
  // A thick card page: a lower swish and a firmer thud.
  "photo-album": [
    { voice: "whoosh", f: 900, decay: 0.7, vol: 0.3 },
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
      { voice: "patter", at: 0.1, f: 2600, n: 40, decay: 2.2, vol: 0.3 },
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
  // Lane Photo to 3D: a soft whoosh that rises as the depth comes up, and one that falls as it lies flat.
  "photo-3d": {
    on: [
      { voice: "whoosh", f: 240, to: 7, decay: 2.4, vol: 0.85 },
      { voice: "glass", at: 1.5, notes: "E5 B5", step: 0.22, decay: 0.8, vol: 0.3 },
    ],
    off: { voice: "whoosh", f: 2600, to: 0.14, decay: 1.8, vol: 0.7 },
  },
  // Lane Screens: the old TV's click and hum (each style plays its own
  // cues as it switches on: the flat TV's soft tone, the cinema's curtains,
  // the hologram's shimmer).
  // The old TV: on, a click, a crackle and the hum; off, the knob's click
  // and the whine falling away (lane Screens r2). The Screen plays each
  // style's own sounds from its recipe (src/packs/screens.js).
  screen: {
    on: [
      { voice: "switch", f: 1800, vol: 0.9 },
      { voice: "zap", at: 0.1, f: 5200, to: 0.9, decay: 0.5, vol: 0.18 },
      { voice: "hum", at: 0.12, f: 60, to: 1.02, decay: 1.6, bright: 0.15, vol: 0.5 },
    ],
    off: [
      { voice: "switch", f: 1500, vol: 0.9 },
      { voice: "zap", at: 0.05, f: 7800, to: 0.35, decay: 1.4, vol: 0.12 },
      { voice: "hum", at: 0.02, f: 62, to: 0.6, decay: 0.7, bright: 0.12, vol: 0.35 },
    ],
  },
  // ---- Lab (lane Lab) ----------------------------------------------------------------
  // A soft rising swell as the pulse runs out through the field.
  "splat-field": { voice: "pad", f: "D4", to: 1.5, decay: 2.5, vol: 0.7 },
};

// The toy's sound, or null when it has none (visitors' own splats).
export function toySound(id) {
  return TOY_SOUNDS[id] || null;
}
