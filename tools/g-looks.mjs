#!/usr/bin/env node
// Lane G: paints the default look onto the two photo-made scans, keeping the
// scan's own light and shade. Each splat takes a new colour by region, scaled
// by its own brightness against the region's median, so ribs, facets, dents
// and the photo's shading stay; nothing moves and no splat is added.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &   (the can's label is drawn in Chromium)
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/g-looks.mjs pencil-real tin-can-real
//     [--look=<id>]   another look (see LOOKS) instead of the default
//     [--out=<dir>]   write <id>.sog and <id>-lite.sog there instead of assets/toys/<id>/
//     [--label=<png>] also save the can's label picture
//
// The plain scans are read from git (PLAIN, the commit before the looks), so
// the tool can run again without painting twice. The label is an original
// design drawn here (CC0), not a copy of any product's label.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PLAIN = "722c0d4";
const SH = 0.28209479177387814;
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const ids = args.filter((a) => !a.startsWith("--"));
const work = path.join(root, ".cache/g/looks");
fs.mkdirSync(work, { recursive: true });

// Colours are the look's colour at the region's median brightness.
export const LOOKS = {
  "pencil-real": {
    yellow: { body: [0.98, 0.66, 0.02], ferrule: "silver", eraser: [0.93, 0.5, 0.52], imprint: [0.12, 0.1, 0.06] }, // prettier-ignore
    red: { body: [0.78, 0.12, 0.1], ferrule: "silver", eraser: [0.93, 0.5, 0.52], imprint: [0.95, 0.85, 0.6] }, // prettier-ignore
    blue: { body: [0.12, 0.3, 0.72], ferrule: "silver", eraser: [0.93, 0.5, 0.52], imprint: [0.95, 0.9, 0.75] }, // prettier-ignore
    green: { body: [0.12, 0.45, 0.25], ferrule: "silver", eraser: [0.93, 0.5, 0.52], imprint: [0.95, 0.85, 0.6] }, // prettier-ignore
    wood: null,
  },
  "tin-can-real": {
    peaches: { label: "peaches" },
    tomatoes: { label: "tomatoes" },
    plain: null,
  },
};
const DEFAULT = { "pencil-real": "yellow", "tin-can-real": "peaches" };

function readPly(file) {
  const buf = fs.readFileSync(file);
  const headEnd = buf.indexOf("end_header\n") + 11;
  const props = [];
  let count = 0;
  for (const line of buf.subarray(0, headEnd).toString("latin1").split("\n")) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "element" && t[1] === "vertex") count = Number(t[2]);
    if (t[0] === "property") props.push(t[2]);
  }
  const data = new Float32Array(buf.buffer.slice(buf.byteOffset + headEnd));
  return { count, props, P: props.length, data, header: buf.subarray(0, headEnd), buf };
}
function writePly(file, ply) {
  fs.writeFileSync(file, Buffer.concat([ply.header, Buffer.from(ply.data.buffer)]));
}
const st = (a) =>
  execFileSync(
    path.join(root, "node_modules/.bin/splat-transform"),
    ["-g", "cpu", "-q", "-w", ...a],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const median = (v) => {
  const s = Float64Array.from(v).sort();
  return s[Math.floor(s.length / 2)] || 1;
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Each splat as { i, p: [x, y, z], c: [r, g, b] } (colour 0..1).
function splats(ply) {
  const [ix, ic] = [ply.props.indexOf("x"), ply.props.indexOf("f_dc_0")];
  const out = [];
  for (let i = 0; i < ply.count; i++) {
    const o = i * ply.P;
    out.push({
      i,
      p: [ply.data[o + ix], ply.data[o + ix + 1], ply.data[o + ix + 2]],
      c: [0, 1, 2].map((k) => 0.5 + SH * ply.data[o + ic + k]),
    });
  }
  return out;
}
function setColor(ply, s, c) {
  const o = s.i * ply.P + ply.props.indexOf("f_dc_0");
  for (let k = 0; k < 3; k++) ply.data[o + k] = (clamp(c[k], 0, 1.2) - 0.5) / SH;
}
// Paints each splat of a group with colour(s) times its brightness against
// the group's median (kept within a sensible range, so glare and the unseen
// side's guesswork do not turn to white or black).
function paint(ply, group, color, lo = 0.35, hi = 1.35) {
  if (!group.length) return;
  const ref = median(group.map((s) => lum(s.c)));
  for (const s of group) {
    const k = clamp(lum(s.c) / ref, lo, hi);
    const c = typeof color === "function" ? color(s) : color;
    setColor(
      ply,
      s,
      c.map((v) => v * k),
    );
  }
}

// ---- The pencil ---------------------------------------------------------------------
// Along x: eraser (x < -0.78), ferrule (to about -0.38), the six-sided body,
// the sharpened cone (from about 0.5) and the graphite point (past 0.84).
function pencil(ply, look) {
  const all = splats(ply);
  const chroma = (c) => (Math.max(...c) - Math.min(...c)) / (Math.max(...c) || 1);
  const red = (c) => c[0] > 1.6 * c[1] && c[0] > 1.6 * c[2];
  // The axis and the body's outline (radius by angle round the axis).
  const mid = all.filter((s) => s.p[0] > -0.25 && s.p[0] < 0.4);
  const cy = mid.reduce((a, s) => a + s.p[1], 0) / mid.length;
  const cz = mid.reduce((a, s) => a + s.p[2], 0) / mid.length;
  const polar = (s) => [Math.hypot(s.p[1] - cy, s.p[2] - cz), Math.atan2(s.p[2] - cz, s.p[1] - cy)];
  const BINS = 90;
  const bin = (a) => Math.floor(((a + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
  const rings = Array.from({ length: BINS }, () => []);
  for (const s of mid) {
    const [r, a] = polar(s);
    rings[bin(a)].push(r);
  }
  const outline = rings.map((v) => {
    v.sort((a, b) => a - b);
    return v[Math.floor(v.length * 0.85)] ?? 0.13;
  });
  const eraser = [];
  const ferrule = [];
  const body = [];
  for (const s of all) {
    const x = s.p[0];
    const [r, a] = polar(s);
    if (x < -0.72 && red(s.c)) eraser.push(s);
    else if (x < -0.36 && (chroma(s.c) > 0.4 || x < -0.45)) ferrule.push(s);
    else if (x < -0.36) body.push(s);
    else if (x < 0.84 && r > outline[bin(a)] - 0.006) {
      // On the sharpened cone only the facets' ridges keep their paint, which
      // gives the scalloped edge of a real sharpened pencil.
      body.push(s);
    }
  }
  if (!look) return;
  paint(ply, eraser, look.eraser);
  paint(ply, ferrule, [0.5, 0.51, 0.53], 0.3, 1.3);
  // A small "HB" on the face that looks up (+y), near the ferrule end.
  const up = bin(0);
  const face = (s) => {
    const [, a] = polar(s);
    const d = Math.abs(bin(a) - up);
    return Math.min(d, BINS - d) <= 5;
  };
  const glyph = inked("HB", -0.27, 0.24, 0.085);
  paint(ply, body, (s) => (face(s) && glyph(s.p[0], s.p[2] - cz) ? look.imprint : look.body));
}

// Two block capitals, drawn from 5x7 cells: x from x0, width w, centred on
// z = 0 across the face, height h. Returns (x, z) => inked?
function inked(text, x0, w, h) {
  const FONT = {
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  };
  const cols = text.length * 6 - 1;
  return (x, z) => {
    const u = (x - x0) / w;
    const v = (z + h / 2) / h;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
    const col = Math.floor(u * cols);
    const ch = FONT[text[Math.floor(col / 6)]];
    const cx = col % 6;
    // The face is read from the eraser end: rows run across the pencil.
    return !!ch && cx < 5 && ch[Math.floor(v * 7)][cx] === "1";
  };
}

// ---- The tin can --------------------------------------------------------------------
// The side wall is a cylinder of radius 0.587 round the y axis, between the
// rims at y = -0.78 and 0.82. The label covers it from -0.74 to 0.78; the
// rims, the lid and the base stay metal.
const LABEL = { bottom: -0.74, top: 0.78, radius: [0.55, 0.63] };
// The home camera's yaw: the label's front panel faces it.
const HOME_YAW = 0.35;

async function drawLabel(kind) {
  const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM });
  const page = await browser.newPage();
  const url = await page.evaluate(labelArt, { kind, w: 2048, h: 900 });
  await browser.close();
  return PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
}

// Runs in the page: the label as a PNG data URL. Two front panels, half a
// turn apart (so it reads from either side), each a fruit picture in an oval
// over a banner with the word; bands of colour and a gold rule above and below.
function labelArt({ kind, w, h }) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  const pal =
    kind === "tomatoes"
      ? { ground: "#1f5a3a", band: "#e9dfc4", word: "#b3261e", banner: "#f3ead2", rule: "#c99a2e", sky: "#f5edd8", text: "TOMATOES" } // prettier-ignore
      : { ground: "#1d3f73", band: "#f1e6c8", word: "#c8561c", banner: "#f7eed8", rule: "#c99a2e", sky: "#f6ecd6", text: "PEACHES" }; // prettier-ignore
  g.fillStyle = pal.ground;
  g.fillRect(0, 0, w, h);
  // Cream bands and gold rules at the top and bottom.
  for (const y of [0, h - 90]) {
    g.fillStyle = pal.band;
    g.fillRect(0, y, w, 90);
    g.fillStyle = pal.rule;
    g.fillRect(0, y === 0 ? 90 : h - 104, w, 14);
  }
  // A thin edge, so the paper stands apart from the metal.
  g.fillStyle = pal.rule;
  g.fillRect(0, 0, w, 10);
  g.fillRect(0, h - 10, w, 10);
  const fruit = (x, y, r, rot) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    if (kind === "tomatoes") {
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      gr.addColorStop(0, "#f06a4a");
      gr.addColorStop(0.7, "#cf2c1c");
      gr.addColorStop(1, "#8e1a12");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(0, 0, r, r * 0.86, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#2f7a2e";
      for (let k = 0; k < 5; k++) {
        g.save();
        g.translate(0, -r * 0.8);
        g.rotate((k / 5) * Math.PI * 2);
        g.beginPath();
        g.ellipse(0, -r * 0.16, r * 0.08, r * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    } else {
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.3, r * 0.1, 0, 0, r);
      gr.addColorStop(0, "#ffd27a");
      gr.addColorStop(0.55, "#f39a3c");
      gr.addColorStop(0.85, "#d9532a");
      gr.addColorStop(1, "#a8381f");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      // The crease down one side.
      g.strokeStyle = "rgba(150,50,25,0.7)";
      g.lineWidth = r * 0.07;
      g.beginPath();
      g.moveTo(r * 0.05, -r * 0.95);
      g.quadraticCurveTo(r * 0.35, 0, r * 0.05, r * 0.95);
      g.stroke();
      // A leaf.
      g.fillStyle = "#3f7d2c";
      g.beginPath();
      g.ellipse(r * 0.45, -r * 1.02, r * 0.5, r * 0.2, -0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };
  const panel = (cx) => {
    const top = 104;
    const bot = h - 104;
    // The oval picture.
    g.save();
    g.beginPath();
    g.ellipse(cx, top + 250, 250, 205, 0, 0, Math.PI * 2);
    g.fillStyle = pal.rule;
    g.fill();
    g.beginPath();
    g.ellipse(cx, top + 250, 232, 187, 0, 0, Math.PI * 2);
    g.fillStyle = pal.sky;
    g.fill();
    g.clip();
    fruit(cx - 90, top + 280, 110, -0.2);
    fruit(cx + 95, top + 270, 104, 0.25);
    fruit(cx, top + 330, 95, 0);
    g.restore();
    // The banner with the word.
    const by = bot - 250;
    g.fillStyle = pal.rule;
    g.fillRect(cx - 330, by - 8, 660, 196);
    g.fillStyle = pal.banner;
    g.fillRect(cx - 320, by, 640, 180);
    g.fillStyle = pal.word;
    g.font = "bold 132px 'DejaVu Serif', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(pal.text, cx, by + 96, 600);
    g.fillStyle = pal.band;
    g.font = "bold 44px 'DejaVu Serif', serif";
    g.fillText(kind === "tomatoes" ? "WHOLE · PEELED" : "HALVES IN SYRUP", cx, bot - 32);
  };
  panel(w * 0.25);
  panel(w * 0.75);
  return cv.toDataURL("image/png");
}

function can(ply, look, art) {
  const all = splats(ply);
  const side = all.filter((s) => {
    const r = Math.hypot(s.p[0], s.p[2]);
    return (
      s.p[1] > LABEL.bottom && s.p[1] < LABEL.top && r > LABEL.radius[0] && r < LABEL.radius[1]
    );
  });
  if (!look) return;
  // The front panel (u = 0.25) faces the home camera, which sits towards
  // (sin yaw, 0, cos yaw); u runs left to right seen from outside.
  const front = Math.atan2(Math.cos(HOME_YAW), Math.sin(HOME_YAW));
  const sample = (u, v) => {
    const x = clamp(u * art.width, 0, art.width - 1.001);
    const y = clamp(v * art.height, 0, art.height - 1.001);
    const [x0, y0] = [Math.floor(x), Math.floor(y)];
    const c = [0, 0, 0];
    for (const [dx, dy, wt] of [
      [0, 0, (1 - (x - x0)) * (1 - (y - y0))],
      [1, 0, (x - x0) * (1 - (y - y0))],
      [0, 1, (1 - (x - x0)) * (y - y0)],
      [1, 1, (x - x0) * (y - y0)],
    ]) {
      const o = ((y0 + dy) * art.width + (x0 + dx)) * 4;
      for (let k = 0; k < 3; k++) c[k] += wt * art.data[o + k];
    }
    // sRGB to the scan's colour scale (the scan's whites sit at about 0.8).
    return c.map((v) => (v / 255) * 0.86);
  };
  // Label paper takes the wall's shading softly: the photo's glare and the
  // yellowed patches must not show through as stains.
  const ref = median(side.map((s) => lum(s.c)));
  for (const s of side) {
    const a = Math.atan2(s.p[2], s.p[0]);
    let u = 0.25 + (front - a) / (2 * Math.PI);
    u -= Math.floor(u);
    const v = (LABEL.top - s.p[1]) / (LABEL.top - LABEL.bottom);
    const k = clamp(1 + 0.4 * (lum(s.c) / ref - 1), 0.75, 1.06);
    setColor(
      ply,
      s,
      sample(u, v).map((c) => c * k),
    );
  }
}

for (const id of ids) {
  const lookId = opt("look", DEFAULT[id]);
  if (!(lookId in LOOKS[id])) throw new Error(`${id} has no look "${lookId}"`);
  const look = LOOKS[id][lookId];
  const out = opt("out", path.join(root, "assets/toys", id));
  fs.mkdirSync(out, { recursive: true });
  let art = null;
  if (look?.label) {
    art = await drawLabel(look.label);
    if (opt("label")) fs.writeFileSync(opt("label"), PNG.sync.write(art));
  }
  for (const f of [`${id}.sog`, `${id}-lite.sog`]) {
    const plain = path.join(work, `plain-${f}`);
    fs.writeFileSync(plain, execFileSync("git", ["show", `${PLAIN}:assets/toys/${id}/${f}`], { cwd: root, maxBuffer: 1 << 28 })); // prettier-ignore
    const ply = path.join(work, f.replace(".sog", ".ply"));
    st([plain, ply]);
    const data = readPly(ply);
    if (id === "pencil-real") pencil(data, look);
    else can(data, look, art);
    writePly(ply, data);
    st([ply, path.join(out, f)]);
    console.log(`${id} (${lookId}): ${path.join(out, f)} ${(fs.statSync(path.join(out, f)).size / 1048576).toFixed(2)} MB`); // prettier-ignore
  }
}
