// Lane Photo sharp view (prefix psv): the "Sharp" view of Photo to 3D and Moving photo to 3D, a
// choice beside the splats (which stay the default). The picture at its full resolution as a
// texture on a relief lifted by the same depth the splats use (src/live/relief-mesh.js), so small
// text reads as it does in the original.
//
// Each toy calls three things (its one small hook): sharpEntry(id) in its input panel's live list
// (the Splats / Sharp switch), sharpPhoto(...) or sharpClip(...) at the end of its build, and
// sharpDrive(out) at the end of its drive. The choice lives only while the page is open: nothing
// new goes into scenes or links (until the owner says otherwise).
//
// While Sharp is on, the toy's splats are switched off and the relief moves as they would: the
// depth slider, the tap (the morph), Layers, the sway, play, pause and scrubbing. A tap on the
// relief reaches the toy through its tap box. The relief module is loaded the first time someone
// picks Sharp.

const VIEW = { "photo-3d": "splats", "moving-photo-3d": "splats" };
const S = {
  src: null, // what the last build showed: { toy, kind, ... }
  mesh: null, // the ReliefMesh, once made
  mod: null, // src/live/relief-mesh.js, once loaded
  loading: null,
  stage: null,
  watching: null,
  out: null, // the last drive's out
  key: "", // what the mesh's textures hold
  video: null, // a muted copy of a short clip's video (its color)
  frame: -1,
  splatsOff: null, // the entity whose splats are switched off
  ticks: 0, // the stage's updates (counted once the relief has been asked for)
  droveTick: null, // the update of the last sharpDrive
};

const player = () => globalThis.window?.__splashery?.player || null;

// Budget of grid cells for the relief on each device profile (its triangles are twice this).
export const SHARP_CELLS = { low: 60000, mid: 120000, high: 200000, max: 300000 };
const cellsFor = () => SHARP_CELLS[player()?.profile] || SHARP_CELLS.mid;

export const sharpView = (toy) => VIEW[toy] || "splats";

// Picks the view for a toy ("splats" or "sharp").
export function setSharpView(toy, view) {
  VIEW[toy] = view === "sharp" ? "sharp" : "splats";
  for (const fn of LISTENERS) fn();
  sync();
  player()?.stage?.requestRender?.();
}
const LISTENERS = new Set();

// The switch, for the toy's input panel (`input.live`).
export function sharpEntry(toy) {
  return {
    render() {
      const box = document.createElement("div");
      box.className = "psv-switch";
      const row = document.createElement("div");
      row.className = "button-row";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "How the picture is drawn");
      const make = (view, label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.id = `psv-${view}`;
        b.textContent = label;
        b.addEventListener("click", () => setSharpView(toy, view));
        return b;
      };
      const a = make("splats", "Splats");
      const b = make("sharp", "Sharp picture");
      row.append(a, b);
      const note = document.createElement("p");
      note.className = "note";
      note.textContent =
        "Sharp picture: the picture at its full size on a 3D relief, so small text stays readable. Splats: the picture rebuilt from splats. (A test: the choice isn't saved in scenes.)";
      box.append(row, note);
      const paint = () => {
        a.setAttribute("aria-pressed", String(sharpView(toy) === "splats"));
        b.setAttribute("aria-pressed", String(sharpView(toy) === "sharp"));
      };
      paint();
      LISTENERS.add(paint);
      // (dropped when the panel is redrawn and the switch leaves the page)
      const gone = new MutationObserver(() => {
        if (!box.isConnected) {
          LISTENERS.delete(paint);
          gone.disconnect();
        }
      });
      requestAnimationFrame(() => box.parentNode && gone.observe(document.body, { childList: true, subtree: true })); // prettier-ignore
      return box;
    },
  };
}

// Photo to 3D's build: the photo, the splats' own depth (0..1 at gx x gy) and its relief.
export function sharpPhoto({ photo, depth, gx, gy, aspect, relief, uid }) {
  S.src = { toy: "photo-3d", kind: "photo", photo, depth, gx, gy, aspect, relief, uid };
  S.key = "";
}

// Moving photo to 3D's build: the toy's state (MOVING), the picture's size and its lift.
export function sharpClip(moving, { width, height, full }) {
  S.src = { toy: "moving-photo-3d", kind: "clip", moving, width, height, full, clip: moving.clip };
  S.key = "";
  S.frame = -1;
}

// The end of the toy's drive: the relief follows this frame.
export function sharpDrive(out) {
  S.out = out;
  S.droveTick = S.ticks;
  sync();
}

const wanted = () => {
  const pl = player();
  const src = S.src;
  // (a toy that stopped calling sharpDrive, as Photo to 3D in the camera's live view, gets its
  // splats back)
  // (counted in the stage's updates, not in time: a slow device's frame can take most of a second)
  const fresh = S.ticks - (S.droveTick ?? -1e9) <= 3;
  return !!(src && fresh && pl?.scene?.toy?.id === src.toy && VIEW[src.toy] === "sharp" && pl.stage?.toy); // prettier-ignore
};

function splats(on) {
  const ent = player()?.stage?.toy?.entity;
  if (S.splatsOff && (on || S.splatsOff !== ent)) {
    if (S.splatsOff.gsplat) S.splatsOff.gsplat.enabled = true;
    S.splatsOff = null;
  }
  if (!on && ent?.gsplat && S.splatsOff !== ent) {
    ent.gsplat.enabled = false;
    S.splatsOff = ent;
  }
  // A tap on the relief reaches the toy through its tap box (the pick buffer has no splats).
  const data = player()?.motion?.ctx?.kit?.data;
  if (!data) return;
  if (on) {
    if (data.psvTap) delete data.tapBox;
    delete data.psvTap;
  } else if (!data.tapBox) {
    data.tapBox = tapBox();
    data.psvTap = true;
  }
}

function tapBox() {
  const s = S.src;
  if (s.kind === "photo") {
    const z = s.relief / 2 + 0.05;
    return { min: [-s.aspect / 2, -0.5, -z], max: [s.aspect / 2, 0.5, z] };
  }
  return { min: [-s.width / 2, -s.height / 2, -0.05], max: [s.width / 2, s.height / 2, s.full + 0.05] }; // prettier-ignore
}

function hide() {
  if (S.mesh) S.mesh.show(false);
  splats(true);
  if (S.video && !S.video.paused) S.video.pause();
}

// Keeps the relief in step with the toy: made, filled and moved while Sharp is on, hidden (and the
// splats back) otherwise.
export function sync() {
  if (!wanted()) return hide();
  const pl = player();
  const stage = pl.stage;
  if (!S.mod) {
    S.loading ||= import("../live/relief-mesh.js").then((m) => {
      S.mod = m;
      sync();
      stage.requestRender();
    });
    return;
  }
  if (S.stage !== stage) {
    S.mesh?.destroy();
    S.mesh = null;
    S.stage = stage;
  }
  if (S.watching !== stage) {
    S.watching = stage;
    stage.onUpdate(() => {
      S.ticks++;
      if (S.stage === stage) follow();
    });
  }
  const src = S.src;
  const [cols, rows] = grid(src);
  if (!S.mesh || S.mesh.cols !== cols || S.mesh.rows !== rows) {
    S.mesh?.destroy();
    S.mesh = new S.mod.ReliefMesh(stage, { cols, rows });
    S.key = "";
  }
  const m = S.mesh;
  if (src.kind === "photo") fillPhoto(m, src);
  else fillClip(m, src);
  shape(m, src, pl);
  follow();
  m.show(true);
  if (m.visible) splats(false);
}

// The relief's grid: as fine as the depth, within the device's budget.
function grid(src) {
  const [w, h] = src.kind === "photo" ? [src.gx, src.gy] : [src.clip.w, src.clip.h];
  const f = Math.min(1, Math.sqrt(cellsFor() / (w * h)));
  return [Math.max(8, Math.round(w * f)), Math.max(8, Math.round(h * f))];
}

function fillPhoto(m, src) {
  const key = `p${src.uid}|${src.gx}x${src.gy}|${src.relief}`;
  if (S.key === key) return;
  S.key = key;
  m.setColor(src.photo);
  m.setDepth({ w: src.gx, h: src.gy, data: src.depth });
}

// A clip: the depth of the frame on show; the color straight from a playing video (the long clip's
// own muted copy, or a muted copy of a short clip's file), else the clip's own frame.
function fillClip(m, src) {
  const mv = src.moving;
  const clip = mv.clip;
  if (!clip) return;
  const playing = (pl) => (pl?.motion?.targets?.play ?? 1) > 0.5;
  let video = null;
  if (clip.long) video = clip.video;
  else if (clip.audio?.url && typeof document !== "undefined") {
    if (!S.video || S.video.dataset.url !== clip.audio.url) {
      S.video?.pause();
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.crossOrigin = "anonymous";
      v.dataset.url = clip.audio.url;
      v.src = clip.audio.url;
      S.video = v;
    }
    video = S.video;
    const on = playing(player());
    const rate = clip.audio.track?.el?.playbackRate || 1;
    if (video.playbackRate !== rate) video.playbackRate = rate;
    if (on) {
      if (Math.abs(video.currentTime - mv.t) > 0.2 && !video.seeking) video.currentTime = mv.t;
      if (video.paused) video.play().catch(() => {});
    } else {
      if (!video.paused) video.pause();
      if (Math.abs(video.currentTime - mv.t) > 0.02 && !video.seeking) video.currentTime = mv.t;
    }
  }
  const usable = video && video.readyState >= 2 && video.videoWidth > 0;
  if (usable && (newFrame(video) || m.colorSrc !== video)) m.setColor(video);
  const f = mv.frame;
  const depth = clip.long ? clip.scratch?.bytes : clip.near[f];
  const key = `c${clip.name}|${f}|${clip.long ? clip.depth?.ready : ""}|${usable ? "v" : "f"}`;
  if (S.key !== key) {
    S.key = key;
    if (depth) m.setDepth({ w: clip.w, h: clip.h, data: depth });
    if (!usable && !clip.long && clip.colors[f])
      m.setColor({ w: clip.w, h: clip.h, data: clip.colors[f] });
  }
}

// Whether the video has a new picture since the last upload (the browser says so where it can,
// else its time moved), so a paused or slow video isn't uploaded again every frame.
function newFrame(v) {
  if (v.requestVideoFrameCallback) {
    if (S.rvfc !== v) {
      S.rvfc = v;
      S.fresh = true;
      const tick = () => {
        if (S.rvfc !== v) return;
        S.fresh = true;
        v.requestVideoFrameCallback(tick);
        player()?.stage?.requestRender?.();
      };
      v.requestVideoFrameCallback(tick);
    }
    const f = S.fresh;
    S.fresh = false;
    return f;
  }
  const moved = v.currentTime !== S.lastTime;
  S.lastTime = v.currentTime;
  return moved;
}

function shape(m, src, pl) {
  const out = S.out || {};
  const ctx = pl.motion?.ctx;
  const fit = ctx?.transform || { center: [0, 0, 0], scale: 1 };
  const toy = pl.toyInfo?.center || [0, 0, 0];
  const common = {
    fit,
    toy,
    bodyQ: out.body?.quat || [0, 0, 0, 1],
    bodyT: [0, 0, 0],
    reach: 0.11,
  };
  if (src.kind === "photo") {
    const L = out.parts?.layer3?.offset?.[2] ?? 0; // (layer b is offset (b - 1.5) x spacing)
    m.set({
      ...common,
      width: src.aspect,
      height: 1,
      lift: src.relief,
      base: 0.5,
      backOffset: -0.012,
      backFlat: -0.01,
      morph: out.morph || [0, 0, 0, 0],
      layers: L / 1.5,
      cut: PHOTO_CUT,
      frame: null,
    });
  } else {
    m.set({
      ...common,
      width: src.width,
      height: src.height,
      lift: src.full,
      base: 0,
      backOffset: -0.02,
      backFlat: -0.02,
      morph: [0, 0, 0, 0],
      layers: 0,
      cut: CLIP_CUT,
      // the toy's thin dark frame (its splats hide with the rest): 0.05 wide, behind the picture
      frame: { across: 0.05 / src.width, down: 0.05 / src.height, z: -0.03 },
    });
  }
}

// A step in the depth (0..1) across one grid cell larger than this cuts the surface there.
export const PHOTO_CUT = 0.03;
export const CLIP_CUT = 0.05;

// Every frame: the relief stands where the toy's entity stands (a Hands-on pose moves it), and goes
// when the toy does.
function follow() {
  const m = S.mesh;
  if (!m) return;
  const pl = player();
  const ent = pl?.stage?.toy?.entity;
  if (!ent || !wanted()) {
    if (m.visible) hide();
    return;
  }
  if (!m.node.parent) pl.stage.app.root.addChild(m.node);
  m.node.setPosition(ent.getPosition());
  m.node.setRotation(ent.getRotation());
  const s = ent.getLocalScale();
  m.node.setLocalScale(s.x, s.y, s.z);
  if (S.src?.kind === "clip" && S.src.moving.clip?.long) fillClip(m, S.src); // (keep the video in step)
}

// For the tests and the clip tools.
export const sharpState = () => ({
  views: { ...VIEW },
  on: !!S.mesh?.visible,
  kind: S.src?.kind || null,
  grid: S.mesh ? [S.mesh.cols, S.mesh.rows] : null,
  color: S.mesh?.color ? [S.mesh.color.width, S.mesh.color.height] : null,
  depth: S.mesh?.depth ? [S.mesh.depth.width, S.mesh.depth.height] : null,
  video: !!S.mesh?.colorSrc,
  videoTime: S.mesh?.colorSrc?.currentTime ?? null,
  cost: S.mesh ? S.mesh.cost() : null,
  splatsOff: !!S.splatsOff,
});
if (typeof window !== "undefined") window.__psv = { set: setSharpView, state: sharpState };
