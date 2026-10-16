// Codex task 78a. Ryan Kamp's principal-axis pixel tree, ported onto the Kit.
// No portfolio renderer or font is shipped. The fitted moments include the
// variance of a unit square pixel, and never depend on the viewing tier.
import { FONT } from "../font.js";

export const PIXEL = 1 / 12;
const MAX_LEVEL = 14;
const SECONDS = 1.8;
// The reference's raster reconstruction filter. It affects display only;
// the tree, readout, and conservation checks keep the exact pixel moments.
const DILATE = 0.3;

export function moments(xs, ys, idx, start, end) {
  const n = end - start;
  let mx = 0,
    my = 0;
  for (let j = start; j < end; j++) {
    mx += xs[idx[j]];
    my += ys[idx[j]];
  }
  mx /= n;
  my /= n;
  let a = 0,
    b = 0,
    c = 0;
  for (let j = start; j < end; j++) {
    const dx = xs[idx[j]] - mx,
      dy = ys[idx[j]] - my;
    a += dx * dx;
    b += dx * dy;
    c += dy * dy;
  }
  return { n, mx, my, a: a / n + PIXEL, b: b / n, c: c / n + PIXEL };
}

export function eig(a, b, c) {
  const mid = (a + c) / 2,
    radius = Math.hypot((a - c) / 2, b);
  return {
    l1: mid + radius,
    l2: Math.max(1e-9, mid - radius),
    theta: Math.atan2(2 * b, a - c) / 2,
  };
}

export function covariance(s1, s2, theta) {
  const x = Math.cos(theta),
    y = Math.sin(theta);
  return {
    a: s1 * s1 * x * x + s2 * s2 * y * y,
    b: (s1 * s1 - s2 * s2) * x * y,
    c: s1 * s1 * y * y + s2 * s2 * x * x,
  };
}

// In-place quickselect: partition along the major eigenvector without sorting
// every level. Float32 projections match the reference's tie handling.
function median(keys, ids, start, end, target) {
  while (start < end) {
    const pivot = keys[(start + end) >>> 1];
    let left = start,
      right = end;
    while (left <= right) {
      while (keys[left] < pivot) left++;
      while (keys[right] > pivot) right--;
      if (left <= right) {
        [keys[left], keys[right]] = [keys[right], keys[left]];
        [ids[left], ids[right]] = [ids[right], ids[left]];
        left++;
        right--;
      }
    }
    if (target <= right) end = right;
    else if (target >= left) start = left;
    else return;
  }
}

export function buildTree(xs, ys, maxLevel = MAX_LEVEL) {
  if (!xs.length || xs.length !== ys.length) throw new Error("The picture needs inked pixels.");
  const levels = Math.max(
    0,
    Math.min(MAX_LEVEL, Math.floor(maxLevel), Math.floor(Math.log2(xs.length))),
  );
  const size = 2 ** (levels + 1);
  const tree = {
    levels,
    size,
    total: xs.length,
    idx: Uint32Array.from(xs, (_, i) => i),
    lo: new Uint32Array(size),
    hi: new Uint32Array(size),
  };
  for (const key of ["n", "mx", "my", "a", "b", "c"]) tree[key] = new Float64Array(size);
  const keys = new Float32Array(xs.length);
  tree.hi[1] = xs.length;
  for (let i = 1; i < size; i++) {
    const start = tree.lo[i],
      end = tree.hi[i];
    const m = moments(xs, ys, tree.idx, start, end);
    for (const key of ["n", "mx", "my", "a", "b", "c"]) tree[key][i] = m[key];
    if (i * 2 >= size) continue;
    const angle = eig(m.a, m.b, m.c).theta;
    const vx = Math.cos(angle),
      vy = Math.sin(angle);
    for (let j = start; j < end; j++)
      keys[j] = (xs[tree.idx[j]] - m.mx) * vx + (ys[tree.idx[j]] - m.my) * vy;
    const middle = start + ((end - start) >>> 1);
    median(keys, tree.idx, start, end - 1, middle);
    tree.lo[i * 2] = start;
    tree.hi[i * 2] = middle;
    tree.lo[i * 2 + 1] = middle;
    tree.hi[i * 2 + 1] = end;
  }
  return tree;
}

export function node(tree, i) {
  return Object.fromEntries(["n", "mx", "my", "a", "b", "c"].map((key) => [key, tree[key][i]]));
}

export function checkSplit(parent, left, right) {
  const wl = left.n / parent.n,
    wr = right.n / parent.n;
  const sum = {
    n: left.n + right.n,
    mx: wl * left.mx + wr * right.mx,
    my: wl * left.my + wr * right.my,
  };
  const within = {},
    between = {};
  for (const [key, x, y] of [
    ["a", "mx", "mx"],
    ["b", "mx", "my"],
    ["c", "my", "my"],
  ]) {
    within[key] = wl * left[key] + wr * right[key];
    between[key] =
      wl * (left[x] - parent[x]) * (left[y] - parent[y]) +
      wr * (right[x] - parent[x]) * (right[y] - parent[y]);
    sum[key] = within[key] + between[key];
  }
  const scale = parent.a + parent.c;
  const residual = Math.max(
    Math.abs(sum.n - parent.n),
    ...["mx", "my"].map((key) => Math.abs(sum[key] - parent[key]) / Math.sqrt(scale)),
    ...["a", "b", "c"].map((key) => Math.abs(sum[key] - parent[key]) / scale),
  );
  return { wl, wr, within, between, sum, residual };
}

export function frontier(tree, level, refinements = "") {
  const depth = Math.max(0, Math.min(tree.levels, Math.round(Number(level) || 0)));
  const split = new Set(String(refinements).split(",").map(Number));
  const ids = [];
  const visit = (i) => {
    if (split.has(i) && i * 2 + 1 < tree.size) {
      visit(i * 2);
      visit(i * 2 + 1);
    } else ids.push(i);
  };
  for (let i = 2 ** depth; i < 2 ** (depth + 1); i++) visit(i);
  return ids;
}

export function checkTree(tree) {
  const report = { splits: tree.size / 2 - 1, worst: 0, at: 0 };
  for (let i = 1; i < tree.size / 2; i++) {
    const { residual } = checkSplit(node(tree, i), node(tree, i * 2), node(tree, i * 2 + 1));
    if (!report.at || residual > report.worst) {
      report.worst = residual;
      report.at = i;
    }
  }
  return report;
}

// Node tools use the existing bitmap alphabet; the browser rasterizes the
// visitor's actual text with its own system font, including Unicode.
function textPixels(text) {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.font = "bold 224px sans-serif";
    canvas.width = Math.ceil(ctx.measureText(text).width) + 32;
    canvas.height = 288;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.font = "bold 224px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 16, 224);
    return refineRaster(canvasPixels(ctx.getImageData(0, 0, canvas.width, canvas.height), false));
  }
  const ink = [];
  Array.from(text.toUpperCase()).forEach((char, col) => {
    const rows = (FONT[char] || (char === " " ? "" : FONT["?"])).split(" ");
    rows.forEach((row, y) =>
      Array.from(row).forEach((bit, x) => {
        if (bit === "1") ink.push([col * 6 + x, y]);
      }),
    );
  });
  if (!ink.length) throw new Error("Type a word with visible letters.");
  const zoom = Math.max(16, Math.ceil(Math.sqrt(16384 / ink.length)));
  const xs = [],
    ys = [];
  for (const [x, y] of ink)
    for (let dy = 0; dy < zoom; dy++)
      for (let dx = 0; dx < zoom; dx++) {
        xs.push(x * zoom + dx + 0.5);
        ys.push(-(y * zoom + dy + 0.5));
      }
  return {
    xs: Float32Array.from(xs),
    ys: Float32Array.from(ys),
    width: Array.from(text).length * 6 * zoom,
    height: 7 * zoom,
  };
}

function canvasPixels(image, color) {
  const xs = [],
    ys = [],
    colors = [];
  let x0 = image.width,
    y0 = image.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 4;
      if (image.data[at + 3] < 128) continue;
      xs.push(x + 0.5);
      ys.push(-(y + 0.5));
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      if (color)
        colors.push(image.data[at] / 255, image.data[at + 1] / 255, image.data[at + 2] / 255);
    }
  if (!xs.length) throw new Error("The picture needs visible pixels.");
  return {
    xs: Float32Array.from(xs, (x) => x - x0),
    ys: Float32Array.from(ys, (y) => y + y0),
    colors: color ? Float32Array.from(colors) : null,
    width: x1 - x0 + 1,
    height: y1 - y0 + 1,
  };
}

// A nearest-neighbor raster enlargement, expanding only visible pixels.
// Sparse transparent files do not require allocating a huge empty canvas.
function refineRaster(pixels) {
  const zoom = Math.ceil(Math.sqrt(16384 / pixels.xs.length));
  if (zoom <= 1) return pixels;
  const n = pixels.xs.length * zoom * zoom;
  const xs = new Float32Array(n),
    ys = new Float32Array(n);
  const colors = pixels.colors ? new Float32Array(n * 3) : null;
  let j = 0;
  for (let i = 0; i < pixels.xs.length; i++)
    for (let y = 0; y < zoom; y++)
      for (let x = 0; x < zoom; x++) {
        xs[j] = (pixels.xs[i] - 0.5) * zoom + x + 0.5;
        ys[j] = (pixels.ys[i] + 0.5) * zoom - y - 0.5;
        if (colors) colors.set(pixels.colors.subarray(i * 3, i * 3 + 3), j * 3);
        j++;
      }
  return { xs, ys, colors, width: pixels.width * zoom, height: pixels.height * zoom };
}

const CACHE = new Map();
let picture = null;
let current = null;
let press = null;
let holdTimer = null;
let readout = null;

function release() {
  clearTimeout(holdTimer);
  holdTimer = null;
  press = null;
  readout?.remove();
  readout = null;
}

function prepareWord(o) {
  const text = Array.from(String(o.word || "Splashery").trim())
    .slice(0, 32)
    .join("");
  const key = text || "Splashery";
  if (!CACHE.has(key)) {
    const pixels = textPixels(key);
    CACHE.set(key, { ...pixels, tree: buildTree(pixels.xs, pixels.ys), label: key });
    if (CACHE.size > 3) CACHE.delete(CACHE.keys().next().value);
  }
  return CACHE.get(key);
}

function nearest(point) {
  if (!current) return null;
  let best = null,
    score = Infinity;
  for (const i of current.ids) {
    const dx = point[0] + current.width / 2 - current.tree.mx[i];
    const dy = point[1] - current.height / 2 - current.tree.my[i];
    const { a, b, c } = node(current.tree, i);
    const distance = (c * dx * dx - 2 * b * dx * dy + a * dy * dy) / (a * c - b * b);
    if (distance < score) {
      best = i;
      score = distance;
    }
  }
  return best;
}

function describe(i) {
  const m = node(current.tree, i),
    e = eig(m.a, m.b, m.c);
  return `Splat ${i} · ${m.n.toLocaleString("en-US")} pixels\nCenter: (${m.mx.toFixed(2)}, ${m.my.toFixed(2)}) px (Y up)\nSize (σ): ${Math.sqrt(e.l1).toFixed(2)} × ${Math.sqrt(e.l2).toFixed(2)} px\nAngle: ${((e.theta * 180) / Math.PI).toFixed(2)}°\nCovariance: [${m.a.toFixed(2)}, ${m.b.toFixed(2)}; ${m.b.toFixed(2)}, ${m.c.toFixed(2)}] px²`;
}

export const RECIPES = {
  "one-splat": {
    turntable: false,
    handsOn: false,
    controls: [{ key: "split", label: "Replay the last split", type: "pulse", ease: SECONDS }],
    options: [
      { key: "word", label: "Word", type: "text", default: "Splashery", maxLength: 32 },
      {
        key: "level",
        label: "Level",
        type: "slider",
        min: 0,
        max: 14,
        step: 1,
        default: 13,
        stage: true,
      },
      { key: "splits", type: "text", default: "", hidden: true },
      { key: "splitSource", type: "text", default: "", hidden: true },
      { key: "splitLevel", type: "slider", min: -1, max: 14, default: -1, hidden: true },
      { key: "lastSplit", type: "slider", min: 0, max: 32767, default: 0, hidden: true },
      { key: "picture", type: "text", default: "", hidden: true },
    ],
    input: {
      title: "A word or a picture",
      placeholder: "Your word (up to 32 characters)",
      button: "Fit the word",
      fileButton: "Open a picture…",
      binary: true,
      accept: "image/png,image/jpeg,image/webp,image/gif",
      note: "The level dial runs from 1 to 16,384 splats. Tap a splat to split it; hold to see its numbers. Pictures stay on this device. A picture link falls back to your word when reopened.",
      async read(text, name, file) {
        release();
        if (file) {
          const bitmap = await createImageBitmap(file);
          try {
            const scale = 512 / Math.max(bitmap.width, bitmap.height);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const g = canvas.getContext("2d", { willReadFrequently: true });
            g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const pixels = refineRaster(
              canvasPixels(g.getImageData(0, 0, canvas.width, canvas.height), true),
            );
            picture = { ...pixels, tree: buildTree(pixels.xs, pixels.ys), label: name };
          } finally {
            bitmap.close();
          }
          return { picture: name, splits: "", splitLevel: -1, lastSplit: 0 };
        }
        const word = text.trim();
        if (!word) throw new Error("Type a word first.");
        if (Array.from(word).length > 32) throw new Error("Use up to 32 characters.");
        return { word, picture: "", splits: "", splitLevel: -1, lastSplit: 0 };
      },
      shown: () =>
        current
          ? `${current.label} · ${current.ids.length.toLocaleString("en-US")} splats · ${current.tree.total.toLocaleString("en-US")} pixels${current.fallback ? " · Picture unavailable; showing your word." : ""}`
          : "",
    },
    action: {
      key: "split",
      label: "Replay the last split",
      at(point) {
        const i = nearest(point);
        if (!i || i * 2 + 1 >= current.tree.size)
          return {
            key: "split",
            say: "This splat is at the finest level. Move the level dial down to split larger splats.",
          };
        const split = [...current.splits, i];
        return {
          key: "split",
          options: {
            splits: split.join(","),
            splitSource: current.label,
            splitLevel: current.level,
            lastSplit: i,
          },
          pick: i,
        };
      },
    },
    drag: {
      plane: [0, 0, 1],
      at: (point) => nearest(point) !== null,
      start(point) {
        release();
        press = { point: point.slice(), id: nearest(point), source: current };
        const held = press;
        holdTimer = setTimeout(() => {
          if (press !== held || current !== held.source || typeof document === "undefined") return;
          readout = document.createElement("output");
          readout.id = "one-splat-readout";
          readout.setAttribute("role", "status");
          readout.textContent = describe(held.id);
          Object.assign(readout.style, {
            position: "fixed",
            left: "12px",
            top: "72px",
            zIndex: "20",
            maxWidth: "calc(100vw - 24px)",
            padding: "12px",
            borderRadius: "12px",
            background: "#16232ef2",
            color: "#fff",
            font: "12px/1.6 monospace",
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
          });
          document.body.append(readout);
        }, 420);
      },
      move(point) {
        if (press && Math.hypot(point[0] - press.point[0], point[1] - press.point[1]) > 4)
          release();
      },
      end: release,
    },
    prepare(o) {
      release();
      prepareWord(o);
    },
    drive(t, c, out) {
      // The children are built in their final pose. Their morph target is
      // the parent's center: the pulse releases them smoothly from there.
      const v = Math.min(1, Math.max(0, c.split || 0));
      out.morph = [v * v * (3 - 2 * v)];
    },
    build(k, o) {
      const source = o.picture && picture?.label === o.picture ? picture : prepareWord(o);
      const level = Math.min(source.tree.levels, Math.max(0, Math.round(Number(o.level) || 0)));
      const sameLevel = Number(o.splitLevel) === level && o.splitSource === source.label;
      const refinements = sameLevel ? String(o.splits || "") : "";
      const ids = frontier(source.tree, level, refinements);
      const last = sameLevel ? Number(o.lastSplit) : 0;
      current = {
        ...source,
        ids,
        level,
        splits: refinements.split(",").map(Number).filter(Boolean),
        fallback: !!o.picture && source !== picture,
      };
      k.data ||= {};
      k.data.tree = source.tree;
      k.data.ids = ids;
      k.data.level = level;
      const position = (i) => [
        source.tree.mx[i] - source.width / 2,
        source.tree.my[i] + source.height / 2,
        0,
      ];
      k.reach([-source.width / 2, -source.height / 2, 0]);
      k.reach([source.width / 2, source.height / 2, 0]);
      // Kit counts are tier-relative; cancel that factor so one node really
      // is one Gaussian on every tier, including the 1-splat level.
      k.cloud({ count: (ids.length * 160000) / k.count, pattern: false, jitter: 0 }, (_, index) => {
        const i = ids[index],
          m = node(source.tree, i),
          e = eig(m.a, m.b, m.c);
        let color = [1, 0.38, 0.13];
        if (source.colors) {
          color = [0, 0, 0];
          for (let j = source.tree.lo[i]; j < source.tree.hi[i]; j++)
            for (let ch = 0; ch < 3; ch++)
              color[ch] += source.colors[source.tree.idx[j] * 3 + ch] / m.n;
        }
        return {
          p: position(i),
          scales: [Math.sqrt(e.l1 + DILATE), Math.sqrt(e.l2 + DILATE), 0.12],
          quat: [0, 0, Math.sin(e.theta / 2), Math.cos(e.theta / 2)],
          color,
          opacity: 0.95,
          to: last && (i === last * 2 || i === last * 2 + 1) ? position(last) : undefined,
          channel: 0,
        };
      });
    },
  },
};
