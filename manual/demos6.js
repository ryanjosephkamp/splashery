// The last five live demos of the Tinkerer's Manual (Manual r9; web version only, the PDF prints a
// still of each and a link). Each is a <section class="demo-live" data-demo="..."> in its chapter:
//   moving-joints  Chapter 5: grab a hinge, a slider, and a dial; each moves by one number
//   photo-depth    Chapter 8: a picture cut into depth layers, beside the Sharp view
//   data-table     Chapter 7: a table of numbers, one splat per row
//   qr-damage      Chapter 9: scratch a QR code and watch the codewords lost against the ones that
//                  error correction can fix (the QR lab's own Reed–Solomon code decides)
//   splat-file     Chapter 10: a tiny splat file with a crop box and the toolkit's floater filter
// Every canvas goes through crisp.js (sharp at the device pixel ratio), takes touch, mouse, and
// pen through pointer events, and has a keyboard or slider way to do the same. Nothing is fetched;
// nothing moves by itself with reduced motion on. A page loads this file with a script tag inside
// the demo's section; the file runs each demo whose section is on the page.

import { crisp, scaleOf } from "./crisp.js";

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;

// Redraw when the theme changes (the system's, or the page's own data-theme).
function onTheme(redraw) {
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); // prettier-ignore
}

// One pointer at a time on a canvas, in the canvas's logical units. start() may return false to
// refuse the touch (then the page scrolls as usual).
function pointerDrag(cv, { start, move, end }) {
  cv.style.touchAction = "none";
  const at = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height]; // prettier-ignore
  };
  let id = null;
  cv.addEventListener("pointerdown", (e) => {
    if (id !== null) return;
    if (start(at(e), e) === false) return;
    id = e.pointerId;
    cv.setPointerCapture?.(id);
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    if (e.pointerId === id) move(at(e), e);
  });
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    end?.(e);
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
}

// A small seeded random, so a demo (and its print still) comes out the same every time.
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h, s, l) => {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};

// ---- Chapter 5: a hinge, a slider, and a dial -----------------------------------------------------
// The same three drivers as src/physics/joints.js: each part is posed from one number. The hinge
// swings between 0 and 90 degrees and falls by its own weight, bouncing off its stop at 0.2 of its
// speed; the slider moves between two stops (0 to 0.5 toy radii) and stays where it is left, held
// by friction like the sword in the stone; the dial turns round and round and coasts after a
// flick (it loses speed at 0.8 a second). With reduced motion nothing falls or coasts.
function movingJoints() {
  const sec = document.querySelector('section[data-demo="moving-joints"]');
  if (!sec) return;
  const cv = $("mj-canvas");
  const W = 400;
  const H = 240;
  const S = { hinge: 0.35, slide: 0.18, dial: 0.6 }; // radians, toy radii, radians
  const HINGE = { x: 24, y: 160, len: 92 };
  const SLIDE = { x: 200, top: 128, per: 180 };
  const DIAL = { x: 334, y: 118, r: 44 };
  const hinge = $("mj-hinge");
  const slide = $("mj-slide");
  const dial = $("mj-dial");
  const outs = { hinge: $("mj-hinge-out"), slide: $("mj-slide-out"), dial: $("mj-dial-out") };
  let w = { hinge: 0, dial: 0 }; // speeds
  let grab = null;
  let raf = 0;
  let last = 0;

  const deg = (r) => Math.round((r * 180) / Math.PI);
  const labels = () => ({
    hinge: `${deg(S.hinge)}°`,
    slide: S.slide.toFixed(2),
    dial: `${(S.dial / TAU).toFixed(2)} turns`,
  });
  function readouts() {
    const l = labels();
    outs.hinge.textContent = l.hinge;
    outs.slide.textContent = l.slide;
    outs.dial.textContent = l.dial;
    hinge.value = deg(S.hinge);
    slide.value = S.slide;
    dial.value = clamp(deg(S.dial), -720, 720);
  }

  function draw() {
    cx.clearRect(0, 0, W, H);
    const ink = css("--ink");
    const muted = css("--muted");
    const line = css("--line");
    const accent = css("--accent");
    const panel = css("--panel");
    cx.lineCap = "round";
    cx.lineJoin = "round";
    cx.font = "600 13px system-ui, sans-serif";
    cx.textAlign = "center";
    const l = labels();
    // The hinge: a chest with a lid that swings about its back edge.
    cx.fillStyle = panel;
    cx.strokeStyle = ink;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.roundRect(HINGE.x, HINGE.y, HINGE.len, 50, 4);
    cx.fill();
    cx.stroke();
    const ex = HINGE.x + HINGE.len * Math.cos(S.hinge);
    const ey = HINGE.y - HINGE.len * Math.sin(S.hinge);
    cx.strokeStyle = accent;
    cx.lineWidth = 10;
    cx.beginPath();
    cx.moveTo(HINGE.x, HINGE.y - 5);
    cx.lineTo(ex, ey - 5);
    cx.stroke();
    cx.fillStyle = ink;
    cx.beginPath();
    cx.arc(HINGE.x, HINGE.y - 5, 4, 0, TAU);
    cx.fill();
    cx.fillStyle = muted;
    cx.fillText("hinge", HINGE.x + HINGE.len / 2, 228);
    cx.fillStyle = ink;
    cx.fillText(l.hinge, HINGE.x + HINGE.len / 2, 24);
    // The slider: a blade in a stone.
    const top = SLIDE.top - S.slide * SLIDE.per;
    cx.strokeStyle = accent;
    cx.lineWidth = 12;
    cx.beginPath();
    cx.moveTo(SLIDE.x, top);
    cx.lineTo(SLIDE.x, SLIDE.top + 60);
    cx.stroke();
    cx.lineWidth = 8;
    cx.beginPath();
    cx.moveTo(SLIDE.x - 24, top + 4);
    cx.lineTo(SLIDE.x + 24, top + 4);
    cx.stroke();
    cx.fillStyle = line;
    cx.strokeStyle = ink;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.roundRect(SLIDE.x - 40, SLIDE.top + 40, 80, 50, 8);
    cx.fill();
    cx.stroke();
    cx.fillStyle = muted;
    cx.fillText("slider", SLIDE.x, 228);
    cx.fillStyle = ink;
    cx.fillText(l.slide, SLIDE.x, 24);
    // The dial: a knob with a notch and ticks.
    cx.strokeStyle = line;
    cx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      cx.beginPath();
      cx.moveTo(DIAL.x + (DIAL.r + 6) * Math.cos(a), DIAL.y + (DIAL.r + 6) * Math.sin(a));
      cx.lineTo(DIAL.x + (DIAL.r + 12) * Math.cos(a), DIAL.y + (DIAL.r + 12) * Math.sin(a));
      cx.stroke();
    }
    cx.fillStyle = panel;
    cx.strokeStyle = ink;
    cx.beginPath();
    cx.arc(DIAL.x, DIAL.y, DIAL.r, 0, TAU);
    cx.fill();
    cx.stroke();
    cx.strokeStyle = accent;
    cx.lineWidth = 8;
    cx.beginPath();
    cx.moveTo(DIAL.x + 12 * Math.cos(S.dial), DIAL.y + 12 * Math.sin(S.dial));
    cx.lineTo(DIAL.x + (DIAL.r - 6) * Math.cos(S.dial), DIAL.y + (DIAL.r - 6) * Math.sin(S.dial));
    cx.stroke();
    cx.fillStyle = muted;
    cx.fillText("dial", DIAL.x, 228);
    cx.fillStyle = ink;
    cx.fillText(l.dial, DIAL.x, 24);
    readouts();
  }
  const cx = crisp(cv, draw);
  onTheme(draw);

  // Gravity and coasting, only while something is moving.
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    if (grab?.part !== "hinge" && (S.hinge > 0 || w.hinge !== 0)) {
      w.hinge += (-14 * Math.cos(S.hinge) - 3 * w.hinge) * dt;
      S.hinge += w.hinge * dt;
      if (S.hinge <= 0) {
        S.hinge = 0;
        w.hinge = w.hinge < -0.3 ? -0.2 * w.hinge : 0; // a small bounce off the stop
      }
      if (S.hinge >= Math.PI / 2) {
        S.hinge = Math.PI / 2;
        w.hinge = Math.min(0, w.hinge);
      }
      moving = S.hinge > 0 || w.hinge !== 0;
    }
    if (grab?.part !== "dial" && Math.abs(w.dial) > 0.05) {
      S.dial += w.dial * dt;
      w.dial *= Math.exp(-0.8 * dt);
      moving = true;
    } else if (grab?.part !== "dial") w.dial = 0;
    draw();
    if (moving) raf = requestAnimationFrame(tick);
  }
  const run = () => {
    if (!raf && !reduce()) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  pointerDrag(cv, {
    start([x, y]) {
      const part = x < 133 ? "hinge" : x < 267 ? "slide" : "dial";
      w = { hinge: 0, dial: 0 };
      if (part === "hinge") grab = { part };
      else if (part === "slide") grab = { part, y0: y, s0: S.slide };
      else {
        const a = Math.atan2(y - DIAL.y, x - DIAL.x);
        grab = { part, prev: a, t: performance.now() };
      }
      return true;
    },
    move([x, y]) {
      if (grab.part === "hinge") {
        // The angle that brings the lid's end nearest the finger.
        S.hinge = clamp(Math.atan2(HINGE.y - y, x - HINGE.x), 0, Math.PI / 2);
      } else if (grab.part === "slide") {
        S.slide = clamp(grab.s0 + (grab.y0 - y) / SLIDE.per, 0, 0.5);
      } else {
        const a = Math.atan2(y - DIAL.y, x - DIAL.x);
        let d = a - grab.prev;
        if (d > Math.PI) d -= TAU;
        if (d < -Math.PI) d += TAU;
        S.dial += d;
        const now = performance.now();
        const dt = Math.max(0.008, (now - grab.t) / 1000);
        w.dial = 0.6 * w.dial + 0.4 * (d / dt);
        grab.prev = a;
        grab.t = now;
      }
      draw();
    },
    end() {
      grab = null;
      if (Math.abs(w.dial) < 0.3) w.dial = 0; // a slow turn stops where it is
      if (reduce()) w = { hinge: 0, dial: 0 };
      run();
    },
  });

  hinge.addEventListener("input", () => {
    S.hinge = (Number(hinge.value) * Math.PI) / 180;
    w.hinge = 0;
    draw();
  });
  slide.addEventListener("input", () => {
    S.slide = Number(slide.value);
    draw();
  });
  dial.addEventListener("input", () => {
    S.dial = (Number(dial.value) * Math.PI) / 180;
    w.dial = 0;
    draw();
  });
  // Letting go of the hinge slider lets the lid fall.
  hinge.addEventListener("change", run);
  $("mj-reset").addEventListener("click", () => {
    Object.assign(S, { hinge: 0.35, slide: 0.18, dial: 0.6 });
    w = { hinge: 0, dial: 0 };
    draw();
  });
  draw();
}

// ---- Chapter 8: a picture cut into depth layers, beside the Sharp view ----------------------------
// A small picture painted by this file, with a depth for every cell (0 is far, 1 is near), drawn
// two ways as the view turns. Left: the depth cut into eight layers, each a flat card that slides
// as a whole (the layers part, and a gap shows behind a near one). Right: the Sharp view's way, a
// continuous relief: every row is stretched so no gap shows. Both are made-up depth, not a model's.
function photoDepth() {
  const sec = document.querySelector('section[data-demo="photo-depth"]');
  if (!sec) return;
  const NX = 100;
  const NY = 75;
  const LAYERS = 8;
  const rgb = new Uint8Array(NX * NY * 3);
  const depth = new Float32Array(NX * NY);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const u = (i + 0.5) / NX;
      const v = (j + 0.5) / NY;
      let c = mix([96, 150, 222], [208, 228, 246], v / 0.6);
      let d = 0;
      if ((u - 0.78) ** 2 + ((v - 0.2) * 0.75) ** 2 < 0.0049) ((c = [255, 236, 170]), (d = 0.02));
      if (v > 0.5 - 0.1 * Math.abs(Math.sin(u * 5.1 + 1)) - 0.04)
        ((c = [112, 128, 156]), (d = 0.18));
      if (v > 0.6 + 0.04 * Math.sin(u * 3 + 2)) ((c = [92, 156, 100]), (d = 0.36));
      if (v > 0.7) (c = mix([84, 150, 90], [52, 112, 64], (v - 0.7) / 0.3)), (d = 0.45 + ((v - 0.7) / 0.3) * 0.5); // prettier-ignore
      // The house.
      if (u > 0.26 && u < 0.5 && v > 0.52 && v < 0.74) ((c = [226, 200, 154]), (d = 0.6));
      if (v > 0.38 && v <= 0.52 && Math.abs(u - 0.38) < (v - 0.38) * 1.1 + 0.02) (c = [176, 72, 62]), (d = 0.6); // prettier-ignore
      if (u > 0.34 && u < 0.4 && v > 0.62 && v < 0.74) ((c = [112, 74, 52]), (d = 0.6));
      // The tree.
      if (u > 0.77 && u < 0.83 && v > 0.52 && v < 0.92) ((c = [112, 78, 52]), (d = 0.84));
      if ((u - 0.8) ** 2 + ((v - 0.42) * 0.75) ** 2 < 0.02) ((c = [44, 120, 66]), (d = 0.88));
      rgb.set(c, (j * NX + i) * 3);
      depth[j * NX + i] = d;
    }
  const fill = Array.from({ length: NX * NY }, (_, k) => `rgb(${rgb[k * 3]},${rgb[k * 3 + 1]},${rgb[k * 3 + 2]})`); // prettier-ignore
  const layerOf = (d) => Math.min(LAYERS - 1, Math.floor(d * LAYERS));
  const byLayer = Array.from({ length: LAYERS }, () => []);
  for (let k = 0; k < NX * NY; k++) byLayer[layerOf(depth[k])].push(k);

  const A = $("pd-layers");
  const B = $("pd-sharp");
  const sDepth = $("pd-depth");
  const sTurn = $("pd-turn");
  const CW = 200 / NX;
  const CH = 150 / NY;
  const shiftFor = (d) => {
    const amount = Number(sDepth.value) * Number(sTurn.value) * 26;
    return (d - 0.5) * amount;
  };
  function drawLayers() {
    const g = cxA;
    g.clearRect(0, 0, 200, 150);
    g.fillStyle = css("--code-bg") || "#eee";
    g.fillRect(0, 0, 200, 150);
    for (let l = 0; l < LAYERS; l++) {
      const s = shiftFor((l + 0.5) / LAYERS);
      for (const k of byLayer[l]) {
        g.fillStyle = fill[k];
        g.fillRect((k % NX) * CW + s, ((k / NX) | 0) * CH, CW + 0.7, CH + 0.7);
      }
    }
  }
  function drawSharp() {
    const g = cxB;
    g.clearRect(0, 0, 200, 150);
    g.fillStyle = css("--code-bg") || "#eee";
    g.fillRect(0, 0, 200, 150);
    for (let j = 0; j < NY; j++) {
      let px = shiftFor(depth[j * NX]);
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        // The next cell's left edge: the relief is one sheet, so no gap shows.
        const x1 =
          i + 1 < NX ? (i + 1) * CW + shiftFor(depth[k + 1]) : NX * CW + shiftFor(depth[k]);
        g.fillStyle = fill[k];
        g.fillRect(px, j * CH, Math.max(0, x1 - px) + 0.7, CH + 0.7);
        px = x1;
      }
    }
  }
  const cxA = crisp(A, drawLayers);
  const cxB = crisp(B, drawSharp);
  const all = () => {
    drawLayers();
    drawSharp();
    $("pd-depth-out").textContent = Number(sDepth.value).toFixed(2);
    $("pd-turn-out").textContent = Number(sTurn.value).toFixed(2);
  };
  onTheme(all);
  sDepth.addEventListener("input", all);
  sTurn.addEventListener("input", all);
  // Drag the picture sideways to turn the view.
  for (const cv of [A, B])
    pointerDrag(cv, {
      start([x]) {
        cv._x = x;
        cv._t = Number(sTurn.value);
      },
      move([x]) {
        sTurn.value = clamp(cv._t + (x - cv._x) / 90, -1, 1);
        all();
      },
    });
  all();
}

// ---- Chapter 7: a table of numbers, one splat per row ---------------------------------------------
function dataTable() {
  const sec = document.querySelector('section[data-demo="data-table"]');
  if (!sec) return;
  const cv = $("dt-canvas");
  const body = $("dt-rows");
  const turn = $("dt-turn");
  const DEFAULT = [
    ["a", 0.6, 0.1, -0.2, 0.18, 12],
    ["b", -0.5, 0.4, 0.3, 0.14, 210],
    ["c", 0.1, -0.5, 0.5, 0.22, 130],
    ["d", -0.2, 0.0, -0.6, 0.1, 285],
  ];
  const MAX_ROWS = 8;
  let rows = DEFAULT.map((r) => r.slice());
  let focus = -1;
  const FIELDS = [
    ["x", -1, 1, 0.1],
    ["y", -1, 1, 0.1],
    ["z", -1, 1, 0.1],
    ["size", 0.04, 0.5, 0.02],
    ["hue", 0, 360, 15],
  ];

  function project(p, yaw) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const x = p[0] * c + p[2] * s;
    const z = -p[0] * s + p[2] * c;
    const pitch = 0.4;
    const y = p[1] * Math.cos(pitch) - z * Math.sin(pitch);
    const z2 = p[1] * Math.sin(pitch) + z * Math.cos(pitch);
    const f = 3.2 / (3.2 - z2 * 0.7); // a little perspective
    return { sx: 200 + x * 120 * f, sy: 150 - y * 120 * f, f, z: z2 };
  }
  function draw() {
    cx.clearRect(0, 0, 400, 300);
    const yaw = (Number(turn.value) * Math.PI) / 180;
    const line = css("--line");
    const ink = css("--ink");
    // The box the numbers live in.
    cx.strokeStyle = line;
    cx.lineWidth = 1;
    const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
    const edge = (a, b) => {
      const p = project(a, yaw);
      const q = project(b, yaw);
      cx.beginPath();
      cx.moveTo(p.sx, p.sy);
      cx.lineTo(q.sx, q.sy);
      cx.stroke();
    };
    for (const a of corners)
      for (const b of corners) {
        const diff = a.filter((v, i) => v !== b[i]).length;
        if (diff === 1 && a < b) edge(a, b);
      }
    const order = rows.map((r, i) => ({ r, i, p: project([r[1], r[2], r[3]], yaw) })).sort((a, b) => a.p.z - b.p.z); // prettier-ignore
    for (const { r, i, p } of order) {
      const rad = r[4] * 120 * p.f * 1.4;
      const [cr, cg, cb] = hsl(r[5] / 360, 0.75, 0.55);
      const grad = cx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
      grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},0.6)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      cx.fillStyle = grad;
      cx.beginPath();
      cx.arc(p.sx, p.sy, rad, 0, TAU);
      cx.fill();
      if (i === focus) {
        cx.strokeStyle = ink;
        cx.lineWidth = 2;
        cx.beginPath();
        cx.arc(p.sx, p.sy, rad + 3, 0, TAU);
        cx.stroke();
      }
      cx.fillStyle = ink;
      cx.font = "600 12px system-ui, sans-serif";
      cx.textAlign = "center";
      cx.fillText(r[0], p.sx, p.sy - rad - 5);
    }
    const r = rows[focus] || rows[0];
    $("dt-read").textContent = r
      ? `Row ${r[0]} is one splat: center (${r[1]}, ${r[2]}, ${r[3]}), size ${r[4]}, color hue ${r[5]}°.`
      : "No rows: add one.";
  }
  const cx = crisp(cv, draw);
  onTheme(draw);

  function build() {
    body.replaceChildren();
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = r[0];
      tr.append(th);
      FIELDS.forEach(([name, lo, hi, step], k) => {
        const td = document.createElement("td");
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = lo;
        inp.max = hi;
        inp.step = step;
        inp.value = r[k + 1];
        inp.inputMode = "decimal";
        inp.setAttribute("aria-label", `Row ${r[0]}, ${name}`);
        inp.addEventListener("input", () => {
          const v = Number(inp.value);
          if (inp.value === "" || !Number.isFinite(v)) return;
          r[k + 1] = clamp(v, lo, hi);
          focus = i;
          draw();
        });
        inp.addEventListener("focus", () => {
          focus = i;
          draw();
        });
        td.append(inp);
        tr.append(td);
      });
      body.append(tr);
    });
    $("dt-add").disabled = rows.length >= MAX_ROWS;
    $("dt-remove").disabled = rows.length <= 1;
  }
  $("dt-add").addEventListener("click", () => {
    const name = String.fromCharCode(97 + rows.length);
    rows.push([name, 0, 0, 0, 0.16, (rows.length * 70) % 360]);
    focus = rows.length - 1;
    build();
    draw();
  });
  $("dt-remove").addEventListener("click", () => {
    rows.pop();
    focus = -1;
    build();
    draw();
  });
  $("dt-reset").addEventListener("click", () => {
    rows = DEFAULT.map((r) => r.slice());
    focus = -1;
    build();
    draw();
  });
  turn.addEventListener("input", draw);
  pointerDrag(cv, {
    start([x]) {
      cv._x = x;
      cv._t = Number(turn.value);
    },
    move([x]) {
      turn.value = clamp(cv._t + (x - cv._x) * 0.6, -90, 90);
      draw();
    },
  });
  build();
  draw();
}

// ---- Chapter 9: scratch a QR code, count the codewords ---------------------------------------------
// Uses the QR lab's own code: encodeSteps (src/qr-lab/steps.js) builds the code and its blocks,
// and analyze (src/qr-lab/read.js) reads the damaged modules back with Reed–Solomon decoding,
// block by block. A scratch lightens the dark modules under the brush.
async function qrDamage() {
  const sec = document.querySelector('section[data-demo="qr-damage"]');
  if (!sec) return;
  const [{ encodeSteps, LEVEL_RECOVERY }, { analyze }] = await Promise.all([
    import("../src/qr-lab/steps.js"),
    import("../src/qr-lab/read.js"),
  ]);
  const TEXT = "https://ryanjosephkamp.github.io/splashery/";
  const cv = $("qd-canvas");
  const level = $("qd-level");
  const brush = $("qd-brush");
  const meter = $("qd-meter");
  const verdict = $("qd-verdict");
  const summary = $("qd-summary");
  const SIZE = 360;
  const QUIET = 4;
  let steps = null;
  let dmg = null; // 1 where a scratch took the ink off a dark module
  let seed = 3;
  let result = null;

  function load() {
    steps = encodeSteps(TEXT, level.value);
    dmg = new Uint8Array(steps.size * steps.size);
    analyse();
  }
  const darkNow = () => {
    const d = new Uint8Array(steps.size * steps.size);
    for (let i = 0; i < d.length; i++) d[i] = steps.modules[i] && !dmg[i] ? 1 : 0;
    return d;
  };
  function analyse() {
    result = analyze(steps, darkNow());
    const total = steps.sequence.length;
    const lostAll = result.blocks.reduce((n, b) => n + b.lost, 0);
    const canFix = result.blocks.length * steps.fixable;
    summary.textContent = `Version ${steps.version}, level ${steps.level}: ${total} codewords in ${result.blocks.length} block${result.blocks.length > 1 ? "s" : ""}, each block can repair ${steps.fixable} (the standard's figure for this level is about ${LEVEL_RECOVERY[steps.level]} percent). Lost now: ${lostAll} of ${total} codewords (${((lostAll / total) * 100).toFixed(1)} percent); ${result.wrong.length} modules scratched.`; // prettier-ignore
    meter.replaceChildren();
    result.blocks.forEach((b, i) => {
      const row = document.createElement("div");
      row.className = "qd-block";
      const label = document.createElement("span");
      label.textContent = `Block ${i + 1}`;
      const bar = document.createElement("span");
      bar.className = "qd-bar";
      bar.setAttribute("role", "img");
      const fill = document.createElement("span");
      const share = Math.min(1, b.lost / Math.max(1, steps.fixable * 1.5));
      fill.style.width = `${share * 100}%`;
      fill.className = b.lost > steps.fixable ? "over" : "";
      const mark = document.createElement("i");
      mark.style.left = `${(1 / 1.5) * 100}%`;
      bar.append(fill, mark);
      const nums = document.createElement("span");
      nums.className = "qd-nums";
      nums.textContent = `${b.lost} lost of ${steps.fixable}`;
      bar.setAttribute("aria-label", `Block ${i + 1}: ${b.lost} codewords lost, ${steps.fixable} can be repaired`); // prettier-ignore
      row.append(label, bar, nums);
      meter.append(row);
    });
    const fingerDamage = result.finders.some((n) => n > 12);
    if (!result.wrong.length) {
      verdict.className = "verdict ok";
      verdict.textContent = "Untouched. Scratch it with your finger or the mouse.";
    } else if (fingerDamage) {
      verdict.className = "verdict bad";
      verdict.textContent = `A finder square is badly scratched (${result.finders.map((n) => (n ? n : "intact")).join(", ")} modules wrong), so a reader may not find the code at all, whatever the codewords say.`; // prettier-ignore
    } else if (result.decodes) {
      verdict.className = "verdict ok";
      verdict.textContent = lostAll > 0 ? "Every block can be repaired: it still scans." : "The scratches missed every codeword: it scans."; // prettier-ignore
    } else {
      verdict.className = "verdict bad";
      const bad = result.blocks.map((b, i) => (b.ok ? 0 : i + 1)).filter(Boolean);
      verdict.textContent = result.format.ok
        ? `Block${bad.length > 1 ? "s" : ""} ${bad.join(", ")} lost more than ${steps.fixable} codewords: Reed–Solomon cannot repair it. It will not scan.`
        : "The format information is too damaged to read: it will not scan.";
    }
    cv.setAttribute("aria-label", `A QR code with ${result.wrong.length} scratched modules; ${verdict.textContent}`); // prettier-ignore
    draw();
  }

  const geo = () => {
    const total = steps.size + 2 * QUIET;
    return { m: SIZE / total, total };
  };
  function draw() {
    if (!steps) return;
    const { m } = geo();
    const k = scaleOf(cv);
    const snap = (v) => Math.round(v * k) / k;
    cx.fillStyle = "#ffffff";
    cx.fillRect(0, 0, SIZE, SIZE);
    for (let r = 0; r < steps.size; r++)
      for (let c = 0; c < steps.size; c++) {
        const i = r * steps.size + c;
        const x0 = snap((QUIET + c) * m);
        const y0 = snap((QUIET + r) * m);
        const x1 = snap((QUIET + c + 1) * m);
        const y1 = snap((QUIET + r + 1) * m);
        if (steps.modules[i] && !dmg[i]) {
          cx.fillStyle = "#000000";
          cx.fillRect(x0, y0, x1 - x0, y1 - y0);
        } else if (dmg[i]) {
          cx.fillStyle = "#f3b8b0"; // the ink is gone; a pale mark shows where
          cx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
  }
  const cx = crisp(cv, draw);

  function scratch([x, y]) {
    const { m } = geo();
    const r = Number(brush.value);
    const c0 = Math.floor(x / m) - QUIET;
    const r0 = Math.floor(y / m) - QUIET;
    let changed = false;
    for (let dr = -r; dr <= r; dr++)
      for (let dc = -r; dc <= r; dc++) {
        if (dr * dr + dc * dc > r * r + 0.5) continue;
        const rr = r0 + dr;
        const cc = c0 + dc;
        if (rr < 0 || cc < 0 || rr >= steps.size || cc >= steps.size) continue;
        const i = rr * steps.size + cc;
        if (steps.modules[i] && !dmg[i]) {
          dmg[i] = 1;
          changed = true;
        }
      }
    return changed;
  }
  let pending = false;
  const later = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      analyse();
    });
  };
  pointerDrag(cv, {
    start(p) {
      if (scratch(p)) later();
      draw();
    },
    move(p) {
      if (scratch(p)) later();
      draw();
    },
  });
  level.addEventListener("change", load);
  $("qd-clear").addEventListener("click", () => {
    dmg.fill(0);
    analyse();
  });
  // Scattered scratches, the same every time for a given press count.
  $("qd-scatter").addEventListener("click", () => {
    const rnd = mulberry32(seed++);
    for (let n = 0; n < 6; n++) {
      const x = (QUIET + rnd() * steps.size) * geo().m;
      const y = (QUIET + rnd() * steps.size) * geo().m;
      scratch([x, y]);
    }
    analyse();
  });
  $("qd-heal").addEventListener("click", () => {
    for (let i = 0; i < dmg.length; i++) if (dmg[i] && result.healed[i]) dmg[i] = 0;
    analyse();
  });
  load();
}

// ---- Chapter 10: a tiny splat file, a crop box, and the floater filter -----------------------------
// Uses the Splat toolkit's own cropIndex and floaterFilter (src/viewers/splat-ops.js) on a table of
// 420 splats made here: a ring of 360 and 60 strays. The .splat format is 32 bytes a splat.
async function splatFile() {
  const sec = document.querySelector('section[data-demo="splat-file"]');
  if (!sec) return;
  const { cropIndex, floaterFilter } = await import("../src/viewers/splat-ops.js");
  const cv = $("sf-canvas");
  const sSize = $("sf-size");
  const sStrength = $("sf-strength");
  const onFloaters = $("sf-floaters");
  const rnd = mulberry32(11);
  const N_BODY = 360;
  const N_STRAY = 60;
  const n = N_BODY + N_STRAY;
  const t = { count: n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n) };
  const col = [];
  for (let i = 0; i < N_BODY; i++) {
    // A thick ring (a donut, seen from the front), colors turning around it.
    const a = rnd() * TAU;
    const b = rnd() * TAU;
    const R = 0.6 + 0.2 * Math.cos(b);
    t.x[i] = R * Math.cos(a);
    t.y[i] = R * Math.sin(a);
    t.z[i] = 0.2 * Math.sin(b);
    col.push(hsl(a / TAU, 0.65, 0.5));
  }
  for (let i = N_BODY; i < n; i++) {
    // Strays: far from the ring, in every direction.
    const a = rnd() * TAU;
    const R = 1.05 + rnd() * 0.9;
    t.x[i] = R * Math.cos(a);
    t.y[i] = R * Math.sin(a) * 0.9;
    t.z[i] = (rnd() - 0.5) * 1.4;
    col.push([120, 120, 130]);
  }
  const VIEW = 1.35; // the canvas shows -VIEW..VIEW
  const toX = (x) => 200 + (x / VIEW) * 190;
  const toY = (y) => 150 - (y / VIEW) * 140;
  const box = { cx: 0.0, cy: 0.0 };
  let keep = null;
  let removed = null;
  let cropped = null;

  function run() {
    const half = Number(sSize.value);
    const lo = [box.cx - half, box.cy - half, -9];
    const hi = [box.cx + half, box.cy + half, 9];
    const inside = cropIndex(t, { min: lo, max: hi });
    cropped = new Set();
    const inSet = new Set(inside);
    for (let i = 0; i < n; i++) if (!inSet.has(i)) cropped.add(i);
    let kept = inside;
    removed = new Set();
    if (onFloaters.checked && inside.length > 12) {
      const f = floaterFilter(t, inside, { k: 8, strength: Number(sStrength.value) });
      kept = f.keep;
      removed = new Set(f.removed);
    }
    keep = new Set(kept);
    const bytes = kept.length * 32;
    $("sf-counts").textContent = `In the file: ${n} splats. Inside the box: ${inside.length}. Floaters removed: ${removed.size}. Kept: ${kept.length}. As a .splat file: ${kept.length} × 32 bytes = ${bytes.toLocaleString("en-US")} bytes.`; // prettier-ignore
    $("sf-size-out").textContent = `${(half * 2).toFixed(1)}`;
    $("sf-strength-out").textContent = onFloaters.checked
      ? Number(sStrength.value).toFixed(1)
      : "off";
    cv.setAttribute("aria-label", `A ring of splats seen from the front with a crop box. ${kept.length} of ${n} splats kept.`); // prettier-ignore
    draw();
  }
  function draw() {
    cx.clearRect(0, 0, 400, 300);
    const half = Number(sSize.value);
    const x0 = toX(box.cx - half);
    const x1 = toX(box.cx + half);
    const y0 = toY(box.cy + half);
    const y1 = toY(box.cy - half);
    cx.fillStyle = "rgba(128,128,128,0.10)";
    cx.fillRect(0, 0, 400, 300);
    cx.clearRect(x0, y0, x1 - x0, y1 - y0);
    cx.fillStyle = "rgba(128,128,128,0.12)";
    cx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < n; i++) {
      const x = toX(t.x[i]);
      const y = toY(t.y[i]);
      if (cropped.has(i)) cx.fillStyle = "rgba(128,128,136,0.35)";
      else if (removed.has(i)) cx.fillStyle = "#e03a3a";
      else cx.fillStyle = `rgb(${col[i].join(",")})`;
      cx.beginPath();
      cx.arc(x, y, removed.has(i) ? 3 : 2.6, 0, TAU);
      cx.fill();
    }
    cx.strokeStyle = css("--accent");
    cx.lineWidth = 2;
    cx.setLineDash([6, 4]);
    cx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    cx.setLineDash([]);
  }
  const cx = crisp(cv, draw);
  onTheme(draw);

  pointerDrag(cv, {
    start([x, y]) {
      cv._g = { x, y, bx: box.cx, by: box.cy };
    },
    move([x, y]) {
      const g = cv._g;
      box.cx = clamp(g.bx + ((x - g.x) / 190) * VIEW, -VIEW, VIEW);
      box.cy = clamp(g.by - ((y - g.y) / 140) * VIEW, -VIEW, VIEW);
      run();
    },
  });
  cv.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; // prettier-ignore
    if (!d) return;
    e.preventDefault();
    box.cx = clamp(box.cx + d[0] * 0.05, -VIEW, VIEW);
    box.cy = clamp(box.cy + d[1] * 0.05, -VIEW, VIEW);
    run();
  });
  for (const el of [sSize, sStrength, onFloaters]) el.addEventListener("input", run);
  $("sf-reset").addEventListener("click", () => {
    box.cx = box.cy = 0;
    sSize.value = 1.0;
    sStrength.value = 2;
    onFloaters.checked = true;
    run();
  });
  run();
}

movingJoints();
photoDepth();
dataTable();
qrDamage();
splatFile();
