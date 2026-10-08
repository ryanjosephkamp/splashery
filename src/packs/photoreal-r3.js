// Photoreal r3 (lane Photoreal r3): ten new photoreal toys, scientific first, all behind the labs
// switch. Two are real splat captures from SuperSplat (the Triceratops skull and the cone shell;
// assets/toys/<id>/<id>.sog, made by tools/pr3-prepare.mjs; their rigs are in
// src/packs/photoreal-r3-rigs.js). Eight are museum scans (photogrammetry meshes) baked into
// splats by tools/pr3-bake.mjs (assets/toys/<id>/<id>.splats, Real objects' format), each splat
// tagged with the piece it moves with, cut with hard edges by the model's own separate pieces or
// files. They load through Real objects' addScan. Every piece moves as a solid part.
//
// One is NonCommercial (the Stannern stones, CC BY-NC 4.0, NHM Vienna): it carries `"nc": true`
// in tools/models.json, and `node tools/nc-assets.mjs` lists it.

import { addScan, decodeSplats } from "./real-objects.js";
import { quatAxisAngle, quatMul, quatRotate, mix } from "../kit.js";

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const ease = (x) => x * x * (3 - 2 * x);
const bump = (x, a, b) => Math.sin(Math.PI * band(x, a, b));
const since = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// Per-tap variety: a small hash of the tap count.
const vary = (tap, salt = 0) => {
  let h = ((tap?.n ?? 0) * 374761393 + salt * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h % 1000) / 1000;
};
// A part's turn q about a point p (the part turns about its own pivot, so the offset makes up the
// difference).
const about = (q, p, pivot) => {
  const r = sub(p, pivot);
  const rr = quatRotate(q, r);
  return { quat: q, offset: sub(r, rr) };
};
const qa = (axis, ang) => quatAxisAngle(unit(axis), ang);

// ---- The baked models ------------------------------------------------------------------------

const SCANS = new Map();
async function loadScan(id) {
  if (SCANS.has(id)) return SCANS.get(id);
  const url = new URL(`../../assets/toys/${id}/${id}.splats`, import.meta.url);
  let bytes;
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    bytes = new Uint8Array(await fs.readFile(url));
  } else {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Could not load the model.");
    bytes = new Uint8Array(await r.arrayBuffer());
  }
  SCANS.set(id, decodeSplats(bytes));
  return SCANS.get(id);
}

const VMM = "Virtual Museums of Małopolska";
const DAAL = "Digital Atlas of Ancient Life (Paleontological Research Institution)";
const CC0 = {
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
};
const BY = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" };
const BYNC = { license: "CC BY-NC 4.0", licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/" }; // prettier-ignore

// A toy made of one baked scan: its credit, its tap (a pulse of secs), its parts (file part ->
// kit part, made in parts(k)) and drive(e, out, info), e the seconds since the tap.
function scanToy({ id, credit, label, secs, parts, drive, share = 0.86, extra }) {
  return {
    alive: false,
    density: 1.5, // as the Real objects toys: 300,000 splats on the high tier
    controls: [{ key: "tap", label, type: "pulse", ease: secs }],
    action: { key: "tap", label },
    credits: [credit],
    async prepare() {
      await loadScan(id);
    },
    drive(t, c, out, info) {
      const e = since(c, "tap", secs);
      if (e >= 0) drive(e, out, info);
    },
    build(k) {
      const made = parts ? parts(k) : [k.part("whole", { pivot: [0, 0, 0] })];
      addScan(k, SCANS.get(id), { share, parts: made });
      extra?.(k);
    },
  };
}

// Turns once round about a vertical axis through a point, with a slight lean toward you as it
// goes, so the light runs across its faces.
const turnRound =
  (center, turns = 1, secs = 2.8, lean = 0.12) =>
  (e, out, info) => {
    const sgn = vary(info?.tap, 3) < 0.5 ? 1 : -1;
    const q = quatMul(qa([1, 0, 0], lean * Math.sin(Math.PI * band(e, 0, secs))), qa([0, 1, 0], sgn * TAU * turns * ease(band(e, 0, secs)))); // prettier-ignore
    out.parts.whole = about(q, center, center);
  };
// Turns half way round to show its other face, holds, and turns back.
const showBack =
  (center, axis = [0, 1, 0]) =>
  (e, out, info) => {
    const sgn = vary(info?.tap, 5) < 0.5 ? 1 : -1;
    const ang = sgn * Math.PI * (ease(band(e, 0, 1.1)) - ease(band(e, 2.3, 3.4)));
    out.parts.whole = {
      quat: qa(axis, ang),
      offset: [0, 0.06 * (bump(e, 0, 1.1) + bump(e, 2.3, 3.4)), 0],
    };
  };

// ---- The toys -------------------------------------------------------------------------------

// The celestial globe's ball, and its axis: it turns in its rings.
const GLOBE_C = [0, 0.13, -0.005];
const GLOBE_AXIS = unit([0.62, 0.79, 0]);
// The armillary sphere's inner rings.
const ARMILLARY_C = [0, 0.375, -0.01];
// The five Stannern stones' centers (from the baked file) and the floor they lie on.
const STONES = [
  [-0.566, -0.008, 0.012],
  [0.041, -0.14, 0.007],
  [0.296, -0.153, 0.007],
  [0.584, -0.101, 0.006],
  [0.848, -0.132, -0.002],
];

export const RECIPES = {
  "celestial-globe": scanToy({
    id: "celestial-globe",
    label: "Spin the globe",
    secs: 3.6,
    credit: { label: "Celestial globe", title: "Celestial globe", source: "https://sketchfab.com/3d-models/celestial-globe-341fa8a777e94883841409438756f747", author: VMM, ...CC0 }, // prettier-ignore
    parts: (k) => [0, k.part("ball", { pivot: GLOBE_C })],
    drive(e, out, info) {
      const sgn = vary(info?.tap, 7) < 0.5 ? 1 : -1;
      const ang = sgn * TAU * 1.5 * (1 - (1 - band(e, 0, 3.4)) ** 2);
      out.parts.ball = { quat: qa(GLOBE_AXIS, ang), offset: [0, 0, 0] };
    },
  }),
  "armillary-sphere": scanToy({
    id: "armillary-sphere",
    label: "Turn the rings",
    secs: 3.4,
    credit: { label: "Armillary sphere", title: "Armillary sphere (1771)", source: "https://sketchfab.com/3d-models/armillary-sphere-1771-41e23659c75241459eec6477d9e77c93", author: VMM, ...BY, changes: "Baked into splats; the glass over the compass left out." }, // prettier-ignore
    parts: (k) => [0, k.part("rings", { pivot: ARMILLARY_C })],
    drive(e, out, info) {
      const sgn = vary(info?.tap, 11) < 0.5 ? 1 : -1;
      const ang = sgn * TAU * (1 - (1 - band(e, 0, 3.2)) ** 2);
      out.parts.rings = { quat: qa([0, 1, 0], ang), offset: [0, 0, 0] };
    },
  }),
  "stannern-meteorites": scanToy({
    id: "stannern-meteorites",
    label: "Let them fall",
    secs: 3.4,
    credit: { label: "Stannern meteorite", title: "Stannern meteorite (NHMW-MIN-A21, A135, A136, A139, A140)", source: "https://datarepository.nhm-wien.ac.at/10.57756/cuqmeh", author: "Viola Winkler, Natural History Museum Vienna", ...BYNC, changes: "Five stones' scans set side by side and baked into splats." }, // prettier-ignore
    parts: (k) => STONES.map((c, i) => k.part("s" + i, { pivot: c })),
    // One after another, each stone is lifted and let fall: it tumbles a little as it drops and
    // lands with a bump, as the stones of the 1808 fall came down over Moravia.
    drive(e, out, info) {
      STONES.forEach((c, i) => {
        const t = e - 0.38 * i;
        if (t < 0) return;
        const up = 0.32;
        const H = 0.75;
        const h = t < up ? H * ease(t / up) : Math.max(0, H - 0.5 * 9.8 * 0.5 * (t - up) ** 2);
        const land = up + Math.sqrt((2 * H) / 4.9);
        const spin = (vary(info?.tap, 13 + i) - 0.5) * 2.2 * band(t, 0, land) * (1 - band(t, land, land + 0.01)); // prettier-ignore
        const settle = t > land ? 0.04 * Math.exp(-(t - land) * 6) * Math.sin((t - land) * 22) : 0;
        out.parts["s" + i] = { quat: quatMul(qa([0, 0, 1], spin + settle), qa([1, 0, 0], 0.6 * spin)), offset: [0, h, 0] }; // prettier-ignore
      });
    },
  }),
  // Under ultraviolet light, fluorite glows blue-violet: the mineral gave fluorescence its name.
  // A tap switches the lamp on: the stone turns slowly and shows its glow, then the lamp goes off.
  "fluorite-crystal": scanToy({
    id: "fluorite-crystal",
    label: "Ultraviolet lamp",
    secs: 4.2,
    share: 0.45,
    credit: { label: "Fluorite", title: "Mineral: Fluorite", source: "https://sketchfab.com/3d-models/mineral-fluorite-5ed87d4487be495aac0a86632eb3880c", author: DAAL, ...CC0 }, // prettier-ignore
    parts: (k) => [k.part("whole", { pivot: [0, 0, 0] })],
    extra(k) {
      // The same stone again, in its glow under the lamp (hidden until it is on).
      const uv = k.part("uv", { pivot: [0, 0, 0] });
      addScan(k, SCANS.get("fluorite-crystal"), {
        share: 0.45,
        parts: [uv],
        color: (c) => {
          const l = 0.3 * c[0] + 0.55 * c[1] + 0.15 * c[2];
          return mix("#3a2a9a", "#b8a8ff", Math.min(1, l * 1.6));
        },
      });
    },
    drive(e, out) {
      const on = e > 0.15 && e < 3.9;
      const q = qa([0, 1, 0], 0.9 * Math.sin(Math.PI * band(e, 0, 4.2)));
      out.parts.whole = { quat: q, offset: [0, 0, 0], visible: on ? 0 : 1 };
      out.parts.uv = { quat: q, offset: [0, 0, 0], visible: on ? 1 : 0 };
    },
  }),
  "ammonite-agate": scanToy({
    id: "ammonite-agate",
    label: "Turn it over",
    secs: 3.5,
    credit: { label: "Ammonite", title: "Ammonite mineralised with quartz and chalcedony", source: "https://sketchfab.com/3d-models/ammonite-mineralised-with-quartz-and-chalcedony-4a8582d264a9466f87dc68cea5c28838", author: VMM, ...CC0 }, // prettier-ignore
    drive: showBack([0, 0, 0]),
  }),
  "morasko-meteorite": scanToy({
    id: "morasko-meteorite",
    label: "Turn it",
    secs: 3,
    credit: { label: "Morasko meteorite", title: "“Morasko” iron meteorite", source: "https://sketchfab.com/3d-models/morasko-iron-meteorite-37fd0d100a3246f2892ece5f8d178c06", author: VMM, ...CC0 }, // prettier-ignore
    drive: turnRound([0, 0, 0]),
  }),
  "pyrite-cubes": scanToy({
    id: "pyrite-cubes",
    label: "Turn it",
    secs: 3,
    credit: { label: "Pyrite", title: "Pyrite", source: "https://sketchfab.com/3d-models/pyrite-0b7c6e8e32144b72806ed31cb49b4145", author: DAAL, ...CC0 }, // prettier-ignore
    drive: turnRound([0, 0, 0]),
  }),
  "megalodon-tooth": scanToy({
    id: "megalodon-tooth",
    label: "Turn it over",
    secs: 3.5,
    credit: { label: "Megalodon tooth", title: "Vertebrate: Carcharocles megalodon (PRI 55188)", source: "https://sketchfab.com/3d-models/vertebrate-carcharocles-megalodon-pri-55188-06e0bef4795840b4b21d17e5f51f3140", author: DAAL, ...CC0 }, // prettier-ignore
    drive: showBack([0, 0, 0], [1, 0, 0]),
  }),
};

// ---- The shelf entries -------------------------------------------------------------------------

const scan = (id, label, tags, camera) => ({ id, label, category: "scans", kind: "kit", pack: "photoreal-r3", labs: true, tags, camera }); // prettier-ignore
const capture = (id, label, tags, credit, camera) => ({
  id,
  label,
  category: "scans",
  tags,
  kind: "captured",
  labs: true,
  url: `assets/toys/${id}/${id}.sog`,
  urlWeak: `assets/toys/${id}/${id}-lite.sog`,
  credit,
  camera,
});

export const PHOTOREAL_R3_TOYS = [
  capture(
    "triceratops-skull",
    "Triceratops skull",
    "photoreal scan captured science fossil dinosaur triceratops skull horns frill museum",
    {
      title: "Triceratops (Burke Museum)",
      author: "Luke Shea",
      source: "https://superspl.at/scene/811dd9ed",
      ...BY,
      changes: "Converted, recentered and scaled; its mounting rod cropped. One band of spherical harmonics kept on the full file.", // prettier-ignore
    },
    { yaw: 0.55, pitch: 0.2, roll: 0, distance: 6 },
  ),
  capture(
    "cone-shell",
    "Cone shell",
    "photoreal scan captured science shell sea snail cone mollusk pattern",
    {
      title: "Leopard (textile) cone shell",
      author: "Alfred Duemlein",
      source: "https://superspl.at/scene/410c2b24",
      ...BY,
      changes: "Converted, recentered and scaled; the putty it stood on cropped. One band of spherical harmonics kept on the full file.", // prettier-ignore
    },
  ),
  scan("celestial-globe", "Celestial globe", "photoreal scan science astronomy globe stars constellations instrument historical museum", { yaw: 0.45, pitch: 0.3, roll: 0, distance: 5.4 }), // prettier-ignore
  scan("armillary-sphere", "Armillary sphere", "photoreal scan science astronomy armillary sphere rings instrument historical museum", { yaw: 0.5, pitch: 0.2, roll: 0, distance: 5.2 }), // prettier-ignore
  scan("stannern-meteorites", "Stannern meteorite", "photoreal scan science space meteorite stones fall 1808 museum", { yaw: 0.15, pitch: 0.5, roll: 0, distance: 3.4 }), // prettier-ignore
  scan("fluorite-crystal", "Fluorite", "photoreal scan science mineral crystal fluorite purple ultraviolet glow fluorescence", { yaw: 0.5, pitch: 0.3, roll: 0, distance: 4.6 }), // prettier-ignore
  scan("ammonite-agate", "Ammonite", "photoreal scan science fossil ammonite quartz chalcedony agate chambers museum", { yaw: 0.3, pitch: 0.2, roll: 0, distance: 4.8 }), // prettier-ignore
  scan("morasko-meteorite", "Morasko meteorite", "photoreal scan science space meteorite iron museum", { yaw: 0.5, pitch: 0.2, roll: 0, distance: 4.8 }), // prettier-ignore
  scan("pyrite-cubes", "Pyrite", "photoreal scan science mineral pyrite fools gold crystal cubes", { yaw: 0.5, pitch: 0.35, roll: 0, distance: 4.6 }), // prettier-ignore
  scan("megalodon-tooth", "Megalodon tooth", "photoreal scan science fossil shark tooth megalodon museum", { yaw: 0.3, pitch: 0.2, roll: 0, distance: 4.8 }), // prettier-ignore
];
