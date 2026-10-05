#!/usr/bin/env node
// Lane Live r7: a generated test camera for the Splat mirror. A smooth
// mannequin (head, hair, neck and shoulders, like a dressmaker's dummy with
// a face) in front of a room's wall, talking: the head turns a little, nods,
// and the jaw opens and closes. Rendered by sphere tracing a signed distance
// field on the CPU, with a camera's sensor noise added to each frame, and
// written as a Y4M (YUV 4:2:0) for Chromium's fake camera
// (--use-file-for-fake-video-capture). No real person's face is used.
//
//   node tools/lv7-mannequin.mjs <out.y4m> [--w=640] [--h=480] [--frames=120] [--fps=30] [--noise=5] [--still]
//
// --still holds one pose (only the sensor's noise changes from frame to
// frame), for measuring how steady the mirror stays.
//
// The clip loops cleanly (every motion is a whole number of cycles).

import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.slice(name.length + 3)) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/lv7-mannequin.mjs <out.y4m> [--w=640] …");
const W = opt("w", 640);
const H = opt("h", 480);
const N = opt("frames", 120);
const FPS = opt("fps", 30);
const NOISE = opt("noise", 5);
const STILL = args.includes("--still");

const TAU = Math.PI * 2;
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
// An ellipsoid's distance (a good bound, Inigo Quilez's).
function ell(x, y, z, a, b, c) {
  const k0 = len3(x / a, y / b, z / c);
  const k1 = len3(x / (a * a), y / (b * b), z / (c * c));
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(a, b, c);
}
const smin = (a, b, k) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
};
const smax = (a, b, k) => -smin(-a, -b, k);
function capsuleY(x, y, z, y0, y1, r) {
  const yy = Math.max(y0, Math.min(y1, y));
  return len3(x, y - yy, z) - r;
}

// The pose at time s (0..1 of the loop): yaw, nod, jaw.
function pose(s) {
  return {
    yaw: 0.2 * Math.sin(TAU * s) + 0.05 * Math.sin(TAU * 3 * s),
    nod: 0.06 * Math.sin(TAU * 2 * s + 0.6),
    jaw: Math.max(0, Math.sin(TAU * 6 * s)) * 0.6 + Math.max(0, Math.sin(TAU * 10 * s + 1)) * 0.4,
    sway: 0.03 * Math.sin(TAU * s + 1.2),
  };
}

// The scene's materials: 0 skin, 1 hair, 2 shirt, 3 mouth (dark), 4 eye, 5 iris.
function scene(px, py, pz, P, wantMat) {
  // The body: shoulders and chest, a shirt.
  const bx = px - P.sway;
  let body = ell(bx, py + 0.47, pz, 0.46, 0.2, 0.2);
  body = smin(body, ell(bx, py + 0.8, pz, 0.36, 0.35, 0.18), 0.08);
  // The neck.
  const neck = capsuleY(bx, py, pz + 0.01, -0.4, -0.16, 0.068);
  // The head, turned (yaw about y, nod about x) about the neck's top.
  const cy = Math.cos(P.yaw);
  const sy = Math.sin(P.yaw);
  let hx = cy * bx - sy * pz;
  let hz = sy * bx + cy * pz;
  let hy = py + 0.2;
  const cn = Math.cos(P.nod);
  const sn = Math.sin(P.nod);
  const hy2 = cn * hy - sn * hz;
  hz = sn * hy + cn * hz;
  hy = hy2 - 0.2;
  // Skull and face.
  let head = ell(hx, hy - 0.02, hz + 0.01, 0.145, 0.19, 0.17);
  const jawDrop = 0.025 * P.jaw;
  head = smin(
    head,
    ell(hx, hy + 0.1 + jawDrop * 0.6, hz + 0.06, 0.1, 0.09 + jawDrop * 0.4, 0.1),
    0.05,
  ); // jaw and chin
  head = smin(head, ell(hx, hy + 0.0, hz + 0.165, 0.024, 0.05, 0.035), 0.025); // nose
  head = smin(head, ell(hx, hy + 0.035, hz + 0.155, 0.028, 0.025, 0.03), 0.02);
  for (const s of [-1, 1]) {
    head = smin(head, ell(hx - s * 0.152, hy - 0.01, hz, 0.02, 0.045, 0.03), 0.02); // ears
    head = smax(head, -ell(hx - s * 0.055, hy - 0.04, hz + 0.15, 0.04, 0.03, 0.025), 0.006); // eye sockets
    head = smin(head, ell(hx - s * 0.065, hy + 0.06, hz + 0.115, 0.05, 0.035, 0.04), 0.03); // cheeks
  }
  // The brow.
  head = smin(head, ell(hx, hy - 0.08, hz + 0.135, 0.11, 0.02, 0.03), 0.03);
  // The mouth: a slot that opens with the jaw.
  const mouth = ell(hx, hy + 0.1 + jawDrop * 0.5, hz + 0.155, 0.038, 0.005 + jawDrop * 0.45, 0.025);
  head = smax(head, -mouth, 0.01);
  // The eyes: small spheres in the sockets.
  let eyes = Infinity;
  for (const s of [-1, 1])
    eyes = Math.min(eyes, len3(hx - s * 0.055, hy - 0.038, hz + 0.122) - 0.022);
  // Hair: a cap over the top and back.
  let hair = ell(hx, hy - 0.05, hz - 0.01, 0.158, 0.19, 0.185);
  hair = smax(hair, -hz - 0.06 - 0.5 * (hy - 0.05), 0.03); // cut away at the forehead
  hair = smax(hair, 0.02 - hy, 0.02); // above the ears
  const skin = smin(head, neck, 0.04);
  let d = Math.min(skin, body, hair, eyes);
  if (!wantMat) return d;
  let m = 0;
  if (d === body) m = 2;
  else if (d === hair) m = 1;
  else if (d === eyes)
    m = hz + 0.122 < -0.017 ? 5 : 4; // the iris, facing out
  else if (mouth < 0.01) m = 3;
  return m;
}

// The room behind: a wall at z = WALL with a framed picture, a door frame
// and a shelf; the floor below the frame.
const WALL = 1.6;
function wallColor(x, y) {
  // A framed picture to the upper left.
  if (x > -0.95 && x < -0.45 && y > -0.05 && y < 0.35) {
    const inner = x > -0.92 && x < -0.48 && y > -0.02 && y < 0.32;
    if (!inner) return [70, 50, 35];
    const t = (y + 0.02) / 0.34;
    return [80 + 120 * t, 140 - 40 * t, 170 - 90 * t];
  }
  // A door edge to the right.
  if (x > 0.62 && x < 0.68) return [215, 210, 200];
  if (x >= 0.68) return [150, 110, 80];
  // A shelf with three books.
  if (y > -0.42 && y < -0.39 && x < -0.2) return [120, 90, 60];
  if (y >= -0.39 && y < -0.24 && x > -0.75 && x < -0.45) {
    const b = Math.floor((x + 0.75) / 0.1);
    return (
      [
        [170, 60, 50],
        [60, 110, 70],
        [200, 170, 80],
      ][b] || [170, 60, 50]
    );
  }
  // Painted plaster, a little darker toward the corners.
  const v = 1 - 0.05 * (x * x + y * y);
  return [205 * v, 196 * v, 178 * v];
}

const MAT = [
  [232, 200, 178], // skin: a smooth pale mannequin
  [62, 42, 30], // hair
  [52, 88, 140], // shirt
  [60, 25, 25], // mouth
  [225, 222, 214], // eyes
  [58, 72, 84], // the iris
];

const fov = 0.62; // tan of half the vertical field
const camZ = -0.95; // the camera, looking down +z
const light = (() => {
  const l = [-0.3, 0.4, -0.85];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();

function render(s, rgb) {
  const P = pose(s);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const sx = ((2 * (i + 0.5)) / W - 1) * fov * (W / H);
      const sy = (1 - (2 * (j + 0.5)) / H) * fov;
      const dn = Math.hypot(sx, sy, 1);
      const dx = sx / dn;
      const dy = sy / dn;
      const dz = 1 / dn;
      let t = 0.4;
      let hit = false;
      // Only rays near the figure march.
      if (Math.abs(sx) < 0.65 && sy < 0.45) {
        for (let k = 0; k < 200 && t < 3; k++) {
          const d = scene(dx * t, dy * t, camZ + dz * t, P, false);
          if (d < 0.0008) {
            hit = true;
            break;
          }
          t += d * 0.6;
        }
      }
      let r;
      let g;
      let b;
      if (hit) {
        const x = dx * t;
        const y = dy * t;
        const z = camZ + dz * t;
        const e = 0.001;
        let nx = scene(x + e, y, z, P) - scene(x - e, y, z, P);
        let ny = scene(x, y + e, z, P) - scene(x, y - e, z, P);
        let nz = scene(x, y, z + e, P) - scene(x, y, z - e, P);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const m = scene(x, y, z, P, true);
        const diff = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
        const rim = Math.pow(1 - Math.max(0, -nz), 3) * 0.15;
        const sh = 0.38 + 0.62 * diff + rim;
        const spec = m === 0 || m >= 4 ? Math.pow(Math.max(0, -(nz * 0.8 - ny * 0.2)), 30) * 40 : 0;
        [r, g, b] = MAT[m].map((c) => c * sh + spec);
      } else {
        const tw = (WALL - camZ) / dz;
        const x = dx * tw;
        const y = dy * tw;
        if (y < -0.85) {
          [r, g, b] = [130, 105, 80];
        } else {
          [r, g, b] = wallColor(x, y);
          // The figure's soft shadow on the wall, down and to the right.
          const d = Math.hypot((x - 0.18 - P.sway) / 0.32, (y + 0.15) / 0.5);
          const shade = 1 - 0.22 * Math.max(0, 1 - d);
          r *= shade;
          g *= shade;
          b *= shade;
        }
      }
      const o = (j * W + i) * 3;
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = b;
    }
}

// A sensor's noise: deterministic per frame.
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(TAU * rnd());

const fd = fs.openSync(out, "w");
fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420jpeg\n`);
const rgb = new Float32Array(W * H * 3);
const Y = Buffer.alloc(W * H);
const U = Buffer.alloc((W / 2) * (H / 2));
const V = Buffer.alloc((W / 2) * (H / 2));
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
for (let f = 0; f < N; f++) {
  if (!STILL || f === 0) render(STILL ? 0.1 : f / N, rgb);
  for (let i = 0; i < W * H; i++) {
    const n = NOISE * gauss();
    const r = rgb[i * 3] + n;
    const g = rgb[i * 3 + 1] + n;
    const b = rgb[i * 3 + 2] + n;
    Y[i] = cl(0.299 * r + 0.587 * g + 0.114 * b);
  }
  for (let j = 0; j < H / 2; j++)
    for (let i = 0; i < W / 2; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [a, c] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const o = ((2 * j + c) * W + 2 * i + a) * 3;
        r += rgb[o];
        g += rgb[o + 1];
        b += rgb[o + 2];
      }
      r /= 4;
      g /= 4;
      b /= 4;
      U[j * (W / 2) + i] = cl(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
      V[j * (W / 2) + i] = cl(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
    }
  fs.writeSync(fd, "FRAME\n");
  fs.writeSync(fd, Y);
  fs.writeSync(fd, U);
  fs.writeSync(fd, V);
  if (f % 20 === 0) process.stderr.write(`frame ${f}/${N}\n`);
}
fs.closeSync(fd);
