import { mix } from "../src/kit.js";

// A little windmill: a stone tower, a red cap, and four sails that turn in
// the wind. A tap blows a gust that spins them once more around.
export const RECIPES = {
  "little-windmill": {
    alive: true,
    options: [{ key: "sails", label: "Sail color", type: "color", default: "#f2eee4" }],
    controls: [
      { key: "wind", label: "Wind", type: "slider", default: 0.4 },
      { key: "gust", label: "Gust", type: "pulse", ease: 3 },
    ],
    action: { key: "gust", label: "Blow a gust" },
    drive(t, c, out) {
      // The wind turns the sails; a gust adds one extra turn, eased in and
      // out, so they end where they would have been anyway.
      const g = c.gust > 0 ? 1 - c.gust : 0;
      const extra = 2 * Math.PI * g * g * (3 - 2 * g);
      out.parts.sails = { angle: t * (0.3 + 2 * c.wind) + extra };
    },
    build(k, o) {
      // The tower: whitewashed stone, darker toward the ground.
      k.add(k.cone(0.5, 0.3, 1.6), {
        color: (c) => mix("#8b8f97", "#ece6d8", (c.p[1] + 0.8) / 1.6),
        interior: 0.1,
        core: "#6b5b4b",
      });
      // The cap.
      k.add(k.cone(0.36, 0.02, 0.4), { pos: [0, 1.0, 0], color: "#9c3b2c" });
      // The sails turn together, about an axis that points at you.
      const sails = k.part("sails", { pivot: [0, 0.6, 0.42], axis: [0, 0, 1] });
      k.add(k.sphere(0.07), { pos: [0, 0.6, 0.42], part: sails, color: "#4b3a2a" });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        k.add(k.box(0.16, 0.9, 0.02), {
          pos: [-0.5 * Math.sin(a), 0.6 + 0.5 * Math.cos(a), 0.44],
          rot: [0, 0, (a * 180) / Math.PI],
          part: sails,
          color: o.sails,
        });
      }
    },
  },
};
