// Fidelity (lane Fidelity, "Trained splats on our rigs"): toys made of trained splats. A trained
// splat is fitted by an optimizer to many path-traced views of a model (tools/fidelity/), so its
// light, shadow and shine are baked in, unlike the kit's placed splats. Each moving piece is
// trained on its own, in the same world frame as the others, and saved as its own SOG file; a
// recipe loads the files as named kit parts (addTrained), so every piece turns as a solid part on
// the kit's rig and taps, sound and physics work as on any kit toy.
//
// The kit buffer keeps a splat's color only (the base band): the spherical-harmonic bands of a
// trained file (the shine that changes as you turn) are dropped here. A single trained file with
// no moving parts keeps them when it is shown as a captured toy (src/toys.js, kind "captured").

import { quatAxisAngle, quatMul, quatRotate, smoothstep } from "../kit.js";

const SH_C0 = 0.28209479177387814;
const TRAINED = new Map();

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load a trained part.");
  return new Uint8Array(await r.arrayBuffer());
}

async function readJson(rel) {
  return JSON.parse(new TextDecoder().decode(await readBytes(rel)));
}

// ---- SOG files -------------------------------------------------------------------------------

// The entries of a zip file (stored or deflated), from its central directory.
async function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Not a SOG file (no zip directory).");
  const count = dv.getUint16(e + 10, true);
  let o = dv.getUint32(e + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(o, true) !== 0x02014b50) throw new Error("A broken SOG file.");
    const method = dv.getUint16(o + 10, true);
    const size = dv.getUint32(o + 20, true);
    const nameLen = dv.getUint16(o + 28, true);
    const extraLen = dv.getUint16(o + 30, true);
    const commentLen = dv.getUint16(o + 32, true);
    const local = dv.getUint32(o + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(o + 46, o + 46 + nameLen));
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    let data = bytes.subarray(start, start + size);
    if (method === 8) {
      const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(ds).arrayBuffer());
    } else if (method !== 0) throw new Error("A SOG file packed in an unknown way.");
    files.set(name, data);
    o += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// Decodes a lossless WebP image to RGBA bytes. In the browser: the browser's decoder (no color
// management, alpha not premultiplied), read back exactly through a WebGL2 texture (a 2D canvas
// would premultiply the alpha and lose the color of faint splats). In Node (the tests and tools):
// splat-transform's WebP codec.
let nodeCodec = null;
let gl = null;
function texturePixels(bmp) {
  gl ||= new OffscreenCanvas(1, 1).getContext("webgl2");
  if (!gl) return null;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const rgba = new Uint8Array(bmp.width * bmp.height * 4);
  gl.readPixels(0, 0, bmp.width, bmp.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  gl.deleteTexture(tex);
  return rgba;
}
async function decodeWebp(bytes) {
  if (typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function") {
    const blob = new Blob([bytes], { type: "image/webp" });
    const bmp = await createImageBitmap(blob, {
      premultiplyAlpha: "none",
      colorSpaceConversion: "none",
    });
    const { width, height } = bmp;
    let rgba = texturePixels(bmp);
    if (!rgba) {
      const g = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      rgba = g.getImageData(0, 0, width, height).data;
    }
    bmp.close?.();
    return { rgba, width, height };
  }
  if (!nodeCodec) {
    const { WebPCodec } = await import("@playcanvas/splat-transform");
    nodeCodec = await WebPCodec.create();
  }
  return nodeCodec.decodeRGBA(bytes);
}

// Decodes a SOG file (version 2, as splat-transform writes it) into plain arrays: positions,
// sizes on the three axes (linear), rotations [x, y, z, w], colors (the base band, 0..1) and
// opacities. The same math as PlayCanvas's SOG reader. `shBands` says how many bands the file
// had (they are not decoded; see the note at the top).
export async function decodeSog(bytes) {
  const files = await unzip(bytes);
  const meta = JSON.parse(new TextDecoder().decode(files.get("meta.json")));
  if (meta.version !== 2) throw new Error("Only SOG version 2 files are supported here.");
  const n = meta.count;
  const img = async (name) => (await decodeWebp(files.get(name))).rgba;
  const [ml, mu] = await Promise.all(meta.means.files.map(img));
  const qs = await img(meta.quats.files[0]);
  const sc = await img(meta.scales.files[0]);
  const s0 = await img(meta.sh0.files[0]);
  const pos = new Float32Array(n * 3);
  const scale = new Float32Array(n * 3);
  const quat = new Float32Array(n * 4);
  const color = new Float32Array(n * 3);
  const alpha = new Float32Array(n);
  const { mins, maxs } = meta.means;
  const unlog = (v) => Math.sign(v) * (Math.exp(Math.abs(v)) - 1);
  const sBook = meta.scales.codebook;
  const cBook = meta.sh0.codebook;
  for (let i = 0; i < n; i++) {
    const i4 = i * 4;
    for (let a = 0; a < 3; a++) {
      const t = ((mu[i4 + a] << 8) + ml[i4 + a]) / 65535;
      pos[i * 3 + a] = unlog(mins[a] + (maxs[a] - mins[a]) * t);
      scale[i * 3 + a] = Math.exp(sBook[sc[i4 + a]]);
      color[i * 3 + a] = Math.min(1, Math.max(0, 0.5 + cBook[s0[i4 + a]] * SH_C0));
    }
    alpha[i] = s0[i4 + 3] / 255;
    const a = (qs[i4] / 255 - 0.5) * Math.SQRT2;
    const b = (qs[i4 + 1] / 255 - 0.5) * Math.SQRT2;
    const c = (qs[i4 + 2] / 255 - 0.5) * Math.SQRT2;
    const d = Math.sqrt(Math.max(0, 1 - (a * a + b * b + c * c)));
    const q = [
      [a, b, c, d],
      [d, b, c, a],
      [b, d, c, a],
      [b, c, d, a],
    ][qs[i4 + 3] - 252] || [0, 0, 0, 1];
    quat.set(q, i4);
  }
  const shBands = meta.shN ? meta.shN.bands || 1 : 0;
  return { n, pos, scale, quat, color, alpha, shBands };
}

// Loads a trained file once (relative to this module) and keeps it for rebuilds.
export async function loadTrained(rel) {
  if (!TRAINED.has(rel)) {
    TRAINED.set(rel, readBytes(rel).then(decodeSog));
    TRAINED.get(rel).catch(() => TRAINED.delete(rel));
  }
  return TRAINED.get(rel);
}

// Picks the full or the lite file of a part for the device: "low" (a phone) takes the lite one.
export function partUrl(part, profile) {
  return profile === "low" && part.lite ? part.lite : part.url;
}

// The splats worth keeping when a part has more than its share: the most visible first (opacity
// times projected area), so a smaller budget drops the faint and tiny ones.
function keepList(t, max, minAlpha) {
  const idx = [];
  for (let i = 0; i < t.n; i++) if (t.alpha[i] >= minAlpha) idx.push(i);
  if (idx.length <= max) return idx;
  const w = new Float32Array(t.n);
  for (const i of idx) {
    const s = t.scale;
    w[i] = t.alpha[i] * Math.cbrt(s[i * 3] * s[i * 3 + 1] * s[i * 3 + 2]) ** 2;
  }
  idx.sort((a, b) => w[b] - w[a]);
  return idx.slice(0, max).sort((a, b) => a - b);
}

// Adds a trained part's splats to the kit as a cloud on `part` (a kit part index). `share` is the
// part's fraction of the toy's budget (at most the file's own count); `minAlpha` drops nearly
// clear splats. The splats keep their trained sizes and rotations exactly (no jitter) and skip
// the kit's surface patterns. Returns the kit item (its start and end index the buffer).
export function addTrained(k, t, { part = 0, share = 1, minAlpha = 0.02 } = {}) {
  const list = keepList(t, Math.max(1, Math.floor(k.count * share)), minAlpha);
  return k.cloud(
    { count: (list.length * 160000) / k.count, pattern: false, jitter: 0 },
    (_r, j) => {
      const i = list[j];
      if (i === undefined) return null;
      return {
        p: [t.pos[i * 3], t.pos[i * 3 + 1], t.pos[i * 3 + 2]],
        scales: [t.scale[i * 3], t.scale[i * 3 + 1], t.scale[i * 3 + 2]],
        quat: [t.quat[i * 4], t.quat[i * 4 + 1], t.quat[i * 4 + 2], t.quat[i * 4 + 3]],
        color: [t.color[i * 3], t.color[i * 3 + 1], t.color[i * 3 + 2]],
        opacity: t.alpha[i],
        part,
      };
    },
  );
}

// Shares a toy's budget among its trained parts by their splat counts, so a lite budget thins
// every part alike.
export function shares(list) {
  const total = list.reduce((s, t) => s + t.n, 0) || 1;
  return list.map((t) => t.n / total);
}

// ---- The brass orrery (Stage 2) ---------------------------------------------------------------

// tools/fidelity/orrery.py builds it in Blender and renders every part on its own; each part is
// trained on its own (Codex task 10) and saved as assets/toys/orrery/<part>.sog (and
// <part>-lite.sog). parts.json there names the parts, their pivots and axes in our coordinates
// (y up) and each arm's seconds per turn.
export const ORR = {
  dir: "../../assets/toys/orrery/",
  T: 7, // seconds a tap keeps it turning
  info: null,
  files: new Map(), // part name -> decoded trained file
};

const ease = (x) => smoothstep(0, 1, x);
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const UP = [0, 1, 0];

const ORRERY = {
  density: 1.5,
  turntable: false,
  closeUp: { minDistance: 0.2 },
  controls: [{ key: "turn", label: "Turn", type: "pulse", ease: ORR.T }],
  action: { key: "turn", label: "Set it turning" },
  credits: [
    {
      label: "Light",
      title: "Studio Small 09 (HDRI)",
      source: "https://polyhaven.com/a/studio_small_09",
      author: "Sergej Majboroda",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    {
      label: "Plinth",
      title: "Dark Wood (texture)",
      source: "https://polyhaven.com/a/dark_wood",
      author: "Dario Barresi, Dimitrios Savva, Rico Cilliers",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    {
      label: "Stone planets",
      title: "Rock Surface (texture)",
      source: "https://polyhaven.com/a/rock_surface",
      author: "Amal Kumar",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ],
  // The app passes the device's profile third (the lite parts on "low"); the Node tools don't.
  async prepare(_o, _help, env) {
    ORR.info ||= await readJson(`${ORR.dir}parts.json`);
    const profile = env?.profile;
    await Promise.all(
      ORR.info.parts.map(async (p) => {
        const url = partUrl({ url: `${ORR.dir}${p.name}.sog`, lite: `${ORR.dir}${p.name}-lite.sog` }, profile); // prettier-ignore
        ORR.files.set(p.name, await loadTrained(url).catch(() => loadTrained(`${ORR.dir}${p.name}.sog`))); // prettier-ignore
      }),
    );
  },
  build(k) {
    const list = ORR.info.parts.map((p) => ORR.files.get(p.name));
    const share = shares(list);
    k.data = { orrery: null };
    ORR.info.parts.forEach((p, i) => {
      const part = p.name === "base" ? 0 : k.part(p.name, { pivot: p.pivot, axis: p.axis });
      addTrained(k, list[i], { part, share: share[i] });
    });
  },
  // The arms turn about the column, each at its own speed, and keep the angle they stop at (a
  // tap winds it on from there, like the real thing). The moon turns about Earth on Earth's
  // arm, the sun spins slowly and the gear train turns under it all.
  drive(t, c, out, info) {
    const st = (info.data.orrery ||= { last: t, ang: {} });
    const dt = Math.min(0.1, Math.max(0, t - st.last));
    st.last = t;
    const e = c.turn > 0 ? (1 - c.turn) * ORR.T : -1;
    const speed = e < 0 ? 0 : ease(seg(e, 0, 0.8)) * (1 - ease(seg(e, ORR.T - 1.8, ORR.T)));
    const parts = ORR.info?.parts || [];
    const gearA = parts.find((p) => p.name === "gear-a");
    for (const p of parts) {
      let w = 0;
      if (p.period) w = (2 * Math.PI) / p.period;
      if (p.teeth) w = ((2 * Math.PI) / 4) * (p === gearA ? 1 : -gearA.teeth / p.teeth);
      st.ang[p.name] = ((st.ang[p.name] || 0) + w * speed * dt) % (2 * Math.PI);
    }
    for (const p of parts) {
      if (p.name === "base") continue;
      const a = st.ang[p.name];
      if (!p.rides) {
        out.parts[p.name] = { angle: a };
        continue;
      }
      // Riding on another arm: turn about its own pivot, then with the arm about the column.
      const qa = quatAxisAngle(UP, st.ang[p.rides]);
      const moved = quatRotate(qa, p.pivot);
      out.parts[p.name] = {
        quat: quatMul(qa, quatAxisAngle(p.axis, a)),
        offset: [moved[0] - p.pivot[0], moved[1] - p.pivot[1], moved[2] - p.pivot[2]],
      };
    }
  },
};

export const RECIPES = { orrery: ORRERY };
