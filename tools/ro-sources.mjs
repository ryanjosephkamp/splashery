// Lane Real objects: where each toy's model comes from and how tools/ro-bake.mjs cuts it into
// the parts its tap moves. Positions in `part` and `paint` are in the baked model's coordinates
// (+Y up, centered, in a sphere of radius 1). `pose` works on the raw mesh before that (the
// file's own units). Licenses were checked on each source's live page (September 29, 2026).

export const SOURCES = {
  // An orange steel bottle with a screw cap on a loop. The file shows the cap beside the bottle,
  // so the cap's four pieces are moved onto the neck first. Parts: 0 bottle, 1 cap (its plug left
  // out).
  "water-bottle": {
    source: { objaverse: "glbs/000-135/42827e2ce39145eda296e6d6524f4c3d.glb" },
    title: "Water bottle",
    author: "danny_p3d",
    url: "https://sketchfab.com/3d-models/water-bottle-42827e2ce39145eda296e6d6524f4c3d",
    license: "CC BY 4.0",
    count: 280000,
    pose({ raw, islands, moveTris }) {
      const I = islands(raw.pos, raw.idx);
      const body = I.list.reduce((a, b) => (b.area > a.area ? b : a));
      const dz = body.center[2] - I.list.find((x) => x !== body && x.lo[1] > 0.3).center[2];
      for (const x of I.list) if (x !== body) moveTris(raw, x.tris, ([a, b, c]) => [a, b, c + dz]);
      raw.capY = 0.39;
    },
    // The cap is a stopper: the plug below its rim (and the plug's seal) sits inside the neck,
    // so it is left out; the toy closes the cap's underside with a dark disc.
    part: (s) => (s.island === s.bodyIsland ? 0 : s.p[1] < 0.604 ? -1 : 1),
  },
  // Vintage round spectacles (Poly Haven, CC0), lenses left out (kit-built lenses that
  // darken). Parts: 0 the front (rims, bridge, nose pads, hinges), 1 left arm, 2 right arm.
  sunglasses: {
    source: { polyhaven: "round_spectacles", res: "2k" },
    title: "Round Spectacles",
    author: "Sean Buckley",
    url: "https://polyhaven.com/a/round_spectacles",
    license: "CC0 1.0",
    count: 280000,
    pose({ raw, islands, dropTris }) {
      const I = islands(raw.pos, raw.idx);
      const lens = new Set();
      for (const x of I.list) if (x.area > 1e-3 && raw.materials[raw.mat[x.tris[0]]].name.endsWith("glass")) for (const t of x.tris) lens.add(t); // prettier-ignore
      dropTris(raw, (t) => lens.has(t));
    },
    part: (s) => {
      const I = s.isl.list[s.island];
      if (I.hi[2] - I.lo[2] < 0.05) return 0;
      return I.center[0] < 0 ? 1 : 2;
    },
    report({ isl, s }) {
      // Where the lenses and hinges are, in baked coordinates.
      void isl;
      let lo = [9, 9, 9];
      let hi = [-9, -9, -9];
      for (let i = 0; i < s.n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], s.pos[i * 3 + k]); hi[k] = Math.max(hi[k], s.pos[i * 3 + k]); } // prettier-ignore
      console.log(
        "  bounds",
        lo.map((v) => v.toFixed(3)),
        hi.map((v) => v.toFixed(3)),
        "scale",
        s.scale,
      );
    },
  },
  // A gray six-panel baseball cap with a fabric texture, eyelets and a strap at the back; no
  // logo. It moves as one piece. Part 0.
  "baseball-cap": {
    source: { objaverse: "glbs/000-105/1c1d34d73fd94e6b9e8f82b1eb7194a0.glb" },
    title: "Baseball Cap",
    author: "Scott VanArsdale",
    url: "https://sketchfab.com/3d-models/baseball-cap-1c1d34d73fd94e6b9e8f82b1eb7194a0",
    license: "CC BY 4.0",
    count: 280000,
  },
  // A green fountain pen with a steel nib and a piston knob. The file lays the cap beside the
  // barrel; it is cut out by its pieces (everything beside the barrel, z < -0.1 in the file) and
  // slid onto the nib after sampling. The maker's marks (the cap-top emblem and the lettering on
  // the nib and the rings) are painted plain. Parts: 0 the pen, 1 the cap.
  "fountain-pen": {
    source: { objaverse: "glbs/000-039/af3606f31c4343859d887049a1908fb0.glb" },
    title: "Fountain pen in translucent green",
    author: "chemicalX",
    url: "https://sketchfab.com/3d-models/af3606f31c4343859d887049a1908fb0",
    license: "CC BY 4.0",
    count: 280000,
    part: (s) => (s.isl.list[s.island].center[2] < -0.1 ? 1 : 0),
    // Cap: top against the nib's tip, its axis on the barrel's (in the file's units).
    place: (s, part) => (part === 1 ? [-2.42, -0.117, 1.3] : null),
    paint(s) {
      if (s.matName === "glossy-black-texture") return [0.05, 0.05, 0.05].map((v) => v * s.light);
      if (s.matName === "metallic-white-texture") return [0.74, 0.75, 0.76].map((v) => Math.min(1, v * s.light)); // prettier-ignore
      return null;
    },
  },
  // A plain drinks can with its own ring pull. The body wears an original label painted here
  // (orange, a white wave, bubbles; no name, no brand), with the rims and lid left aluminum.
  // Parts: 0 the can (with the tab's rivet), 1 the ring pull.
  "soda-can": {
    source: { objaverse: "glbs/000-144/f3560f1b73a1498d9313a0f10fd11ef6.glb" },
    title: "Soda Can",
    author: "RoutineStudio",
    url: "https://sketchfab.com/3d-models/soda-can-f3560f1b73a1498d9313a0f10fd11ef6",
    license: "CC BY 4.0",
    count: 280000,
    part: (s) => {
      const I = s.isl.list[s.island];
      return I.area > 1 && I.area < 50 ? 1 : 0;
    },
    paint(s) {
      const [x, y, z] = s.p;
      const r = Math.hypot(x, z);
      const L = s.light;
      const v = (y + 0.64) / (0.6 + 0.64); // 0 at the label's foot, 1 at its top
      if (v < 0 || v > 1 || r < 0.4 || Math.abs(s.nrm[1]) > 0.5) {
        // Aluminum: a cool gray with a sheen where the light glances.
        const g = 0.78 + 0.1 * Math.max(0, s.nrm[1]);
        return [g * 0.98, g, g * 1.02].map((c) => Math.min(1, c * L));
      }
      const u = (Math.atan2(z, x) / (2 * Math.PI) + 1) % 1;
      let c = [0.95, 0.47, 0.09];
      if (v < 0.07 || v > 0.93) c = [0.72, 0.26, 0.05];
      const wave = 0.56 + 0.07 * Math.sin(2 * Math.PI * (2 * u + 0.1));
      const d = Math.abs(v - wave);
      if (d < 0.05) c = [0.98, 0.96, 0.9];
      else if (d < 0.062) c = [0.78, 0.3, 0.05];
      // Bubbles below the wave, lighter rings on a loose grid.
      if (v < wave - 0.08 && v > 0.1) {
        const gu = u * 36;
        const gv = v * 22;
        const iu = Math.floor(gu);
        const iv = Math.floor(gv);
        const h = Math.sin(iu * 127.1 + iv * 311.7) * 43758.5453;
        const f = h - Math.floor(h);
        if (f > 0.45) {
          const cu = iu + 0.5 + 0.3 * Math.sin(f * 50);
          const cv = iv + 0.5 + 0.3 * Math.cos(f * 70);
          const rr = 0.18 + 0.2 * f;
          const dd = Math.hypot((gu - cu) * 0.62, gv - cv);
          if (dd < rr) c = dd > rr * 0.62 ? [1, 0.78, 0.5] : [0.97, 0.56, 0.18];
        }
      }
      return c.map((q) => Math.min(1, q * L));
    },
  },
  // A photogrammetry scan of a dark trail running shoe, laced and tied. Its bow (the file's
  // piece standing above the laces) is cut out whole: the toy ties a kit-built bow in its
  // place. Parts: 0 the shoe, 1 the scan's bow (not shown).
  "running-shoe": {
    source: { objaverse: "glbs/000-007/d1bb68aebb1b4532b026d8eb824d4c15.glb" },
    title: "PB158 Sneaker Low",
    author: "SCANIMAT",
    url: "https://sketchfab.com/3d-models/pb158-sneaker-low-d1bb68aebb1b4532b026d8eb824d4c15",
    license: "CC BY 4.0",
    count: 280000,
    part: (s) => {
      const I = s.isl.list[s.island];
      return I.hi[1] > 18 && I.area > 20 && I.area < 100 ? 1 : 0;
    },
    report({ s }) {
      console.log("  scale", s.scale);
    },
  },
  // A yellow pullover hoodie with its hood up, drawstrings and ribbed cuffs and hem, no logo
  // (the small label inside the back of the neck is left out). The hood and the two sleeves
  // are cut from the garment with hard planes (see HD in src/packs/real-objects.js). Parts:
  // 0 the body, 1 the hood, 2 the left sleeve, 3 the right sleeve, 4 and 5 the drawstrings.
  hoodie: {
    source: { objaverse: "glbs/000-091/97611a53e3b846f69e0655b210f72b2f.glb" },
    title: "Hoodie",
    author: "Virtual Pandora",
    url: "https://sketchfab.com/3d-models/hoodie-97611a53e3b846f69e0655b210f72b2f",
    license: "CC BY 4.0",
    count: 280000,
    pose({ raw, dropTris }) {
      const label = raw.materials.findIndex((m) => m.name.startsWith("Material125269"));
      dropTris(raw, (t) => raw.mat[t] === label);
    },
    charts: true,
    minChart: 2000,
    // Beyond the torso's sides (|x| 0.345 in baked units) the body has nothing: a scrap of a cuff.
    finalPart: (p, part) => (part === 0 && Math.abs(p[0]) > 0.345 ? (p[0] < 0 ? 2 : 3) : part),
    // In the file's units (meters): the garment's x is 0 at its middle; the hood's panels start
    // at y 0.6, and a sleeve's panels (raglan, running up to the neck) reach past |x| 0.093.
    part: (s) => {
      const C = s.chart;
      if (s.matName.startsWith("Straps") || s.matName.startsWith("Material2501"))
        return C.center[0] < 0 ? 4 : 5;
      if (s.matName.startsWith("BTN")) return 0;
      if (C.lo[1] > 0.6) return 1;
      if (Math.max(-C.lo[0], C.hi[0]) > 0.0935 && C.lo[1] < 0.5 && Math.abs(C.center[0]) > 0.04) {
        // The sleeve comes off at the shoulder: a hard plane from the armpit up to the shoulder's
        // edge (in baked units); the raglan panel above it stays with the body.
        const [x, y] = s.p;
        return Math.abs(x) - y < 0.1 ? 0 : x < 0 ? 2 : 3;
      }
      return 0;
    },
  },
};
