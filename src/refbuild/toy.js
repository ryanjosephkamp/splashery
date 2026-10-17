// The benchmark's actual fitted kit shapes, rebuilt in the browser.
import { REFERENCE_BUILDS } from "./data.js";
import { buildShapes, driveMoves } from "./shapes.js";

export const RECIPES = {
  "built-from-pictures": {
    alive: false,
    density: 0.65,
    options: [
      {
        key: "object",
        label: "Object",
        type: "select",
        default: "reference-duck",
        choices: REFERENCE_BUILDS.map((b) => ({ id: b.id, label: b.label })),
      },
    ],
    controls: [{ key: "play", label: "Move", type: "pulse", ease: 2.4 }],
    action: { key: "play", label: "Move the object" },
    build(k, o) {
      const b = REFERENCE_BUILDS.find((b) => b.id === o.object) || REFERENCE_BUILDS[0];
      buildShapes(k, b.model);
    },
    drive(t, c, out, info) {
      driveMoves(c, out, info.data.refbuild);
    },
  },
};
