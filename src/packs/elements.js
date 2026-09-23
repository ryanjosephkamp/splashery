// Weather and elements pack: fire, storms, ice. Loaded on demand.

import { mix, shade } from "../kit.js";

export const RECIPES = {
  campfire: {
    alive: true,
    controls: [
      { key: "size", label: "Fire size", type: "slider", default: 0.55 },
      { key: "stoke", label: "Stoke", type: "pulse", ease: 1.6 },
    ],
    action: { key: "stoke", label: "Stoke the fire" },
    drive(t, c, out) {
      out.amount = 0.45 + 0.9 * c.size + 0.7 * c.stoke;
    },
    build(k) {
      const ground = -0.55;
      // A ring of stones.
      const stones = 11;
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * Math.PI * 2 + k.rand() * 0.2;
        const r = 0.78 + k.rand() * 0.06;
        const s = 0.12 + k.rand() * 0.06;
        const grey = 0.42 + k.rand() * 0.22;
        k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
          pos: [Math.sin(a) * r, ground + s * 0.5, Math.cos(a) * r],
          rot: [0, (a * 180) / Math.PI + k.rand() * 40, 0],
          flat: 0.3,
          color: (c) => {
            const n = c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9);
            return mix([grey, grey * 0.97, grey * 0.92], "#2c2a27", 0.35 + 0.35 * n);
          },
        });
      }
      // Logs leaning together.
      const logs = 5;
      for (let i = 0; i < logs; i++) {
        const a = (i / logs) * Math.PI * 2 + 0.3;
        const lean = 38 + k.rand() * 8;
        const len = 0.95;
        const base = [Math.sin(a) * 0.46, ground + 0.08, Math.cos(a) * 0.46];
        // A cylinder along Y, tipped towards the centre.
        k.add(k.cylinder(0.075, len), {
          pos: [
            base[0] * 0.55,
            base[1] + (Math.cos((lean * Math.PI) / 180) * len) / 2,
            base[2] * 0.55,
          ],
          rot: [lean * Math.cos(a) * -1, 0, lean * Math.sin(a)],
          flat: 0.25,
          color: (c) => {
            const char = Math.max(0, Math.min(1, (c.p[1] - ground - 0.12) / 0.45));
            const bark = mix(
              "#6b4526",
              "#3a2413",
              0.5 + 0.5 * c.fbm(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14),
            );
            return mix(bark, "#1a1512", char * 0.85);
          },
        });
      }
      // A bed of embers that glows and flickers.
      k.add(k.disc(0.42), {
        pos: [0, ground + 0.03, 0],
        flat: 0.4,
        kind: "twinkle",
        params: (c) => [0.35, c.rand() * 6.28],
        pattern: false,
        color: (c) =>
          mix(
            "#ff6a1a",
            "#7a1a08",
            Math.min(1, Math.hypot(c.p[0], c.p[2]) / 0.42 + 0.3 * c.rand()),
          ),
      });
      // Flames: splats born at the base that rise, shrink and redden.
      k.cloud({ share: 0.3, size: 1.25, pattern: false }, (rand) => {
        const a = rand() * Math.PI * 2;
        const r = 0.3 * Math.sqrt(rand());
        const hot = 1 - r / 0.3;
        return {
          p: [Math.sin(a) * r, ground + 0.12 + rand() * 0.1, Math.cos(a) * r],
          color: mix("#ffb347", "#fff4c2", hot * 0.9),
          size: 0.8 + 0.8 * hot,
          opacity: 0.8,
          kind: "flame",
          params: [0.55 + 0.6 * hot * rand(), rand()],
        };
      });
      // Sparks drifting up.
      k.cloud({ share: 0.015, size: 0.45, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.4, ground + 0.2, (rand() - 0.5) * 0.4],
        color: "#ffc062",
        opacity: 1,
        kind: "rise",
        params: [1.5 + rand(), rand()],
      }));
      // A thin wisp of smoke.
      k.cloud({ share: 0.008, size: 2.2, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.2, ground + 0.7, (rand() - 0.5) * 0.2],
        color: shade("#8a8580", 0.9 + rand() * 0.2),
        opacity: 0.1,
        kind: "rise",
        params: [1.2, rand()],
      }));
      // Room for the flames at their tallest.
      k.reach([0, ground + 1.35, 0]);
    },
  },
};
