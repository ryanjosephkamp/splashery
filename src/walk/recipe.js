// Metadata/preview only. The worker and rendering modules load on entry.
let opening = false;
async function launch() {
  if (opening) return;
  opening = true;
  try {
    const { openWalk } = await import("./main.js");
    await openWalk(globalThis.__splashery?.player?.profile || "low");
  } finally {
    opening = false;
  }
}

export const RECIPES = {
  "walk-inside": {
    label: "Walk inside",
    density: 0.12,
    seed: 115,
    controls: [{ key: "enter", label: "Walk inside", type: "pulse", ease: 0.6, pausable: false }],
    action: {
      key: "enter",
      label: "Walk inside",
      onAct() {
        if (typeof document !== "undefined") launch();
      },
    },
    input: {
      title: "Walk through a splat place",
      fileButton: false,
      note: "Open the walking view, then choose a test place or open your own PLY, SOG, SPZ, or KSPLAT. Everything stays on this device.",
      live: [
        {
          render() {
            const b = document.createElement("button");
            b.id = "walk-open";
            b.type = "button";
            b.textContent = "Walk inside…";
            b.addEventListener("click", launch);
            return b;
          },
        },
      ],
    },
    credits: [
      {
        title: "Walk inside and its test places",
        author: "Made by Ryan with Codex (GPT-6)",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        source: "https://github.com/ryanjosephkamp/splashery/tree/main/src/walk",
        changes:
          "Original procedural kit places; code MIT. Character and renderer imported from Splashery Worlds.",
      },
    ],
    build(k) {
      const floor = k.box(2.4, 0.09, 2.6);
      k.add(floor, { pos: [0, -0.6, 0], color: "#b9b1a0" });
      k.add(k.box(2.4, 1.4, 0.08), { pos: [0, 0.08, 1.26], color: "#bacbc5" });
      k.add(k.box(0.08, 1.4, 2.6), { pos: [-1.16, 0.08, 0], color: "#8ca9a8" });
      for (const x of [-0.6, 0, 0.6])
        k.add(k.box(0.38, 0.5, 0.05), {
          pos: [x, 0.15, 1.2],
          color: x === 0 ? "#b27b57" : "#527c85",
        });
      const door = k.part("door", { pivot: [1.1, -0.6, 0.8], axis: [0, 1, 0] });
      k.add(k.box(0.07, 1.2, 0.85), { pos: [1.1, 0, 0.38], part: door, color: "#be9368" });
    },
    drive(_t, c, out) {
      out.parts.door = { angle: (c.enter || 0) * 1.2 };
    },
  },
};
