import { quatAxisAngle } from "../kit.js";
import { renderMeshPanel } from "./panel.js";

export const RECIPES = {
  "splats-to-mesh": {
    density: 0.4,
    controls: [{ key: "spin", label: "Turn the example", type: "pulse", ease: 2 }],
    action: { key: "spin", label: "Turn the example ring" },
    input: {
      title: "Splats to mesh",
      fileButton: false,
      live: [{ render: renderMeshPanel }],
      note: "The example ring is made of splats. Convert a source in this panel to see and save its triangle mesh.",
    },
    drive(_t, c, out) {
      out.body = { quat: quatAxisAngle([0, 1, 0], Math.PI * 2 * (1 - (c.spin ?? 0))) };
    },
    build(k) {
      k.add(k.torus(0.62, 0.22), {
        rot: [90, 0, 0],
        color: ({ n }) => [
          0.18 + 0.08 * Math.abs(n[1]),
          0.58 + 0.15 * Math.abs(n[1]),
          0.47 + 0.1 * Math.abs(n[1]),
        ],
        even: true,
        interior: 0,
        size: 1.6,
        flat: 0.5,
        opacity: 0.999,
      });
    },
  },
};
