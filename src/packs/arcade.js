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

function stage(k, reach = 1.3) {
  k.cloud({ count: 1 }, () => ({ p: [0, 0, 0], color: "#000000", opacity: 0, size: 0.01 }));
  k.reach([reach, reach, reach]);
  k.reach([-reach, -reach, -reach]);
}

export const RECIPES = {
  shardball: {
    turntable: false,
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
    build(k) {
      stage(k);
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
    build(k) {
      stage(k);
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
    options: [VIEW],
    controls: PLAY,
    action: { key: "go", label: "Play or pause" },
    build(k) {
      stage(k);
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
    build(k) {
      stage(k);
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
};
