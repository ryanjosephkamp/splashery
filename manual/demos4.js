// The manual's live figures (web version only; the PDF prints the still in each figure). A figure
// is a <figure data-live="..."> with a still inside it (the picture the PDF prints) and a canvas
// for the live version. This file finds each one by its data-live name and runs it; to add a live
// figure, add a function to LIVE below and put data-live on a figure. Run once on every page that
// has one (a page loads this file with a script tag in its body).

import { crisp } from "./crisp.js";
import * as M from "./demo-math3.js";
import { compileProgram } from "../src/packs/splat-equation.js";
import { encodeSceneHash, deflateRaw, bytesToBase64Url } from "../src/codec.js";

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const hsl = (h, s, l) => {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const rgb = (c, a = 1) => `rgba(${c.map((v) => Math.round(v * 255)).join(", ")}, ${a})`;

// A canvas that draws only while it is on the screen and the tab is visible. `frame(seconds)` draws
// one frame. With reduced motion it draws one still frame and never animates.
function animate(cv, frame) {
  const printing = matchMedia("print");
  let raf = 0;
  let visible = false;
  let t0 = 0;
  const redraw = () => frame(t0 && !printing.matches ? (performance.now() - t0) / 1000 : 0);
  const cx = crisp(cv, redraw);
  const tick = (now) => {
    raf = 0;
    if (!visible || document.hidden || printing.matches) return;
    t0 ||= now;
    frame((now - t0) / 1000);
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !reduce() && !raf) raf = requestAnimationFrame(tick);
  }).observe(cv);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && visible && !reduce() && !raf) raf = requestAnimationFrame(tick);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); // prettier-ignore
  // Printing (the PDF) stops the motion on the first frame, so the same page prints the same bytes.
  printing.addEventListener?.("change", () => {
    t0 = 0;
    frame(0);
  });
  frame(0);
  return cx;
}

// ---- Chapter 3: each dot of the (u, v) grid is a splat, and the equations carry it onto the torus ----
// The same program as the chapter's: x = (2 + cos v) cos u, y = sin v, z = (2 + cos v) sin u,
// run by the toy's own reader. The grid on the left lights one splat at a time; the torus on the
// right turns slowly and shows where that splat lands.
const TORUS = { x: "(2 + cos v)·cos u", y: "sin v", z: "(2 + cos v)·sin u", u: "0 .. 2pi", v: "0 .. 2pi" }; // prettier-ignore

function uvTorus(fig) {
  const cv = fig.querySelector("canvas");
  const svg = fig.querySelector("svg");
  const ring = svg.querySelector("#uv-ring");
  const cells = [...svg.querySelectorAll("#uv-dots circle")]; // 8 by 8, row by row from the top
  const prog = compileProgram(TORUS);
  const vals = { θ: 0, y: 0, t: 0 };
  const place = (u, v) => {
    vals.θ = u;
    vals.y = v;
    return [prog.x.f(vals), prog.y.f(vals), prog.z.f(vals)].map((w) => w * 0.5);
  };
  const color = (u, v) => hsl(u / M.TAU, 0.78, 0.42 + 0.26 * (v / M.TAU));
  const N = 8; // the grid in the picture is 8 by 8
  const cell = (i, j) => [((i + 0.5) / N) * M.TAU, ((j + 0.5) / N) * M.TAU]; // column i, row j from the bottom
  // Color each dot of the grid like the torus dot it becomes (the hue follows u, the brightness v).
  cells.forEach((c, k) => {
    const i = k % N;
    const j = N - 1 - Math.floor(k / N);
    c.setAttribute("fill", rgb(color(...cell(i, j))));
  });
  const NU = 56;
  const NV = 28;
  const dots = [];
  for (let a = 0; a < NU; a++)
    for (let b = 0; b < NV; b++) {
      const u = ((a + 0.5) / NU) * M.TAU;
      const v = ((b + 0.5) / NV) * M.TAU;
      dots.push({ p: place(u, v), c: color(u, v) });
    }
  const cycle = 12; // seconds for the walk through all 64 cells
  const frame = (t) => {
    const W = cv.width;
    const H = cv.height;
    const cx = cv.getContext("2d");
    const k = reduce() ? 0 : Math.floor((t / cycle) * N * N) % (N * N);
    const row = Math.floor(k / N); // from the bottom, a snake so the ring never jumps
    const i = row % 2 ? N - 1 - (k % N) : k % N;
    const [u, v] = cell(i, row);
    ring.setAttribute("cx", (49.4 + i * 18.75).toFixed(1));
    ring.setAttribute("cy", (160.6 - row * 18.75).toFixed(1));
    const cam = M.orbitCamera({
      yaw: reduce() ? 25 : 25 + t * 18,
      pitch: reduce() ? 24 : 24 + 10 * Math.sin(t * 0.6),
      distance: 7,
      focal: 500,
      cx: W / 2,
      cy: H / 2,
    });
    cx.clearRect(0, 0, W, H);
    const pts = dots.map((d) => ({ d, s: M.project(cam, d.p) })).sort((a, b) => b.s.z - a.s.z);
    for (const { d, s } of pts) {
      cx.fillStyle = rgb(d.c, 0.92);
      cx.beginPath();
      cx.arc(s.x, s.y, (3.4 * 7) / s.z, 0, M.TAU);
      cx.fill();
    }
    const s = M.project(cam, place(u, v));
    cx.strokeStyle = "#e8384f";
    cx.lineWidth = 2.5;
    cx.fillStyle = rgb(color(u, v));
    cx.beginPath();
    cx.arc(s.x, s.y, 7, 0, M.TAU);
    cx.fill();
    cx.stroke();
  };
  animate(cv, frame);
  fig.classList.add("live");
}

// ---- "A whole scene in a link": the real codec, step by step, on a tiny scene ------------------------
// Fills <ol class="link-steps"> with the four stages of a link and the real size of each.
const LINK_SCENE = {
  app: "splashery",
  version: 3,
  seed: 7,
  toy: { kind: "builtin", id: "cactus" },
  camera: { yaw: 0.55, pitch: 0.3, roll: 0, distance: 4.5 },
};
async function linkSteps(fig) {
  const ol = fig.querySelector("ol.link-steps");
  const json = JSON.stringify(LINK_SCENE);
  const bytes = new TextEncoder().encode(json);
  let squeezed = null;
  try {
    squeezed = await deflateRaw(bytes);
  } catch {}
  const hash = await encodeSceneHash(LINK_SCENE);
  const text = squeezed ? bytesToBase64Url(squeezed) : bytesToBase64Url(bytes);
  const stages = [
    [
      "The scene, as JSON",
      `${bytes.length} bytes`,
      json.length > 60 ? json.slice(0, 57) + "…" : json,
    ],
    squeezed
      ? [
          "Squeezed (raw deflate)",
          `${squeezed.length} bytes`,
          "the same facts, said in fewer bytes",
        ]
      : [
          "Left as it is",
          `${bytes.length} bytes`,
          "this browser cannot compress, so the link carries the JSON as it is",
        ],
    [
      "Written in 64 safe letters (base64url)",
      `${text.length} characters`,
      `${hash.slice(0, 2)}${text.slice(0, 26)}…`,
    ],
    [
      "The link",
      `${text.length + 2} characters after #s=`,
      "…/splashery/#s=" + hash.slice(0, 18) + "…",
    ],
  ];
  ol.replaceChildren(
    ...stages.map(([title, size, sample]) => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = title;
      const n = document.createElement("span");
      n.className = "size";
      n.textContent = size;
      const c = document.createElement("code");
      c.textContent = sample;
      li.append(b, n, c);
      return li;
    }),
  );
}

const LIVE = { "uv-torus": uvTorus, "link-steps": linkSteps };

for (const fig of document.querySelectorAll("figure[data-live]")) {
  const run = LIVE[fig.dataset.live];
  if (run) run(fig);
}
