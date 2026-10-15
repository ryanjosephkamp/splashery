// Video to 3D (lane Video 3D, prefix v3d): the "Video to 3D" toy, on the Studio shelf (labs). A
// one-week spike (docs/lab/VIDEO3D.md). Open a video in the Toy tab and choose a stretch of it: the
// sharpest frames of the stretch are picked, Splat.js (vendor/splatjs/, MIT) works out where the
// camera was for each one and trains 3D Gaussian splats until the scene looks right from each of
// those places, all on this device through WebGPU. The result is shown as the toy's splats: turn
// it, zoom, save it as a PLY, or tap Replay flight to fly the video's own camera path with its
// sound. Scenes that stand still work; moving cars and people blur or vanish.
//
// Nothing heavy loads before a video is opened: src/video3d/run.js imports Splat.js then. The
// samples (assets/toys/video-3d/) are real results with source credits and compatible CC licenses.

import { readSplatPly } from "../video3d/ply.js";
import { readBakedScene } from "../video3d/baked.js";
import { sceneFrame, splatsInFrame, toyCamera, pruneSplats } from "../video3d/scene.js";
import { SAMPLES } from "../video3d/samples.js";
import { makeFlight } from "../video3d/flight.js";
import { GUIDE_NOTE } from "../video3d/guide.js";
import { cleanScene } from "../video3d/cleanup.js";
import { mountWalk } from "../video3d/walk.js";
import { buildWalkRegion } from "../video3d/region.js";
import { mountSceneCredit } from "../video3d/credit.js";
import { sampleBudget, phoneSample } from "../video3d/tiers.js";
import { pausePreviousView } from "../video3d/pause-view.js";

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

export const video3dState = () => ({ ...V3D.info, error: V3D.error, suitability: V3D.suitability });

// The last trained result of a video somebody opened (for tools/v3d-sample.mjs and the tests).
export const video3dResult = () => V3D.custom;

// A trained PLY and its solved cameras as the toy's scene: the splats and the camera path in the
// toy's frame. cams: [{ time, R, t }].
export function sceneFromPly(
  bytes,
  cams,
  keep = 400000,
  { affine = false, preservePhotometric = false } = {},
) {
  const raw = readSplatPly(bytes, keep);
  return sceneFromSplats(raw, cams, { affine, preservePhotometric });
}

export function sceneFromSplats(raw, cams, { affine = false, preservePhotometric = false } = {}) {
  const frame = sceneFrame(raw, cams);
  const framed = splatsInFrame(frame, raw, { contract: !affine && !preservePhotometric });
  // globalThis.__v3dNoPrune (tools/v3d-clip.mjs --prune=0) shows the scene as trained, for a
  // before-and-after.
  const path = cams.map((c) => ({ time: c.time, f: c.f, w: c.w, h: c.h, ...toyCamera(frame, c) }));
  const pruned = globalThis.__v3dNoPrune
    ? null
    : pruneSplats(
        framed,
        // A measured opaque bake needs its fitted broad surface Gaussians. Absolute world-size
        // cuts can remove the surface base and expose floaters and the background. Keep the
        // faint/near-camera and subsequent geometric support/ray guards for these models.
        preservePhotometric
          ? { faint: 0.008, smearSize: Infinity, smearOpacity: 0.4, giant: Infinity }
          : undefined,
        path.map((c) => c.pos),
      );
  const cleaned = globalThis.__v3dNoPrune
    ? null
    : cleanScene(pruned ? pruned.scene : framed, path, { affine, preservePhotometric });
  const scene = cleaned?.scene || framed;
  const domeCenter =
    affine && path.length
      ? [0, 1, 2].map((k) => path.reduce((n, c) => n + c.pos[k], 0) / path.length)
      : [0, 0, 0];
  let domeRadius = 4;
  for (let i = 0; i < scene.count; i++)
    domeRadius = Math.max(
      domeRadius,
      Math.hypot(...[0, 1, 2].map((k) => scene.pos[i * 3 + k] - domeCenter[k])) * 1.1,
    );
  domeRadius = Math.min(160, domeRadius); // The stage's unchanged far clip is 200.
  return {
    scene,
    path,
    pruned: { ...pruned?.removed, ...cleaned?.removed },
    sky: cleaned?.sky,
    skyCount: cleaned?.skyCount || 0,
    dome: { center: domeCenter, radius: domeRadius },
    clamped: cleaned?.clamped || 0,
    affine,
    preservePhotometric,
    region: affine ? buildWalkRegion(scene, path) : null,
  };
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

async function loadSample(id, navigation, budget = 400000) {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES[0];
  if (!s) return null;
  const key = `${s.id}/${navigation === "walk" ? "walk" : "orbit"}/${budget}`;
  if (!V3D.samples.has(key)) {
    const [raw, json] = await Promise.all([
      s.baked
        ? readBakedScene(new URL(`../../assets/toys/video-3d/${s.baked}`, import.meta.url), budget)
        : readBytes(`../../assets/toys/video-3d/${s.id}.ply`).then((bytes) => readSplatPly(bytes)),
      readBytes(`../../assets/toys/video-3d/${s.id}.json`),
    ]);
    const baseMeta = JSON.parse(new TextDecoder().decode(json));
    const meta = raw.tierRole === "desktop" && baseMeta.desktop ? baseMeta.desktop : baseMeta;
    const framed = sceneFromSplats(raw, meta.cams, {
      affine: navigation === "walk",
      preservePhotometric: !!meta.bake?.clarity?.opaque || meta.bake?.backend === "msplat/Metal",
    });
    V3D.samples.set(key, { ...framed, name: s.label, stats: meta.stats, sample: s, uid: s.id });
  }
  return V3D.samples.get(key);
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

// A file operation belongs to the toy/source that opened it. A newer load also invalidates
// the old operation when someone leaves and returns before the next check tick.
function watchChoice(ctrl) {
  const player = globalThis.window?.__splashery?.player;
  const id = player?.scene?.toy?.id;
  const source = player?.scene?.toy?.options?.source || SAMPLES[0]?.id;
  const token = player?.loadToken;
  const matches = () => {
    if (!player) return true;
    const live = globalThis.window?.__splashery?.player;
    return (
      live === player &&
      live.scene?.toy?.id === id &&
      (live.scene?.toy?.options?.source || SAMPLES[0]?.id) === source &&
      (token == null || live.loadToken === token)
    );
  };
  const timer =
    ctrl &&
    setInterval(() => {
      if (!matches()) ctrl.abort();
    }, 100);
  return { matches, dispose: () => clearInterval(timer) };
}

// Trains the open video's chosen stretch (browser only), showing the progress card.
async function trainVideo(o, key) {
  V3D.trainCtrl?.abort();
  const ctrl = new AbortController();
  V3D.trainCtrl = ctrl;
  const file = V3D.file;
  const name = V3D.videoName;
  const choice = watchChoice(ctrl);
  const current = () => V3D.trainCtrl === ctrl && file === V3D.file && choice.matches();
  let releaseView = () => {};
  let card;
  try {
    const [{ videoTo3D }, { progressCard }, { detectProfile }, { downloadBlob }] =
      await Promise.all([
        import("../video3d/run.js"),
        import("../video3d/panel.js"),
        import("../player.js"),
        import("../exports.js"),
      ]);
    const { isPhone, estimateMinutes, webgpuStatus } = await import("../video3d/run.js");
    const { tierSettings } = await import("../video3d/frames.js");
    card = progressCard();
    if (!current()) return null;
    card.reset(`${V3D.videoName}: ${o.length} s from ${o.start} s`);
    const { checkVideo } = await import("../video3d/suitability.js");
    const checkKey = `${V3D.fileUid}/${o.start}/${o.length}`;
    if (V3D.checkKey !== checkKey) {
      const checked = await checkVideo(file, {
        start: Number(o.start),
        length: Number(o.length),
        signal: ctrl.signal,
      });
      if (!current()) return null;
      V3D.suitability = checked;
      V3D.checkKey = checkKey;
    }
    card.assessment(V3D.suitability);
    const gpu = await webgpuStatus();
    if (!current()) return null;
    if (!gpu.ok) {
      V3D.error = gpu.reason;
      card.fail(`${gpu.reason} You can still explore the baked samples.`, { advice: false });
      return null;
    }
    // The setting: phone-safe on a phone unless somebody picks another (r7).
    const phone = isPhone();
    const profile = globalThis.window?.__splashery?.player?.profile || detectProfile();
    const tier = !o.setting || o.setting === "auto" ? (phone ? "phone" : profile) : o.setting;
    const set = { ...tierSettings(tier), ...(globalThis.__v3dSettings || {}) };
    const [lo, hi] = estimateMinutes(tier, set);
    const label = SETTING_LABELS[tier] || tier;
    const plan = `${label}: up to ${set.maxFrames} frames, ${fmt(set.iters)} training steps, up to ${fmt(set.splats)} splats. A rough guess: ${lo} to ${hi} minutes. Training keeps the result after ${set.maxMinutes ?? 15} minutes on a slower device.`; // prettier-ignore
    const warn = phone
      ? ` On a phone it gets warm. Keep this tab open and the phone plugged in if you can${tier === "phone" ? `; training stops by itself after ${set.maxMinutes} minutes and keeps what it has` : ". A heavier setting than phone-safe can make a phone hot and slow"}. Finish now keeps what has been trained.` // prettier-ignore
      : "";
    // A phone asks first (the tools that train the samples skip it).
    if ((phone || V3D.suitability?.verdict !== "promising") && !globalThis.__v3dSettings) {
      const go = await card.confirm(plan + warn, { signal: ctrl.signal });
      if (!current()) return null;
      if (!go) {
        V3D.error = "Not started.";
        card.fail("Not started. Pick a stretch or a setting and open the video again.", { advice: false }); // prettier-ignore
        return null;
      }
    }
    card.planLine(plan);
    card.stopButton(() => ctrl.abort());
    releaseView = pausePreviousView(window.__splashery?.player, { signal: ctrl.signal });
    const r = await videoTo3D(file, {
      start: Number(o.start),
      length: Number(o.length),
      rate: Number(o.rate),
      tier,
      settings: globalThis.__v3dSettings || null, // tools/v3d-sample.mjs
      signal: ctrl.signal,
      preview: card.preview,
      onProgress: (e) => {
        if (current()) card.progress(e);
      },
    });
    if (!current()) return null;
    const framed = sceneFromPly(r.ply, r.cams, undefined, { preservePhotometric: true });
    V3D.custom = { key, ...framed, stats: r.stats, timings: r.timings, ply: r.ply, cams: r.cams, log: r.log, name, uid: key }; // prettier-ignore
    V3D.error = "";
    const base = (V3D.videoName || "video").replace(/[^\w-]+/g, "-").slice(0, 40);
    card.done(r, {
      onSave: () => downloadBlob(new Blob([r.ply], { type: "application/octet-stream" }), `${base}-splats.ply`), // prettier-ignore
    });
    return V3D.custom;
  } catch (e) {
    if (!current()) return null;
    V3D.error = e?.name === "AbortError" ? "Stopped." : e?.message || String(e);
    // What makes a video work, unless the video was not the trouble (no WebGPU, or stopped).
    card?.fail(V3D.error, { advice: e?.name !== "AbortError" && !/WebGPU|graphics card|play that video/.test(V3D.error) }); // prettier-ignore
    return null;
  } finally {
    releaseView();
    choice.dispose();
    if (V3D.trainCtrl === ctrl && !choice.matches()) {
      V3D.trainCtrl = null;
      if (card) card.root.hidden = true;
    }
  }
}

// Opens a video somebody picked: reads its length (the stretch is chosen in the Toy tab).
export async function openVideoFile(file, name) {
  V3D.trainCtrl?.abort();
  V3D.trainCtrl = null;
  V3D.checkCtrl?.abort();
  const ctrl = new AbortController();
  V3D.checkCtrl = ctrl;
  const choice = watchChoice(ctrl);
  const current = () => V3D.checkCtrl === ctrl && !ctrl.signal.aborted && choice.matches();
  const releaseView = pausePreviousView(window.__splashery?.player, { signal: ctrl.signal });
  let card;
  try {
    const [{ checkVideo }, { progressCard }] = await Promise.all([
      import("../video3d/suitability.js"),
      import("../video3d/panel.js"),
    ]);
    if (!current()) throw new DOMException("Stopped", "AbortError");
    card = progressCard();
    card.reset("Checking a few frames on this device…");
    V3D.error = "";
    const options =
      window.__splashery?.app?.scene?.toy?.options ||
      window.__splashery?.player?.scene?.toy?.options ||
      {};
    const v = await checkVideo(file, {
      start: Number(options.start || 0),
      length: Number(options.length || 10),
      signal: ctrl.signal,
    });
    if (!current()) throw new DOMException("Stopped", "AbortError");
    card.assessment(v);
    if (v.unplayable) {
      V3D.error = v.diagnostic;
      card.fail(V3D.error, { advice: false });
      throw new Error(V3D.error);
    }
    V3D.trainCtrl?.abort();
    V3D.trainCtrl = null;
    if (V3D.fileUrl) URL.revokeObjectURL(V3D.fileUrl);
    V3D.fileUrl = null;
    // The old model may remain visible while its replacement trains. Its original must not
    // be resolved as a baked sample after the old custom result is released.
    V3D.shown = null;
    V3D.cardKey = null;
    V3D.compare?.original?.("video-3d")?.hide?.();
    V3D.file = file;
    V3D.fileUid++;
    V3D.videoName = name;
    V3D.duration = v.duration;
    V3D.suitability = v;
    V3D.checkKey = `${V3D.fileUid}/${options.start || 0}/${options.length || 10}`;
    V3D.custom = null;
    V3D.customWalk = null;
    return { duration: v.duration, suitability: v };
  } catch (error) {
    if (error?.name === "AbortError" && V3D.checkCtrl === ctrl) {
      V3D.checkCtrl = null;
      if (card) card.root.hidden = true;
    }
    throw error;
  } finally {
    releaseView();
    choice.dispose();
  }
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

// Studio media: "Show the original". The sample's own span of the video (480p, in MP4 and WebM), or the
// video somebody opened, in a corner card (src/compare.js, loaded only when it is switched on), at the
// time the flight is at: playing while Replay flight plays, holding when it holds, the start otherwise.
const ORIG_TYPES = { mp4: 'video/mp4; codecs="avc1.42E01E"', webm: 'video/webm; codecs="vp9"' };
const originalSources = (src) =>
  src.uid === V3D.custom?.uid
    ? V3D.file
      ? [{ url: (V3D.fileUrl ||= URL.createObjectURL(V3D.file)), type: V3D.file.type || ORIG_TYPES.mp4 }]
      : []
    : ["mp4", "webm"].map((e) => ({ url: new URL(`../../assets/toys/video-3d/${src.uid}-source.${e}`, import.meta.url).href, type: ORIG_TYPES[e] })); // prettier-ignore
function showOriginal(flight, walk = null) {
  if (!isBrowser()) return;
  const mod = V3D.compare;
  if (!V3D.original || !V3D.shown) {
    if (mod) mod.original("video-3d").hide();
    V3D.cardKey = null;
    return;
  }
  if (!mod) {
    V3D.compare = false;
    import("../compare.js").then((m) => (V3D.compare = m));
    return;
  }
  if (!mod.original) return;
  const card = mod.original("video-3d");
  const src = V3D.shown;
  if (V3D.cardKey !== src.uid || !card.state.kind) {
    V3D.cardKey = src.uid;
    card.video({ srcs: originalSources(src), label: `Original: ${src.name}` });
  }
  const st = flight?.state;
  const t = walk
    ? walk.state.time
    : st
      ? st.active
        ? (st.time ?? flight.path.start)
        : (st.pausedAt ?? flight.path.start)
      : 0;
  card.sync({ time: t, playing: !walk && !!st?.active && !st?.done });
}

const VIDEO_3D = {
  density: 1.6,
  frameReaches: true,
  turntable: false,
  // These models fit Gaussian compositing. A steeper display kernel changes fitted overlaps,
  // lowering held-out SSIM and adding visible grain. Detail comes from the measured bakes.
  kernel: "gaussian",
  render: { cull: "off", dpr: "native", adapt: "off" },
  options: [
    {
      key: "navigation",
      label: "Move around",
      type: "select",
      default: "orbit",
      choices: [
        { id: "orbit", label: "Turn and zoom" },
        { id: "walk", label: "Walk inside the filmed area" },
      ],
    },
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
    {
      key: "original",
      label: "Show the original",
      type: "select",
      default: "off",
      choices: [
        { id: "off", label: "Off" },
        { id: "on", label: "On: the flat video in a corner, in step with the flight" },
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
    author: s.transformationCredit ? `${s.author} (3D scene: ${s.transformationCredit})` : s.author,
    license: s.license,
    licenseUrl: s.licenseUrl,
  })),
  async prepare(o, _help, ctx) {
    const generation = (V3D.prepareUid = (V3D.prepareUid || 0) + 1);
    const choice = watchChoice();
    const current = () => generation === V3D.prepareUid && choice.matches();
    let want = null;
    if (o.source === "custom" && V3D.file && isBrowser()) {
      const key = `${V3D.fileUid}/${o.start}/${o.length}/${o.rate}/${o.setting || "auto"}`;
      if (V3D.custom?.key !== key) await trainVideo(o, key);
      if (!current()) return;
      if (V3D.custom?.key === key) {
        if (o.navigation === "walk") {
          if (V3D.customWalk?.key !== key)
            V3D.customWalk = {
              ...V3D.custom,
              ...sceneFromPly(V3D.custom.ply, V3D.custom.cams, undefined, {
                affine: true,
                preservePhotometric: V3D.custom.preservePhotometric,
              }),
            };
          want = V3D.customWalk;
        } else want = V3D.custom;
      }
    }
    if (!want && SAMPLES.length) {
      try {
        want = await loadSample(
          o.source === "custom" ? SAMPLES[0].id : o.source,
          o.navigation,
          sampleBudget(ctx?.count, {
            profile: ctx?.profile,
            phone: phoneSample(ctx?.profile),
          }),
        );
      } catch {
        want = null;
      }
    }
    // An older preparation cannot replace the source a newer load selected.
    if (current()) V3D.want = want;
  },
  drive(t, c, out, info) {
    const walk = info?.data?.walk;
    const flight = info?.data?.flight;
    if (walk && (c.replay ?? 0) <= 0.001) {
      if (walk.followingReplay)
        walk.resumeAt(flight.path.at(flight.state.time ?? flight.path.start));
      walk.followingReplay = false;
      walk.root.hidden = false;
      walk.drive(info);
    } else {
      if (walk) {
        walk.followingReplay = true;
        walk.root.hidden = true;
      }
      flight?.(c.replay ?? 0, info);
    }
    showOriginal(flight, walk && !walk.followingReplay ? walk : null);
  },
  build(k, o) {
    V3D.credit?.dispose?.();
    V3D.credit = null;
    V3D.flight?.dispose?.();
    V3D.flight = null;
    V3D.walk?.dispose?.();
    V3D.walk = null;
    const src = V3D.want;
    V3D.shown = null;
    V3D.original = o.original === "on";
    if (!src) {
      buildFilmStrip(k);
      V3D.info = { placeholder: true, splats: 0 };
      k.data = { video: V3D.info };
      return;
    }
    const s = src.scene;
    k.fitOn = false; // the scene and its camera path share the frame scene.js made
    if (src.affine || src.preservePhotometric) {
      // Frame camera limits on the captured area rather than extreme background splats.
      for (const c of src.path) k.reach(c.pos);
      k.reach([-1, -1, -1]);
      k.reach([1, 1, 1]);
    }
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
    // Calibrated geometry already shares the camera frame and can extend beyond the unit ball.
    // Declare it outside kit fitting rather than contracting the fitted world to that ball.
    k.cloud(
      {
        count: picked.near.length * per,
        pattern: false,
        fit: !(src.affine || src.preservePhotometric),
      },
      (_r, j) => (j < picked.near.length ? splat(picked.near[j]) : null),
    );
    // The far shell (water, skyline, sky, pulled in between radius 1 and 2) sits outside the fit.
    if (picked.far.length)
      k.cloud({ count: picked.far.length * per, pattern: false, fit: false }, (_r, j) =>
        j < picked.far.length ? splat(picked.far[j]) : null,
      );
    // The soft upper dome uses the video's trained sky colors, behind the scene's far shell.
    if (src.skyCount > 10 && src.sky && !globalThis.__v3dNoPrune)
      k.cloud({ share: 0.015, pattern: false, fit: false }, (r) => {
        const y = r();
        const a = r() * Math.PI * 2;
        const b = Math.sqrt(1 - y * y);
        return {
          p: [Math.cos(a) * b, y, Math.sin(a) * b].map(
            (v, i) => src.dome.center[i] + v * src.dome.radius,
          ),
          scales: [0.0575, 0.0575, 0.0575].map((v) => v * src.dome.radius),
          color: src.sky.map((c) => Math.min(1, c + (1 - y) * 0.07)),
          opacity: 0.98,
          pattern: false,
        };
      });
    V3D.info = {
      name: src.name,
      uid: src.uid,
      splats: n,
      cams: src.path.length,
      custom: src.uid === V3D.custom?.uid,
      stats: src.stats,
      timings: src.timings,
      pruned: src.pruned,
      clamped: src.clamped,
      walkRegion: src.region?.stats,
      skyDome: src.skyCount > 10 ? src.dome : null,
    };
    k.data = { video: V3D.info };
    V3D.shown = src;
    if (isBrowser() && src.sample) V3D.credit = mountSceneCredit(src.sample, { walk: src.affine });
    V3D.original = o.original === "on";
    if (isBrowser() && src.path.length) {
      V3D.flight = makeFlight(src.path, src.uid === V3D.custom?.uid ? { file: V3D.file } : null, {
        isCurrent: () => V3D.shown === src,
      });
      k.data.flight = V3D.flight;
      if (o.navigation === "walk") {
        V3D.walk = mountWalk(src.path, {
          flight: V3D.flight,
          region: src.region,
          isCurrent: () => V3D.shown === src,
        });
        k.data.walk = V3D.walk;
      }
      // A frame soon after, so the flight's drive can open the view where the video starts.
      setTimeout(() => window.__splashery?.player?.stage?.requestRender?.(), 1000);
    }
  },
};

export const RECIPES = {
  "video-3d": VIDEO_3D,
};
