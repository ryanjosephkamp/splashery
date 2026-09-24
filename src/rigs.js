// Rigs for captured toys (see src/rig.js): parts made of soft ellipsoid
// regions in world coordinates, plus controls, an action and drive() as in
// a kit recipe. Place regions with ?rig=show, which tints each part.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

export const RIGS = {
  // The head turns to one side and back, and the tail (curled on the
  // ground round its right side) flicks its tip up once.
  "cat-statue": {
    parts: [
      {
        name: "head",
        pivot: [0.05, 0.35, 0.4],
        axis: [0, 1, 0],
        regions: [{ at: [0.06, 0.74, 0.5], r: [0.48, 0.5, 0.4], soft: 0.3 }],
      },
      {
        name: "tail",
        pivot: [0.46, -0.84, -0.35],
        axis: [1, 0, 0],
        regions: [
          { at: [0.34, -0.84, -0.55], r: [0.22, 0.11, 0.22], soft: 0.6 },
          { at: [0.48, -0.84, -0.1], r: [0.14, 0.11, 0.32], soft: 0.4 },
          { at: [0.42, -0.84, 0.32], r: [0.16, 0.11, 0.3], soft: 0.4 },
        ],
      },
    ],
    controls: [{ key: "look", label: "Look", type: "pulse", ease: 2.4 }],
    action: { key: "look", label: "Look around" },
    drive(t, c, out) {
      const e = (1 - c.look) * 2.4;
      const on = c.look > 0;
      const turn = on ? Math.sin(Math.PI * band(e, 0, 0.7)) * (1 - band(e, 1.4, 2.2)) : 0;
      const back = on ? Math.sin(Math.PI * band(e, 0.7, 1.4)) : 0;
      out.parts.head = { angle: 0.55 * turn - 0.35 * back };
      out.parts.tail = { angle: on ? -0.45 * Math.sin(Math.PI * band(e, 0.2, 1.0)) : 0 };
    },
  },
  // Squeezed flat, then it springs back with a wobble (a whole-toy effect:
  // no parts, just out.body).
  "rubber-duck-real": {
    parts: [],
    controls: [{ key: "squeeze", label: "Squeeze", type: "pulse", ease: 1.4 }],
    action: { key: "squeeze", label: "Squeeze" },
    drive(t, c, out) {
      if (!(c.squeeze > 0)) return;
      const e = (1 - c.squeeze) * 1.4;
      const press = Math.sin((Math.PI / 2) * band(e, 0, 0.14));
      const spring = e < 0.3 ? 0 : Math.exp(-(e - 0.3) * 5) * Math.cos((e - 0.3) * 22);
      out.body = { squash: e < 0.3 ? 0.42 * press : 0.42 * spring };
    },
  },
};
