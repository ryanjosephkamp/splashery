// Props: the things that stand in a world (trees, rocks, signs). Most reuse
// a toy's recipe from src/packs/ and are "baked" into still splats: the
// recipe is built with the kit, put in its rest pose (its parts and loose
// pieces where a toy at rest shows them), its looping particles (flames,
// falling snow) and its ground base (the grass mound under a toy tree) are
// left out, and it is scaled to stand 1 meter tall with its foot at the
// origin. A world places copies of it at any size (props share their
// splats). Worlds also have a few props of their own, built here with the
// kit: a boulder, a bush and the landmark signs.
//
// Pure JavaScript apart from the dynamic import of a pack.

import { Kit, mix, shade, clamp, rgb, quatRotate, quatAxisAngle } from "../kit.js";
import { SplatBuffer } from "../generators.js";
import { KINDS } from "../effects.js";
import { BITMAP } from "../font.js";
import { mulberry32, mixSeed, hash32 } from "../noise.js";

// Every prop type a world file can name. `pack` and `recipe` pick a toy's
// recipe; `build` is a world-only prop. `count` is the splats of the near
// level at the high tier; `base` drops the recipe's ground base ("auto"
// finds it: a low, wide shape at the foot). `collider` is the default
// shape, in units of the prop's size, or "auto" (a capsule around the
// lowest quarter of the prop: a tree's trunk, a rock's body).
export const PROP_TYPES = {
  palm: { pack: "nature", recipe: "palm", count: 42000, collider: "auto" },
  pine: { pack: "nature", recipe: "pine", count: 42000, collider: "auto" },
  oak: { pack: "nature", recipe: "oak", count: 50000, collider: "auto" },
  pebbles: { pack: "nature", recipe: "rocks", count: 16000, collider: "auto" },
  mushroom: { pack: "nature", recipe: "mushroom", count: 16000, collider: "auto" },
  tulip: { pack: "nature", recipe: "tulip", count: 6000, collider: false },
  sunflower: { pack: "nature", recipe: "sunflower", count: 9000, collider: false },
  lighthouse: { pack: "landmarks", recipe: "lighthouse", count: 60000, collider: "auto" },
  boulder: { build: buildBoulder, count: 9000, collider: "auto" },
  bush: { build: buildBush, count: 9000, collider: "auto" },
};

// Level of detail for props: level k keeps one splat in STRIDES[k], each
// made bigger to cover the same ground.
export const PROP_STRIDES = [1, 4, 16];

export function propType(name) {
  return PROP_TYPES[name] || null;
}

function restOptions(recipe, given = {}) {
  const out = {};
  for (const o of recipe.options || []) out[o.key] = given[o.key] ?? o.default;
  return out;
}

// Bakes a prop type into its near-level splats (a SplatBuffer, 1 m tall,
// foot at the origin) plus its measured shape. Async because a pack is
// loaded on demand. `count` is the splats wanted before the base is cut.
export async function bakeProp(typeName, { seed = 1, options = {}, count } = {}) {
  const type = PROP_TYPES[typeName];
  if (!type) throw new Error(`Unknown prop type "${typeName}".`);
  const n = Math.max(500, Math.round(count ?? type.count));
  if (type.build) return finish(type.build(n, seed, options), type);
  const mod = await import(`../packs/${type.pack}.js`);
  const recipe = mod.RECIPES?.[type.recipe];
  if (!recipe) throw new Error(`The ${typeName} recipe is missing from its pack.`);
  const opts = restOptions(recipe, options);
  if (recipe.prepare) await recipe.prepare(opts);
  const k = new Kit(recipe.seed ?? hash32(type.recipe) ^ seed, { count: n, options: opts });
  recipe.build(k, opts);
  const it = k.emit();
  while (!it.next().done);
  return finish(restPose(k, recipe, type), type);
}

// The toy's rest pose, baked: parts turned and moved as the recipe's drive
// puts them with every control at 0, hidden parts and pieces dropped.
function restPose(k, recipe, type) {
  const buf = k.buf;
  const { center, scale } = k.transform;
  const toRecipeY = (y) => y / scale + center[1];
  const drive = { energy: 0, grow: 1, amount: 1, glow: [1, 1, 1, 0], parts: {}, body: null, fx: {}, addon: null, tokens: null, cues: [], morph: null }; // prettier-ignore
  const state = {};
  for (const c of recipe.controls || []) state[c.key] = 0;
  try {
    recipe.drive?.(0, state, drive, { time: 0, R: 1, tap: null, data: k.data });
  } catch {
    // A drive that needs a live toy: the build pose is the rest pose.
  }
  // Items that are the toy's ground base (a low, wide shape at its foot: a
  // grass mound, a patch of sea).
  const drop = new Uint8Array(buf.count);
  if (type.base !== false) {
    for (const item of k.items) {
      if (item.start === undefined) continue;
      let lo = [Infinity, Infinity, Infinity];
      let hi = [-Infinity, -Infinity, -Infinity];
      for (let i = item.start; i < item.end; i++)
        for (let a = 0; a < 3; a++) {
          const v = buf.pos[i * 3 + a] / scale + center[a];
          if (v < lo[a]) lo[a] = v;
          if (v > hi[a]) hi[a] = v;
        }
      if (hi[1] < 0.16 && hi[0] - lo[0] > 0.9 && hi[2] - lo[2] > 0.9)
        drop.fill(1, item.start, item.end);
    }
  }
  const parts = k.parts.map((p) => drive.parts[p.name] || null);
  const tokens = drive.tokens || [];
  const out = new SplatBuffer(buf.count);
  for (let i = 0; i < buf.count; i++) {
    if (drop[i]) continue;
    const kind = Math.round(buf.anim[i * 4 + 1]);
    const a = buf.anim[i * 4 + 2];
    const b = buf.anim[i * 4 + 3];
    // Looping particles and pieces that fade in on a tap are not at rest.
    if (kind === KINDS.flame || kind === KINDS.rise || kind === KINDS.fall) continue;
    if (kind === KINDS.fade && b < 0) continue;
    if (kind === KINDS.grow && a > (drive.grow ?? 1)) continue;
    if (buf.color[i * 4 + 3] <= 0.02) continue;
    let p = [buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]];
    let q = [buf.rot[i * 4], buf.rot[i * 4 + 1], buf.rot[i * 4 + 2], buf.rot[i * 4 + 3]];
    let s = 1;
    const pi = Math.round(buf.anim[i * 4]) & 15;
    const pd = parts[pi];
    if (pd) {
      if (pd.visible === 0) continue;
      const def = k.parts[pi];
      const pq = pd.quat || (pd.angle ? quatAxisAngle(pd.axis || def.axis, pd.angle) : null);
      if (pq) {
        const rel = [p[0] - def.pivot[0], p[1] - def.pivot[1], p[2] - def.pivot[2]];
        const r = quatRotate(pq, rel);
        p = [def.pivot[0] + r[0], def.pivot[1] + r[1], def.pivot[2] + r[2]];
        q = quatMulXYZW(pq, q);
      }
      if (pd.scale !== undefined) {
        s = pd.scale;
        p = [0, 1, 2].map((a2) => def.pivot[a2] + (p[a2] - def.pivot[a2]) * s);
      }
      if (pd.offset) p = [p[0] + pd.offset[0] * scale, p[1] + pd.offset[1] * scale, p[2] + pd.offset[2] * scale]; // prettier-ignore
    }
    if (kind === KINDS.token) {
      const t = tokens[Math.round(a)];
      if (t) {
        if (t.visible === 0) continue;
        if (t.offset) p = [p[0] + t.offset[0] * scale, p[1] + t.offset[1] * scale, p[2] + t.offset[2] * scale]; // prettier-ignore
      }
    }
    if (s <= 0.01) continue;
    // The toy's own ground is gone, so nothing may sink under the foot.
    if (toRecipeY(p[1]) < -0.2) continue;
    out.push(p, [buf.scale[i * 3] * s, buf.scale[i * 3 + 1] * s, buf.scale[i * 3 + 2] * s], q, [
      buf.color[i * 4],
      buf.color[i * 4 + 1],
      buf.color[i * 4 + 2],
      buf.color[i * 4 + 3],
    ]);
  }
  // The foot: the recipe's origin, where toys stand.
  const foot = [-center[0] * scale, -center[1] * scale, -center[2] * scale];
  return { buf: out, foot };
}

function quatMulXYZW(a, b) {
  return [
    a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
    a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

// Moves the foot to the origin, scales to 1 m tall and measures the prop.
function finish({ buf, foot }, type) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < buf.count; i++) {
    const y = buf.pos[i * 3 + 1];
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  const baseY = Math.min(lo, foot[1] + 0.02);
  const s = 1 / Math.max(1e-6, hi - baseY);
  let reach = 0;
  const lowR = [];
  for (let i = 0; i < buf.count; i++) {
    const x = (buf.pos[i * 3] - foot[0]) * s;
    const y = (buf.pos[i * 3 + 1] - baseY) * s;
    const z = (buf.pos[i * 3 + 2] - foot[2]) * s;
    buf.pos[i * 3] = x;
    buf.pos[i * 3 + 1] = y;
    buf.pos[i * 3 + 2] = z;
    for (let a = 0; a < 3; a++) buf.scale[i * 3 + a] *= s;
    const r = Math.hypot(x, z);
    reach = Math.max(reach, r);
    if (y < 0.25) lowR.push(r);
  }
  lowR.sort((a, b) => a - b);
  const trunk = lowR.length ? lowR[Math.floor(lowR.length * 0.85)] : 0.1;
  let collider = null;
  if (type.collider === "auto")
    collider = { shape: "capsule", radius: Math.max(0.03, trunk), height: 1, offset: [0, 0] }; // prettier-ignore
  else if (type.collider) collider = type.collider;
  return { buf, reach, collider };
}

// A coarser copy for far away: one splat in `stride`, each bigger.
export function thinOut(buf, stride) {
  if (stride <= 1) return buf;
  const out = new SplatBuffer(Math.ceil(buf.count / stride) + 1);
  const grow = Math.sqrt(stride) * 0.9;
  for (let i = 0; i < buf.count; i++) {
    if ((Math.imul(i, 2654435761) >>> 0) % stride !== 0) continue;
    out.push(
      [buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]],
      [
        buf.scale[i * 3] * grow,
        buf.scale[i * 3 + 1] * grow,
        buf.scale[i * 3 + 2] * Math.min(grow, 2),
      ],
      [buf.rot[i * 4], buf.rot[i * 4 + 1], buf.rot[i * 4 + 2], buf.rot[i * 4 + 3]],
      [buf.color[i * 4], buf.color[i * 4 + 1], buf.color[i * 4 + 2], buf.color[i * 4 + 3]],
    );
  }
  return out;
}

// ---- World props built here -------------------------------------------------

const SUN = [-0.45, 0.8, 0.35];
function lit(c, n, k = 0.4) {
  const d = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
  return shade(c, 1 - k * 0.5 + k * Math.max(0, d));
}

// A weathered boulder: a lumpy rock with lichen on top.
function buildBoulder(count, seed, o = {}) {
  const k = new Kit(mixSeed(seed, "boulder"), { count, fit: false });
  const r = mulberry32(mixSeed(seed, "boulder-shape"));
  const bumps = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const y = r() * 1.4 - 0.5;
    bumps.push({ d: [Math.cos(a), y, Math.sin(a)], k: 0.12 + r() * 0.16 });
  }
  const base = rgb(o.color || "#8e8a84");
  k.add(
    k.radial((d) => {
      let rr = 1;
      for (const b of bumps) rr += b.k * Math.max(0, d[0] * b.d[0] + d[1] * b.d[1] + d[2] * b.d[2]) ** 3; // prettier-ignore
      const flat = d[1] < -0.2 ? 0.7 + 0.3 * (1 + d[1]) : 1;
      return rr * flat * (1 + 0.08 * k.noise.fbm(d[0] * 3, d[1] * 3, d[2] * 3, 3));
    }),
    {
      scale: [1, 0.72, 0.9],
      flat: 0.25,
      even: true,
      color: (c) => {
        const g = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5, 3);
        let col = mix(base, shade(base, 0.62), clamp(0.5 + g * 1.6, 0, 1));
        if (c.n[1] > 0.55 && c.noise(c.p[0] * 4, 1, c.p[2] * 4) > 0.1)
          col = mix(col, "#7d8f4e", 0.55);
        return lit(col, c.n, 0.5);
      },
    },
  );
  const it = k.emit();
  while (!it.next().done);
  return { buf: plain(k.buf), foot: [0, -0.62, 0] };
}

// A round bush of small leaves.
function buildBush(count, seed, o = {}) {
  const k = new Kit(mixSeed(seed, "bush"), { count, fit: false });
  const r = mulberry32(mixSeed(seed, "bush-shape"));
  const green = rgb(o.color || "#4f8a3a");
  const blobs = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.25 + r() * 0.25;
    blobs.push([Math.cos(a) * d, 0.45 + r() * 0.3, Math.sin(a) * d, 0.35 + r() * 0.15]);
  }
  blobs.push([0, 0.7, 0, 0.45]);
  // Leaves on the outside of each clump (a dense shell reads as solid
  // foliage; leaves spread through the inside read as speckle), a darker
  // layer just under them so no sky shows through.
  const inside = (p, skip) =>
    blobs.some((b, j) => j !== skip && Math.hypot(p[0] - b[0], (p[1] - b[1]) / 0.85, p[2] - b[2]) < b[3] * 0.92); // prettier-ignore
  // (A kit with only clouds has a base splat size of 1 cm, so sizes
  // here are in centimeters.)
  k.cloud({ count: count * 1.6, size: 4.2 }, (rand) => {
    const bi = Math.floor(rand() * blobs.length);
    const b = blobs[bi];
    const d = randDir(rand);
    const deep = rand() < 0.2;
    const rr = b[3] * (deep ? 0.8 : 0.95 + 0.08 * rand());
    const p = [b[0] + d[0] * rr, b[1] + d[1] * rr * 0.85, b[2] + d[2] * rr];
    if (p[1] < 0.02 || inside(p, bi)) return null;
    const lift = clamp(0.5 + d[1] * 0.5, 0, 1);
    let col = mix(shade(green, 0.7), mix(green, "#a4d468", rand() * 0.5), lift);
    if (deep) col = shade(green, 0.72);
    return {
      p,
      n: d,
      color: lit(col, d, 0.55),
      flat: 0.35,
      size: deep ? 1.6 : 1 + rand() * 0.4,
      opacity: 0.97,
    };
  });
  const it = k.emit();
  while (!it.next().done);
  return { buf: plain(k.buf), foot: [0, 0, 0] };
}

function randDir(r) {
  const z = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return [Math.cos(a) * s, z, Math.sin(a) * s];
}

// A kit buffer without its per-splat behaviour data.
function plain(buf) {
  const out = new SplatBuffer(buf.count);
  for (let i = 0; i < buf.count; i++) {
    if (buf.color[i * 4 + 3] <= 0) continue;
    out.push(
      [buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]],
      [buf.scale[i * 3], buf.scale[i * 3 + 1], buf.scale[i * 3 + 2]],
      [buf.rot[i * 4], buf.rot[i * 4 + 1], buf.rot[i * 4 + 2], buf.rot[i * 4 + 3]],
      [buf.color[i * 4], buf.color[i * 4 + 1], buf.color[i * 4 + 2], buf.color[i * 4 + 3]],
    );
  }
  return out;
}

// ---- Landmark signs -----------------------------------------------------------

// A wooden signpost with the landmark's label painted on its board, in
// meters (the board faces +z). `label` is up to 14 capitals and digits.
export function buildSign(label, { count = 20000, seed = 1, color = "#1f6f8b" } = {}) {
  const k = new Kit(mixSeed(seed, "sign"), { count, fit: false });
  const text = String(label || "").toUpperCase().replace(/[^A-Z0-9 .,'!?-]/g, "").slice(0, 14) || " "; // prettier-ignore
  const chars = text.length;
  // Board size from the text: 6 font pixels a letter, 0.05 m a pixel.
  const px = 0.052;
  const bw = Math.max(1.1, chars * 6 * px + 0.34);
  const bh = 0.62;
  const top = 1.95;
  const wood = rgb("#8a6440");
  const woodColor = (c) => {
    const g = c.fbm(c.p[0] * 2, c.p[1] * 9, c.p[2] * 2, 2);
    return lit(mix(wood, shade(wood, 0.78), clamp(0.5 + g * 1.2, 0, 1)), c.n, 0.35);
  };
  // Two posts.
  for (const sx of [-1, 1])
    k.add(k.box(0.12, top, 0.12), { pos: [sx * (bw / 2 - 0.16), top / 2, -0.02], color: woodColor, flat: 0.3, even: true }); // prettier-ignore
  // The board, painted in the world's accent color with pale letters.
  const paint = rgb(color);
  const cream = rgb("#fbf4e2");
  const board = k.box(bw, bh, 0.08);
  const y0 = top - bh / 2 - 0.05;
  k.add(board, {
    pos: [0, y0, 0.05],
    weight: 3.2,
    flat: 0.2,
    even: true,
    color: (c) => {
      if (c.n[2] < 0.9) return woodColor(c);
      const x = c.p[0];
      const y = c.p[1] - y0;
      // A thin cream border.
      if (Math.abs(x) > bw / 2 - 0.05 || Math.abs(y) > bh / 2 - 0.05) return lit(cream, c.n, 0.2);
      const s = (x + (chars * 6 * px) / 2) / px;
      const t = (0.35 * 7 * px - y) / px + 0.3;
      if (ink(text, s, t)) return { c: lit(cream, c.n, 0.15), size: 0.8 };
      return lit(shade(paint, 0.95 + 0.1 * c.rand()), c.n, 0.2);
    },
  });
  const it = k.emit();
  while (!it.next().done);
  return { buf: plain(k.buf), height: top, width: bw };
}

function ink(text, s, t) {
  if (s < 0 || t < 0 || t >= 7) return false;
  const col = Math.floor(s / 6);
  const gx = Math.floor(s - col * 6);
  const ch = text[col];
  if (!ch || gx > 4) return false;
  const g = BITMAP[ch];
  return !!g && ((g[Math.floor(t)] >> (4 - gx)) & 1) === 1;
}
