// Video to 3D (lane Video 3D, prefix v3d): the "Video to 3D" toy, on the Studio shelf (labs). A
// one-week spike (docs/lab/VIDEO3D.md). Open a video in the Toy tab and choose a stretch of it: the
// sharpest frames of the stretch are picked, Splat.js (vendor/splatjs/, MIT) works out where the
// camera was for each one and trains 3D Gaussian splats until the scene looks right from each of
// those places, all on this device through WebGPU. The result is shown as the toy's splats: turn
// it, zoom, save it as a PLY, or tap Replay flight to fly the video's own camera path with its
// sound. Scenes that stand still work; moving cars and people blur or vanish.
//
// Nothing heavy loads before a video is opened: src/video3d/run.js imports Splat.js then. The
// samples (assets/toys/video-3d/) are results made the same way from three CC0 or CC BY clips.

import { readSplatPly } from "../video3d/ply.js";
import { sceneFrame, splatsInFrame, toyCamera, pruneSplats } from "../video3d/scene.js";
import { SAMPLES } from "../video3d/samples.js";
import { makeFlight } from "../video3d/flight.js";
import { GUIDE_NOTE } from "../video3d/guide.js";

const V3D = {
  file: null, // the video somebody opened (a File; it stays on the device)
  fileUid: 0,
  videoName: "",
  duration: 0,
  custom: null, // the trained result for the open video: { key, scene, cams, stats, ply, name }
  samples: new Map(), // sample id -> { scene, cams, name, sample }
  want: null,
  error: "",
  info: null,
  flight: null,
};

export const video3dState = () => ({ ...V3D.info, error: V3D.error });

// The last trained result of a video somebody opened (for tools/v3d-sample.mjs and the tests).
export const video3dResult = () => V3D.custom;

// A trained PLY and its solved cameras as the toy's scene: the splats and the camera path in the
// toy's frame. cams: [{ time, R, t }].
export function sceneFromPly(bytes, cams, keep = 400000) {
  const raw = readSplatPly(bytes, keep);
  const frame = sceneFrame(raw, cams);
  const framed = splatsInFrame(frame, raw);
  // globalThis.__v3dNoPrune (tools/v3d-clip.mjs --prune=0) shows the scene as trained, for a
  // before-and-after.
  const path = cams.map((c) => ({ time: c.time, f: c.f, w: c.w, h: c.h, ...toyCamera(frame, c) }));
  const pruned = globalThis.__v3dNoPrune
    ? null
    : pruneSplats(
        framed,
        undefined,
        path.map((c) => c.pos),
      );
  const scene = pruned ? pruned.scene : framed;
  return { scene, path, pruned: pruned?.removed || null };
}

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

async function loadSample(id) {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
  if (!s) return null;
  if (!V3D.samples.has(s.id)) {
    const [ply, json] = await Promise.all([
      readBytes(`../../assets/toys/video-3d/${s.id}.ply`),
      readBytes(`../../assets/toys/video-3d/${s.id}.json`),
    ]);
    const meta = JSON.parse(new TextDecoder().decode(json));
    const { scene, path } = sceneFromPly(ply, meta.cams);
    V3D.samples.set(s.id, { scene, path, name: s.label, stats: meta.stats, sample: s, uid: s.id });
  }
  return V3D.samples.get(s.id);
}

const fmt = (n) => Math.round(n).toLocaleString("en-US");

// The settings somebody can pick (frames.js TIERS); "auto" is phone-safe on a phone and the
// device's own tier elsewhere.
const SETTING_LABELS = {
  phone: "Phone-safe",
  low: "Light",
  mid: "Standard",
  high: "High",
  max: "Highest",
};

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

// Trains the open video's chosen stretch (browser only), showing the progress card.
async function trainVideo(o, key) {
  const [{ videoTo3D }, { progressCard }, { detectProfile }, { downloadBlob }] = await Promise.all([
    import("../video3d/run.js"),
    import("../video3d/panel.js"),
    import("../player.js"),
    import("../exports.js"),
  ]);
  const { isPhone, estimateMinutes } = await import("../video3d/run.js");
  const { tierSettings } = await import("../video3d/frames.js");
  const card = progressCard();
  card.reset(`${V3D.videoName}: ${o.length} s from ${o.start} s`);
  // The setting: phone-safe on a phone unless somebody picks another (r7).
  const phone = isPhone();
  const profile = globalThis.window?.__splashery?.player?.profile || detectProfile();
  const tier = !o.setting || o.setting === "auto" ? (phone ? "phone" : profile) : o.setting;
  const set = { ...tierSettings(tier), ...(globalThis.__v3dSettings || {}) };
  const [lo, hi] = estimateMinutes(tier, set);
  const label = SETTING_LABELS[tier] || tier;
  const plan = `${label}: up to ${set.maxFrames} frames, ${fmt(set.iters)} training steps, up to ${fmt(set.splats)} splats. A rough guess: ${lo} to ${hi} minutes.`; // prettier-ignore
  const warn = phone
    ? ` On a phone it gets warm. Keep this tab open and the phone plugged in if you can${tier === "phone" ? `; training stops by itself after ${set.maxMinutes} minutes and keeps what it has` : ". A heavier setting than phone-safe can make a phone hot and slow"}. Finish now keeps what has been trained.` // prettier-ignore
    : "";
  // A phone asks first (the tools that train the samples skip it).
  if (phone && !globalThis.__v3dSettings) {
    const go = await card.confirm(plan + warn);
    if (!go) {
      V3D.error = "Not started.";
      card.fail("Not started. Pick a stretch or a setting and open the video again.", { advice: false }); // prettier-ignore
      return null;
    }
  }
  card.planLine(plan);
  const ctrl = new AbortController();
  card.stopButton(() => ctrl.abort());
  try {
    const r = await videoTo3D(V3D.file, {
      start: Number(o.start),
      length: Number(o.length),
      rate: Number(o.rate),
      tier,
      settings: globalThis.__v3dSettings || null, // tools/v3d-sample.mjs
      signal: ctrl.signal,
      preview: card.preview,
      onProgress: (e) => card.progress(e),
    });
    const { scene, path } = sceneFromPly(r.ply, r.cams);
    V3D.custom = { key, scene, path, stats: r.stats, timings: r.timings, ply: r.ply, cams: r.cams, log: r.log, name: V3D.videoName, uid: key }; // prettier-ignore
    V3D.error = "";
    const base = (V3D.videoName || "video").replace(/[^\w-]+/g, "-").slice(0, 40);
    card.done(r, {
      onSave: () => downloadBlob(new Blob([r.ply], { type: "application/octet-stream" }), `${base}-splats.ply`), // prettier-ignore
    });
    return V3D.custom;
  } catch (e) {
    V3D.error = e?.name === "AbortError" ? "Stopped." : e?.message || String(e);
    // What makes a video work, unless the video was not the trouble (no WebGPU, or stopped).
    card.fail(V3D.error, { advice: e?.name !== "AbortError" && !/WebGPU|graphics card|play that video/.test(V3D.error) }); // prettier-ignore
    return null;
  }
}

// Opens a video somebody picked: reads its length (the stretch is chosen in the Toy tab).
export async function openVideoFile(file, name) {
  const { openVideo, closeVideo } = await import("../video3d/extract.js");
  const v = await openVideo(file);
  closeVideo(v);
  V3D.file = file;
  V3D.fileUid++;
  V3D.videoName = name;
  V3D.duration = v.duration;
  V3D.custom = null;
  return { duration: v.duration, width: v.width, height: v.height };
}

// A stand-in when there is nothing to show yet: a strip of film.
function buildFilmStrip(k) {
  const W = 1.6;
  const H = 0.9;
  k.cloud({ share: 0.98, pattern: false }, (rand) => {
    const x = (rand() - 0.5) * W;
    const y = (rand() - 0.5) * H;
    const band = Math.abs(y) > H * 0.36;
    const hole = band && (((x / W) * 14 + 100) % 1) < 0.45 && Math.abs(Math.abs(y) - H * 0.43) < 0.03; // prettier-ignore
    if (hole) return null;
    const frame = !band && ((((x + W / 2) / W) * 3) % 1 < 0.04 || false);
    const c = band || frame ? [0.12, 0.12, 0.13] : [0.55 + 0.2 * (y / H), 0.62, 0.72 - 0.2 * (y / H)]; // prettier-ignore
    return { p: [x, y, 0], n: [0, 0, 1], size: 1.1, flat: 0.2, color: c, opacity: 0.95, jitter: 0 };
  });
}

const VIDEO_3D = {
  density: 1.6,
  turntable: false,
  // The Lab lane's sharper falloff (labs only, docs/lab/KERNELS.md): trained splats read crisper
  // with it, edge sharpness +20% to +63% on the samples' flights (docs/lab/VIDEO3D.md).
  kernel: "sharp",
  options: [
    {
      key: "source",
      label: "Scene",
      type: "select",
      default: SAMPLES[0]?.id || "custom",
      choices: [
        ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
        { id: "custom", label: "Your video (open one below)" },
      ],
    },
    { key: "start", label: "Start (s)", type: "slider", min: 0, max: 300, step: 1, default: 0 },
    {
      key: "length",
      label: "Length",
      type: "select",
      default: "10",
      choices: [
        { id: "5", label: "5 seconds" },
        { id: "10", label: "10 seconds" },
        { id: "20", label: "20 seconds" },
        { id: "40", label: "40 seconds" },
      ],
    },
    {
      key: "rate",
      label: "Frames a second",
      type: "select",
      default: "3",
      choices: [
        { id: "2", label: "2 a second" },
        { id: "3", label: "3 a second" },
        { id: "4", label: "4 a second" },
        { id: "6", label: "6 a second" },
      ],
    },
    {
      key: "setting",
      label: "Setting",
      type: "select",
      default: "auto",
      choices: [
        { id: "auto", label: "Automatic (phone-safe on a phone)" },
        { id: "phone", label: "Phone-safe (quickest, softest)" },
        { id: "mid", label: "Standard" },
        { id: "high", label: "High (a computer with a graphics card)" },
      ],
    },
    { key: "videoName", label: "Video name", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "replay", label: "Replay flight", type: "toggle", default: 0, ease: 0.6 }],
  action: { key: "replay", label: "Replay flight" },
  input: {
    title: "Your own video",
    accept: "video/*,.mp4,.m4v,.mov,.webm",
    binary: true,
    fileButton: "Open a video…",
    note: GUIDE_NOTE,
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a video.");
      const name = (file.name || fileName || "Your video").replace(/\.[^.]+$/, "");
      await openVideoFile(file, name);
      return { source: "custom", videoName: name };
    },
    shown() {
      const i = V3D.info;
      if (V3D.error) return `The last run did not finish: ${V3D.error}`;
      if (!i) return "";
      if (i.placeholder) return "Open a video to see it rebuilt here.";
      const s = i.stats || {};
      const took = i.timings?.total ? ` in ${i.timings.total.toFixed(0)} s` : "";
      return `${i.name}: ${fmt(i.splats)} splats from ${s.frames ?? "?"} frames (${s.registered ?? "?"} placed)${took}.`; // prettier-ignore
    },
  },
  credits: SAMPLES.map((s) => ({
    label: s.label,
    title: s.title,
    source: s.source,
    author: s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
  async prepare(o) {
    V3D.want = null;
    if (o.source === "custom" && V3D.file && isBrowser()) {
      const key = `${V3D.fileUid}/${o.start}/${o.length}/${o.rate}/${o.setting || "auto"}`;
      if (V3D.custom?.key !== key) await trainVideo(o, key);
      if (V3D.custom?.key === key) V3D.want = V3D.custom;
    }
    if (!V3D.want && SAMPLES.length) {
      try {
        V3D.want = await loadSample(o.source === "custom" ? SAMPLES[0].id : o.source);
      } catch {
        V3D.want = null;
      }
    }
  },
  drive(t, c, out, info) {
    info?.data?.flight?.(c.replay ?? 0, info);
  },
  build(k, o) {
    V3D.flight?.dispose?.();
    V3D.flight = null;
    const src = V3D.want;
    if (!src) {
      buildFilmStrip(k);
      V3D.info = { placeholder: true, splats: 0 };
      k.data = { video: V3D.info };
      return;
    }
    const s = src.scene;
    k.fitOn = false; // the scene and its camera path share the frame scene.js made
    const budget = Math.max(100, Math.floor(k.count * 0.98));
    const n = Math.min(s.count, budget);
    // A budget below the scene's size keeps an even share of it.
    const step = s.count / n;
    const picked = { near: [], far: [] };
    for (let j = 0; j < n; j++) {
      const i = Math.floor(j * step);
      (s.outer?.[i] ? picked.far : picked.near).push(i);
    }
    const splat = (i) => ({
      p: [s.pos[i * 3], s.pos[i * 3 + 1], s.pos[i * 3 + 2]],
      scales: [s.scales[i * 3], s.scales[i * 3 + 1], s.scales[i * 3 + 2]],
      quat: [s.quat[i * 4], s.quat[i * 4 + 1], s.quat[i * 4 + 2], s.quat[i * 4 + 3]],
      color: [s.color[i * 3], s.color[i * 3 + 1], s.color[i * 3 + 2]],
      opacity: s.opacity[i],
      pattern: false,
    });
    const per = 160000 / k.count; // a cloud's count is given per 160,000 of the budget
    k.cloud({ count: picked.near.length * per, pattern: false }, (_r, j) =>
      j < picked.near.length ? splat(picked.near[j]) : null,
    );
    // The far shell (water, skyline, sky, pulled in between radius 1 and 2) sits outside the fit.
    if (picked.far.length)
      k.cloud({ count: picked.far.length * per, pattern: false, fit: false }, (_r, j) =>
        j < picked.far.length ? splat(picked.far[j]) : null,
      );
    V3D.info = {
      name: src.name,
      uid: src.uid,
      splats: n,
      cams: src.path.length,
      custom: src === V3D.custom,
      stats: src.stats,
      timings: src.timings,
    };
    k.data = { video: V3D.info };
    if (isBrowser() && src.path.length) {
      V3D.flight = makeFlight(src.path, src === V3D.custom ? { file: V3D.file } : null);
      k.data.flight = V3D.flight;
      // A frame soon after, so the flight's drive can open the view where the video starts.
      setTimeout(() => window.__splashery?.player?.stage?.requestRender?.(), 1000);
    }
  },
};

export const RECIPES = {
  "video-3d": VIDEO_3D,
};
