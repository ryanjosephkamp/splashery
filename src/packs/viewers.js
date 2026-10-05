// Lane Viewers (prefix vwr): two Studio tools for files people already have, on the device
// (docs/handoff/Viewers.md). Labs only.
//
// - The Splat toolkit: open a 3D Gaussian splat file (.ply, compressed .ply, .splat, .spz, .sog),
//   see its numbers, crop it with a box, remove floaters (a statistical outlier filter you tune,
//   with the removed splats shown in red or before and after side by side), shrink it to a share of
//   its splats, save it in another format, and compare two splats side by side, turning in step.
// - Point clouds: open LAS, LAZ, PLY, XYZ or PTS points, drawn as splats, colored by height,
//   intensity, classification or the file's own colors; measure a distance between two taps; crop;
//   thin; save as PLY, LAS or XYZ. Samples: USGS 3DEP lidar (public domain).
//
// The work runs in a worker (src/viewers/worker.js, src/viewers/engine.js) on every splat or point;
// the toy draws a preview within the device's budget. Nothing is uploaded.

import { PROFILES } from "../generators.js";
import { call } from "../viewers/client.js";
import { SAVE_FORMATS, extOf } from "../viewers/splat-io.js";
import { CLOUD_SAVE, CLASS_NAMES, cloudExt } from "../viewers/cloud-io.js";
import { CLASS_COLORS } from "../viewers/cloud-ops.js";

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const mb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`); // prettier-ignore
const num = (v) => {
  const a = Math.abs(v);
  return a >= 1000 ? fmt(v) : a >= 10 ? v.toFixed(1) : a >= 0.1 ? v.toFixed(2) : v.toPrecision(2);
};
const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";
const app = () => globalThis.__splashery?.app;
const exportsJS = () => import("../exports.js");

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the sample.");
  return new Uint8Array(await r.arrayBuffer());
}

// The splats a toy may draw on this device (as the player counts them).
function budgetFor(recipe, profile) {
  const prof = PROFILES[profile] || PROFILES.mid;
  return Math.round(Math.min(prof.maxCount, prof.defaultCount * (recipe.density ?? 1)) * 0.97);
}

// Global progress bar and the panel's own line, while the worker works.
function progressTo(panelLine) {
  return (f, text) => {
    if (text) panelLine?.(text);
    app()?.ui?.progress?.update?.(f, text || undefined);
  };
}

async function save(cmd, slot, format, label) {
  const a = app();
  const run = async (progress) => {
    const r = await call(cmd, { slot, format }, progress);
    const { downloadBlob } = await exportsJS();
    downloadBlob(new Blob([r.bytes], { type: "application/octet-stream" }), r.name);
    a?.ui?.toast?.(`Saved ${r.name}: ${fmt(r.count)} ${label}. It stays on this device.`, 5000);
    return r;
  };
  if (a?.withBusy) return a.withBusy("Saving…", run);
  return run(() => {});
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const btn = (id, text, onClick) => {
  const b = el("button", "", text);
  b.type = "button";
  b.id = id;
  b.addEventListener("click", onClick);
  return b;
};

// ---- Drawing helpers -----------------------------------------------------------------------------

// A dotted outline of a box (view axes, already placed): 12 edges of small round splats.
function boxOutline(k, min, max, color, part, size = 0.006) {
  const corners = [];
  for (let i = 0; i < 8; i++)
    corners.push([i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]; // prettier-ignore
  const per = 70;
  const pts = [];
  for (const [a, b] of edges)
    for (let j = 0; j <= per; j++) {
      const t = j / per;
      pts.push([0, 1, 2].map((c) => corners[a][c] + (corners[b][c] - corners[a][c]) * t));
    }
  const cnt = (pts.length * 160000) / k.count;
  k.cloud(
    { count: cnt, pattern: false, part, fit: false },
    (_r, j) =>
    j < pts.length ? { p: pts[j], scales: [size, size, size], color, opacity: 0.95, pattern: false } : null, // prettier-ignore
  );
}

// ==== The Splat toolkit ==============================================================================

const SPLAT_SAMPLES = [
  {
    id: "cactus",
    file: "../../assets/toys/cactus/cactus.sog",
    label: "Cactus (SOG)",
    title: "Cactus (3DGS sample data)",
    author: "steam studio / 3D SCAN STUDIO iris",
    source: "https://note.com/steam_studio/n/ne9736d94f162",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    id: "cactus-stray",
    file: "../../assets/toys/cactus/cactus.sog",
    stray: true,
    label: "Cactus with stray splats added (try Remove floaters)",
  },
  {
    id: "strawberry",
    file: "../../assets/toys/strawberry/strawberry.sog",
    label: "Strawberry (SOG)",
    title: "Strawberry",
    author: "Dany Bittel",
    source: "https://superspl.at/scene/84df8849",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "bee",
    file: "../../assets/toys/bee/bee.sog",
    label: "Japanese bee (SOG)",
    title: "Japanese Bee",
    author: "YUMA Co., Ltd.",
    source: "https://superspl.at/scene/ae58ed2c",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    id: "cactus-lite",
    file: "../../assets/toys/cactus/cactus-lite.sog",
    label: "Cactus, the light copy phones get (SOG)",
  },
];

const SPL = {
  files: { custom: null, custom2: null }, // { file, files, name, uid }
  uid: 0,
  opened: { a: "", b: "" }, // what each worker slot holds
  stats: { a: null, b: null },
  view: null, // { main, second } previews from the worker
  cacheKey: "",
  error: "",
  status: "",
  panel: null,
};

export const toolkitState = () => ({
  error: SPL.error,
  stats: SPL.stats.a,
  statsB: SPL.stats.b,
  main: SPL.view?.main ? { counts: SPL.view.main.counts, floater: SPL.view.main.floater, name: SPL.view.main.name } : null, // prettier-ignore
  second: SPL.view?.second ? { counts: SPL.view.second.counts, name: SPL.view.second.name } : null, // prettier-ignore
});

// Opens a file or a sample in a worker slot (a: the main splat, b: the one compared with it).
async function openSplatSource(slot, id, progress) {
  const f = id === "custom" ? SPL.files.custom : id === "custom2" ? SPL.files.custom2 : null;
  const sample = SPLAT_SAMPLES.find((s) => s.id === id);
  const k = f ? `file:${f.uid}` : sample ? `sample:${sample.id}` : "";
  if (!k) throw new Error("Open a splat file first.");
  if (SPL.opened[slot] === k) return;
  let bytes;
  let name;
  let files = null;
  if (f) {
    bytes = new Uint8Array(await f.file.arrayBuffer());
    name = f.name;
    if (f.files?.length) {
      files = new Map();
      for (const x of f.files) if (x !== f.file) files.set(x.name, new Uint8Array(await x.arrayBuffer())); // prettier-ignore
    }
  } else {
    progress?.(0, `Loading the ${sample.label.toLowerCase()}…`);
    bytes = await readBytes(sample.file);
    name = sample.file.split("/").pop();
  }
  const r = await call("open", { kind: "splat", slot, name, bytes, files, stray: !!sample?.stray }, progress, [bytes.buffer]); // prettier-ignore
  SPL.opened[slot] = k;
  SPL.stats[slot] = { ...r.stats, name: f ? f.name : sample.label };
}

// The settings the worker runs from the toy's options.
// The samples are Splashery's own files, already stored upright.
const uprightFor = (o, src) => (o.upright === "yes" ? true : o.upright === "no" ? false : !SPLAT_SAMPLES.some((x) => x.id === src)); // prettier-ignore

function splatSettings(o, src) {
  const crop = o.crop
    ? {
        x: [Math.min(o.cropX0, o.cropX1), Math.max(o.cropX0, o.cropX1)],
        y: [Math.min(o.cropY0, o.cropY1), Math.max(o.cropY0, o.cropY1)],
        z: [Math.min(o.cropZ0, o.cropZ1), Math.max(o.cropZ0, o.cropZ1)],
        invert: !!o.cropInvert,
      }
    : null;
  return {
    upright: uprightFor(o, src),
    crop,
    floaters: o.floaters
      ? { k: Number(o.neighbors) || 8, strength: Number(o.strength) || 3 }
      : null,
    faint: o.faint ? 0.02 : 0,
    shrink: o.keep < 100 ? o.keep / 100 : 1,
    show: o.show === "removed" ? "removed" : "result",
  };
}

const SPLAT_TOOLKIT = {
  density: 2.2,
  turntable: false,
  kernel: "sharp", // trained splats read crisper with the Lab's sharper falloff (as Video to 3D)
  options: [
    {
      key: "source",
      label: "Splat",
      type: "select",
      default: "cactus-stray",
      choices: [
        ...SPLAT_SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your splat (open one below)" },
      ],
    },
    {
      key: "show",
      label: "Show",
      type: "select",
      default: "split",
      choices: [
        { id: "result", label: "The result" },
        { id: "removed", label: "The result, with what is removed in red" },
        { id: "split", label: "Before and after, side by side" },
      ],
    },
    {
      key: "compare",
      label: "Compare with",
      type: "select",
      default: "off",
      choices: [
        { id: "off", label: "Nothing (one splat)" },
        ...SPLAT_SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom2", label: "Your second splat (open it below)" },
      ],
    },
    {
      key: "upright",
      label: "Turn it upright",
      type: "select",
      default: "auto",
      choices: [
        { id: "auto", label: "Automatic (most splat files are stored upside down)" },
        { id: "yes", label: "Yes, turn it over" },
        { id: "no", label: "No, as it is stored" },
      ],
    },
    { key: "floaters", label: "Remove floaters", type: "switch", default: true },
    { key: "strength", label: "Floaters: how far out (lower removes more)", type: "slider", min: 0.5, max: 6, step: 0.1, default: 3 }, // prettier-ignore
    {
      key: "neighbors",
      label: "Floaters: neighbors to compare with",
      type: "select",
      default: "8",
      choices: [
        { id: "4", label: "4 (keeps thin parts)" },
        { id: "8", label: "8" },
        { id: "16", label: "16 (smoother)" },
      ],
    },
    { key: "faint", label: "Also remove nearly invisible splats", type: "switch", default: false },
    { key: "crop", label: "Crop with a box", type: "switch", default: false },
    { key: "cropX0", label: "Box: left side", type: "slider", min: 0, max: 1, step: 0.01, default: 0 }, // prettier-ignore
    { key: "cropX1", label: "Box: right side", type: "slider", min: 0, max: 1, step: 0.01, default: 1 }, // prettier-ignore
    { key: "cropY0", label: "Box: bottom", type: "slider", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "cropY1", label: "Box: top", type: "slider", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "cropZ0", label: "Box: back", type: "slider", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "cropZ1", label: "Box: front", type: "slider", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "cropInvert", label: "Box: keep what is outside it", type: "switch", default: false },
    { key: "keep", label: "Shrink: keep this share of the splats (%)", type: "slider", min: 5, max: 100, step: 5, default: 100 }, // prettier-ignore
    { key: "fileName", label: "File", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "spin", label: "Spin", type: "pulse", ease: 3 }],
  action: { key: "spin", label: "Spin it round (both, in step)" },
  input: {
    title: "Your own splat",
    accept: ".ply,.splat,.spz,.sog,.json,.webp",
    binary: true,
    multiple: true,
    fileButton: "Open a splat file…",
    maxBytes: () => (isPhoneish() ? 400e6 : 1.5e9),
    tooBig: (cap) => `That file is over ${mb(cap)}, more than this device can work on. Try it on a computer, or open a lighter copy.`, // prettier-ignore
    note: "Opens .ply (3D Gaussian splatting, also the compressed .ply), .splat, .spz (versions 1 to 3) and .sog (a zipped .sog, or its meta.json picked together with its .webp pictures). Everything runs on this device, in the background; nothing is uploaded. The edits and Save apply to every splat in the file; the view draws as many as this device can.", // prettier-ignore
    async read(_text, fileName, file, files, progress = () => {}) {
      const picked = files?.length ? [...files] : file ? [file] : [];
      const main =
        picked.find((f) => ["ply", "splat", "spz", "sog"].includes(extOf(f.name))) ||
        picked.find((f) => f.name.toLowerCase().endsWith("meta.json"));
      if (!main)
        throw new Error(
          "Pick a .ply, .splat, .spz or .sog file (or a SOG's meta.json with its pictures).",
        );
      SPL.files.custom = { file: main, files: picked, name: main.name, uid: ++SPL.uid };
      SPL.opened.a = "";
      progress(`Reading ${main.name} (${mb(main.size)})…`);
      await openSplatSource("a", "custom", progressTo(progress));
      return { source: "custom", fileName: main.name.slice(0, 120) };
    },
    live: [{ render: () => renderToolkitPanel() }],
    shown() {
      if (SPL.error) return SPL.error;
      const s = SPL.stats.a;
      return s ? `Showing ${s.name}.` : "";
    },
  },
  credits: SPLAT_SAMPLES.filter((s) => s.license).map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
  async prepare(o, _help, { profile } = {}) {
    SPL.error = "";
    const budget = budgetFor(SPLAT_TOOLKIT, profile);
    const progress = progressTo((t) => setStatus(t));
    const src = o.source === "custom" && !SPL.files.custom ? "cactus" : o.source;
    const cmp = o.compare === "custom2" && !SPL.files.custom2 ? "off" : o.compare;
    const s = splatSettings(o, src);
    const key = JSON.stringify([src, SPL.files.custom?.uid, cmp, SPL.files.custom2?.uid, s, o.show, budget]); // prettier-ignore
    if (key === SPL.cacheKey && SPL.view) return;
    try {
      await openSplatSource("a", src, progress);
      let main;
      let second = null;
      if (o.show === "split") {
        const half = Math.floor(budget / 2);
        second = await call("applySplats", { slot: "a", settings: { ...s, crop: null, floaters: null, faint: 0, shrink: 1 }, budget: half }, progress); // prettier-ignore
        main = await call("applySplats", { slot: "a", settings: s, budget: half }, progress);
        [main, second] = [second, main]; // before on the left, after on the right
        main.label = "Before";
        second.label = "After";
      } else if (cmp !== "off") {
        await openSplatSource("b", cmp, progress);
        const half = Math.floor(budget / 2);
        main = await call("applySplats", { slot: "a", settings: s, budget: half }, progress);
        second = await call("applySplats", { slot: "b", settings: { upright: uprightFor(o, cmp), show: "result" }, budget: half }, progress); // prettier-ignore
      } else {
        main = await call("applySplats", { slot: "a", settings: s, budget }, progress);
      }
      SPL.view = { main, second, split: o.show === "split" };
      SPL.cacheKey = key;
    } catch (e) {
      SPL.error = e?.message || String(e);
      SPL.view = null;
      SPL.cacheKey = "";
    }
    setStatus("");
    SPL.panel?.refresh();
  },
  drive(t, c, out) {
    // One whole turn, easing in and out, each splat about its own middle.
    const p = 1 - (c.spin ?? 0);
    const e = (c.spin ?? 0) > 0 ? p * p * (3 - 2 * p) : 0;
    const angle = e * Math.PI * 2;
    out.parts.left = { angle };
    out.parts.right = { angle };
  },
  build(k, o) {
    k.fitOn = false;
    const v = SPL.view;
    const dual = !!v?.second;
    const left = k.part("left", { pivot: [dual ? -1.05 : 0, 0, 0], axis: [0, 1, 0] });
    if (!v?.main) {
      // Nothing to show (an error): an empty frame.
      boxOutline(k, [-0.7, -0.7, -0.7], [0.7, 0.7, 0.7], [0.55, 0.6, 0.68], left, 0.01);
      k.data = { toolkit: toolkitState() };
      return;
    }
    // Each splat turns about its own middle.
    const right = dual ? k.part("right", { pivot: [1.05, 0, 0], axis: [0, 1, 0] }) : null;
    const place = (view, part, dx, radius) => {
      const f = view.frame;
      const c = [0, 1, 2].map((a) => (f.min[a] + f.max[a]) / 2);
      const half = Math.max(...[0, 1, 2].map((a) => (f.max[a] - f.min[a]) / 2)) || 1;
      const s = radius / half;
      const m = view.main;
      const items = [[m, false]];
      if (view.red) items.push([view.red, true]);
      for (const [arr] of items) {
        const n = arr.count;
        k.cloud({ count: (n * 160000) / k.count, pattern: false, part, fit: false }, (_r, j) => {
          if (j >= n) return null;
          return {
            p: [(arr.pos[j * 3] - c[0]) * s + dx, (arr.pos[j * 3 + 1] - c[1]) * s, (arr.pos[j * 3 + 2] - c[2]) * s], // prettier-ignore
            scales: [arr.scl[j * 3] * s, arr.scl[j * 3 + 1] * s, arr.scl[j * 3 + 2] * s],
            quat: [arr.quat[j * 4], arr.quat[j * 4 + 1], arr.quat[j * 4 + 2], arr.quat[j * 4 + 3]],
            color: [arr.col[j * 3], arr.col[j * 3 + 1], arr.col[j * 3 + 2]],
            opacity: arr.op[j],
            pattern: false,
            jitter: 0,
          };
        });
      }
      if (view.crop && !(v.split && part === left)) {
        const mn = [0, 1, 2].map((a) => (view.crop.min[a] - c[a]) * s + (a === 0 ? dx : 0));
        const mx = [0, 1, 2].map((a) => (view.crop.max[a] - c[a]) * s + (a === 0 ? dx : 0));
        boxOutline(k, mn, mx, [1, 0.72, 0.15], part, 0.005);
      }
    };
    if (dual) {
      place(v.main, left, -1.05, 0.92);
      place(v.second, right, 1.05, 0.92);
    } else place(v.main, left, 0, 0.95);
    k.reach([dual ? -2 : -0.97, -0.97, -0.97]);
    k.reach([dual ? 2 : 0.97, 0.97, 0.97]);
    k.data = { toolkit: toolkitState() };
  },
};

const isPhoneish = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && typeof screen === "object" && Math.min(screen.width, screen.height) < 820; // prettier-ignore

function setStatus(text) {
  SPL.status = text || "";
  SPL.panel?.status(SPL.status);
}

// The Toy tab's panel: the numbers, a second file to compare, and Save.
function renderToolkitPanel() {
  const box = el("div", "vwr-panel");
  box.id = "vwr-toolkit";
  const stats = el("div", "note vwr-stats");
  stats.id = "vwr-stats";
  stats.style.whiteSpace = "pre-line";
  const status = el("p", "note");
  status.id = "vwr-status";
  status.setAttribute("role", "status");
  const row = el("div", "button-row");
  const second = el("input");
  second.type = "file";
  second.hidden = true;
  second.multiple = true;
  second.accept = ".ply,.splat,.spz,.sog,.json,.webp";
  second.id = "vwr-second-file";
  second.addEventListener("change", async () => {
    const picked = [...(second.files || [])];
    second.value = "";
    const main = picked.find((f) => ["ply", "splat", "spz", "sog"].includes(extOf(f.name))) || picked.find((f) => f.name.toLowerCase().endsWith("meta.json")); // prettier-ignore
    if (!main) return;
    SPL.files.custom2 = { file: main, files: picked, name: main.name, uid: ++SPL.uid };
    SPL.opened.b = "";
    await app()?.setToyOptions({ compare: "custom2" });
  });
  row.append(btn("vwr-open-second", "Open a second splat to compare…", () => second.click()));
  const saveRow = el("div", "button-row");
  const sel = el("select");
  sel.id = "vwr-save-format";
  sel.setAttribute("aria-label", "Save as");
  for (const [id, f] of Object.entries(SAVE_FORMATS)) {
    const op = el("option", "", f.label);
    op.value = id;
    sel.append(op);
  }
  saveRow.append(sel, btn("vwr-save", "Save the result…", () => save("saveSplats", "a", sel.value, "splats"))); // prettier-ignore
  const note = el("p", "note", "Save keeps every splat the crop, the filters and Shrink leave, in the format you pick, as a download on this device. The second splat of a comparison is shown as it is."); // prettier-ignore
  box.append(stats, status, row, saveRow, note, second);
  SPL.panel = {
    status(t) {
      status.textContent = t;
      status.hidden = !t;
    },
    refresh() {
      stats.textContent = toolkitText();
    },
  };
  SPL.panel.refresh();
  SPL.panel.status(SPL.status);
  return box;
}

function statsText(s) {
  if (!s) return "";
  const b = s.bounds;
  const core = s.core;
  const fmtName = { ply: s.compressed ? "compressed PLY" : "PLY", splat: ".splat", spz: "SPZ", sog: "SOG" }[s.format] || s.format; // prettier-ignore
  return [
    `${s.name} (${fmtName}, ${mb(s.fileBytes)} on disk, ${mb(s.memory)} in memory)`,
    `${fmt(s.count)} splats; view-dependent color (spherical harmonics) of degree ${s.shDegree}`,
    `Size: ${b.size.map(num).join(" × ")} (the middle 98%: ${core.size.map(num).join(" × ")}), in the file's units`, // prettier-ignore
    `Mean opacity ${(s.meanOpacity * 100).toFixed(0)}%, median splat ${num(s.medianSize)} across`,
  ].join("\n");
}

function toolkitText() {
  if (SPL.error) return SPL.error;
  const lines = [statsText(SPL.stats.a)];
  const m = SPL.view?.split ? SPL.view.second : SPL.view?.main;
  if (m) {
    const c = m.counts;
    const parts = [];
    if (c.cropped) parts.push(`${fmt(c.cropped)} cropped`);
    if (c.removed) parts.push(`${fmt(c.removed)} floaters or faint splats removed`);
    if (c.kept < c.total - c.cropped - c.removed) parts.push(`shrunk to ${fmt(c.kept)}`);
    lines.push(`Result: ${fmt(c.kept)} splats${parts.length ? ` (${parts.join(", ")})` : ""}. Drawing ${fmt(c.drawn)}${c.drawn < c.kept ? " (this device's budget; the most visible ones, a little bigger)" : ""}.`); // prettier-ignore
  }
  if (SPL.view?.second && !SPL.view.split && SPL.stats.b)
    lines.push(`Compared with: ${statsText(SPL.stats.b)}`);
  return lines.filter(Boolean).join("\n\n");
}

// ==== Point clouds ===================================================================================

export const CLOUD_SAMPLES = [
  {
    id: "palace",
    file: "../../assets/toys/point-clouds/palace.laz",
    label: "Palace of Fine Arts, San Francisco (LAZ)",
    title: "USGS 3DEP lidar, CA_SanFrancisco_1_B23 (300 m around the Palace of Fine Arts, 450,000 of its 8 million points)", // prettier-ignore
  },
  {
    id: "golden-gate",
    file: "../../assets/toys/point-clouds/golden-gate.laz",
    label: "Golden Gate Bridge's south end and Fort Point (LAZ)",
    title: "USGS 3DEP lidar, CA_SanFrancisco_1_B23 (340 m around Fort Point, 450,000 of its points)", // prettier-ignore
  },
  {
    id: "meteor-crater",
    file: "../../assets/toys/point-clouds/meteor-crater.laz",
    label: "Meteor Crater, Arizona (LAZ)",
    title: "USGS 3DEP lidar, AZ_NorthEast_3_D23 (1.6 km around Barringer meteorite crater, 450,000 of its 8.5 million points)", // prettier-ignore
  },
].map((s) => ({
  ...s,
  author: "U.S. Geological Survey, 3D Elevation Program",
  source: "https://registry.opendata.aws/usgs-lidar/",
  license: "Public domain (U.S. Government work)",
  licenseUrl:
    "https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map",
}));

const PC = {
  file: null, // { file, name, uid }
  uid: 0,
  opened: "",
  stats: null,
  spacing: 0,
  view: null,
  cacheKey: "",
  error: "",
  status: "",
  panel: null,
  frameInfo: null, // { c, s } recipe = (view - c) * s
  pins: [],
};

export const cloudState = () => ({
  error: PC.error,
  stats: PC.stats,
  counts: PC.view?.counts || null,
  colorMode: PC.view?.colorMode || null,
  pins: PC.pins,
  distance: PC.distance || null,
});

async function openCloudSource(id, progress) {
  const f = id === "custom" ? PC.file : null;
  const sample = CLOUD_SAMPLES.find((s) => s.id === id);
  const k = f ? `file:${f.uid}` : sample ? `sample:${sample.id}` : "";
  if (!k) throw new Error("Open a point cloud first.");
  if (PC.opened === k) return;
  let bytes;
  let name;
  if (f) {
    bytes = new Uint8Array(await f.file.arrayBuffer());
    name = f.name;
  } else {
    progress?.(0, "Loading the sample…");
    bytes = await readBytes(sample.file);
    name = sample.file.split("/").pop();
  }
  const r = await call("open", { kind: "cloud", slot: "a", name, bytes }, progress, [bytes.buffer]);
  PC.opened = k;
  PC.stats = { ...r.stats, name: f ? f.name : sample.label };
  PC.spacing = r.spacing;
}

// Thin choices, as multiples of the file's typical spacing.
const THIN = { off: 0, light: 1.5, medium: 3, strong: 6, heavy: 12 };

function cloudSettings(o) {
  const crop = o.crop
    ? {
        x: [Math.min(o.cropX0, o.cropX1), Math.max(o.cropX0, o.cropX1)],
        y: [Math.min(o.cropY0, o.cropY1), Math.max(o.cropY0, o.cropY1)],
        z: [Math.min(o.cropZ0, o.cropZ1), Math.max(o.cropZ0, o.cropZ1)],
        invert: !!o.cropInvert,
      }
    : null;
  return { up: upFor(o), color: o.color, crop, thin: (THIN[o.thin] || 0) * PC.spacing, shade: o.shade !== false }; // prettier-ignore
}

function upFor(o) {
  if (o.up === "y" || o.up === "z") return o.up;
  const name = o.source === "custom" ? PC.file?.name : "x.laz";
  return cloudExt(name) === "ply" ? "y" : "z";
}

// A pin's place from its option text ("x,y,z" in view axes, the file's units).
const parsePin = (s) => {
  const v = String(s || "")
    .split(",")
    .map(Number);
  return v.length === 3 && v.every(Number.isFinite) ? v : null;
};

const POINT_CLOUDS = {
  density: 3,
  turntable: false,
  // The Lab lane's sharper falloff: each point a crisp dot, not a soft blob (the owner's review).
  kernel: "sharp",
  pickAlpha: 0.02, // points are small: a tap finds them at any opacity
  options: [
    {
      key: "source",
      label: "Point cloud",
      type: "select",
      default: "palace",
      choices: [
        ...CLOUD_SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your point cloud (open one below)" },
      ],
    },
    {
      key: "color",
      label: "Color by",
      type: "select",
      default: "height",
      choices: [
        { id: "height", label: "Height" },
        { id: "intensity", label: "Intensity (how strongly each point reflected)" },
        { id: "class", label: "Classification (ground, trees, buildings…)" },
        { id: "rgb", label: "The file's own colors" },
      ],
    },
    {
      key: "shade",
      label: "Shaded relief (light from the northwest)",
      type: "switch",
      default: true,
    },
    { key: "size", label: "Point size", type: "slider", min: 0.4, max: 3, step: 0.1, default: 1 },
    { key: "measure", label: "Measure: tap two points", type: "switch", default: false },
    {
      key: "thin",
      label: "Thin",
      type: "select",
      default: "off",
      choices: [
        { id: "off", label: "Keep every point" },
        { id: "light", label: "Light (one point per 1.5 spacings)" },
        { id: "medium", label: "Medium (one per 3 spacings)" },
        { id: "strong", label: "Strong (one per 6 spacings)" },
        { id: "heavy", label: "Heavy (one per 12 spacings)" },
      ],
    },
    { key: "crop", label: "Crop with a box", type: "switch", default: false },
    { key: "cropX0", label: "Box: west side", type: "slider", min: 0, max: 1, step: 0.01, default: 0 }, // prettier-ignore
    { key: "cropX1", label: "Box: east side", type: "slider", min: 0, max: 1, step: 0.01, default: 1 }, // prettier-ignore
    { key: "cropY0", label: "Box: bottom", type: "slider", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "cropY1", label: "Box: top", type: "slider", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "cropZ0", label: "Box: north side", type: "slider", min: 0, max: 1, step: 0.01, default: 0 }, // prettier-ignore
    { key: "cropZ1", label: "Box: south side", type: "slider", min: 0, max: 1, step: 0.01, default: 1 }, // prettier-ignore
    { key: "cropInvert", label: "Box: keep what is outside it", type: "switch", default: false },
    {
      key: "up",
      label: "Up is",
      type: "select",
      default: "auto",
      choices: [
        { id: "auto", label: "Automatic (Z, or Y for PLY)" },
        { id: "z", label: "Z (lidar, surveys, most GIS)" },
        { id: "y", label: "Y (3D apps, many PLY files)" },
      ],
    },
    { key: "pinA", label: "First point", type: "text", default: "", hidden: true },
    { key: "pinB", label: "Second point", type: "text", default: "", hidden: true },
    { key: "fileName", label: "File", type: "text", default: "", hidden: true },
  ],
  controls: [
    { key: "scan", label: "Scan", type: "pulse", ease: 2.6 },
    { key: "pin", label: "Pin (Measure on: tap the points)", type: "pulse", ease: 0.3 },
  ],
  action: {
    key: "scan",
    label: "Sweep a lidar scan line over it",
    // Measure on: a tap drops a pin on the nearest drawn point (two pins make a distance).
    at(point, c) {
      void c;
      const o = PC.options;
      if (!o?.measure || !point || !PC.view) return null;
      const hit = nearestDrawn(point);
      if (!hit) return null;
      const txt = hit.map((v) => v.toFixed(3)).join(",");
      const a = parsePin(o.pinA);
      const b = parsePin(o.pinB);
      const next = !a || (a && b) ? { pinA: txt, pinB: "" } : { pinB: txt };
      return { options: next, key: "pin" };
    },
  },
  input: {
    title: "Your own point cloud",
    accept: ".las,.laz,.ply,.xyz,.pts,.txt,.csv",
    binary: true,
    fileButton: "Open a point cloud…",
    maxBytes: () => (isPhoneish() ? 300e6 : 1.2e9),
    tooBig: (cap) => `That file is over ${mb(cap)}, more than this device can work on. Try it on a computer, or thin it in another tool first.`, // prettier-ignore
    note: "Opens LAS (1.0 to 1.4), LAZ, PLY, XYZ and PTS points. It all runs on this device, in the background; nothing is uploaded. LAZ is read with laz-perf, loaded only when a .laz file is opened. Crop, Thin and Save work on every point; the view draws as many as this device can.", // prettier-ignore
    async read(_text, fileName, file, files, progress = () => {}) {
      if (!file) throw new Error("Open a point cloud file.");
      if (!["las", "laz", "ply", "xyz", "pts", "txt", "csv"].includes(cloudExt(file.name)))
        throw new Error("Pick a .las, .laz, .ply, .xyz or .pts file.");
      PC.file = { file, name: file.name, uid: ++PC.uid };
      PC.opened = "";
      progress(`Reading ${file.name} (${mb(file.size)})…`);
      await openCloudSource("custom", progressTo(progress));
      return { source: "custom", fileName: file.name.slice(0, 120), pinA: "", pinB: "" };
    },
    live: [{ render: () => renderCloudPanel() }],
    shown() {
      if (PC.error) return PC.error;
      return PC.stats ? `Showing ${PC.stats.name}.` : "";
    },
  },
  credits: CLOUD_SAMPLES.map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
  async prepare(o, _help, { profile } = {}) {
    PC.error = "";
    PC.options = o;
    const budget = budgetFor(POINT_CLOUDS, profile) - 400; // room for the pins and the box
    const progress = progressTo((t) => setCloudStatus(t));
    const src = o.source === "custom" && !PC.file ? "palace" : o.source;
    try {
      await openCloudSource(src, progress);
      const s = cloudSettings(o);
      const key = JSON.stringify([src, PC.file?.uid, s, budget]);
      if (key !== PC.cacheKey || !PC.view) {
        PC.view = await call("applyCloud", { slot: "a", settings: s, budget }, progress);
        PC.cacheKey = key;
      }
    } catch (e) {
      PC.error = e?.message || String(e);
      PC.view = null;
      PC.cacheKey = "";
    }
    setCloudStatus("");
    PC.panel?.refresh();
  },
  drive(t, c, out) {
    // The scan line crosses from one side to the other.
    const s = c.scan ?? 0;
    out.morph = [s > 0 ? 1.15 * (1 - s) : 0, 0, 0, 0];
    out.glow = [0.35, 1, 0.9, s > 0 ? 1.4 : 0];
  },
  build(k, o) {
    k.fitOn = false;
    const v = PC.view;
    PC.distance = null;
    if (!v?.main) {
      boxOutline(k, [-0.7, -0.3, -0.7], [0.7, 0.3, 0.7], [0.55, 0.6, 0.68], 0, 0.01);
      k.data = { cloud: cloudState() };
      return;
    }
    const f = v.frame;
    const c = [0, 1, 2].map((a) => (f.min[a] + f.max[a]) / 2);
    const half = Math.max(...[0, 1, 2].map((a) => (f.max[a] - f.min[a]) / 2)) || 1;
    const s = 0.95 / half;
    PC.frameInfo = { c, s };
    const m = v.main;
    const n = m.count;
    const size = Math.max(1e-4, v.spacing * s * 0.68 * (o.size || 1));
    // The scan line sweeps across from west to east, like a lidar pass over the ground.
    const lo = f.min[0];
    const span = f.max[0] - f.min[0] || 1;
    k.cloud({ count: (n * 160000) / k.count, pattern: false, fit: false }, (_r, j) => {
      if (j >= n) return null;
      const x = m.pos[j * 3];
      return {
        p: [(x - c[0]) * s, (m.pos[j * 3 + 1] - c[1]) * s, (m.pos[j * 3 + 2] - c[2]) * s],
        scales: [size, size, size],
        color: [m.col[j * 3], m.col[j * 3 + 1], m.col[j * 3 + 2]],
        opacity: 1,
        pattern: false,
        kind: "band",
        params: [(x - lo) / span, 0.035],
        channel: 0,
      };
    });
    if (v.crop) {
      const mn = [0, 1, 2].map((a) => (v.crop.min[a] - c[a]) * s);
      const mx = [0, 1, 2].map((a) => (v.crop.max[a] - c[a]) * s);
      boxOutline(k, mn, mx, [1, 0.72, 0.15], 0, 0.004);
    }
    // The measuring pins and the line between them.
    const a = o.measure ? parsePin(o.pinA) : null;
    const b = o.measure ? parsePin(o.pinB) : null;
    const toR = (p) => [0, 1, 2].map((q) => (p[q] - c[q]) * s);
    const pins = [a, b].filter(Boolean);
    PC.pins = pins;
    const pinSize = 0.012;
    for (const p of pins) {
      const r = toR(p);
      k.cloud({ count: (60 * 160000) / k.count, pattern: false, fit: false }, (rand, j) => {
        if (j >= 60) return null;
        const u = rand() * 2 - 1;
        const th = rand() * Math.PI * 2;
        const rr = Math.sqrt(1 - u * u);
        const d = pinSize * Math.cbrt(rand());
        return { p: [r[0] + d * rr * Math.cos(th), r[1] + d * u + pinSize * 1.2, r[2] + d * rr * Math.sin(th)], scales: [0.005, 0.005, 0.005], color: [1, 0.25, 0.55], opacity: 1, pattern: false }; // prettier-ignore
      });
    }
    if (a && b) {
      const ra = toR(a);
      const rb = toR(b);
      const len = Math.hypot(rb[0] - ra[0], rb[1] - ra[1], rb[2] - ra[2]);
      const dots = Math.max(8, Math.min(240, Math.round(len / 0.008)));
      k.cloud({ count: ((dots + 1) * 160000) / k.count, pattern: false, fit: false }, (_r, j) => {
        if (j > dots) return null;
        const t = j / dots;
        return { p: [0, 1, 2].map((q) => ra[q] + (rb[q] - ra[q]) * t + (q === 1 ? pinSize * 1.2 : 0)), scales: [0.0035, 0.0035, 0.0035], color: [1, 1, 1], opacity: 1, pattern: false }; // prettier-ignore
      });
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      PC.distance = { straight: Math.hypot(...d), flat: Math.hypot(d[0], d[2]), rise: d[1] };
    }
    k.reach([-0.97, -0.97, -0.97]);
    k.reach([0.97, 0.97, 0.97]);
    k.data = { cloud: cloudState() };
    if (isBrowser()) setTimeout(() => PC.panel?.refresh(), 0);
  },
};

// The drawn point nearest a tap (recipe coordinates), in view axes (the file's units).
function nearestDrawn(point) {
  const v = PC.view;
  const fi = PC.frameInfo;
  if (!v?.main || !fi) return null;
  const p = [0, 1, 2].map((q) => point[q] / fi.s + fi.c[q]);
  const m = v.main;
  let best = -1;
  let bd = Infinity;
  for (let j = 0; j < m.count; j++) {
    const d = (m.pos[j * 3] - p[0]) ** 2 + (m.pos[j * 3 + 1] - p[1]) ** 2 + (m.pos[j * 3 + 2] - p[2]) ** 2; // prettier-ignore
    if (d < bd) {
      bd = d;
      best = j;
    }
  }
  return best < 0 ? null : [m.pos[best * 3], m.pos[best * 3 + 1], m.pos[best * 3 + 2]];
}

export function cloudPinFromTap(point) {
  return nearestDrawn(point);
}

function setCloudStatus(text) {
  PC.status = text || "";
  PC.panel?.status(PC.status);
}

function renderCloudPanel() {
  const box = el("div", "vwr-panel");
  box.id = "vwr-cloud";
  const stats = el("div", "note vwr-stats");
  stats.id = "vwr-cloud-stats";
  stats.style.whiteSpace = "pre-line";
  const dist = el("p", "note");
  dist.id = "vwr-distance";
  dist.style.fontWeight = "600";
  const legend = el("div", "note vwr-legend");
  legend.id = "vwr-legend";
  const status = el("p", "note");
  status.id = "vwr-cloud-status";
  status.setAttribute("role", "status");
  const saveRow = el("div", "button-row");
  const sel = el("select");
  sel.id = "vwr-cloud-format";
  sel.setAttribute("aria-label", "Save as");
  for (const [id, f] of Object.entries(CLOUD_SAVE)) {
    const op = el("option", "", f.label);
    op.value = id;
    sel.append(op);
  }
  saveRow.append(sel, btn("vwr-cloud-save", "Save the points…", () => save("saveCloud", "a", sel.value, "points"))); // prettier-ignore
  const clear = btn("vwr-clear-pins", "Clear the pins", () => app()?.setToyOptions({ pinA: "", pinB: "" })); // prettier-ignore
  const pinRow = el("div", "button-row");
  pinRow.append(clear);
  const note = el("p", "note", "Save keeps every point the crop and Thin leave, with its classification, intensity and colors, in the file's own coordinates (LAS and PLY keep them to the millimeter)."); // prettier-ignore
  box.append(dist, pinRow, stats, legend, status, saveRow, note);
  PC.panel = {
    status(t) {
      status.textContent = t;
      status.hidden = !t;
    },
    refresh() {
      stats.textContent = cloudText();
      const d = PC.distance;
      const o = PC.options || {};
      dist.hidden = !o.measure;
      pinRow.hidden = !o.measure || !PC.pins.length;
      dist.textContent = !o.measure
        ? ""
        : d
          ? `Distance: ${num(d.straight)} (${num(d.flat)} along the ground, ${d.rise >= 0 ? "up" : "down"} ${num(Math.abs(d.rise))})${unitWord()}.` // prettier-ignore
          : PC.pins.length
            ? "Now tap a second point."
            : "Tap a point to drop the first pin.";
      legend.replaceChildren();
      if (PC.view?.colorMode === "class" && PC.stats?.classes) {
        const entries = Object.entries(PC.stats.classes).sort((x, y) => y[1] - x[1]);
        for (const [k, cnt] of entries) {
          const item = el("span", "vwr-class");
          item.style.marginRight = "10px";
          item.style.display = "inline-block";
          const sw = el("span");
          const col = CLASS_COLORS[k] || [0.6, 0.6, 0.6];
          sw.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;background:rgb(${col.map((v) => Math.round(v * 255)).join(",")})`; // prettier-ignore
          item.append(sw, `${CLASS_NAMES[k] || `Class ${k}`} (${fmt(cnt)})`);
          legend.append(item);
        }
      } else if (PC.view && PC.view.colorMode !== (PC.options?.color || "height")) {
        legend.textContent = `This file has no ${{ rgb: "colors", intensity: "intensity", class: "classification" }[PC.options?.color] || "such values"}, so it is colored by height.`; // prettier-ignore
      }
    },
  };
  PC.panel.refresh();
  PC.panel.status(PC.status);
  return box;
}

function unitWord() {
  const crs = PC.stats?.info?.crs || "";
  if (/UTM|metre|meter|EPSG:326|EPSG:327|EPSG:269/i.test(crs)) return " meters";
  if (/ft|feet|foot/i.test(crs)) return " feet";
  return " (the file's units)";
}

function cloudText() {
  if (PC.error) return PC.error;
  const s = PC.stats;
  if (!s) return "";
  const b = s.bounds;
  const info = s.info || {};
  const kind = s.format === "las" || s.format === "laz" ? `${s.format.toUpperCase()} ${info.version}, point format ${info.pointFormat}` : s.format.toUpperCase(); // prettier-ignore
  const has = [s.has.intensity && "intensity", s.has.cls && "classification", s.has.color && "colors"].filter(Boolean); // prettier-ignore
  const lines = [
    `${s.name} (${kind}, ${mb(s.fileBytes)} on disk, ${mb(s.memory)} in memory)`,
    `${fmt(s.count)} points${has.length ? `, with ${has.join(", ")}` : ""}`,
    `Size: ${b.size.map(num).join(" × ")}${unitWord()}; about ${num(s.density)} points a square unit from above`, // prettier-ignore
  ];
  if (info.crs) lines.push(`Coordinates: ${info.crs}`);
  const c = PC.view?.counts;
  if (c) {
    const parts = [];
    if (c.cropped) parts.push(`${fmt(c.cropped)} cropped`);
    if (c.thinned) parts.push(`${fmt(c.thinned)} thinned`);
    lines.push(`Result: ${fmt(c.kept)} points${parts.length ? ` (${parts.join(", ")})` : ""}. Drawing ${fmt(c.drawn)}${c.drawn < c.kept ? " (this device's budget)" : ""}.`); // prettier-ignore
  }
  return lines.join("\n");
}

export const RECIPES = {
  "splat-toolkit": SPLAT_TOOLKIT,
  "point-clouds": POINT_CLOUDS,
};
