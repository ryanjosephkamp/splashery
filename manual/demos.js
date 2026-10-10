// The manual's live demos (web version only; the PDF prints a still of each and a link). Each demo
// is a <section class="demo-live" data-demo="..."> in index.html; this file finds it by its ids and
// wires it up. The math is in demo-math.js, so it can be tested without a page.

import {
  TAU,
  covFromSizes,
  covFacts,
  covWeight,
  smoothstep,
  momentPos,
  morphPos,
  worstDip,
  pointsPerCopy,
  parseExpr,
  evalTree,
  grouped,
} from "./demo-math.js";

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const redraws = [];

// ---- Covariance: Sigma from two sizes and a turn, or typed ------------------------------------
function covDemo() {
  if (!$("cov-canvas")) return;
  const cv = $("cov-canvas");
  const cx = cv.getContext("2d");
  let mode = "sizes";
  const num = (id) => Number($(id).value);
  const matrix = () =>
    mode === "sizes"
      ? covFromSizes(num("cov-s1"), num("cov-s2"), (num("cov-th") * Math.PI) / 180)
      : { a: num("cov-a"), b: num("cov-b"), c: num("cov-c") };
  function draw() {
    const m = matrix();
    for (const k of ["s1", "s2", "a", "b", "c"])
      $(`cov-${k}-out`).value = num(`cov-${k}`).toFixed(2);
    $("cov-th-out").value = `${$("cov-th").value}°`;
    const f = covFacts(m);
    const W = cv.width;
    const H = cv.height;
    const scale = W / 3;
    const img = cx.createImageData(W, H);
    const [hr, hg, hb] = css("--heat").split(",").map(Number);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let w = covWeight(m, (x - W / 2) / scale, -(y - H / 2) / scale);
        if (!f.valid) w = Math.min(1, w);
        const i = (y * W + x) * 4;
        img.data[i] = hr;
        img.data[i + 1] = hg;
        img.data[i + 2] = hb;
        img.data[i + 3] = Math.round(255 * Math.min(1, Math.max(0, w)) * 0.85);
      }
    }
    cx.clearRect(0, 0, W, H);
    cx.putImageData(img, 0, 0);
    cx.strokeStyle = css("--line");
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(0, H / 2);
    cx.lineTo(W, H / 2);
    cx.moveTo(W / 2, 0);
    cx.lineTo(W / 2, H);
    cx.stroke();
    if (f.valid) {
      cx.strokeStyle = css("--ink");
      cx.lineWidth = 1.5;
      for (const k of [1, 2]) {
        cx.setLineDash(k === 2 ? [5, 4] : []);
        cx.beginPath();
        cx.ellipse(W / 2, H / 2, k * Math.sqrt(f.l1) * scale, k * Math.sqrt(Math.max(f.l2, 0)) * scale, -f.angle, 0, TAU); // prettier-ignore
        cx.stroke();
      }
      cx.setLineDash([]);
    }
    const t = (v) => (v >= 0 ? " " : "") + v.toFixed(3);
    $("cov-readout").textContent =
      `Σ = [ ${t(m.a)}  ${t(m.b)} ]\n    [ ${t(m.b)}  ${t(m.c)} ]\n\n` +
      `squared sizes along its own axes: ${f.l1.toFixed(3)} and ${f.l2.toFixed(3)}\n` +
      `(so the sizes are ${Math.sqrt(f.l1).toFixed(3)} and ${Math.sqrt(Math.max(f.l2, 0)).toFixed(3)}; both must be above 0)`; // prettier-ignore
    const v = $("cov-verdict");
    if (f.valid) {
      v.textContent = "Valid: it falls off in every direction.";
      v.className = "verdict ok";
    } else if (f.flat) {
      v.textContent = "Not valid: it is flat in one direction (a size of 0), so it can't be inverted."; // prettier-ignore
      v.className = "verdict bad";
    } else {
      v.textContent = "Not valid: in some direction it grows instead of falling off (it isn't positive definite)."; // prettier-ignore
      v.className = "verdict bad";
    }
  }
  function setMode(next) {
    mode = next;
    $("cov-mode-sizes").setAttribute("aria-pressed", String(next === "sizes"));
    $("cov-mode-matrix").setAttribute("aria-pressed", String(next === "matrix"));
    $("cov-sizes").hidden = next !== "sizes";
    $("cov-matrix").hidden = next !== "matrix";
    draw();
  }
  for (const id of ["cov-s1", "cov-s2", "cov-th", "cov-a", "cov-b", "cov-c"]) $(id).addEventListener("input", draw); // prettier-ignore
  $("cov-mode-sizes").addEventListener("click", () => setMode("sizes"));
  $("cov-mode-matrix").addEventListener("click", () => {
    // Seed the matrix sliders from the current sizes, so the switch is seamless.
    mode = "sizes";
    const m = matrix();
    $("cov-a").value = m.a.toFixed(2);
    $("cov-b").value = m.b.toFixed(2);
    $("cov-c").value = m.c.toFixed(2);
    setMode("matrix");
  });
  redraws.push(draw);
  draw();
}

// ---- The reader: how an expression groups -----------------------------------------------------
const PARSE_PRESETS = ["2^3^2", "-u^2", "2u + 1", "sin 2u", "sin u cos u", "sin u^2", "1 + 2 * 3^2", "|cos(u)|^0.5", "sqrt(1 - u^2)", "sin(3u - t)"]; // prettier-ignore
const PARSE_ENV = { u: 1, v: 0.5, t: 0 };
const escapeHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); // prettier-ignore

function treeHtml(n) {
  if (n.leaf !== undefined)
    return `<div class="leaf">${escapeHtml(n.leaf)}<span class="kind">${n.kind}</span></div>`;
  const label =
    n.op === "negate" ? "− (negate)"
    : n.op === "^" ? "^ (power)"
    : n.op === "×" && n.implied ? "× (implied)"
    : n.fn ? `${n.op}( )${n.bare ? " (bare input)" : ""}`
    : n.op === "( )" ? "( brackets )"
    : n.op; // prettier-ignore
  return `<div class="op">${escapeHtml(label)}</div><div class="node">${n.kids.map(treeHtml).join("")}</div>`;
}

function parseDemo() {
  if (!$("parse-input")) return;
  const presets = $("parse-presets");
  for (const s of PARSE_PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => {
      $("parse-input").value = s;
      run();
    });
    presets.append(b);
  }
  function run() {
    const src = $("parse-input").value;
    const out = $("parse-tree");
    const ro = $("parse-readout");
    try {
      const tree = parseExpr(src);
      out.innerHTML = treeHtml(tree);
      const val = evalTree(tree, PARSE_ENV);
      ro.textContent = `Grouped: ${grouped(tree)}\n\nAt u = 1, v = 0.5, t = 0:\n= ${Number.isFinite(val) ? +val.toPrecision(6) : "not a number (that point would be skipped)"}`; // prettier-ignore
    } catch (e) {
      out.innerHTML = `<div class="err">That can't be drawn: ${escapeHtml(e.message)}</div>`;
      ro.textContent = "Fix the expression to see how it groups.";
    }
  }
  $("parse-input").addEventListener("input", run);
  run();
}

// ---- Moments: u around the ring, the stored copies, the dip -----------------------------------
function momentsDemo() {
  if (!$("t-canvas")) return;
  const tc = $("t-canvas");
  const tx = tc.getContext("2d");
  const N = 72;
  let raf = 0;
  function draw() {
    const kind = $("t-eq").value;
    const tf = Number($("t-slider").value);
    const t = tf * TAU;
    const K = Number($("t-knots").value);
    $("t-out").value = t.toFixed(2);
    $("t-knots-out").value = K ? String(K) : "off";
    const W = tc.width;
    const H = tc.height;
    const s = W / 3.2;
    tx.clearRect(0, 0, W, H);
    tx.strokeStyle = css("--line");
    tx.lineWidth = 1;
    tx.beginPath();
    tx.arc(W / 2, H / 2, s, 0, TAU);
    tx.stroke();
    tx.fillStyle = css("--accent");
    let dip = 0;
    let first = null;
    for (let i = 0; i < N; i++) {
      const u = (i / N) * TAU;
      const p = K ? morphPos(kind, u, tf, K) : momentPos(kind, u, t);
      if (K) {
        const e = momentPos(kind, u, t);
        dip = Math.max(dip, Math.hypot(e[0], e[1]) - Math.hypot(p[0], p[1]));
      }
      if (i === 0) first = p;
      tx.beginPath();
      tx.arc(W / 2 + p[0] * s, H / 2 - p[1] * s, i === 0 ? 6 : 3.5, 0, TAU);
      tx.fill();
    }
    tx.fillStyle = css("--muted");
    tx.font = "12px sans-serif";
    tx.fillText("u = 0", W / 2 + first[0] * s + 9, H / 2 - first[1] * s + 4);
    $("t-readout").textContent =
      `t = ${t.toFixed(2)} of 2π = ${TAU.toFixed(2)}  (${Math.round(tf * 100)}% of the cycle)\n` +
      `on the wall clock: about ${(tf * 4).toFixed(1)} s of 4 s, if played\n` +
      (K
        ? `stored moments: ${K} (copy ${Math.min(K - 1, Math.floor(tf * K)) + 1} → next)\n` +
          `largest dip right now: ${(dip * 100).toFixed(1)}%\n` +
          `worst case for a turn: ${(worstDip(K) * 100).toFixed(1)}%\n` +
          `points per copy on the weakest device: ${pointsPerCopy(120000, K).toLocaleString("en-US")}`
        : "moments: off (the exact shape at every t)");
  }
  for (const id of ["t-eq", "t-slider", "t-knots"]) $(id).addEventListener("input", draw);
  $("t-play").addEventListener("click", () => {
    cancelAnimationFrame(raf);
    const start = performance.now();
    const from = Number($("t-slider").value);
    const glide = (x) => x - Math.sin(TAU * x) / TAU; // starts and ends still, like the toy
    const step = (now) => {
      const e = Math.min(1, (now - start) / 4000);
      $("t-slider").value = ((from + glide(e)) % 1).toFixed(3);
      draw();
      if (e < 1) raf = requestAnimationFrame(step);
    };
    if (reduce()) {
      $("t-slider").value = ((from + 0.25) % 1).toFixed(3);
      draw();
    } else raf = requestAnimationFrame(step);
  });
  redraws.push(draw);
  draw();
}

// ---- Smoothstep: the curve, a straight ramp, and a turn that uses it -----------------------------
function smoothDemo() {
  if (!$("ss-canvas")) return;
  const cv = $("ss-canvas");
  const cx = cv.getContext("2d");
  const slider = $("ss-x");
  let raf = 0;
  const pad = 34;
  const px = (x) => pad + x * (cv.width - 2 * pad);
  const py = (y) => cv.height - pad - y * (cv.height - 2 * pad);
  function blade(ctx, ox, oy, size, angle, color) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-size * 0.09, -size, size * 0.18, size * 0.95);
    }
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.14, 0, TAU);
    ctx.fillStyle = css("--ink");
    ctx.fill();
    ctx.restore();
  }
  function draw() {
    const x = Number(slider.value);
    const ss = smoothstep(x);
    $("ss-x-out").value = x.toFixed(2);
    // The curve and the ramp.
    const W = cv.width;
    const H = cv.height;
    cx.clearRect(0, 0, W, H);
    cx.strokeStyle = css("--line");
    cx.lineWidth = 1;
    cx.beginPath();
    cx.rect(px(0), py(1), px(1) - px(0), py(0) - py(1));
    cx.stroke();
    cx.fillStyle = css("--muted");
    cx.font = "12px sans-serif";
    cx.fillText("0", px(0) - 12, py(0) + 14);
    cx.fillText("1", px(1) - 4, py(0) + 14);
    cx.fillText("1", px(0) - 14, py(1) + 4);
    cx.setLineDash([5, 4]);
    cx.strokeStyle = css("--muted");
    cx.lineWidth = 1.5;
    cx.beginPath();
    cx.moveTo(px(0), py(0));
    cx.lineTo(px(1), py(1));
    cx.stroke();
    cx.setLineDash([]);
    cx.strokeStyle = css("--accent");
    cx.lineWidth = 2.5;
    cx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const g = i / 100;
      cx[i ? "lineTo" : "moveTo"](px(g), py(smoothstep(g)));
    }
    cx.stroke();
    cx.strokeStyle = css("--line");
    cx.beginPath();
    cx.moveTo(px(x), py(0));
    cx.lineTo(px(x), py(Math.max(x, ss)));
    cx.stroke();
    cx.fillStyle = css("--accent");
    cx.beginPath();
    cx.arc(px(x), py(ss), 6, 0, TAU);
    cx.fill();
    cx.fillStyle = css("--ink");
    cx.beginPath();
    cx.arc(px(x), py(x), 4, 0, TAU);
    cx.fill();
    cx.fillStyle = css("--accent");
    cx.fillText("smoothstep", px(0.56), py(0.35));
    cx.fillStyle = css("--muted");
    cx.fillText("straight ramp", px(0.08), py(0.48));
    // The two turning shapes: the same extra turn, eased two ways.
    const tw = $("ss-turn");
    const tg = tw.getContext("2d");
    tg.clearRect(0, 0, tw.width, tw.height);
    const size = tw.height * 0.3;
    blade(tg, tw.width * 0.25, tw.height * 0.5, size, TAU * x, css("--muted"));
    blade(tg, tw.width * 0.75, tw.height * 0.5, size, TAU * ss, css("--accent"));
    tg.fillStyle = css("--muted");
    tg.font = "22px sans-serif";
    tg.textAlign = "center";
    tg.fillText("straight: turn = x", tw.width * 0.25, tw.height - 10);
    tg.fillText("smoothstep: turn = s(x)", tw.width * 0.75, tw.height - 10);
    $("ss-readout").textContent =
      `x = ${x.toFixed(3)}\nstraight ramp:  ${x.toFixed(4)}\n` +
      `smoothstep:     3x² − 2x³ = 3 × ${(x * x).toFixed(4)} − 2 × ${(x * x * x).toFixed(4)} = ${ss.toFixed(4)}\n` +
      `extra turn:     ${(360 * x).toFixed(1)}° (straight) and ${(360 * ss).toFixed(1)}° (smoothstep)`;
  }
  slider.addEventListener("input", draw);
  // Drag the point on the curve, or use the arrow keys on it.
  const fromPointer = (e) => {
    const r = cv.getBoundingClientRect();
    const g = ((e.clientX - r.left) / r.width) * cv.width;
    slider.value = Math.min(1, Math.max(0, (g - pad) / (cv.width - 2 * pad))).toFixed(3);
    draw();
  };
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    fromPointer(e);
  });
  cv.addEventListener("pointermove", (e) => {
    if (e.buttons) fromPointer(e);
  });
  cv.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.02 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.02 : 0; // prettier-ignore
    if (!d) return;
    e.preventDefault();
    slider.value = Math.min(1, Math.max(0, Number(slider.value) + d)).toFixed(3);
    draw();
  });
  $("ss-play").addEventListener("click", () => {
    cancelAnimationFrame(raf);
    if (reduce()) {
      slider.value = slider.value === "1" ? "0" : "1";
      draw();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const e = Math.min(1, (now - start) / 2400);
      slider.value = e.toFixed(3);
      draw();
      if (e < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
  redraws.push(draw);
  draw();
}

covDemo();
parseDemo();
momentsDemo();
smoothDemo();
const all = () => redraws.forEach((f) => f());
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", all);
new MutationObserver(all).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
