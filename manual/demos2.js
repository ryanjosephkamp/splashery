// The manual's second set of live demos (web version only; the PDF prints a still of each and a
// link). Each demo is a <section class="demo-live" data-demo="..."> in index.html; this file finds
// it by its ids and wires it up. The math is in demo-math3.js (and railroad.js for the grammar), so
// it can be tested without a page. Some demos run the toy's own code: the grammar demo asks the real
// reader, and the windmill and program demos build the real recipes with the kit.

import * as M from "./demo-math3.js";
import { RULES, RULE_ORDER, FIELD_NAMES, renderRule, walk, compact } from "./railroad.js";
import {
  readStatements,
  compileProgram,
  readExpr,
  RECIPES as EQ_RECIPES,
  PRESETS,
  FIELDS,
} from "../src/packs/splat-equation.js";
import { buildRecipe } from "../src/kit.js";
import { RECIPES as WINDMILL } from "./example-recipe.js";

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const num = (id) => Number($(id).value);
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const redraws = [];
const fmt = (v, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);

// Redraw every demo when the color scheme changes (they read the page's colors).
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => redraws.forEach((f) => f())); // prettier-ignore
new MutationObserver(() => redraws.forEach((f) => f())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); // prettier-ignore

// A canvas that turns a view when dragged, and with the arrow keys: { yaw, pitch } in degrees.
function makeOrbit(canvas, view, onMove) {
  let drag = null;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const k = 0.5;
    view.yaw = drag.yaw - (e.clientX - drag.x) * k;
    view.pitch = Math.max(-85, Math.min(85, drag.pitch + (e.clientY - drag.y) * k));
    onMove();
  });
  const end = () => (drag = null);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 15 : 5;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }; // prettier-ignore
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    view.yaw += m[0];
    view.pitch = Math.max(-85, Math.min(85, view.pitch + m[1]));
    onMove();
  });
}

// ---- The grammar as tracks, and a walk along them --------------------------------------------------
function railroadDemo() {
  const host = $("rr-rules");
  if (!host) return;
  host.innerHTML = RULE_ORDER.map(
    (name) =>
      `<section class="rr-rule" id="rr-${name}"><h5>${name}</h5><div class="rr-scroll" tabindex="0" role="region" aria-label="The rule ${name}, drawn as tracks. Scrolls sideways.">${renderRule(name)}</div></section>`, // prettier-ignore
  ).join("");
  const sel = $("rr-start");
  for (const f of FIELD_NAMES) sel.append(new Option(f, f));
  let seed = 20261010;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const base = { x: "u", y: "v", z: "0", u: "0 .. 1" };
  // What the toy's own reader says about a program (a field or two), or null if it accepts it.
  function realVerdict(text) {
    try {
      const set = readStatements(text);
      const fields = { ...base, ...set };
      if (set.hue) delete fields.r;
      compileProgram(fields);
      return null;
    } catch (e) {
      return String(e.message);
    }
  }
  function clear() {
    for (const el of host.querySelectorAll(".on")) el.classList.remove("on");
  }
  function show(w) {
    clear();
    for (const id of w.visited)
      for (const el of host.querySelectorAll(`[data-rr="${id}"]`)) el.classList.add("on");
  }
  function go() {
    clear();
    let w = null;
    let text = "";
    let problem = null;
    // Prefer a walk the reader accepts outright; a few walk into numbers that don't work (a log of
    // 0), and the page says so rather than hide them.
    for (let tries = 0; tries < 40; tries++) {
      w = walk("program", rng, { field: sel.value || null });
      text = compact(w.text);
      problem = realVerdict(text);
      if (!problem) break;
    }
    show(w);
    $("rr-text").textContent = text;
    const v = $("rr-verdict");
    if (!problem) {
      v.textContent = "The toy's own reader accepts it.";
      v.className = "verdict ok";
    } else {
      v.textContent = `The tracks allow it, and the reader reads it, but the numbers do not work: ${problem}`;
      v.className = "verdict bad";
    }
    $("rr-rules").querySelector(".on")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  $("rr-walk").addEventListener("click", go);
  $("rr-clear").addEventListener("click", () => {
    clear();
    $("rr-text").textContent = "";
    $("rr-verdict").textContent = "";
  });
  void RULES;
}

// ---- Drawing helpers --------------------------------------------------------------------------
function canvasPoint(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height }; // prettier-ignore
}
const rgba = (c, a = 1) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`; // prettier-ignore
const heat = () => css("--heat").split(",").map(Number);

// A polyline of 3D points as a path on the screen (null where a point is behind the camera).
function strokeRing(ctx, cam, center, ring) {
  ctx.beginPath();
  let pen = false;
  for (const q of ring) {
    const s = M.project(cam, M.add(center, q));
    if (s.z <= 0.05) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(s.x, s.y);
    else ctx.moveTo(s.x, s.y);
    pen = true;
  }
  ctx.stroke();
}

// ---- A 3D Gaussian, from every side -----------------------------------------------------------------
function gaussianDemo() {
  const cv = $("g3-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const view = { yaw: 35, pitch: 22 };
  const sizes = [0.9, 0.55, 0.3];
  const R = M.quatMatrix(M.quatEulerDeg(25, 40, 10));
  const Sigma = M.covariance(sizes, R);
  const fog = M.fogPoints(1600, sizes, R, 5);
  let fogOn = true;
  let spin = null;
  function draw() {
    const W = cv.width;
    const H = cv.height;
    const cam = M.orbitCamera({ ...view, distance: 7, focal: 380, cx: W / 2, cy: H / 2 });
    cx.clearRect(0, 0, W, H);
    const [hr, hg, hb] = heat();
    if (fogOn) {
      const pts = fog.map((p) => ({ s: M.project(cam, p), p })).sort((a, b) => b.s.z - a.s.z);
      for (const { s, p } of pts) {
        // A point near the center is more likely: the cloud is thickest where G is largest.
        const g = M.gaussianAt(Sigma, p);
        cx.fillStyle = `rgba(${hr}, ${hg}, ${hb}, ${0.18 + 0.4 * g})`;
        cx.beginPath();
        cx.arc(s.x, s.y, 1.9, 0, M.TAU);
        cx.fill();
      }
    }
    cx.lineWidth = 1.6;
    cx.strokeStyle = css("--ink");
    [
      [1, 0.95, []],
      [2, 0.65, [6, 4]],
      [3, 0.4, [2, 4]],
    ].forEach(([k, a, dash]) => {
      cx.globalAlpha = a;
      cx.setLineDash(dash);
      for (const ring of M.shellRings(sizes, R, k)) strokeRing(cx, cam, [0, 0, 0], ring);
    });
    cx.globalAlpha = 1;
    cx.setLineDash([]);
    // The shell the slider picks.
    const w = num("g3-w");
    const kw = M.shellForWeight(w);
    cx.strokeStyle = css("--accent");
    cx.lineWidth = 2.6;
    for (const ring of M.shellRings(sizes, R, kw)) strokeRing(cx, cam, [0, 0, 0], ring);
    // The center.
    const c0 = M.project(cam, [0, 0, 0]);
    cx.fillStyle = css("--ink");
    cx.fillRect(c0.x - 3, c0.y - 1, 6, 2);
    cx.fillRect(c0.x - 1, c0.y - 3, 2, 6);
    $("g3-w-out").value = w.toFixed(2);
    const row = (k) => `${k} size${k === 1 ? " " : "s"} out   G = ${M.weightAtShell(k).toFixed(3)}   reaches ${sizes.map((s) => (k * s).toFixed(2)).join(" · ")}`; // prettier-ignore
    $("g3-readout").textContent =
      `The solid, dashed, and dotted shells:\n${row(1)}\n${row(2)}\n${row(3)}\n\n` +
      `Your shell (the colored one): G = ${w.toFixed(2)}\n= ${kw.toFixed(2)} sizes out; it reaches ${sizes.map((s) => (kw * s).toFixed(2)).join(" · ")}\n` + // prettier-ignore
      `along the three axes of the splat (the sizes are ${sizes.join(", ")}).`;
  }
  makeOrbit(cv, view, draw);
  $("g3-w").addEventListener("input", draw);
  $("g3-fog").addEventListener("click", (e) => {
    fogOn = !fogOn;
    e.currentTarget.setAttribute("aria-pressed", String(fogOn));
    draw();
  });
  $("g3-spin").addEventListener("click", (e) => {
    const on = !spin;
    e.currentTarget.setAttribute("aria-pressed", String(on));
    if (!on) {
      cancelAnimationFrame(spin);
      spin = null;
      return;
    }
    const tick = () => {
      view.yaw += 0.6;
      draw();
      spin = requestAnimationFrame(tick);
    };
    spin = requestAnimationFrame(tick);
  });
  $("g3-reset").addEventListener("click", () => {
    view.yaw = 35;
    view.pitch = 22;
    draw();
  });
  redraws.push(draw);
  draw();
}

// ---- The numbers in one splat ------------------------------------------------------------------------
const NUM_KEYS = ["x", "y", "z", "s1", "s2", "s3", "tx", "ty", "tz", "r", "g", "b", "a"];
function numbersDemo() {
  const cv = $("sn-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const view = { yaw: 20, pitch: 15 };
  const off = document.createElement("canvas");
  off.width = cv.width;
  off.height = cv.height;
  const ox = off.getContext("2d");
  let prev = null;
  const read = () => Object.fromEntries(NUM_KEYS.map((k) => [k, num(`sn-${k}`)]));
  const rows = [
    ["x", "x"], ["y", "y"], ["z", "z"], ["s1", "s₁"], ["s2", "s₂"], ["s3", "s₃"],
    ["qx", "q x"], ["qy", "q y"], ["qz", "q z"], ["qw", "q w"], ["r", "red"], ["g", "green"], ["b", "blue"], ["a", "α"],
  ]; // prettier-ignore
  const body = $("sn-table");
  body.innerHTML = rows.map(([k, label]) => `<div role="listitem" data-k="${k}"><span class="k">${label}</span><span class="v"></span></div>`).join(""); // prettier-ignore
  function draw() {
    const v = read();
    const W = cv.width;
    const H = cv.height;
    const q = M.quatEulerDeg(v.tx, v.ty, v.tz);
    const R = M.quatMatrix(q);
    const sizes = [v.s1, v.s2, v.s3];
    const Sigma = M.covariance(sizes, R);
    const cam = M.orbitCamera({ ...view, distance: 5, focal: 440, cx: W / 2, cy: H / 2 });
    const mu = [v.x, v.y, v.z];
    // The splat on the screen: color, and opacity alpha * G' (its flat bell).
    const cov = M.projectCovariance(cam, mu, Sigma);
    const c = M.project(cam, mu);
    const det = cov.a * cov.c - cov.b * cov.b;
    const img = ox.createImageData(W, H);
    if (det > 1e-9) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const dx = x - c.x;
          const dy = y - c.y;
          const m2 = (cov.c * dx * dx - 2 * cov.b * dx * dy + cov.a * dy * dy) / det;
          const al = v.a * Math.exp(-0.5 * m2);
          if (al < 0.003) continue;
          const i = (y * W + x) * 4;
          img.data[i] = v.r * 255;
          img.data[i + 1] = v.g * 255;
          img.data[i + 2] = v.b * 255;
          img.data[i + 3] = al * 255;
        }
    }
    ox.putImageData(img, 0, 0);
    // A checkerboard behind it, so opacity shows.
    cx.clearRect(0, 0, W, H);
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    for (let y = 0; y < H; y += 20)
      for (let x = 0; x < W; x += 20) {
        cx.fillStyle = (x / 20 + y / 20) % 2 ? (dark ? "#2a2f3a" : "#e9ebf0") : (dark ? "#20242d" : "#f6f7f9"); // prettier-ignore
        cx.fillRect(x, y, 20, 20);
      }
    cx.drawImage(off, 0, 0);
    // The axes through the origin (x red, y green, z blue) and the splat's 1-size shell.
    for (const [axis, col] of [
      [[1, 0, 0], "#d6334a"],
      [[0, 1, 0], "#1b9a5a"],
      [[0, 0, 1], "#2f6fdb"],
    ]) {
      const a = M.project(cam, [0, 0, 0]);
      const b = M.project(cam, M.scale(axis, 0.9));
      cx.strokeStyle = col;
      cx.lineWidth = 1.4;
      cx.beginPath();
      cx.moveTo(a.x, a.y);
      cx.lineTo(b.x, b.y);
      cx.stroke();
    }
    cx.strokeStyle = css("--ink");
    cx.globalAlpha = 0.55;
    cx.lineWidth = 1.2;
    for (const ring of M.shellRings(sizes, R, 1, 40)) strokeRing(cx, cam, mu, ring);
    cx.globalAlpha = 1;
    // The numbers, in a table; the ones that changed since the last move are marked.
    const qn = q.map((x) => x / (Math.hypot(...q) || 1));
    const now = { x: v.x, y: v.y, z: v.z, s1: v.s1, s2: v.s2, s3: v.s3, qx: qn[0], qy: qn[1], qz: qn[2], qw: qn[3], r: v.r, g: v.g, b: v.b, a: v.a }; // prettier-ignore
    for (const item of body.children) {
      const k = item.dataset.k;
      item.querySelector(".v").textContent = now[k].toFixed(3);
      item.classList.toggle("changed", !!prev && Math.abs(now[k] - prev[k]) > 1e-9);
    }
    prev = now;
    for (const k of NUM_KEYS) {
      const out = $(`sn-${k}-out`);
      if (out) out.value = k.startsWith("t") ? `${num(`sn-${k}`)}°` : num(`sn-${k}`).toFixed(2);
    }
    $("sn-swatch").style.background = `rgb(${v.r * 255}, ${v.g * 255}, ${v.b * 255})`;
    $("sn-swatch").style.opacity = String(Math.max(0.15, v.a));
  }
  for (const k of NUM_KEYS) $(`sn-${k}`).addEventListener("input", draw);
  makeOrbit(cv, view, draw);
  $("sn-reset").addEventListener("click", () => {
    for (const k of NUM_KEYS) $(`sn-${k}`).value = $(`sn-${k}`).defaultValue;
    prev = null;
    draw();
  });
  redraws.push(draw);
  draw();
}

// ---- The bell, from one dimension to three ---------------------------------------------------------
function bellDemo() {
  const cv = $("bl-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  let dims = 1;
  const RANGE = 3;
  const sig = () => [num("bl-s1"), num("bl-s2"), num("bl-s3")];
  const probe = () => [num("bl-x"), num("bl-y"), num("bl-z")];
  const colorAt = (g) => {
    const [r, gg, b] = heat();
    return `rgba(${r}, ${gg}, ${b}, ${Math.min(1, g)})`;
  };
  function draw() {
    const W = cv.width;
    const H = cv.height;
    const s = sig();
    const p = probe();
    cx.clearRect(0, 0, W, H);
    cx.lineWidth = 1;
    const out = M.bell(dims, p, s);
    if (dims === 1) {
      const x0 = 30;
      const x1 = W - 30;
      const yb = H - 50;
      const yt = 40;
      const X = (x) => x0 + ((x + RANGE) / (2 * RANGE)) * (x1 - x0);
      const Y = (g) => yb - g * (yb - yt);
      cx.strokeStyle = css("--line");
      cx.beginPath();
      cx.moveTo(x0, yb);
      cx.lineTo(x1, yb);
      cx.stroke();
      // Dashes at 1 and 2 sizes.
      cx.fillStyle = css("--muted");
      cx.font = "12px sans-serif";
      cx.textAlign = "center";
      for (const k of [-2, -1, 0, 1, 2]) {
        cx.fillText(k === 0 ? "μ" : `${k > 0 ? "+" : "−"}${Math.abs(k)}σ`, X(k * s[0]), yb + 18);
        cx.beginPath();
        cx.moveTo(X(k * s[0]), yb);
        cx.lineTo(X(k * s[0]), yb + 4);
        cx.stroke();
      }
      cx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const x = -RANGE + (2 * RANGE * i) / 160;
        const g = M.bell(1, [x], s).g;
        if (i) cx.lineTo(X(x), Y(g));
        else cx.moveTo(X(x), Y(g));
      }
      cx.lineTo(X(RANGE), yb);
      cx.lineTo(X(-RANGE), yb);
      cx.closePath();
      cx.fillStyle = colorAt(0.18);
      cx.fill();
      cx.strokeStyle = css("--accent");
      cx.lineWidth = 2.5;
      cx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const x = -RANGE + (2 * RANGE * i) / 160;
        const g = M.bell(1, [x], s).g;
        if (i) cx.lineTo(X(x), Y(g));
        else cx.moveTo(X(x), Y(g));
      }
      cx.stroke();
      // The probe.
      cx.strokeStyle = css("--ink");
      cx.setLineDash([4, 4]);
      cx.lineWidth = 1.2;
      cx.beginPath();
      cx.moveTo(X(p[0]), yb);
      cx.lineTo(X(p[0]), Y(out.g));
      cx.lineTo(x0, Y(out.g));
      cx.stroke();
      cx.setLineDash([]);
      cx.fillStyle = css("--ink");
      cx.beginPath();
      cx.arc(X(p[0]), Y(out.g), 5, 0, M.TAU);
      cx.fill();
      cx.textAlign = "left";
      cx.fillText("G", 6, yt - 8);
      cx.fillText("1 at the center", x0 + 6, yt - 8);
    } else {
      // A heat map of G on the plane (the first two axes; for 3D, the slice at the probe's z).
      const side = Math.min(W, H) - 20;
      const x0 = (W - side) / 2;
      const y0 = (H - side) / 2;
      const zf = dims === 3 ? Math.exp(-0.5 * (p[2] / s[2]) ** 2) : 1;
      const img = cx.createImageData(side, side);
      const [hr, hg, hb] = heat();
      for (let j = 0; j < side; j++)
        for (let i = 0; i < side; i++) {
          const x = ((i + 0.5) / side) * 2 * RANGE - RANGE;
          const y = RANGE - ((j + 0.5) / side) * 2 * RANGE;
          const g = Math.exp(-0.5 * ((x / s[0]) ** 2 + (y / s[1]) ** 2)) * zf;
          const k = (j * side + i) * 4;
          img.data[k] = hr;
          img.data[k + 1] = hg;
          img.data[k + 2] = hb;
          img.data[k + 3] = Math.min(255, g * 255);
        }
      cx.putImageData(img, x0, y0);
      cx.strokeStyle = css("--line");
      cx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1);
      const X = (x) => x0 + ((x + RANGE) / (2 * RANGE)) * side;
      const Y = (y) => y0 + ((RANGE - y) / (2 * RANGE)) * side;
      cx.beginPath();
      cx.moveTo(x0, Y(0));
      cx.lineTo(x0 + side, Y(0));
      cx.moveTo(X(0), y0);
      cx.lineTo(X(0), y0 + side);
      cx.stroke();
      // Rings where G is 0.61 (one size), 0.14 (two) and 0.01 (three), cut by this plane.
      cx.strokeStyle = css("--ink");
      cx.lineWidth = 1.4;
      [
        [1, []],
        [2, [6, 4]],
        [3, [2, 4]],
      ].forEach(([k, dash]) => {
        const kk2 = k * k - (dims === 3 ? (p[2] / s[2]) ** 2 : 0);
        if (kk2 <= 0) return;
        const kk = Math.sqrt(kk2);
        cx.setLineDash(dash);
        cx.beginPath();
        cx.ellipse(X(0), Y(0), (kk * s[0] * side) / (2 * RANGE), (kk * s[1] * side) / (2 * RANGE), 0, 0, M.TAU); // prettier-ignore
        cx.stroke();
      });
      cx.setLineDash([]);
      // The probe, and the ring through it.
      const kp2 = out.q - (dims === 3 ? (p[2] / s[2]) ** 2 : 0);
      cx.strokeStyle = css("--accent");
      cx.lineWidth = 2.4;
      if (kp2 > 0) {
        cx.beginPath();
        cx.ellipse(X(0), Y(0), (Math.sqrt(kp2) * s[0] * side) / (2 * RANGE), (Math.sqrt(kp2) * s[1] * side) / (2 * RANGE), 0, 0, M.TAU); // prettier-ignore
        cx.stroke();
      }
      cx.fillStyle = css("--ink");
      cx.beginPath();
      cx.arc(X(p[0]), Y(p[1]), 5, 0, M.TAU);
      cx.fill();
      cx.fillStyle = css("--muted");
      cx.font = "12px sans-serif";
      cx.textAlign = "left";
      cx.fillText(
        dims === 3 ? `the slice z = ${p[2].toFixed(2)}` : "x across, y up",
        x0 + 6,
        y0 + 16,
      );
    }
    // The numbers and the formula with them filled in.
    for (const k of ["s1", "s2", "s3", "x", "y", "z"])
      $(`bl-${k}-out`).value = num(`bl-${k}`).toFixed(2);
    const f2 = (v) => v.toFixed(2);
    let line;
    if (dims === 1)
      line = `G(x) = exp(−x² / 2σ²)\n     = exp(−${f2(p[0])}² / (2 × ${f2(s[0])}²))\n     = exp(−${f2(out.q / 2)})`; // prettier-ignore
    else
      line =
        `G(p) = exp(−½ (${["x²/σ₁²", "y²/σ₂²", "z²/σ₃²"].slice(0, dims).join(" + ")}))\n` +
        `     = exp(−½ (${[0, 1, 2]
          .slice(0, dims)
          .map((i) => `${f2(p[i])}²/${f2(s[i])}²`)
          .join(" + ")}))\n` + // prettier-ignore
        `     = exp(−½ × ${f2(out.q)})`;
    $("bl-readout").textContent = `${line}\n     = ${out.g.toFixed(3)}\n\nThat point is ${out.k.toFixed(2)} sizes from the center.`; // prettier-ignore
    for (const id of ["bl-y", "bl-s2"]) $(id).closest("label").hidden = dims < 2;
    for (const id of ["bl-z", "bl-s3"]) $(id).closest("label").hidden = dims < 3;
  }
  for (const id of ["bl-s1", "bl-s2", "bl-s3", "bl-x", "bl-y", "bl-z"]) $(id).addEventListener("input", draw); // prettier-ignore
  for (const d of [1, 2, 3])
    $(`bl-d${d}`).addEventListener("click", () => {
      dims = d;
      for (const e of [1, 2, 3]) $(`bl-d${e}`).setAttribute("aria-pressed", String(e === d));
      draw();
    });
  // Drag on the picture to move the probe.
  let dragging = false;
  const move = (e) => {
    const { x, y } = canvasPoint(cv, e);
    if (dims === 1) {
      const x0 = 30;
      const x1 = cv.width - 30;
      $("bl-x").value = Math.max(-RANGE, Math.min(RANGE, ((x - x0) / (x1 - x0)) * 2 * RANGE - RANGE)).toFixed(2); // prettier-ignore
    } else {
      const side = Math.min(cv.width, cv.height) - 20;
      const x0 = (cv.width - side) / 2;
      const y0 = (cv.height - side) / 2;
      $("bl-x").value = Math.max(-RANGE, Math.min(RANGE, ((x - x0) / side) * 2 * RANGE - RANGE)).toFixed(2); // prettier-ignore
      $("bl-y").value = Math.max(-RANGE, Math.min(RANGE, RANGE - ((y - y0) / side) * 2 * RANGE)).toFixed(2); // prettier-ignore
    }
    draw();
  };
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", (e) => {
    dragging = true;
    cv.setPointerCapture(e.pointerId);
    move(e);
  });
  cv.addEventListener("pointermove", (e) => dragging && move(e));
  cv.addEventListener("pointerup", () => (dragging = false));
  cv.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: ["bl-x", -0.1], ArrowRight: ["bl-x", 0.1], ArrowUp: ["bl-y", 0.1], ArrowDown: ["bl-y", -0.1] }[e.key]; // prettier-ignore
    if (!d) return;
    e.preventDefault();
    $(d[0]).value = Math.max(-RANGE, Math.min(RANGE, num(d[0]) + d[1])).toFixed(2);
    draw();
  });
  redraws.push(draw);
  draw();
}

// ---- From 3D to the screen -------------------------------------------------------------------------------
function projectionDemo() {
  const cv = $("pj-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const top = $("pj-top");
  const tx = top.getContext("2d");
  const base = [0.9, 0.5, 0.3];
  function draw() {
    const W = cv.width;
    const H = cv.height;
    const size = num("pj-size");
    const sizes = base.map((s) => s * size);
    const R = M.quatMatrix(M.quatEulerDeg(num("pj-tx"), num("pj-ty"), 0));
    const Sigma = M.covariance(sizes, R);
    const D = num("pj-d");
    // The zoom grows with the distance, so the picture stays about the same size and what changes is
    // only how much the perspective bends the splat.
    const cam = M.orbitCamera({ yaw: num("pj-yaw"), pitch: num("pj-pitch"), distance: D, focal: 95 * D, cx: W / 2, cy: H / 2 }); // prettier-ignore
    const c = M.project(cam, [0, 0, 0]);
    const cov = M.projectCovariance(cam, [0, 0, 0], Sigma);
    const ell = M.ellipseOf(cov, 1);
    const outline = M.trueOutline(cam, [0, 0, 0], sizes, R, 1);
    const gap = M.outlineGap(outline, c, cov, 1);
    cx.clearRect(0, 0, W, H);
    cx.strokeStyle = css("--line");
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(0, H / 2);
    cx.lineTo(W, H / 2);
    cx.moveTo(W / 2, 0);
    cx.lineTo(W / 2, H);
    cx.stroke();
    // The true outline of the shell one size out (solid), and the ellipse the renderer draws (dashed).
    cx.beginPath();
    outline.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
    cx.closePath();
    cx.fillStyle = `rgba(${heat()}, 0.14)`;
    cx.fill();
    cx.strokeStyle = css("--ink");
    cx.lineWidth = 2.4;
    cx.stroke();
    cx.strokeStyle = css("--accent");
    cx.lineWidth = 2.4;
    cx.setLineDash([7, 5]);
    cx.beginPath();
    cx.ellipse(c.x, c.y, ell.rx, ell.ry, ell.angle, 0, M.TAU);
    cx.stroke();
    cx.setLineDash([]);
    cx.fillStyle = css("--ink");
    cx.fillRect(c.x - 4, c.y - 1, 8, 2);
    cx.fillRect(c.x - 1, c.y - 4, 2, 8);
    cx.font = "12px sans-serif";
    cx.fillStyle = css("--muted");
    cx.textAlign = "left";
    cx.fillText("solid: the true outline of the shell one size out", 8, 18);
    cx.fillText("dashed: the ellipse from Σ′ (the renderer's)", 8, 35);
    // The top view: the camera, its view line to the splat, and the splat seen from above.
    const tw = top.width;
    const th = top.height;
    tx.clearRect(0, 0, tw, th);
    const k = 14;
    const ox = tw / 2;
    const oy = 46;
    const T = (p) => [ox + p[0] * k, oy + p[2] * k];
    tx.strokeStyle = css("--line");
    tx.beginPath();
    tx.moveTo(0, oy);
    tx.lineTo(tw, oy);
    tx.moveTo(ox, 0);
    tx.lineTo(ox, th);
    tx.stroke();
    const topCov = { a: Sigma[0], b: Sigma[2], c: Sigma[8] };
    const te = M.ellipseOf(topCov, 1);
    tx.strokeStyle = css("--ink");
    tx.lineWidth = 2;
    tx.beginPath();
    tx.ellipse(ox, oy, te.rx * k, te.ry * k, te.angle, 0, M.TAU);
    tx.stroke();
    const e = T(cam.eye);
    tx.strokeStyle = css("--accent");
    tx.setLineDash([5, 4]);
    tx.beginPath();
    tx.moveTo(e[0], e[1]);
    tx.lineTo(ox, oy);
    tx.stroke();
    tx.setLineDash([]);
    tx.fillStyle = css("--accent");
    tx.beginPath();
    tx.arc(e[0], e[1], 6, 0, M.TAU);
    tx.fill();
    tx.fillStyle = css("--muted");
    tx.font = "12px sans-serif";
    tx.fillText("seen from above: the camera (dot) looks at the splat's center", 8, th - 8);
    // The numbers.
    const J = M.jacobian(cam, M.toView(cam, [0, 0, 0]));
    const f3 = (v) => (v < 0 ? "" : " ") + v.toFixed(2);
    $("pj-readout").textContent =
      `J (2 × 3), at the center:\n  [${f3(J[0])} ${f3(J[1])} ${f3(J[2])} ]\n  [${f3(J[3])} ${f3(J[4])} ${f3(J[5])} ]\n\n` + // prettier-ignore
      `Σ′ (pixels²): [ ${cov.a.toFixed(1)}  ${cov.b.toFixed(1)} ; ${cov.b.toFixed(1)}  ${cov.c.toFixed(1)} ]\n` +
      `the ellipse reaches ${ell.rx.toFixed(1)} and ${ell.ry.toFixed(1)} pixels (one size out)\n\n` +
      `The outline and the ellipse differ by at most ${gap.toFixed(1)} pixels,\n${((100 * gap) / ell.rx).toFixed(1)}% of the ellipse's long axis. Bring the camera in to see it grow.`; // prettier-ignore
    for (const id of ["pj-d", "pj-yaw", "pj-pitch", "pj-tx", "pj-ty", "pj-size"]) {
      const o = $(`${id}-out`);
      o.value = id === "pj-d" || id === "pj-size" ? num(id).toFixed(1) : `${num(id)}°`;
    }
  }
  for (const id of ["pj-d", "pj-yaw", "pj-pitch", "pj-tx", "pj-ty", "pj-size"]) $(id).addEventListener("input", draw); // prettier-ignore
  redraws.push(draw);
  draw();
}
// ---- Sorting and blending ------------------------------------------------------------------------------
const BLEND_SPLATS = [
  { name: "red", c: [0.92, 0.18, 0.2], alpha: 0.8, x: 150, y: 120, sigma: 56, depth: 1 },
  { name: "green", c: [0.12, 0.62, 0.35], alpha: 0.8, x: 205, y: 100, sigma: 54, depth: 2 },
  { name: "blue", c: [0.16, 0.38, 0.9], alpha: 0.8, x: 190, y: 160, sigma: 58, depth: 3 },
  { name: "gold", c: [0.96, 0.78, 0.15], alpha: 0.8, x: 245, y: 150, sigma: 50, depth: 4 },
];
const PERMS = [
  [3, 2, 1, 0],
  [0, 1, 2, 3],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
  [1, 0, 3, 2],
  [3, 0, 2, 1],
];
function blendDemo() {
  const cv = $("bd-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const splats = BLEND_SPLATS.map((s) => ({ ...s }));
  // Draw order, first drawn first. The right one is far to near, so the biggest depth comes first.
  const rightOrder = () => [0, 1, 2, 3].sort((a, b) => splats[b].depth - splats[a].depth);
  let order = rightOrder();
  let shuffle = 0;
  let probe = { x: 205, y: 135 };
  let steps = 4;
  const strength = (s, x, y) => s.alpha * Math.exp((-0.5 * ((x - s.x) ** 2 + (y - s.y) ** 2)) / s.sigma ** 2); // prettier-ignore
  const layersAt = (idx, x, y) =>
    idx.map((i) => ({ c: splats[i].c, a: strength(splats[i], x, y) }));
  const img = cx.createImageData(cv.width, cv.height);
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(", ")})`;
  function draw() {
    const W = cv.width;
    const H = cv.height;
    splats.forEach((s, i) => (s.alpha = num(`bd-a${i}`)));
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const bg = dark ? [0, 0, 0] : [0, 0, 0];
    const shown = order.slice(0, steps);
    // Every pixel: the splats laid over each other in the chosen order, over black.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let r = bg[0];
        let g = bg[1];
        let b = bg[2];
        for (const i of shown) {
          const s = splats[i];
          const a = strength(s, x, y);
          r = a * s.c[0] + (1 - a) * r;
          g = a * s.c[1] + (1 - a) * g;
          b = a * s.c[2] + (1 - a) * b;
        }
        const k = (y * W + x) * 4;
        img.data[k] = r * 255;
        img.data[k + 1] = g * 255;
        img.data[k + 2] = b * 255;
        img.data[k + 3] = 255;
      }
    cx.putImageData(img, 0, 0);
    // The pixel being read.
    cx.strokeStyle = "#fff";
    cx.lineWidth = 2;
    cx.beginPath();
    cx.arc(probe.x, probe.y, 8, 0, M.TAU);
    cx.stroke();
    cx.strokeStyle = "#000";
    cx.lineWidth = 1;
    cx.beginPath();
    cx.arc(probe.x, probe.y, 9.5, 0, M.TAU);
    cx.stroke();
    // The table: the order, each splat's strength at the pixel, and the color and transmittance so far.
    const layers = layersAt(order, probe.x, probe.y);
    const run = M.overSteps(layers);
    const right = rightOrder();
    const best = M.overSteps(layersAt(right, probe.x, probe.y)).at(-1);
    const body = $("bd-table");
    body.innerHTML = order
      .map((i, n) => {
        const s = splats[i];
        const st = run[n];
        const active = n < steps;
        return `<tr class="${active ? "" : "later"}"><th scope="row">${n + 1}. <span class="sw" style="background:${rgb(s.c)}"></span> ${s.name}</th><td>${s.depth}</td><td>${layers[n].a.toFixed(3)}</td><td><span class="sw" style="background:${rgb(st.color)}"></span> ${st.color.map((v) => Math.round(v * 255)).join(", ")}</td><td>${st.transmittance.toFixed(3)}</td></tr>`; // prettier-ignore
      })
      .join("");
    const last = run[Math.min(steps, run.length) - 1] || { color: bg, transmittance: 1 };
    const done = steps === 4;
    const same = done && order.every((v, n) => v === right[n]);
    const diff = Math.max(...last.color.map((v, k) => Math.abs(v - best.color[k]))) * 255;
    $("bd-result").innerHTML =
      `After ${steps} of 4: the pixel is <span class="sw big" style="background:${rgb(last.color)}"></span> rgb(${last.color.map((v) => Math.round(v * 255)).join(", ")}), and ${(last.transmittance * 100).toFixed(1)}% of the black behind still shows through.` + // prettier-ignore
      (done
        ? same
          ? " That is the right order, far to near."
          : ` That is not far to near. The right order gives <span class="sw big" style="background:${rgb(best.color)}"></span> rgb(${best.color.map((v) => Math.round(v * 255)).join(", ")}), ${diff.toFixed(0)} off in its largest channel. The transmittance is the same either way: ${best.transmittance.toFixed(3)}.` // prettier-ignore
        : "");
    $("bd-steps-out").value = String(steps);
    splats.forEach((s, i) => ($(`bd-a${i}-out`).value = s.alpha.toFixed(2)));
    $("bd-order").innerHTML = order
      .map(
        (i, n) =>
          `<li><span class="sw" style="background:${rgb(splats[i].c)}"></span> ${splats[i].name} <button type="button" data-n="${n}" aria-label="Draw ${splats[i].name} one place later" ${n === order.length - 1 ? "disabled" : ""}>later</button></li>`, // prettier-ignore
      )
      .join("");
  }
  $("bd-order").addEventListener("click", (e) => {
    const n = e.target?.dataset?.n;
    if (n === undefined) return;
    const i = Number(n);
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
    draw();
  });
  $("bd-sorted").addEventListener("click", () => {
    order = rightOrder();
    draw();
  });
  $("bd-reverse").addEventListener("click", () => {
    order = rightOrder().reverse();
    draw();
  });
  $("bd-shuffle").addEventListener("click", () => {
    order = PERMS[shuffle++ % PERMS.length].slice();
    draw();
  });
  $("bd-steps").addEventListener("input", () => {
    steps = num("bd-steps");
    draw();
  });
  for (let i = 0; i < 4; i++) $(`bd-a${i}`).addEventListener("input", draw);
  let dragging = false;
  const move = (e) => {
    const p = canvasPoint(cv, e);
    probe = {
      x: Math.max(0, Math.min(cv.width - 1, p.x)),
      y: Math.max(0, Math.min(cv.height - 1, p.y)),
    };
    draw();
  };
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", (e) => {
    dragging = true;
    cv.setPointerCapture(e.pointerId);
    move(e);
  });
  cv.addEventListener("pointermove", (e) => dragging && move(e));
  cv.addEventListener("pointerup", () => (dragging = false));
  cv.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, -6], ArrowDown: [0, 6] }[
      e.key
    ];
    if (!d) return;
    e.preventDefault();
    probe = { x: Math.max(0, Math.min(cv.width - 1, probe.x + d[0])), y: Math.max(0, Math.min(cv.height - 1, probe.y + d[1])) }; // prettier-ignore
    draw();
  });
  redraws.push(draw);
  draw();
}

// ---- Drawing the toy's real splats on a canvas (windmill and program demos) ----------------------------
// `buf` is the kit's splat buffer (the toy as it is built), `idx` the splats to draw, and `look(i)`
// says how: { alpha, tint } or null to skip. The splats are sorted far to near and drawn as the
// ellipses the camera sees them as (the same Sigma' as the projection demo, written without objects
// so thousands of splats redraw quickly).
function drawKit(cx, W, H, buf, idx, cam, look, place) {
  const f = cam.focal;
  const Wm = cam.W;
  const items = [];
  for (const i of idx) {
    const l = look(i);
    if (!l) continue;
    let p = [buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]];
    let q = [buf.rot[i * 4], buf.rot[i * 4 + 1], buf.rot[i * 4 + 2], buf.rot[i * 4 + 3]];
    if (place) [p, q] = place(i, p, q);
    const v = M.toView(cam, p);
    if (v[2] < 0.1) continue;
    items.push({ i, p, q, v, l });
  }
  items.sort((a, b) => b.v[2] - a.v[2]);
  for (const { i, q, v, l } of items) {
    // Rows of P = J W: the screen's x and y as combinations of the world axes.
    const J = [f / v[2], 0, (-f * v[0]) / (v[2] * v[2]), 0, -f / v[2], (f * v[1]) / (v[2] * v[2])];
    const Rm = M.quatMatrix(q);
    const P = [0, 1].map((r) => [0, 1, 2].map((c) => J[r * 3] * Wm[c] + J[r * 3 + 1] * Wm[3 + c] + J[r * 3 + 2] * Wm[6 + c])); // prettier-ignore
    // M = P R S: column k of P R scaled by the splat's size along its axis k.
    let a = 0;
    let b = 0;
    let c = 0;
    for (let k = 0; k < 3; k++) {
      const s = buf.scale[i * 3 + k];
      const m0 = (P[0][0] * Rm[k] + P[0][1] * Rm[3 + k] + P[0][2] * Rm[6 + k]) * s;
      const m1 = (P[1][0] * Rm[k] + P[1][1] * Rm[3 + k] + P[1][2] * Rm[6 + k]) * s;
      a += m0 * m0;
      b += m0 * m1;
      c += m1 * m1;
    }
    const e = M.ellipseOf({ a, b, c }, 1.7);
    const sx = cam.cx + (f * v[0]) / v[2];
    const sy = cam.cy - (f * v[1]) / v[2];
    cx.fillStyle = rgba(
      l.tint || [buf.color[i * 4], buf.color[i * 4 + 1], buf.color[i * 4 + 2]],
      l.alpha,
    );
    cx.beginPath();
    cx.ellipse(sx, sy, Math.max(0.7, e.rx), Math.max(0.7, e.ry), e.angle, 0, M.TAU);
    cx.fill();
  }
}

// ---- Where each part of a recipe shows on the windmill ---------------------------------------------------------
function windmillDemo() {
  const cv = $("wm-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const view = { yaw: 22, pitch: 12 };
  // The real windmill recipe, built by the real kit.
  const run = buildRecipe(WINDMILL["little-windmill"], { seed: 7, count: 12000, options: { sails: "#f2eee4" } }, () => {}); // prettier-ignore
  let r = run.next();
  while (!r.done) r = run.next();
  const ctxK = r.value;
  const buf = ctxK.buf;
  const items = ctxK.kit.items;
  const partOf = (i) => (buf.anim ? (buf.anim[i * 4] | 0) & 15 : 0);
  const sailsPart = ctxK.parts.findIndex((p) => p.name === "sails");
  const pivot = ctxK.parts[sailsPart].pivot;
  const axis = ctxK.parts[sailsPart].axis;
  const all = Array.from({ length: buf.count }, (_, i) => i);
  let lit = null; // a set of item indexes, or "sails" for everything in the part
  let angle = 0;
  const range = (set) => {
    const out = new Set();
    for (const n of set) for (let i = items[n].start; i < items[n].end; i++) out.add(i);
    return out;
  };
  const groups = {
    tower: new Set([0]),
    cap: new Set([1]),
    hub: new Set([2]),
    blades: new Set([3, 4, 5, 6]),
  };
  function draw() {
    const W = cv.width;
    const H = cv.height;
    const cam = M.orbitCamera({ ...view, distance: 3.3, focal: 380, cx: W / 2, cy: H / 2 + 20 });
    cx.clearRect(0, 0, W, H);
    const litSet = lit === "sails" ? new Set(all.filter((i) => partOf(i) === sailsPart)) : lit ? range(lit) : null; // prettier-ignore
    const turn = M.turnAbout(pivot, axis, (angle * Math.PI) / 180);
    drawKit(cx, W, H, buf, all, cam, (i) => (litSet ? (litSet.has(i) ? { alpha: 0.95 } : { alpha: 0.1, tint: [0.55, 0.57, 0.62] }) : { alpha: 0.9 }), (i, p, q) => (partOf(i) === sailsPart ? turn(p, q) : [p, q])); // prettier-ignore
    if (lit === "sails") {
      // The part's pivot and its axis (the line the sails turn about).
      const a = M.project(cam, M.sub(pivot, M.scale(axis, 0.5)));
      const b = M.project(cam, M.add(pivot, M.scale(axis, 0.5)));
      cx.strokeStyle = css("--accent");
      cx.lineWidth = 2.5;
      cx.setLineDash([6, 4]);
      cx.beginPath();
      cx.moveTo(a.x, a.y);
      cx.lineTo(b.x, b.y);
      cx.stroke();
      cx.setLineDash([]);
      const c = M.project(cam, pivot);
      cx.fillStyle = css("--accent");
      cx.beginPath();
      cx.arc(c.x, c.y, 6, 0, M.TAU);
      cx.fill();
    }
    $("wm-angle-out").value = `${angle}°`;
    const n = litSet ? litSet.size : buf.count;
    const what = {
      tower: "the tower (a cone)",
      cap: "the cap (a cone)",
      hub: "the hub (a sphere)",
      blades: "the four sails (four boxes)",
    };
    const name = lit === "sails" ? "everything in the sails part: the hub and the four sails" : lit ? Object.entries(groups).filter(([, v]) => v === lit).map(([k]) => what[k])[0] : "the whole toy"; // prettier-ignore
    $("wm-readout").textContent =
      `${name}: ${n.toLocaleString("en-US")} of ${buf.count.toLocaleString("en-US")} splats (${((100 * n) / buf.count).toFixed(0)}%).\n` + // prettier-ignore
      (lit === "sails"
        ? `The part turns as one solid piece about the dashed line (axis [${axis.map((v) => v.toFixed(0)).join(", ")}] through the pivot). Move the slider.` // prettier-ignore
        : lit
          ? "These splats stay where they are when the sails turn."
          : "The recipe builds this many splats; each line below made some of them.");
    // Mark the lit line.
    for (const b of document.querySelectorAll("#demo-windmill .code-line")) {
      b.setAttribute("aria-pressed", String(b.dataset.lit === pinned));
      b.classList.toggle("hot", b.dataset.lit === lit_key);
    }
  }
  // A line lights its splats while you point at it or focus it, and stays lit once you tap or click it
  // (tap it again to put it out).
  let lit_key = "";
  let pinned = "";
  let hover = "";
  const setLit = () => {
    lit_key = hover || pinned;
    lit = lit_key === "" ? null : lit_key === "sails" ? "sails" : groups[lit_key];
    draw();
  };
  const canHover = () => matchMedia("(hover: hover)").matches;
  for (const b of document.querySelectorAll("#demo-windmill .code-line")) {
    b.addEventListener("click", () => {
      pinned = pinned === b.dataset.lit ? "" : b.dataset.lit;
      setLit();
    });
    b.addEventListener("pointerenter", () => {
      if (!canHover()) return;
      hover = b.dataset.lit;
      setLit();
    });
    b.addEventListener("pointerleave", () => {
      if (!canHover()) return;
      hover = "";
      setLit();
    });
    b.addEventListener("focus", () => {
      hover = b.dataset.lit;
      setLit();
    });
    b.addEventListener("blur", () => {
      hover = "";
      setLit();
    });
  }
  $("wm-angle").addEventListener("input", () => {
    angle = num("wm-angle");
    draw();
  });
  makeOrbit(cv, view, draw);
  redraws.push(draw);
  draw();
}

// ---- The (u, v) grid, turning into the torus, dot by dot ---------------------------------------------------
const TORUS_PROGRAM = { x: "(2 + cos v)·cos u", y: "sin v", z: "(2 + cos v)·sin u", u: "0 .. 2pi", v: "0 .. 2pi" }; // prettier-ignore
function torusDemo() {
  const cv = $("ut-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const view = { yaw: 25, pitch: 18 };
  const prog = compileProgram(TORUS_PROGRAM);
  const NU = 36;
  const NV = 18;
  const SC = 0.55;
  const grid = M.uvGrid(NU, NV, prog.u, prog.v);
  const vals = { θ: 0, y: 0, t: 0 };
  const onTorus = grid.map(([u, v]) => {
    vals.θ = u;
    vals.y = v;
    return M.scale([prog.x.f(vals), prog.y.f(vals), prog.z.f(vals)], SC);
  });
  const flat = grid.map(([u, v]) => [(u - Math.PI) * SC, (v - Math.PI) * SC, 0]);
  let progress = 0;
  let together = false;
  let picked = Math.floor(grid.length / 2) + 5;
  let timer = null;
  const dotColor = ([u, v]) => hslToRgb(u / M.TAU, 0.72, 0.4 + 0.3 * (v / M.TAU));
  const along = (i) =>
    together ? progress * progress * (3 - 2 * progress) : M.stagger(progress, i, grid.length);
  const where = (i) => M.lerp3(flat[i], onTorus[i], along(i));
  function draw() {
    const W = cv.width;
    const H = cv.height;
    const cam = M.orbitCamera({ ...view, distance: 7.5, focal: 420, cx: W / 2, cy: H / 2 });
    cx.clearRect(0, 0, W, H);
    const pts = grid
      .map((g, i) => ({ i, s: M.project(cam, where(i)) }))
      .sort((a, b) => b.s.z - a.s.z);
    for (const { i, s } of pts) {
      cx.fillStyle = rgba(dotColor(grid[i]), 0.95);
      cx.beginPath();
      cx.arc(s.x, s.y, i === picked ? 6 : 3.6, 0, M.TAU);
      cx.fill();
      if (i === picked) {
        cx.strokeStyle = css("--ink");
        cx.lineWidth = 2.4;
        cx.stroke();
      }
    }
    const [u, v] = grid[picked];
    const p = where(picked);
    const t = onTorus[picked];
    const f = flat[picked];
    $("ut-progress-out").value = progress.toFixed(2);
    $("ut-readout").textContent =
      `The marked dot is dot ${picked + 1} of ${grid.length}.\n` +
      `u = ${u.toFixed(2)}   (${((100 * u) / M.TAU).toFixed(0)}% of the way round)\n` +
      `v = ${v.toFixed(2)}   (${((100 * v) / M.TAU).toFixed(0)}% of the way round)\n\n` +
      `On the flat sheet: (${f.map((w) => w.toFixed(2)).join(", ")})\n` +
      `On the torus:      (${t.map((w) => w.toFixed(2)).join(", ")})\n` +
      `Now:               (${p.map((w) => w.toFixed(2)).join(", ")})  ${(100 * along(picked)).toFixed(0)}% of its way`;
  }
  $("ut-progress").addEventListener("input", () => {
    progress = num("ut-progress");
    draw();
  });
  $("ut-mode").addEventListener("click", (e) => {
    together = !together;
    e.currentTarget.setAttribute("aria-pressed", String(!together));
    e.currentTarget.textContent = together ? "All at once" : "One dot at a time";
    draw();
  });
  const stop = () => {
    clearInterval(timer);
    timer = null;
    $("ut-play").textContent = "Carry them";
  };
  $("ut-play").addEventListener("click", () => {
    if (timer) return stop();
    if (reduce()) {
      progress = progress >= 1 ? 0 : 1;
      $("ut-progress").value = progress;
      draw();
      return;
    }
    if (progress >= 1) progress = 0;
    $("ut-play").textContent = "Pause";
    let last = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      progress = Math.min(1, progress + (now - last) / 5000);
      last = now;
      $("ut-progress").value = progress;
      draw();
      if (progress >= 1) stop();
    }, 33);
  });
  // Tap a dot to follow it (a drag still turns the view).
  let downAt = null;
  cv.style.touchAction = "none";
  cv.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  cv.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const { x, y } = canvasPoint(cv, e);
    const cam = M.orbitCamera({
      ...view,
      distance: 7.5,
      focal: 420,
      cx: cv.width / 2,
      cy: cv.height / 2,
    });
    let best = picked;
    let bd = 1e9;
    grid.forEach((g, i) => {
      const s = M.project(cam, where(i));
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    picked = best;
    draw();
  });
  makeOrbit(cv, view, draw);
  $("ut-u").addEventListener("input", () => {
    const u = num("ut-u");
    const v = num("ut-v");
    picked = nearestDot(u, v);
    draw();
  });
  $("ut-v").addEventListener("input", () => {
    picked = nearestDot(num("ut-u"), num("ut-v"));
    draw();
  });
  function nearestDot(u, v) {
    let best = 0;
    let bd = 1e9;
    grid.forEach((g, i) => {
      const d = (g[0] - u) ** 2 + (g[1] - v) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  redraws.push(draw);
  draw();
}
function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// ---- The fields of a program, on the toy -----------------------------------------------------------------------
const FIELD_NOTES = {
  x: "Where each splat sits, left to right.",
  y: "Where each splat sits, bottom to top.",
  z: "Where each splat sits, near to far.",
  u: "The range of u: the first of the two numbers each splat gets.",
  v: "The range of v: the second of the two numbers each splat gets.",
  hue: "The color, as one number: 0 to 1 goes once around the rainbow. Replaces red, green, and blue.",
  r: "Red, from 0 to 1. Replaces the hue.",
  g: "Green, from 0 to 1. Replaces the hue.",
  b: "Blue, from 0 to 1. Replaces the hue.",
  size: "How big each splat is.",
  count: "How many splats (100 to 10,000).",
  spread: "grid puts them in even rows; random scatters them.",
};
function fieldsDemo() {
  const cv = $("pf-canvas");
  if (!cv) return;
  const cx = cv.getContext("2d");
  const view = { yaw: 25, pitch: 18 };
  const pick = $("pf-preset");
  for (const p of PRESETS) pick.append(new Option(p.label, p.id));
  pick.value = "torus";
  const list = $("pf-fields");
  list.innerHTML = FIELDS.map(
    (f) => `<div class="field-row" data-f="${f}"><label for="pf-f-${f}"><code>${f}</code></label><input type="text" id="pf-f-${f}" spellcheck="false" autocomplete="off" /><span class="note">${FIELD_NOTES[f]}</span></div>`, // prettier-ignore
  ).join("");
  const input = (f) => $(`pf-f-${f}`);
  let built = null;
  let prev = null;
  let timer = null;
  function loadPreset() {
    const p = PRESETS.find((q) => q.id === pick.value);
    for (const f of FIELDS) input(f).value = p[f] || "";
    prev = null;
    rebuild(null);
  }
  function currentFields() {
    const fields = {};
    for (const f of FIELDS) if (input(f).value.trim()) fields[f] = input(f).value.trim();
    // A hue replaces red, green, and blue, and any of those replaces the hue: the last field changed wins.
    return fields;
  }
  function rebuild(changed) {
    const fields = currentFields();
    if (changed === "hue") for (const f of ["r", "g", "b"]) delete fields[f];
    else if (["r", "g", "b"].includes(changed)) delete fields.hue;
    const err = $("pf-error");
    let prog;
    try {
      prog = compileProgram(fields);
    } catch (e) {
      err.textContent = String(e.message);
      return;
    }
    err.textContent = "";
    const o = { preset: "custom", splats: "solid", shade: true };
    for (const f of FIELDS) o[f] = fields[f] || "";
    const run = buildRecipe(EQ_RECIPES["splat-equation"], { seed: 11, count: 120000, options: o }, () => {}); // prettier-ignore
    let r = run.next();
    while (!r.done) r = run.next();
    const k = r.value;
    // The first copy of the shape (t = 0), which is what rests on screen.
    const firstPart = k.kit.data.equation.copies > 1 ? 1 : 0;
    const buf = k.buf;
    const idx = [];
    for (let i = 0; i < buf.count; i++) if (((buf.anim[i * 4] | 0) & 15) === firstPart) idx.push(i);
    const snap = {
      n: idx.length,
      pos: idx.map((i) => [buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]]),
      col: idx.map((i) => [buf.color[i * 4], buf.color[i * 4 + 1], buf.color[i * 4 + 2]]),
      size: idx.map((i) => buf.scale[i * 3]),
    };
    built = { buf, idx };
    // What changed since the last build, from the splats themselves.
    const same = (a, b, eps = 1e-5) => a.length === b.length && a.every((v, i) => (Array.isArray(v) ? v.every((w, j) => Math.abs(w - b[i][j]) < eps) : Math.abs(v - b[i]) < eps)); // prettier-ignore
    if (prev) {
      const rows = [
        ["Count", `${prev.n === snap.n ? `${snap.n.toLocaleString("en-US")} splats, the same` : `${prev.n.toLocaleString("en-US")} → ${snap.n.toLocaleString("en-US")} splats`} (you asked for ${prog.count.toLocaleString("en-US")}; the toy lays splats out in whole rows and columns)`], // prettier-ignore
        ["Where the splats are", prev.n !== snap.n ? "changed (the count changed)" : same(prev.pos, snap.pos) ? "the same" : "changed"], // prettier-ignore
        ["Their colors", prev.n !== snap.n ? "changed (the count changed)" : same(prev.col, snap.col) ? "the same" : "changed"], // prettier-ignore
        ["Their sizes", prev.n !== snap.n ? "changed (the count changed)" : same(prev.size, snap.size) ? "the same" : "changed"], // prettier-ignore
      ];
      $("pf-diff").innerHTML = rows.map(([a, b]) => `<tr class="${/changed/.test(b) && !/the same/.test(b) ? "changed" : ""}"><th scope="row">${a}</th><td>${b}</td></tr>`).join(""); // prettier-ignore
      $("pf-diff-head").textContent = `Since your last change${changed ? ` (${changed})` : ""}:`;
    } else {
      $("pf-diff").innerHTML = "";
      $("pf-diff-head").textContent =
        "Change a field to see what it moves and what it leaves alone.";
    }
    prev = snap;
    draw();
    void prog;
  }
  function draw() {
    if (!built) return;
    const W = cv.width;
    const H = cv.height;
    const cam = M.orbitCamera({ ...view, distance: 3.4, focal: 400, cx: W / 2, cy: H / 2 });
    cx.clearRect(0, 0, W, H);
    drawKit(cx, W, H, built.buf, built.idx, cam, () => ({ alpha: 0.95 }));
  }
  for (const f of FIELDS)
    input(f).addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => rebuild(f), 220);
    });
  pick.addEventListener("change", loadPreset);
  $("pf-reset").addEventListener("click", loadPreset);
  makeOrbit(cv, view, draw);
  redraws.push(draw);
  loadPreset();
}

// Every demo starts when the page has loaded.
function start() {
  railroadDemo();
  gaussianDemo();
  numbersDemo();
  bellDemo();
  projectionDemo();
  blendDemo();
  windmillDemo();
  torusDemo();
  fieldsDemo();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
