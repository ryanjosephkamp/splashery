// Lane Arcade: games made of splats, on the labs-only Arcade shelf. Each is
// a kit toy with an `arcade` block (src/arcade/runtime.js): the kit runs
// its clock, controls, screen furniture, play mode and 2D/3D switch, and
// the game's own module (loaded when the toy opens) moves its splats.
//
// The toy itself builds nothing to see (one clear splat, and the reach of
// the play area for the framing): everything shows on the game's own layer.

const VIEW = {
  key: "view",
  label: "View",
  type: "select",
  default: "2d",
  choices: [
    { id: "2d", label: "2D" },
    { id: "3d", label: "3D" },
  ],
};

const PLAY = [{ key: "go", label: "Play", type: "pulse", ease: 0.4 }];

// Each game's still picture: what the toy itself builds. The game hides
// it once its own layer is up; the shelf's tools (thumbnails, the contact
// sheet, check-packs) and a first look before the game loads see it.
const lit = (hexc, n, f = 1) => {
  const c = [1, 3, 5].map((i) => parseInt(hexc.slice(i, i + 2), 16) / 255);
  const l = (0.78 + 0.22 * n[1] + 0.08 * n[2]) * f;
  return c.map((v) => v * l);
};
const RAINBOW = ["#d8443a", "#e97a2c", "#e9b730", "#6dbb46", "#2fa6a0", "#3a7bd5"];

function picture(k, kind) {
  const box = (sx, sy, sz, pos, col) => k.add(k.box(sx, sy, sz), { pos, even: true, flat: 0.25, color: (c) => (typeof col === "function" ? col(c) : lit(col, c.n)) }); // prettier-ignore
  if (kind === "bricks" || kind === "page") {
    // The board: rails, a wall of bricks (or a page of words), the paddle and the ball.
    const wood = (c) => lit("#6b4630", c.n, 0.9 + 0.1 * Math.sin(c.p[0] * 80));
    box(0.04, 2.0, 0.1, [-0.82, 0, 0], wood);
    box(0.04, 2.0, 0.1, [0.82, 0, 0], wood);
    box(1.68, 0.04, 0.1, [0, 1.0, 0], wood);
    if (kind === "page") {
      box(1.4, 1.5, 0.01, [0, 0.2, -0.02], "#f4f1e8");
      for (let r = 0; r < 16; r++)
        for (let w = 0; w < 5; w++) box(0.2 + 0.05 * ((r * 3 + w) % 3), 0.035, 0.02, [-0.55 + w * 0.27, 0.85 - r * 0.085, 0], "#2b2b30"); // prettier-ignore
    } else {
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 10; c++) box(0.134, 0.054, 0.06, [-0.72 + c * 0.16, 0.8 - r * 0.075, 0], RAINBOW[r]); // prettier-ignore
    }
    k.add(k.roundedBox(0.3, 0.05, 0.1, 4), {
      pos: [0, -0.86, 0],
      even: true,
      color: (c) => lit("#9fb4cf", c.n),
    });
    k.add(k.sphere(0.032), { pos: [0.1, -0.6, 0], even: true, color: "#f4f2ec", weight: 3 });
  } else if (kind === "table") {
    box(1.5, 2.1, 0.02, [0, 0, -0.02], (c) =>
      Math.abs(c.lp[1]) < 0.01 ? [0.93, 0.93, 0.9] : [0.12, 0.42, 0.26],
    );
    for (const x of [-0.78, 0.78]) box(0.05, 2.2, 0.08, [x, 0, 0.01], "#73492f");
    k.add(k.roundedBox(0.3, 0.05, 0.06, 4), {
      pos: [0.1, -0.93, 0.03],
      even: true,
      color: (c) => lit("#e66b2e", c.n),
    });
    k.add(k.roundedBox(0.3, 0.05, 0.06, 4), {
      pos: [-0.2, 0.93, 0.03],
      even: true,
      color: (c) => lit("#407ad9", c.n),
    });
    k.add(k.sphere(0.035), { pos: [0.05, -0.2, 0.04], even: true, color: "#f4f2ec", weight: 3 });
  } else if (kind === "rocks") {
    // Lumpy rocks on a starfield and a small ship.
    k.cloud({ share: 0.1 }, (rand) => ({
      p: [(rand() - 0.5) * 2.4, (rand() - 0.5) * 2.4, -0.4],
      color: [0.85, 0.9, 1],
      size: 1,
    }));
    for (const [x, y, r] of [[-0.5, 0.4, 0.22], [0.45, 0.55, 0.13], [0.3, -0.35, 0.18], [-0.3, -0.6, 0.08]])
      k.add(k.radial((d) => r * (1 + 0.18 * Math.sin(d[0] * 5 + d[1] * 3) * Math.cos(d[2] * 4)), { grid: 24 }), { pos: [x, y, 0], even: true, color: (c) => lit("#6e6760", c.n) }); // prettier-ignore
    k.add(k.cone(0.035, 0, 0.16), {
      pos: [0, 0, 0.05],
      even: true,
      color: (c) => lit("#dcdfe4", c.n),
    });
  } else if (kind === "lander") {
    // A slice of cratered ground and a small lander above it.
    k.cloud({ share: 0.7 }, (rand) => {
      const x = (rand() - 0.5) * 2.2;
      const z = (rand() - 0.5) * 0.8;
      const r = Math.hypot(x + 0.3, z);
      const y =
        -0.6 +
        0.12 * Math.exp(-((r - 0.35) ** 2) / 0.004) -
        0.1 * Math.exp(-(r ** 2) / 0.06) +
        0.02 * Math.sin(x * 9);
      const g = 0.45 + 0.2 * rand();
      return { p: [x, y, z], color: [g, g, g * 0.97], size: 1.4, n: [0, 1, 0] };
    });
    box(0.09, 0.05, 0.09, [0.3, 0.25, 0], "#d9a83d");
    box(0.07, 0.04, 0.07, [0.3, 0.3, 0], "#b8b8bc");
  } else if (kind === "pinball") {
    box(1.0, 0.02, 1.9, [0, -0.01, 0], (c) => lit("#16245a", c.n));
    for (const x of [-0.5, 0.5]) box(0.03, 0.06, 1.9, [x, 0.03, 0], "#c9ccd2");
    for (const [x, z] of [[-0.16, -0.45], [0.14, -0.5], [-0.02, -0.25]]) k.add(k.cylinder(0.055, 0.05), { pos: [x, 0.025, z], even: true, color: (c) => (c.n[1] > 0.5 ? [1, 0.88, 0.48] : lit("#d6382f", c.n)) }); // prettier-ignore
    for (const s of [-1, 1]) box(0.16, 0.04, 0.03, [s * 0.12, 0.02, 0.74], "#f4f4f0");
    k.add(k.sphere(0.028), { pos: [0.05, 0.028, 0.2], even: true, color: "#e8eaf0", weight: 3 });
  } else if (kind === "shadow") {
    box(1.6, 1.6, 0.02, [0, 0, -0.76], "#e8dfcc");
    for (const [x, y] of [[0, 0.2], [-0.2, 0], [0.2, 0], [0, -0.1], [-0.1, -0.25], [0.1, -0.25], [0, 0]]) box(0.2, 0.2, 0.01, [x, y, -0.74], "#2a282c"); // prettier-ignore
    for (const [x, y, z] of [[0, 0, 0], [0.075, 0, 0], [0, 0.075, 0], [0, 0, 0.075], [-0.075, 0, 0]]) k.add(k.box(0.072, 0.072, 0.072), { pos: [x + 0.3, y + 0.2, z + 0.3], even: true, color: (c) => lit("#c96f4a", c.n) }); // prettier-ignore
  } else if (kind === "dash") {
    k.cloud({ share: 0.85 }, (rand) => {
      const x = (rand() - 0.5) * 2.6;
      const y = (rand() - 0.5) * 2;
      const sky = y > 0.1 + 0.1 * Math.sin(x * 3);
      const c = sky ? [0.55, 0.72, 0.95] : [0.85, 0.25 + 0.4 * rand(), 0.3];
      return { p: [x, y, 0], color: c, size: 1.3, n: [0, 0, 1] };
    });
    k.add(k.sphere(0.055), {
      pos: [-0.5, 0.22, 0.06],
      even: true,
      color: (c) => lit("#3a73e6", c.n),
      weight: 3,
    });
  } else if (kind === "net") {
    // The cube's net of tiles, and a string of green beads.
    const A = 0.5;
    const faces = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0, -2],
    ];
    const cols = ["#e9c98f", "#9fcf96", "#9cbfe8", "#dcb878", "#88bf80", "#86acd8"];
    faces.forEach(([fx, fy], f) => {
      for (let j = 0; j < 7; j++)
        for (let i = 0; i < 7; i++) box(0.13, 0.13, 0.01, [fx * 2 * A - A + (i + 0.5) * (2 * A / 7), fy * 2 * A + 0.5 - A + (j + 0.5) * (2 * A / 7), 0], (i + j) % 2 ? cols[f] : cols[(f + 3) % 6]); // prettier-ignore
    });
    for (let b = 0; b < 6; b++) k.add(k.sphere(0.055), { pos: [-0.36 + b * 0.143, 0.5, 0.06], even: true, color: (c) => lit(b === 5 ? "#2f7d4f" : "#58b06e", c.n), weight: 4 }); // prettier-ignore
    k.add(k.sphere(0.06), {
      pos: [0.36, 0.07, 0.06],
      even: true,
      color: (c) => lit("#c8203a", c.n),
      weight: 4,
    });
  } else if (kind === "grains") {
    // A glass box with a dune of sand, a pool and a ledge.
    const e = 0.012;
    const glass = "#bcd2dc";
    for (const x of [-0.8, 0.8]) box(e, 2.0, e, [x, 0, 0.1], glass);
    box(1.6, e, e, [0, 1.0, 0.1], glass);
    box(1.6, e, e, [0, -1.0, 0.1], glass);
    k.cloud({ share: 0.8 }, (rand) => {
      const x = (rand() - 0.5) * 1.56;
      const top = -0.82 + 0.1 * Math.sin(x * 4.4) + 0.05 * Math.sin(x * 15);
      const y = -0.98 + rand() * (top + 0.98);
      const water = x > 0.3 && y > -0.9;
      const c = water
        ? [0.24, 0.52, 0.85]
        : [0.89, 0.76, 0.49].map((v) => v * (0.85 + 0.2 * rand()));
      return { p: [x, y, (rand() - 0.5) * 0.18], color: c, size: 1.2 };
    });
    box(0.6, 0.03, 0.18, [-0.45, 0.1, 0], "#8b8f96");
  } else {
    // The well: four posts, a floor, and a few stones in it.
    const e = 0.02;
    const W = 0.32;
    for (const x of [-W, W]) for (const z of [-W, W]) box(e, 1.9, e, [x, 0, z], "#6a6560");
    box(0.64, 0.02, 0.64, [0, -0.96, 0], "#7d766c");
    const stones = [[-0.24, -0.88, -0.24, "#3f88c5"], [-0.08, -0.88, -0.24, "#3f88c5"], [0.08, -0.88, 0.08, "#c8553d"], [0.24, -0.88, 0.24, "#44af69"], [-0.24, -0.72, -0.24, "#e8c547"], [0.08, 0.3, 0.08, "#f28f3b"], [0.24, 0.3, 0.08, "#f28f3b"], [0.08, 0.46, 0.08, "#f28f3b"]]; // prettier-ignore
    for (const [x, y, z, c] of stones) k.add(k.roundedBox(0.15, 0.15, 0.15, 6), { pos: [x, y, z], even: true, color: (cc) => lit(c, cc.n) }); // prettier-ignore
  }
}

function stage(k, kind = "bricks") {
  picture(k, kind);
  k.reach([1.1, 1.1, 0.4]);
  k.reach([-1.1, -1.1, -0.4]);
}

export const RECIPES = {
  shardball: {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "flat",
        choices: [
          { id: "flat", label: "Flat board" },
          { id: "dome", label: "Dome" },
        ],
      },
      VIEW,
      { key: "level", label: "Level", type: "slider", min: 1, max: 5, step: 1, default: 1 },
    ],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "bricks");
    },
    arcade: {
      title: "Shardball",
      goal: "Keep the ball in play and break every brick.",
      stats: [
        { key: "score", label: "Score" },
        { key: "lives", label: "Balls", icon: "●" },
        { key: "level", label: "Level" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "up", "down", "fire"],
      padLabels: { fire: "Go" },
      controls: {
        keys: "← → (or A, D) move the paddle; in the dome, ↑ ↓ (W, S) too. Space launches the ball.",
        mouse: "Move the mouse to steer the paddle; click to launch.",
        touch: "Drag to steer the paddle; tap to launch. Or use the pad.",
        pad: "Stick or D-pad to steer; A launches.",
        short: "← → steer · Space launch · V for 3D",
      },
      create: async (api) => (await import("./arcade-shardball.js")).createShardball(api),
    },
  },
  longtail: {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [
      {
        key: "world",
        label: "World",
        type: "select",
        default: "cube",
        choices: [
          { id: "cube", label: "Cube" },
          { id: "planet", label: "Planet" },
          { id: "torus", label: "Ring (torus)" },
        ],
      },
      {
        key: "planet",
        label: "Planet",
        type: "select",
        default: "mars",
        choices: [
          { id: "mars", label: "Mars" },
          { id: "moon", label: "The Moon" },
          { id: "earth", label: "Earth" },
        ],
      },
      { key: "tunnels", label: "Tunnels", type: "switch", default: true },
      VIEW,
    ],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "net");
    },
    arcade: {
      title: "Longtail",
      goal: "Eat the berries to grow longer. Don't run into yourself.",
      stats: [
        { key: "score", label: "Score" },
        { key: "length", label: "Length" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "up", "down"],
      controls: {
        keys: "Arrow keys (or W, A, S, D) turn toward that side of the screen.",
        touch: "Swipe the way to go, or use the pad.",
        pad: "Stick or D-pad to turn.",
        short: "Arrows turn · V folds it into 3D",
      },
      create: async (api) => (await import("./arcade-longtail.js")).createLongtail(api),
    },
  },
  "grain-garden": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [VIEW],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "grains");
    },
    arcade: {
      title: "Grain Garden",
      goal: "Pour sand, water, oil, fire and seeds, and watch them pile, flow, burn and grow.",
      stats: [
        { key: "grains", label: "Grains" },
        { key: "plants", label: "Plants" },
      ],
      best: false,
      views: true,
      pad: ["turnL", "turnR"],
      padLabels: { turnL: "⟲", turnR: "⟳" },
      choices: [
        { id: "sand", label: "Sand", color: "#e3c27c" },
        { id: "water", label: "Water", color: "#3d86d8" },
        { id: "oil", label: "Oil", color: "#4a3418" },
        { id: "fire", label: "Fire", color: "#ff7a1a" },
        { id: "seed", label: "Seeds", color: "#a06b35" },
        { id: "stone", label: "Stone", color: "#8b8f96" },
        { id: "empty", label: "Erase", color: "#ffffff" },
      ],
      controls: {
        mouse: "Hold the button and move to pour. Pick what to pour from the buttons.",
        touch: "Hold a finger down and move it to pour; pick what to pour from the buttons.",
        keys: "Q and E turn the box in 3D.",
        short: "Hold to pour · V tips it into 3D",
      },
      create: async (api) => (await import("./arcade-grains.js")).createGrains(api),
    },
  },
  "page-breaker": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [
      {
        key: "sample",
        label: "Page",
        type: "select",
        default: "article",
        choices: [
          { id: "article", label: "An article (PDF)" },
          { id: "photo", label: "A photo" },
        ],
      },
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "flat",
        choices: [
          { id: "flat", label: "Flat board" },
          { id: "dome", label: "Dome" },
        ],
      },
      VIEW,
      { key: "source", label: "Source", type: "text", default: "", hidden: true },
    ],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "page");
    },
    input: {
      title: "Your own page",
      accept: ".pdf,application/pdf,image/png,image/jpeg,image/webp,image/avif",
      binary: true,
      fileButton: "Open a PDF or a photo…",
      note: "Every word on the page becomes a brick, and so does each piece of its pictures; each page of a PDF is a level. The file is read on this device and never leaves it.",
      async read(_text, fileName, file) {
        if (!file) throw new Error("Open a PDF or a photo.");
        const { PAGES } = await import("./arcade-pages.js");
        PAGES.file = file;
        PAGES.name = fileName;
        return { source: "own" };
      },
      shown: () => "",
    },
    credits: [
      {
        label: "Page Breaker",
        title: "Tulip field (the photo sample)",
        source: "https://www.flickr.com/photos/14674348@N04/13825345834",
        author: "DennisM2",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    arcade: {
      title: "Page Breaker",
      goal: "Every word and picture on the page is a brick. Break them all.",
      stats: [
        { key: "score", label: "Score" },
        { key: "lives", label: "Balls", icon: "●" },
        { key: "level", label: "Page" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "up", "down", "fire"],
      padLabels: { fire: "Go" },
      controls: {
        keys: "← → (or A, D) move the paddle; in the dome, ↑ ↓ (W, S) too. Space launches the ball.",
        mouse: "Move the mouse to steer the paddle; click to launch.",
        touch: "Drag to steer the paddle; tap to launch. Or use the pad.",
        pad: "Stick or D-pad to steer; A launches.",
        short: "← → steer · Space launch · V for 3D",
      },
      create: async (api) => (await import("./arcade-pages.js")).createPageBreaker(api),
    },
  },
  strata: {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [
      {
        key: "well",
        label: "Well",
        type: "select",
        default: "deep",
        choices: [
          { id: "deep", label: "Deep (4 by 4)" },
          { id: "wide", label: "Wide (5 by 5)" },
          { id: "slot", label: "Flat slot (one deep)" },
        ],
      },
      { ...VIEW, default: "3d" },
    ],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "well");
    },
    arcade: {
      title: "Strata",
      goal: "Fill a whole layer of the well to clear it. Don't let the stones reach the rim.",
      stats: [
        { key: "score", label: "Score" },
        { key: "layers", label: "Layers" },
        { key: "level", label: "Level" },
        { key: "next", label: "Next" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "up", "down", "alt", "turnL", "fire"],
      padLabels: { alt: "⟳", turnL: "⤾", fire: "▼" },
      controls: {
        keys: "Arrows (or W, A, S, D) move the stone across the well; X turns it, Q and E tip it; Space drops it.",
        touch: "Swipe to move it, swipe up to turn it; or use the pad.",
        pad: "D-pad moves; B turns; LB and RB tip; A drops.",
        short: "Arrows move · X turn · Q E tip · Space drop",
      },
      create: async (api) => (await import("./arcade-strata.js")).createStrata(api),
    },
  },
  "volley-table": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [
      { key: "skill", label: "The computer", type: "slider", min: 1, max: 3, step: 1, default: 2 },
      VIEW,
    ],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "table");
    },
    arcade: {
      title: "Volley Table",
      goal: "Get the ball past the computer's paddle. First to seven.",
      stats: [
        { key: "you", label: "You" },
        { key: "them", label: "Computer" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "fire"],
      padLabels: { fire: "Serve" },
      controls: {
        keys: "← → (or A, D) move your paddle; Space serves.",
        mouse: "Move the mouse to steer your paddle.",
        touch: "Drag to steer your paddle, or use the pad.",
        pad: "Stick or D-pad to steer; A serves.",
        short: "← → steer · a moving paddle puts spin on the ball · V tilts the table",
      },
      create: async (api) => (await import("./arcade-rally.js")).createRally(api),
    },
  },
  "stone-belt": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [VIEW],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "rocks");
    },
    credits: [
      {
        label: "Stone Belt",
        title:
          "The shapes of Bennu, Itokawa, Eros, Kleopatra, Geographos, Toutatis and Golevka (NASA 3D Resources)",
        source: "https://github.com/nasa/NASA-3D-Resources",
        author: "NASA",
        license: "Public domain",
        licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      },
    ],
    arcade: {
      title: "Stone Belt",
      background: "#05070c",
      goal: "Blast the drifting rocks. Big ones split in two; small ones turn to dust.",
      stats: [
        { key: "score", label: "Score" },
        { key: "lives", label: "Ships", icon: "▲" },
        { key: "wave", label: "Wave" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "up", "fire"],
      padLabels: { fire: "Fire" },
      controls: {
        keys: "← → (or A, D) turn; ↑ (W) thrusts; Space fires (hold to keep firing).",
        touch: "Hold a finger where to go: the ship turns, flies and fires. Or use the pad.",
        pad: "Stick to turn and thrust; A fires.",
        short: "← → turn · ↑ thrust · Space fire · V for the chase view",
      },
      create: async (api) => (await import("./arcade-rocks.js")).createRocks(api),
    },
  },
  "soft-landing": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [
      {
        key: "world",
        label: "World",
        type: "select",
        default: "moon",
        choices: [
          { id: "moon", label: "The Moon" },
          { id: "mars", label: "Mars" },
        ],
      },
      VIEW,
    ],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "lander");
    },
    credits: [
      {
        label: "Soft Landing",
        title:
          "The Moon's ground: LRO's laser altimeter (LOLA) and camera (LROC), the CGI Moon Kit",
        source: "https://svs.gsfc.nasa.gov/4720",
        author:
          "NASA's Scientific Visualization Studio (Ernie Wright), from the LOLA and LROC teams",
        license: "Public domain",
        licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      },
      {
        label: "Soft Landing",
        title:
          "Mars's ground: Mars Global Surveyor's laser altimeter (MOLA), the MEGDR at 16 pixels a degree",
        source: "https://pds-geosciences.wustl.edu/missions/mgs/megdr.html",
        author: "NASA's Planetary Data System, the MOLA Science Team",
        license: "Public domain",
        licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      },
    ],
    arcade: {
      title: "Soft Landing",
      background: "#05060a",
      goal: "Land on real ground: slow, upright and on a level spot. The green lights mark flat ones.",
      stats: [
        { key: "score", label: "Score" },
        { key: "lives", label: "Landers", icon: "▲" },
        { key: "fuel", label: "Fuel" },
        { key: "down", label: "Falling" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "fire"],
      padLabels: { fire: "Thrust" },
      controls: {
        keys: "← → (or A, D) tip the lander; ↑ (W) or Space fires the engine.",
        touch: "Hold Thrust to fire the engine; ◀ ▶ tip the lander.",
        pad: "Stick to tip; A fires the engine.",
        short: "← → tip · ↑ or Space thrust · V shows the ground in 3D",
      },
      create: async (api) => (await import("./arcade-lander.js")).createLander(api),
    },
  },
  "night-owl-pinball": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [VIEW],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "pinball");
    },
    arcade: {
      title: "Night Owl Pinball",
      goal: "Keep the ball on the table with the flippers; the pop bumpers score.",
      stats: [
        { key: "score", label: "Score" },
        { key: "balls", label: "Balls", icon: "●" },
      ],
      best: "score",
      views: true,
      pad: ["turnL", "fire", "turnR"],
      padLabels: { turnL: "◀", fire: "Pull", turnR: "▶" },
      controls: {
        keys: "← (or A, Q) left flipper, → (or D, E) right flipper; hold Space (or ↓) to pull the plunger, let go to launch.",
        touch:
          "Hold the left or right half of the table for that flipper; hold to pull the plunger.",
        pad: "LB and RB, or the D-pad, are the flippers; A pulls the plunger.",
        short: "← → flippers · hold Space to launch · V for the player's view",
      },
      create: async (api) => (await import("./arcade-pinball.js")).createPinball(api),
    },
  },
  "cast-a-shadow": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [VIEW],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "shadow");
    },
    arcade: {
      title: "Cast a Shadow",
      goal: "Turn the carved block until its shadow fills the outline on the wall.",
      stats: [
        { key: "puzzle", label: "Puzzle" },
        { key: "match", label: "Match" },
        { key: "score", label: "Score" },
      ],
      best: "score",
      views: true,
      pad: ["left", "right", "up", "down", "turnL", "turnR"],
      padLabels: { turnL: "⟲", turnR: "⟳" },
      controls: {
        keys: "Arrows (or W, A, S, D) turn the block; Q and E roll it.",
        mouse: "Drag to turn the block.",
        touch: "Drag to turn the block, or use the pad.",
        pad: "Stick to turn; LB and RB roll.",
        short: "Drag or arrows turn it · V shows the block itself",
      },
      create: async (api) => (await import("./arcade-shadows.js")).createShadows(api),
    },
  },
  "photo-dash": {
    turntable: false,
    density: 0.05,
    kernel: "sharp", // the sharper splat edge (labs)
    options: [VIEW, { key: "source", label: "Source", type: "text", default: "", hidden: true }],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    drive() {}, // the game moves on its own layer; the toy's still picture stays still
    build(k) {
      stage(k, "dash");
    },
    input: {
      title: "Your own photo",
      accept: "image/png,image/jpeg,image/webp,image/avif",
      binary: true,
      fileButton: "Open a photo…",
      note: "The line where the photo's sky meets its ground becomes the track. The photo is read on this device and never leaves it.",
      async read(_text, fileName, file) {
        if (!file) throw new Error("Open a photo.");
        const { DASH } = await import("./arcade-dash.js");
        DASH.file = file;
        DASH.name = fileName;
        return { source: "own" };
      },
      shown: () => "",
    },
    credits: [
      {
        label: "Photo Dash",
        title: "Tulip field (the sample photo)",
        source: "https://www.flickr.com/photos/14674348@N04/13825345834",
        author: "DennisM2",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    arcade: {
      title: "Photo Dash",
      goal: "Roll the marble along your photo's skyline. Jump the gaps; catch the sparks.",
      stats: [
        { key: "score", label: "Score" },
        { key: "lives", label: "Marbles", icon: "●" },
        { key: "lap", label: "Lap" },
      ],
      best: "score",
      views: true,
      pad: ["fire"],
      padLabels: { fire: "Jump" },
      controls: {
        keys: "Space (or ↑) jumps.",
        mouse: "Click to jump.",
        touch: "Tap to jump.",
        pad: "A jumps.",
        short: "Space or tap to jump · V raises the photo into 3D",
      },
      create: async (api) => (await import("./arcade-dash.js")).createDash(api),
    },
  },
};
