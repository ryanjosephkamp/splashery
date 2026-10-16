// Lane Photo sharp view (prefix psv): the "Sharp picture" view of Photo to 3D and Moving photo to
// 3D, the default since the owner's call of October 8, 2026 ("Make sharp the default"), with the
// splats a tap away beside it. The picture at its full resolution as a
// texture on a relief lifted by the same depth the splats use (src/live/relief-mesh.js), so small
// text reads as it does in the original.
//
// Each toy calls three things (its one small hook): sharpEntry(id) in its input panel's live list
// (the Splats / Sharp switch), sharpPhoto(...) or sharpClip(...) at the end of its build, and
// sharpDrive(out) at the end of its drive.
//
// The choice is saved with the scene (the owner's call of October 8, 2026: "I want saved scenes to
// remember sharp/splat"): the switch writes the toy option `view` ("sharp" or "splats") into the
// scene, so a saved scene and a #s= link carry it, and each build reads it back. A scene without
// the key (every scene saved before) opens in Sharp picture. It is stored as the scene's toy option
// directly, so picking it doesn't rebuild the toy (docs/SCENE-SCHEMA.md, docs/PHOTO-VIEWS.md).
//
// Where the splats must stay, they show instead, and the switch and the status line say so: while
// a tool that works on splats is picked (Poke, Paint, Magnet, Clay), in Hands-on, and while a Look
// effect is on. Saving the toy as a splat file is unaffected (it reads the splats, not the screen).
//
// While Sharp is on, the toy's splats are switched off and the relief moves as they would: the
// depth slider, the tap (the morph), Layers, the sway, play, pause and scrubbing. A tap on the
// relief reaches the toy through its tap box. The relief module loads with the first picture.

import { depthBytes } from "../live/relief-height.js"; // lane Photo depth
import { clipRasterView, clipRasterPlanes } from "./moving-photo-raster.js";
import { drawFields, indexClipCaps } from "./moving-photo-geometry.js";
import {
  PIXELFORMAT_R32F,
  PRIMITIVE_TRIANGLES,
  VertexBuffer,
  VertexFormat,
  SEMANTIC_ATTR12,
  SEMANTIC_ATTR13,
  TYPE_FLOAT32,
  BUFFER_DYNAMIC,
  Mat4,
} from "../pc.js"; // clip-only geometry/cache
import { formatCount } from "../state.js";

const VIEW = { "photo-3d": "sharp", "moving-photo-3d": "sharp" };
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
  wake: false, // its splats come back at the next update (wake)
  ticks: 0, // the stage's updates (counted once the relief has been asked for)
  droveTick: null, // the update of the last sharpDrive
};

const player = () => globalThis.window?.__splashery?.player || null;

// Budget of grid cells for the relief on each device profile (its triangles are twice this).
export const SHARP_CELLS = { low: 60000, mid: 120000, high: 200000, max: 300000 };
const cellsFor = () => SHARP_CELLS[player()?.profile] || SHARP_CELLS.mid;
export const sharpClipOnly = (clip) =>
  !!(
    S.src?.kind === "clip" &&
    S.src.clip === clip &&
    S.mesh?.visible &&
    S.splatsOff === player()?.stage?.toy?.entity &&
    !S.wake &&
    !S.yielded
  );
let clipHolds = 0;
let clipGeometry = null;
let clipGeometryLoading = null;
export function holdSharpClip() {
  clipHolds++;
  S.video?.pause();
  let released = false;
  return () => {
    if (!released) clipHolds--;
    released = true;
  };
}

export const sharpView = (toy) => VIEW[toy] || "splats";

// Picks the view for a toy ("splats" or "sharp").
export function setSharpView(toy, view) {
  VIEW[toy] = view === "sharp" ? "sharp" : "splats";
  // (into the scene, so saving it or copying its link keeps the choice)
  const t = player()?.scene?.toy;
  if (t?.kind === "builtin" && t.id === toy) t.options = { ...(t.options || {}), view: VIEW[toy] };
  for (const fn of LISTENERS) fn();
  sync();
  player()?.stage?.requestRender?.();
}
const LISTENERS = new Set();

// The scene's saved choice, at each build: "splats" for Splats, anything else (or no key, as in
// every scene saved before October 8, 2026) for Sharp picture.
function fromScene(toy) {
  const t = player()?.scene?.toy;
  if (!t || t.id !== toy) return;
  const v = t.options?.view === "splats" ? "splats" : "sharp";
  if (VIEW[toy] === v) return;
  VIEW[toy] = v;
  for (const fn of LISTENERS) fn();
}

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
      box.append(row, note);
      const paint = () => {
        a.setAttribute("aria-pressed", String(sharpView(toy) === "splats"));
        b.setAttribute("aria-pressed", String(sharpView(toy) === "sharp"));
        note.textContent =
          sharpView(toy) === "sharp" && S.yielded
            ? "Showing the splats while a tool, Hands-on or an effect is on (they work on splats). Sharp picture comes back after."
            : toy === "photo-3d" && player()?.scene?.toy?.options?.detail !== "splats"
              ? "Fine Splats (hybrid) adds a filled background sheet behind the splats. Splat exports omit the sheet; scene saves keep the view settings."
              : "Sharp picture: the picture at its full size on a 3D relief, so small text stays readable. Splats: the picture rebuilt from splats.";
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
// (band: each cell's layer, its piece's, so each piece moves as one, as the splats do; lane Photo depth)
export function sharpPhoto({ photo, depth, band, gx, gy, aspect, relief, uid, background }) {
  S.src = {
    toy: "photo-3d",
    kind: "photo",
    photo,
    depth,
    band,
    gx,
    gy,
    aspect,
    relief,
    uid,
    background,
  };
  fromScene("photo-3d");
  S.key = "";
}

export async function prepareSharpPhoto() {
  S.mod ||= await import("../live/relief-mesh.js");
}

// Moving photo to 3D's build: the toy's state (MOVING), the picture's size and its lift.
export function sharpClip(moving, { width, height, full }) {
  // Prepare in parallel with the first small preview. A blocked or missing
  // accelerator retains the exact JavaScript construction below.
  clipGeometryLoading ||= import("./moving-photo-geometry.js")
    .then(async (helper) => ({ ...helper, module: await helper.prepareGeometry() }))
    .then((helper) => {
      clipGeometry = helper;
    })
    .catch(() => {});
  const stage = player()?.stage;
  if (stage && S.clipStage !== stage) {
    S.clipStage = stage;
    S.clipUpdate = () => {
      const pl = player();
      if (pl?.stage !== stage) return;
      const pending = S.clipPending;
      S.clipPending = null;
      if (
        pending &&
        pending.src === S.src &&
        pending.player === pl &&
        pending.toy === pl.scene?.toy
      ) {
        S.out = pending.out;
        sync();
      }
      // A paused clip has no drive calls. Camera moves and decoded frames
      // still update the stage, so it must not age out of Sharp into Splats.
      if (
        pl?.stage === stage &&
        S.src?.kind === "clip" &&
        pl.scene?.toy?.id === S.src.toy &&
        (pl.motion?.targets?.play ?? 1) <= 0.5 &&
        !pl.loading
      )
        S.droveTick = S.ticks;
    };
    stage.onUpdate(S.clipUpdate);
  }
  S.clipPending = null;
  if (S.src?.clip !== moving.clip) {
    S.video?.pause();
    S.video?.removeAttribute("src");
    S.video?.load();
    S.video = null;
    S.rvfc = null;
  }
  S.src = { toy: "moving-photo-3d", kind: "clip", moving, width, height, full, clip: moving.clip };
  fromScene("moving-photo-3d");
  S.key = "";
  S.frame = -1;
  // Paint the selected clip before the next drive, rather than waiting for
  // a decoder or leaving the previous sample's texture on this relief.
  if (S.mesh && !(moving.clip?.video?.readyState >= 2) && (moving.clip?.previewColor || moving.clip?.colors?.[moving.frame]))
    S.mesh.setColor(moving.clip.previewColor || { w: moving.clip.w, h: moving.clip.h, data: moving.clip.colors[moving.frame] }); // prettier-ignore
}

// The first moving picture may also be the first use of the lazy relief
// renderer. Wait for that module before claiming its preview was presented.
export async function presentSharpClip(moving, shape, isCurrent = () => true) {
  const clip = moving.clip,
    video = clip?.video;
  if (moving.opening && video) {
    video.pause();
    if (video.seeking || Math.abs(video.currentTime - moving.t) > 0.0001)
      await new Promise((resolve, reject) => {
        const done = () => {
          if (video.seeking || Math.abs(video.currentTime - moving.t) > 0.001) return;
          clearTimeout(timer);
          video.removeEventListener("seeked", done);
          resolve();
        };
        const timer = setTimeout(() => {
          video.removeEventListener("seeked", done);
          reject(new Error("The video preview couldn't seek to its first frame."));
        }, 10000);
        video.addEventListener("seeked", done);
        video.currentTime = moving.t;
      });
    if (clip.long) clip.shownDepth?.(moving.t);
  }
  if (!isCurrent()) return false;
  sharpClip(moving, shape);
  sharpDrive({});
  if (!S.mod && S.loading) await S.loading;
  if (!isCurrent() || S.src?.clip !== moving.clip) return false;
  sharpDrive({});
  return !!S.mesh?.visible;
}

// The end of the toy's drive: the relief follows this frame.
export function sharpDrive(out) {
  S.out = out;
  S.droveTick = S.ticks;
  sync();
}

// Established clips prepare their textures after the player's clock update,
// in the same stage update and before rendering. Opening and manual captures
// retain immediate sync when that stage callback is not active.
export function sharpClipDrive(out) {
  const pl = player(),
    stage = pl?.stage;
  if (
    S.src?.kind === "clip" &&
    !S.src.moving.opening &&
    pl?.scene?.toy?.id === S.src.toy &&
    !pl.paused &&
    !pl.frozen &&
    !pl.loading &&
    VIEW[S.src.toy] === "sharp" &&
    !splatsNeeded(pl) &&
    S.stage === stage &&
    S.mesh?.clipOnly &&
    stage?.updateHandlers?.includes(S.clipUpdate)
  ) {
    S.out = out;
    S.droveTick = S.ticks;
    S.clipPending = { src: S.src, player: pl, toy: pl.scene.toy, out };
    return;
  }
  S.clipPending = null;
  sharpDrive(out);
}

const wanted = () => {
  const pl = player();
  const src = S.src;
  // (a toy that stopped calling sharpDrive, as Photo to 3D in the camera's live view, gets its
  // splats back)
  // (counted in the stage's updates, not in time: a slow device's frame can take most of a second)
  const fresh = S.ticks - (S.droveTick ?? -1e9) <= 3 || (clipHolds > 0 && src?.kind === "clip");
  const on = !!(src && fresh && pl?.scene?.toy?.id === src.toy && VIEW[src.toy] === "sharp" && pl.stage?.toy); // prettier-ignore
  const yielded = on && splatsNeeded(pl);
  if (yielded !== S.yielded) {
    S.yielded = yielded;
    for (const fn of LISTENERS) fn();
  }
  return on && !yielded;
};

const backgroundWanted = () => {
  const pl = player();
  return !!(
    S.src?.kind === "photo" &&
    S.src.background &&
    S.ticks - (S.droveTick ?? -1e9) <= 3 &&
    pl?.scene?.toy?.id === "photo-3d" &&
    pl.scene.toy.options?.detail !== "splats" &&
    pl.stage?.toy &&
    !splatsNeeded(pl)
  );
};

// Where the splats must stay: a tool that works on them (Poke, Paint, Magnet, Clay), Hands-on, a
// Look effect on.
function splatsNeeded(pl) {
  const tool = globalThis.window?.__splashery?.app?.tool;
  if (tool && tool !== "orbit") return true;
  if (pl.handsOn?.mode) return true;
  return Object.values(pl.scene?.effects || {}).some((e) => e?.on);
}

function splats(on) {
  const ent = player()?.stage?.toy?.entity;
  const pl = player();
  // The splats come back at the stage's next update (wake), not here: see there.
  if (S.splatsOff && S.splatsOff !== ent) S.splatsOff = null;
  S.wake = on && !!S.splatsOff;
  if (!on && ent?.gsplat && S.splatsOff !== ent) {
    ent.gsplat.enabled = false;
    S.splatsOff = ent;
    if (pl) pl.pickDirty = true;
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

// The splats back, at the start of a frame: only the toy's own entity, and never during a build (it
// waits, and a rebuild lets it go). An entity turned back on just before a rebuild destroys it (as
// when Splats is picked and the options change at once, or a frame lands between the build and the
// stage's swap) keeps a frame or two in the splats' work-buffer pass after its paint texture is gone;
// that pass then finds no paint texture, and PlayCanvas makes its stand-in texture in the middle of
// the draw, which leaves an RGBA8 texture where the pass reads its unsigned-integer sub-draw data
// ("glDrawElementsInstanced: Mismatch between texture format and sampler type").
function wake() {
  const pl = player();
  const ent = pl?.stage?.toy?.entity;
  if (!S.splatsOff || S.splatsOff !== ent) {
    S.splatsOff = null;
    S.wake = false;
    S.mesh?.show(false);
    return;
  }
  if (pl.loading) return;
  S.wake = false;
  if (ent.gsplat) ent.gsplat.enabled = true;
  S.splatsOff = null;
  S.mesh?.show(false);
  pl.pickDirty = true; // (the pick buffer is drawn again, with the splats)
  pl.stage.requestRender();
}

function tapBox() {
  const s = S.src;
  if (s.kind === "photo") {
    const z = s.relief / 2 + 0.05;
    return { min: [-s.aspect / 2, -0.5, -z], max: [s.aspect / 2, 0.5, z] };
  }
  return { min: [-s.width / 2, -s.height / 2, -0.05], max: [s.width / 2, s.height / 2, s.full + 0.05] }; // prettier-ignore
}

// The status line under the toy says what is on screen: "Sharp picture" while the relief shows
// (src/app.js asks player.statusLabel), the splat count otherwise.
function status(on) {
  const pl = player();
  if (!pl) return;
  if (!pl.psvLabel) {
    pl.psvLabel = true;
    const before = pl.statusLabel;
    pl.statusLabel = (info) => {
      if (S.labelOn) return "Sharp picture";
      const label = before?.(info);
      if (!S.hybrid) return label;
      const splats = info.splats + (pl.pictures?.splats() || 0) + (pl.chunks?.splats() || 0); // prettier-ignore
      return `${label || `${formatCount(splats)} splats`} · Hybrid`;
    };
  }
  const hybrid = !!(backgroundWanted() && S.mesh?.miB.visible && !S.mesh.visible);
  if (S.labelOn === on && S.hybrid === hybrid) return;
  S.labelOn = on;
  S.hybrid = hybrid;
  globalThis.window?.__splashery?.app?.updateStatus?.();
}

function hide() {
  S.mesh?.clipStream?.pause();
  status(false);
  splats(true);
  // (the relief stays until the splats are back, at the next update, so no frame shows neither)
  if (S.mesh && !S.wake) S.mesh.show(false);
  if (S.video && !S.video.paused) S.video.pause();
}

// Keeps the relief in step with the toy: made, filled and moved while Sharp is on, hidden (and the
// splats back) otherwise.
export function sync() {
  const surface = wanted();
  if (!surface && !backgroundWanted()) return hide();
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
    watchClipDraws(stage);
    stage.onUpdate(() => {
      S.ticks++;
      if (S.wake) wake();
      if (S.stage === stage) follow();
    });
  }
  const src = S.src;
  const [cols, rows] = grid(src);
  if (
    !S.mesh ||
    S.mesh.cols !== cols ||
    S.mesh.rows !== rows ||
    !!S.mesh.clipOnly !== (src.kind === "clip")
  ) {
    S.mesh?.destroy();
    S.mesh = new S.mod.ReliefMesh(stage, {
      cols,
      rows,
      surface: src.kind === "photo" ? src.background?.surface : null,
    });
    S.key = "";
  }
  const m = S.mesh;
  if (src.kind === "photo") fillPhoto(m, src);
  else fillClip(m, src);
  shape(m, src, pl);
  follow();
  // Keep the old surface until the next frame enables the splats. Its visible
  // state must agree with the entity during this handoff, including rebuilds.
  splats(!surface);
  m.show(surface || S.wake);
  if (!surface) m.showBackground(true);
  status(m.visible);
  // Hidden splat textures do not request a frame. A still camera must also
  // present each ready clip picture; the draw signature drops duplicates.
  if (src.kind === "clip" && sharpClipOnly(src.clip) && !m.clipWaitingDepth) stage.requestRender(0);
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
  const bytes = depthBytes(src.depth);
  m.setDepth({ w: src.gx, h: src.gy, data: bytes });
  // Lane Photo depth: each piece moves with its own layer, and the backing stays behind it.
  m.setPieces(
    src.band
      ? {
          band: src.band,
          depth: bytes,
          gx: src.gx,
          gy: src.gy,
          base: 0.5,
          field: src.background?.field,
        }
      : null,
  );
  m.setBackground(src.background);
}

// A clip: the depth of the frame on show; the color straight from a playing video (the long clip's
// own muted copy, or a muted copy of a short clip's file), else the clip's own frame.
function fillClip(m, src) {
  const mv = src.moving;
  const clip = mv.clip;
  if (!clip) return;
  clipBorder(m, src);
  if (m.u.uBack[2]) m.setPieces(null); // (a clip's relief blends by depth, as before)
  const playing = (pl) => !mv.opening && clipHolds === 0 && (pl?.motion?.targets?.play ?? 1) > 0.5;
  if (m.clipStream && m.clipStream.clip !== clip) {
    m.clipStream.close();
    m.clipStream = null;
    m.clipBitmap?.close();
    m.clipBitmap = null;
  }
  if (
    clip.long &&
    playing(player()) &&
    !clip.depthEase &&
    clipGeometry &&
    typeof VideoFrame !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  ) {
    m.clipStream ||= clipGeometry.videoGeometryStream(clip, m.cols, m.rows, m.clipAspect, () =>
      player()?.stage?.requestRender?.(0),
    );
    const active = m.clipStream.play(mv.t);
    const packet = m.clipStream.take(mv.t);
    if (packet) {
      m.clipStreamPacket = packet;
      m.setDepth({ w: clip.w, h: clip.h, data: packet.depth });
      m.clipStreamPacket = null;
      const old = m.clipBitmap;
      packet.bitmap.currentTime = packet.time;
      m.setColor(packet.bitmap);
      m.clipBitmap = packet.bitmap;
      m.clipBitmapTime = packet.time;
      old?.close();
      S.key = `stream|${packet.id}`;
      return;
    }
    if (active && m.clipDepthOwner === clip && m.color) return;
  } else m.clipStream?.pause();
  let video = null;
  if (clip.video) video = clip.video;
  else if (
    /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(clip.audio?.url || "") &&
    typeof document !== "undefined"
  ) {
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
  const usable =
    video &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    !video.seeking &&
    Math.abs(video.currentTime - mv.t) < 0.25;
  const f = mv.frame;
  const scratch = clip.scratch;
  const depth = clip.long
    ? scratch?.time === mv.t &&
      scratch.depth === clip.depth &&
      scratch.ready === clip.depth.ready &&
      scratch.easeTick === (clip.depthEase ? Math.floor(performance.now() / 16) : null)
      ? scratch.bytes
      : clip.shownDepth?.(mv.t)
    : clip.shownDepth?.(f) || clip.near[f];
  const key = `c${clip.name}|${clip.version || 0}|${clip.transition || clip.depthEase ? Math.floor(performance.now() / 16) : ""}|${f}|${clip.long ? mv.t : ""}|${clip.long ? clip.depth?.ready : ""}|${usable ? "v" : "f"}`;
  if (m.clipWaitingDepth && S.key === key && depth)
    clipCellDepth(m, { w: clip.w, h: clip.h, data: depth });
  if (S.key !== key) {
    S.key = key;
    if (depth) m.setDepth({ w: clip.w, h: clip.h, data: depth });
    // Audio files have no picture. A loading or seeking video uses this
    // clip's frame too, so an old sample can never stay on the surface.
    if (!usable && !clip.long && (clip.previewColor || clip.colors[f]))
      m.setColor(clip.previewColor || { w: clip.w, h: clip.h, data: clip.colors[f] });
  }
  if (
    usable &&
    (newFrame(video) ||
      S.stage?.captureWaiters.length > 0 ||
      m.colorSrc !== (video.paused || !directClipVideo(video) ? S.clipStill : video))
  )
    clipPicture(m, video);
}

// A moving picture's backing must meet its surface at the border. The shared
// photo backing is inset, leaving cut cells at the clip's rim with nothing
// behind them. Match the existing softened rim without changing clip depth.
function clipBorder(m, src) {
  m.clipAspect = src.height / src.width;
  m.clipPreview = !!src.moving.opening;
  if (m.clipOnly) return;
  m.clipOnly = true;
  // Retain inherited dispatch, including upload observers installed later.
  const methods = Object.getPrototypeOf(m);
  for (const name of ["setColor", "setDepth"]) {
    m[name] = function (...args) {
      this.clipRevision = (this.clipRevision || 0) + 1;
      return methods[name].apply(this, args);
    };
  }
  // The border's geometry already uses softened depth. Cutting it from
  // the unsmoothed map can remove a physically smooth border triangle.
  const surface = clipSoftShader(m.matS.shaderDesc);
  m.matS.shaderDesc = {
    ...surface,
    uniqueName: "mp3ClipSurface",
    vertexGLSL:
      surface.vertexGLSL.slice(0, surface.vertexGLSL.indexOf("void main(void)")) +
      `
void main(void) {
  vec2 uv = aPosition.xy;
  vec4 point = texelFetch(uClipSoft, ivec2(floor(uv * uGrid.zw + 0.5)), 0);
  float d = point.r;
  vUv = uv; vD = d; vEdge = point.b > uLayer.y ? 1.0 : 0.0;
  gl_Position = psvPlace(vec3((uv.x - 0.5) * uGrid.x, (0.5 - uv.y) * uGrid.y, uLift.x * (d - uLift.y)));
}`,
    vertexWGSL:
      surface.vertexWGSL.slice(0, surface.vertexWGSL.indexOf("@vertex fn vertexMain")) +
      `
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let uv = input.aPosition.xy;
  let point = textureLoad(uClipSoft, vec2i(floor(uv * uniform.uGrid.zw + 0.5)), 0);
  let d = point.r;
  output.vUv = uv; output.vD = d; output.vEdge = select(0.0, 1.0, point.b > uniform.uLayer.y);
  output.position = psvPlace(vec3f((uv.x - 0.5) * uniform.uGrid.x, (0.5 - uv.y) * uniform.uGrid.y, uniform.uLift.x * (d - uniform.uLift.y)));
  return output;
}`,
    fragmentGLSL: `uniform sampler2D uColor;
varying vec2 vUv;
void main(void) { gl_FragColor = vec4(texture(uColor, vUv).rgb, 1.0); }
`,
    fragmentWGSL: `var uColor: texture_2d<f32>;
var uColorSampler: sampler;
varying vUv: vec2f;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = textureSample(uColor, uColorSampler, input.vUv);
  return output;
}`,
  };
  m.matS.update();
  const frameShader = clipSoftShader(m.matF.shaderDesc);
  m.matF.shaderDesc = {
    ...frameShader,
    uniqueName: "mp3ClipFrame",
    vertexGLSL:
      frameShader.vertexGLSL.slice(0, frameShader.vertexGLSL.indexOf("void main(void)")) +
      `
void main(void) {
  vec2 f = aPosition.xy;
  f = mix(f, -uFrame.xy, step(f, vec2(-0.5)));
  f = mix(f, 1.0 + uFrame.xy, step(vec2(1.5), f));
  float d = psvSoft(clamp(f, 0.0, 1.0));
  vUv = vec2(0.0); vD = 0.0; vEdge = 0.0;
  gl_Position = psvPlace(vec3((f.x - 0.5) * uGrid.x, (0.5 - f.y) * uGrid.y, uLift.x * (d - uLift.y) + uFrame.z));
}`,
    vertexWGSL:
      frameShader.vertexWGSL.slice(0, frameShader.vertexWGSL.indexOf("@vertex fn vertexMain")) +
      `
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  var f = input.aPosition.xy;
  f = mix(f, -uniform.uFrame.xy, step(f, vec2f(-0.5)));
  f = mix(f, 1.0 + uniform.uFrame.xy, step(vec2f(1.5), f));
  let d = psvSoft(clamp(f, vec2f(0.0), vec2f(1.0)));
  output.vUv = vec2f(0.0); output.vD = 0.0; output.vEdge = 0.0;
  output.position = psvPlace(vec3f((f.x - 0.5) * uniform.uGrid.x, (0.5 - f.y) * uniform.uGrid.y, uniform.uLift.x * (d - uniform.uLift.y) + uniform.uFrame.z));
  return output;
}`,
    fragmentGLSL: frameShader.fragmentGLSL.replaceAll("uLayer.z", "2.0"),
    fragmentWGSL: frameShader.fragmentWGSL.replaceAll("uniform.uLayer.z", "2.0"),
  };
  m.matF.update();
  clipFrame(m);
  clipCells(m);
  clipCaps(m);
  const setDepth = m.setDepth.bind(m);
  m.setDepth = (depth) => {
    setDepth(depth);
    clipCellDepth(m, depth);
  };
  const cost = m.cost.bind(m);
  const extraBytes =
    m.frame.vertexBuffer.numBytes +
    m.frame.indexBuffer[0].numBytes +
    m.clipCells.vertexBuffer.numBytes +
    m.clipCells.indexBuffer[0].numBytes;
  m.cost = () => {
    const held = cost();
    return {
      ...held,
      mesh: held.mesh + extraBytes,
      total: held.total + extraBytes,
      triangles:
        m.surface.mesh.primitive[0].count / 3 +
        2 * m.miB.instancingCount +
        ((m.clipCapCount || 0) + (m.clipTopCount || 0)) / 3 +
        m.frame.primitive[0].count / 3,
    };
  };
  const destroy = m.destroy.bind(m);
  m.destroy = () => {
    for (const prefix of ["clipCap", "clipTop"]) {
      if (m[prefix + "Pass"]) m.layer.removeMeshInstances([m[prefix + "Pass"]]);
      m[prefix + "Mesh"]?.destroy();
    }
    m.clipCapMaterial.destroy();
    m.clipStream?.close();
    m.clipBitmap?.close();
    m.clipCache?.close();
    m.clipPatch?.destroy();
    m.clipFloor?.destroy();
    m.clipSoft?.destroy();
    m.miB.setInstancing(null);
    m.clipInstances?.destroy();
    m.clipCells.destroy();
    destroy();
  };
}

// The existing 25-tap border softening is constant for a depth frame. Compute
// it once on the CPU at the actual surface/frame vertices. This keeps their
// geometry identical and avoids compiling the stencil into three clip shaders.
// Exposed pixel edges interpolate that same border curve between its vertices.
function clipSoftShader(desc, interpolate = false) {
  const gl = interpolate
    ? `
  vec2 p = clamp(uv, 0.0, 1.0) * uGrid.zw;
  ivec2 a = ivec2(floor(p)), hi = ivec2(uGrid.zw);
  vec2 f = fract(p);
  float tl = texelFetch(uClipSoft, a, 0).r;
  float tr = texelFetch(uClipSoft, min(a + ivec2(1, 0), hi), 0).r;
  float bl = texelFetch(uClipSoft, min(a + ivec2(0, 1), hi), 0).r;
  float br = texelFetch(uClipSoft, min(a + ivec2(1, 1), hi), 0).r;
  return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);`
    : `
  ivec2 p = ivec2(floor(clamp(uv, 0.0, 1.0) * uGrid.zw + 0.5));
  return texelFetch(uClipSoft, p, 0).r;`;
  const wg = interpolate
    ? `
  let p = clamp(uv, vec2f(0.0), vec2f(1.0)) * uniform.uGrid.zw;
  let a = vec2i(floor(p)); let hi = vec2i(uniform.uGrid.zw);
  let f = fract(p);
  let tl = textureLoad(uClipSoft, a, 0).r;
  let tr = textureLoad(uClipSoft, min(a + vec2i(1, 0), hi), 0).r;
  let bl = textureLoad(uClipSoft, min(a + vec2i(0, 1), hi), 0).r;
  let br = textureLoad(uClipSoft, min(a + vec2i(1, 1), hi), 0).r;
  return mix(mix(tl, tr, f.x), mix(bl, br, f.x), f.y);`
    : `
  let p = vec2i(floor(clamp(uv, vec2f(0.0), vec2f(1.0)) * uniform.uGrid.zw + 0.5));
  return textureLoad(uClipSoft, p, 0).r;`;
  return {
    ...desc,
    vertexGLSL: desc.vertexGLSL.replace(
      /float psvSoft\(vec2 p\) \{[\s\S]*?\n\}/,
      `uniform highp sampler2D uClipSoft;\nfloat psvSoft(vec2 uv) {${gl}\n}`,
    ),
    vertexWGSL: desc.vertexWGSL.replace(
      /fn psvSoft\(p: vec2f\) -> f32 \{[\s\S]*?\n\}/,
      `var uClipSoft: texture_2d<uff>;\nfn psvSoft(uv: vec2f) -> f32 {${wg}\n}`,
    ),
  };
}

// Every observed depth texel is a separate plane with solid vertical sides.
// Shared source pixels close the cut cells without stretching a foreground
// triangle onto its background. Native color stays on the actual geometry;
// ordinary raster depth and texture derivatives work on either renderer.
function clipCells(m) {
  const positions = [],
    indices = [];
  const quad = (corners) => {
    const start = positions.length / 3;
    positions.push(...corners.flat());
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
  };
  quad([
    [-0.5, -0.5, 0],
    [0.5, -0.5, 0],
    [-0.5, 0.5, 0],
    [0.5, 0.5, 0],
  ]);
  const mesh = (m.clipCells = new m.surface.mesh.constructor(m.device));
  mesh.setPositions(new Float32Array(positions), 3);
  mesh.setIndices(new Uint16Array(indices));
  mesh.update(PRIMITIVE_TRIANGLES);
  m.miB.mesh = mesh;
  m.miB.setInstancing(true, false);
  const desc = clipSoftShader(m.matB.shaderDesc, true);
  m.matB.shaderDesc = {
    ...desc,
    uniqueName: "mp3ClipCells",
    // A side owns a whole observed depth cell in its normal direction.
    // Its projected UV gradient collapses to zero there, so implicit native
    // filtering can pick a bright subpixel from an adjacent depth layer.
    // Keep the native top filter, and sample a wall's finite source footprint
    // around its own cell center. Bound a thin wall's tangent gradient to its
    // finite patch so extrapolated helper pixels cannot sample another layer.
    // Select its mip level explicitly from that finite footprint as well.
    fragmentGLSL: desc.fragmentGLSL
      .replaceAll("uLayer.z", "1.0")
      .replace("uniform sampler2D uColor;", "uniform sampler2D uColor;\nuniform vec2 uClipCell;")
      .replace(
        "vec3 c = texture(uColor, vUv).rgb;",
        `vec2 ux = dFdx(vUv), uy = dFdy(vUv);
  vec3 c = texture(uColor, vUv).rgb;
  if (vEdge > 0.5) {
    vec2 cell = uClipCell;
    vec2 gx = vEdge < 2.5 ? vec2(cell.x, 0.0) : vec2(min(length(vec2(ux.x, uy.x)), cell.x), 0.0);
    vec2 gy = vEdge < 2.5 ? vec2(0.0, min(length(vec2(ux.y, uy.y)), cell.y)) : vec2(0.0, cell.y);
    vec2 colorSize = vec2(textureSize(uColor, 0));
    float footprint = max(length(gx * colorSize), length(gy * colorSize));
    c = textureLod(uColor, vUv, log2(max(footprint, 1.0))).rgb;
  }`,
      ),
    fragmentWGSL: desc.fragmentWGSL
      .replaceAll("uniform.uLayer.z", "1.0")
      .replace(
        "var uColor: texture_2d<f32>;",
        "var uColor: texture_2d<f32>;\nuniform uClipCell: vec2f;",
      )
      .replace(
        "let c = textureSample(uColor, uColorSampler, input.vUv);",
        `var c = textureSample(uColor, uColorSampler, input.vUv);
  if (input.vEdge > 0.5) {
    let cell = uniform.uClipCell;
    let gx = select(vec2f(min(length(vec2f(ux.x, uy.x)), cell.x), 0.0), vec2f(cell.x, 0.0), input.vEdge < 2.5);
    let gy = select(vec2f(0.0, cell.y), vec2f(0.0, min(length(vec2f(ux.y, uy.y)), cell.y)), input.vEdge < 2.5);
    let colorSize = vec2f(textureDimensions(uColor, 0));
    let footprint = max(length(gx * colorSize), length(gy * colorSize));
    c = textureSampleLevel(uColor, uColorSampler, input.vUv, log2(max(footprint, 1.0)));
  }`,
      ),
    attributes: { ...desc.attributes, aClipTop: SEMANTIC_ATTR12, aClipFloor: SEMANTIC_ATTR13 },
    vertexGLSL:
      desc.vertexGLSL.slice(0, desc.vertexGLSL.indexOf("void main(void)")) +
      /* glsl */ `
uniform vec4 uClipDimensions;
attribute vec4 aClipTop;
attribute vec4 aClipFloor;
void main(void) {
  ivec2 size = ivec2(uClipDimensions.xy);
  uint code = floatBitsToUint(aClipTop.w);
  uint face = (code >> 24u) & 7u;
  ivec2 cell = ivec2(int(code & uint(uClipDimensions.w)), int((code & 16777215u) >> uint(uClipDimensions.z)));
  vec3 layer = aClipTop.xyz;
  vec2 local = aPosition.xy;
  if (face == 1u) local = vec2(-0.5, aPosition.x);
  if (face == 2u) local = vec2(0.5, -aPosition.x);
  if (face == 3u) local = vec2(-aPosition.x, -0.5);
  if (face == 4u) local = vec2(aPosition.x, 0.5);
  float pointZ = face > 0u && face < 5u ? (aPosition.y < 0.0 ? -float(face) : float(face)) : float(face);
  vec2 uv = (vec2(cell) + 0.5 + local) / vec2(size);
  vec4 corner = aClipFloor;
  float bottom = local.y < 0.0 ? (local.x < 0.0 ? corner.r : corner.g) : (local.x < 0.0 ? corner.b : corner.a);
  float d = pointZ > 0.5 ? bottom : layer.x + dot(layer.yz, local);
  // The movie's outer edge meets its unchanged softened frame exactly.
  if (min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)) < 0.000001)
    d = psvRim(uv, textureLod(uDepth, uv, 0.0).r);
  vUv = uv;
  if (abs(pointZ) > 0.5 && abs(pointZ) < 4.5) {
    if (abs(pointZ) < 2.5) vUv.x = (float(cell.x) + 0.5) / float(size.x);
    else vUv.y = (float(cell.y) + 0.5) / float(size.y);
  }
  vD = d;
  vEdge = pointZ > 4.5 ? 0.0 : abs(pointZ);
  float z = uLift.x * (d - uLift.y);
  gl_Position = psvPlace(vec3((uv.x - 0.5) * uGrid.x, (0.5 - uv.y) * uGrid.y, z));
}
`,
    vertexWGSL:
      desc.vertexWGSL.slice(0, desc.vertexWGSL.indexOf("@vertex fn vertexMain")) +
      /* wgsl */ `
uniform uClipDimensions: vec4f;
attribute aClipTop: vec4f;
attribute aClipFloor: vec4f;
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let size = vec2i(uniform.uClipDimensions.xy);
  let code = bitcast<u32>(input.aClipTop.w);
  let face = (code >> 24u) & 7u;
  let cell = vec2i(i32(code & u32(uniform.uClipDimensions.w)), i32((code & 16777215u) >> u32(uniform.uClipDimensions.z)));
  let layer = input.aClipTop.xyz;
  var local = input.aPosition.xy;
  if (face == 1u) { local = vec2f(-0.5, input.aPosition.x); }
  if (face == 2u) { local = vec2f(0.5, -input.aPosition.x); }
  if (face == 3u) { local = vec2f(-input.aPosition.x, -0.5); }
  if (face == 4u) { local = vec2f(input.aPosition.x, 0.5); }
  let pointZ = select(f32(face), select(f32(face), -f32(face), input.aPosition.y < 0.0), face > 0u && face < 5u);
  let uv = (vec2f(cell) + 0.5 + local) / vec2f(size);
  let corner = input.aClipFloor;
  let bottom = select(select(corner.a, corner.b, local.x < 0.0), select(corner.g, corner.r, local.x < 0.0), local.y < 0.0);
  var d = select(layer.x + dot(layer.yz, local), bottom, pointZ > 0.5);
  if (min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)) < 0.000001) {
    d = psvRim(uv, textureSampleLevel(uDepth, uDepthSampler, uv, 0.0).r);
  }
  output.vUv = uv;
  if (abs(pointZ) > 0.5 && abs(pointZ) < 4.5) {
    if (abs(pointZ) < 2.5) { output.vUv.x = (f32(cell.x) + 0.5) / f32(size.x); }
    else { output.vUv.y = (f32(cell.y) + 0.5) / f32(size.y); }
  }
  output.vD = d;
  output.vEdge = select(abs(pointZ), 0.0, pointZ > 4.5);
  let z = uniform.uLift.x * (d - uniform.uLift.y);
  output.position = psvPlace(vec3f((uv.x - 0.5) * uniform.uGrid.x, (0.5 - uv.y) * uniform.uGrid.y, z));
  return output;
}
`,
  };
  m.matB.update();
}

// The lower curve is shared at native corners. Its indexed mesh draws after
// the walls, preserving the old cap depth ties and native color derivatives.
function clipCaps(m) {
  const desc = m.matB.shaderDesc,
    surface = m.matS.shaderDesc;
  m.clipCapMaterial = new m.matB.constructor({
    ...desc,
    uniqueName: "mp4IndexedCaps",
    fragmentGLSL: `uniform sampler2D uColor;
uniform vec4 uBack;
varying vec2 vUv;
void main(void) {
  vec3 c = texture(uColor, vUv).rgb;
  if (uBack.w > 0.5) c = vec3(1.0, 0.0, 1.0);
  gl_FragColor = vec4(c, 1.0);
}`,
    fragmentWGSL: `var uColor: texture_2d<f32>;
var uColorSampler: sampler;
uniform uBack: vec4f;
varying vUv: vec2f;
@fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  var c = textureSample(uColor, uColorSampler, input.vUv).rgb;
  if (uniform.uBack.w > 0.5) { c = vec3f(1.0, 0.0, 1.0); }
  output.color = vec4f(c, 1.0);
  return output;
}`,

    attributes: surface.attributes,
    vertexGLSL:
      surface.vertexGLSL.slice(0, surface.vertexGLSL.indexOf("void main(void)")) +
      `
uniform vec4 uClipDimensions;
void main(void) {
  vec2 uv = aPosition.xy / uClipDimensions.xy;
  float d = aPosition.z;
  vUv = uv; vD = d; vEdge = 0.0;
  gl_Position = psvPlace(vec3((uv.x - 0.5) * uGrid.x, (0.5 - uv.y) * uGrid.y, uLift.x * (d - uLift.y)));
}`,
    vertexWGSL:
      surface.vertexWGSL.slice(0, surface.vertexWGSL.indexOf("@vertex fn vertexMain")) +
      `
uniform uClipDimensions: vec4f;
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let uv = input.aPosition.xy / uniform.uClipDimensions.xy;
  let d = input.aPosition.z;
  output.vUv = uv; output.vD = d; output.vEdge = 0.0;
  output.position = psvPlace(vec3f((uv.x - 0.5) * uniform.uGrid.x, (0.5 - uv.y) * uniform.uGrid.y, uniform.uLift.x * (d - uniform.uLift.y)));
  return output;
}`,
  });
  m.clipCapMaterial.parameters = m.matB.parameters;
  m.clipCapMaterial.cull = m.matB.cull;
  m.clipCapMaterial.depthTest = true;
  m.clipCapMaterial.depthWrite = true;
  m.clipCapMaterial.update();
  m.miF.drawBucket = 132;
  m.miB.drawBucket = 129;
  m.miS.drawBucket = 127;
  const show = m.show.bind(m);
  m.show = (on) => {
    show(on);
    for (const prefix of ["clipCap", "clipTop"])
      if (m[prefix + "Pass"]) m[prefix + "Pass"].visible = m.visible && m[prefix + "Count"] > 0;
  };
}
function clipCapUpload(m, data, top = false) {
  const prefix = top ? "clipTop" : "clipCap";
  const count = (m[prefix + "Count"] = data?.indices.length || 0);
  if (!count) {
    if (m[prefix + "Pass"]) m[prefix + "Pass"].visible = false;
    return;
  }
  if (!m[prefix + "Mesh"]) {
    const mesh = (m[prefix + "Mesh"] = new m.surface.mesh.constructor(m.device));
    const pass = (m[prefix + "Pass"] = new m.miS.constructor(mesh, m.clipCapMaterial, m.node));
    pass.cull = false;
    pass.drawBucket = top ? 131 : 128;
    m.layer.addMeshInstances([pass]);
  }
  const mesh = m[prefix + "Mesh"];
  mesh.setPositions(data.positions, 3);
  mesh.setIndices(data.indices);
  mesh.update(PRIMITIVE_TRIANGLES, false);
  m[prefix + "Pass"].visible = m.visible;
  m.pieceBytes = m.clipSoftValues.byteLength + (m.clipInstances?.numBytes || 0) + clipCapBytes(m);
}
function clipCapBytes(m) {
  return [m.clipCapMesh, m.clipTopMesh].reduce(
    (sum, mesh) =>
      sum + (mesh?.vertexBuffer?.numBytes || 0) + (mesh?.indexBuffer[0]?.numBytes || 0),
    0,
  );
}

// The frame and picture share every border vertex. The photo frame's 96
// segments can chord across the clip's changing outline, leaving pinholes at
// their joint even when both layers use the same softened depth.
function clipFrame(m) {
  const xs = Array.from({ length: m.cols + 1 }, (_, i) => i / m.cols);
  const ys = Array.from({ length: m.rows + 1 }, (_, i) => i / m.rows);
  const strips = [
    [
      [-1, ...xs, 2],
      [-1, 0],
    ],
    [
      [-1, ...xs, 2],
      [1, 2],
    ],
    [[-1, 0], ys],
    [[1, 2], ys],
  ];
  const positions = [],
    indices = [];
  for (const [us, vs] of strips) {
    const start = positions.length / 3;
    for (const v of vs) for (const u of us) positions.push(u, v, 0);
    for (let y = 0; y + 1 < vs.length; y++)
      for (let x = 0; x + 1 < us.length; x++) {
        const a = start + y * us.length + x,
          c = a + us.length;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
  }
  const frame = new m.surface.mesh.constructor(m.device);
  frame.setPositions(new Float32Array(positions), 3);
  frame.setIndices(new Uint32Array(indices));
  frame.update(PRIMITIVE_TRIANGLES);
  const old = m.frame;
  m.frame = frame;
  m.miF.mesh = frame;
  old.destroy();
}

function clipCellDepth(m, { w, h, data }) {
  m.clipDepthOwner = S.src?.clip;
  let field = m.clipField;
  if (!field || field.w !== w || field.h !== h) {
    field = m.clipField = {
      w,
      h,
      heights: new Float32Array(w * h),
      patches: new Float32Array(w * h * 4),
      floors: new Float32Array(w * h * 4),
      corners: new Float32Array((w + 1) * (h + 1)),
      ids: new Float32Array(w * h),
      rowLow: new Float32Array(w * h),
      rowHigh: new Float32Array(w * h),
      low: new Float32Array(w * h),
      high: new Float32Array(w * h),
      queue: new Int32Array(Math.max(w, h)),
      soft: new Float32Array((m.cols + 1) * (m.rows + 1) * 4),
    };
    m.clipXBits = Math.ceil(Math.log2(w));
    m.clipXMask = 2 ** m.clipXBits - 1;
    m.matB.setParameter("uClipDimensions", [w, h, m.clipXBits, m.clipXMask]);
    m.matB.setParameter("uClipCell", [1 / w, 1 / h]);
    m.clipSoft?.destroy();
    m.clipSoftValues = new Float32Array((m.cols + 1) * (m.rows + 1));
    m.clipSoft = m.byteTexture(
      "mp3-border-depth",
      m.cols + 1,
      m.rows + 1,
      PIXELFORMAT_R32F,
      m.clipSoftValues,
    );
    for (const material of [m.matS, m.matB, m.matF]) material.setParameter("uClipSoft", m.clipSoft);
    m.clipInstances?.destroy();
    m.clipInstances = null;
    m.clipCapacity = 0;
    m.pieceBytes = m.clipSoftValues.byteLength;
  }
  const src =
    data instanceof Uint8Array || data instanceof Uint8ClampedArray
      ? data
      : Uint8Array.from(data, (x) => Math.max(0, Math.min(255, Math.round(x * 255))));
  if (clipGeometry) {
    if (!field.compute) {
      const native = clipGeometry.geometryField(clipGeometry.module, w, h, m.cols, m.rows);
      Object.assign(field, native);
    }
    const clip = S.src?.clip;
    if (m.clipCache && (m.clipCache.clip !== clip || m.clipCache.aspect !== m.clipAspect)) {
      m.clipCache.close();
      m.clipCache = null;
    }
    if (!m.clipPreview && clip && !clip.long && !clip.transition && m.clipCache?.clip !== clip) {
      m.clipCache?.close();
      m.clipCache = clipGeometry.geometryCache(clip, m.cols, m.rows, m.clipAspect);
    }
    if (
      !clip?.long &&
      !clip?.transition &&
      m.clipGeometryOwner === clip &&
      m.clipComputedSource === src &&
      m.clipComputedAspect === m.clipAspect
    ) {
      m.clipWaitingDepth = false;
      return;
    }
    const cached =
      m.clipStreamPacket ||
      (!clip?.long && !clip?.transition && m.clipCache?.clip === clip
        ? m.clipCache.get(S.src.moving.frame, src)
        : null);
    if (
      !cached &&
      m.clipCache?.active &&
      m.clipGeometryOwner === clip &&
      !clip.transition &&
      !m.clipPreview &&
      (player()?.motion?.targets?.play ?? 1) > 0.5 &&
      !player()?.stage?.captureWaiters.length &&
      sharpClipOnly(clip) &&
      clipAlone(m)
    ) {
      // Keep updates and the exact R8 input current while the worker finishes
      // this geometry. No draw is submitted with an older geometry result.
      m.clipWaitingDepth = true;
      return;
    }
    m.clipWaitingDepth = false;
    const values = cached || field;
    m.miB.instancingCount = cached ? cached.count : field.compute(src, true, m.clipAspect);
    clipSoftUpload(m, values.soft);
    clipInstanceData(
      m,
      field,
      m.miB.instancingCount,
      cached?.instances,
      cached?.indices,
      cached?.raster,
    );
    m.clipComputedSource = src;
    m.clipComputedAspect = m.clipAspect;
    return;
  }
  if (field.sampleAspect !== m.clipAspect) {
    field.sampleMaps = null;
    field.sampleAspect = m.clipAspect;
  }
  clipPatches(m, src, field);
  clipCutCells(m, field);
}

// Intact surface triangles keep their native rendering. Add observed pixel
// geometry only around potential cuts, with a neighboring margin and the
// frame's softened band. Exact extrema also catch sub-cell foreground parts.
function clipCutCells(m, field) {
  const { w, h, heights, rowLow, rowHigh, low, high, queue, ids } = field;
  const rx = w / m.cols,
    ry = h / m.rows;
  const ratio = Math.max(rx, ry);
  const radius = Math.ceil(2 * ratio) + 1;
  const border = Math.ceil(8 * ratio);
  // Keep a whole supporting texel beyond each interval; do not assume exact
  // floating-point interpolation weights on a hardware linear sampler.
  // The coordinate pad covers Float32 vertex/neighbor-coordinate rounding.
  const coordinatePad = Math.max(w, h) * 2 ** -22;
  const spanX = Math.ceil(rx + coordinatePad) + 1;
  const spanY = Math.ceil(ry + coordinatePad) + 1;
  const gridError = Math.max(m.cols, m.rows) * 2 ** -23;
  const slopeScale = gridError < 1 ? 1 / (1 - gridError) : Infinity;
  const threshold = CLIP_CUT - 1e-5;
  const line = (input, output, offset, stride, n, maximum) => {
    let head = 0,
      tail = 0,
      next = 0;
    for (let x = 0; x < n; x++) {
      const right = Math.min(n - 1, x + radius);
      while (next <= right) {
        const v = input[offset + next * stride];
        while (
          tail > head &&
          (maximum
            ? input[offset + queue[tail - 1] * stride] <= v
            : input[offset + queue[tail - 1] * stride] >= v)
        )
          tail--;
        queue[tail++] = next++;
      }
      while (queue[head] < x - radius) head++;
      output[offset + x * stride] = input[offset + queue[head] * stride];
    }
  };
  for (let y = 0; y < h; y++) {
    line(heights, rowLow, y * w, 1, w, false);
    line(heights, rowHigh, y * w, 1, w, true);
  }
  for (let x = 0; x < w; x++) {
    line(rowLow, low, x, w, h, false);
    line(rowHigh, high, x, w, h, true);
  }
  let count = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (Math.min(x, y, w - 1 - x, h - 1 - y) <= border || high[i] - low[i] > CLIP_CUT / 2)
        ids[count++] = i;
    }
  const candidates = count;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      low[i] = Math.abs(heights[y * w + Math.min(w - 1, x + 1)] - heights[i]);
      high[i] = Math.abs(heights[Math.min(h - 1, y + 1) * w + x] - heights[i]);
    }
  const maximum = (input, output, offset, stride, n) => {
    let head = 0,
      tail = 0,
      next = 0;
    for (let x = 0; x < n; x++) {
      const right = Math.min(n - 1, x + radius);
      while (next <= right) {
        const value = input[offset + next * stride];
        while (tail > head && input[offset + queue[tail - 1] * stride] <= value) tail--;
        queue[tail++] = next++;
      }
      while (queue[head] < x - radius) head++;
      output[offset + x * stride] = input[offset + queue[head] * stride];
    }
  };
  // The four existing scratch arrays hold gradients, then row maxima, then
  // square maxima. All row passes finish before their input arrays are reused.
  for (let y = 0; y < h; y++) {
    maximum(low, rowLow, y * w, 1, w);
    maximum(high, rowHigh, y * w, 1, w);
  }
  for (let x = 0; x < w; x++) {
    maximum(rowLow, low, x, w, h);
    maximum(rowHigh, high, x, w, h);
  }
  count = 0;
  for (let candidate = 0; candidate < candidates; candidate++) {
    const i = ids[candidate],
      x = i % w,
      y = Math.floor(i / w);
    const possibleCut = slopeScale * (spanX * low[i] + spanY * high[i]) > threshold;
    if (Math.min(x, y, w - 1 - x, h - 1 - y) <= border || possibleCut) ids[count++] = i;
  }
  clipInstanceData(m, field, count);
}

// Instance attributes carry the same Float32 planes and corners directly.
// This avoids two random float-texture reads at every wall/cap vertex.
function clipInstanceData(m, field, cellCount, prepared = null, indices = null, raster = null) {
  const draws = prepared
    ? { instances: prepared, indices }
    : drawFields(field, cellCount, m.cols, m.rows);
  const planes = draws.instances,
    count = planes.length / 8;
  const mesh = m.surface.mesh;
  if (!mesh.clipReferenceIndices) {
    const buffer = mesh.indexBuffer[0];
    mesh.clipReferenceIndices = new Uint32Array(buffer.numIndices);
    buffer.readData(mesh.clipReferenceIndices);
    const Type = buffer.bytesPerIndex === 2 ? Uint16Array : Uint32Array;
    m.clipSurfaceIndices = new Type(buffer.numIndices);
  }
  m.clipSurfaceIndices.set(draws.indices);
  mesh.indexBuffer[0].setData(m.clipSurfaceIndices);
  mesh.primitive[0].count = draws.indices.length;
  m.clipGeometryOwner = S.src.clip;
  m.clipWaitingDepth = false;
  m.clipAllPlanes = planes;
  m.clipRasterPrepared = raster;
  m.clipVisibilitySource = null;
}

// Only faces without raster samples are omitted. Keep both sides of every
// solid: rear caps can close tiny numerical seams between neighboring cells.
// A camera change immediately falls back to the full retained geometry.
function clipVisibleFaces(m, pl) {
  if (!m.clipAllPlanes) return;
  const { w, h } = m.clipField,
    device = m.device;
  const camera = pl.stage.cameraEntity.camera;
  const vp = new Mat4().mul2(camera.projectionMatrix, camera.viewMatrix).data;
  const model = m.node.getWorldTransform().data;
  const pose = ["uGrid", "uLift", "uTf", "uToy", "uBodyQ", "uBodyT"].map((name) =>
    m.u[name].map(Math.fround),
  );
  const key = JSON.stringify([
    Array.from(vp),
    Array.from(model),
    pose,
    device.width,
    device.height,
  ]);
  if (m.clipRasterViewKey !== key) {
    m.clipRasterViewKey = key;
    m.clipRasterQuantum ||= device.gl
      ? 2 ** -device.gl.getParameter(device.gl.SUBPIXEL_BITS)
      : 1 / 16;
    const samples = device.samples || 1,
      rect = camera.rect;
    const aspectMatches = Math.abs(camera.aspectRatio - device.width / device.height) < 1e-6;
    m.clipRasterView =
      samples === 1 && aspectMatches && rect.x === 0 && rect.y === 0 && rect.z === 1 && rect.w === 1
        ? clipRasterView(vp, model, m.u, device.width, device.height, w, h, m.clipRasterQuantum)
        : null;
    if (m.clipRasterView) m.clipRasterView.key = key;
  }
  const view = m.clipRasterView;
  m.clipCache?.ahead(S.src.moving.frame, view);
  m.clipStream?.view(view);
  if (m.clipWaitingDepth) return;
  const ready = view && m.clipRasterPrepared?.key === key ? m.clipRasterPrepared.instances : null;
  const source = ready || m.clipAllPlanes;
  if (m.clipVisibilitySource === source && m.clipVisibilityKey === key) return;
  m.clipVisibilitySource = source;
  m.clipVisibilityKey = key;
  if (clipGeometry && !m.clipRasterNativeReady) {
    m.clipNativeRaster = clipGeometry.geometryRaster(clipGeometry.module);
    m.clipRasterNativeReady = true;
  }
  const indexed = ready
    ? m.clipRasterPrepared
    : indexClipCaps(clipRasterPlanes(source, w, h, view, m.clipNativeRaster), w, h);
  clipCapUpload(m, indexed.caps);
  clipCapUpload(m, indexed.tops, true);
  const visible = indexed.instances,
    count = visible.length / 8;
  const stats = (m.clipRasterStats ||= { prepared: 0, computed: 0 });
  stats[ready ? "prepared" : "computed"]++;
  if (!m.clipInstances || m.clipCapacity < count) {
    m.clipCapacity = 2 ** Math.ceil(Math.log2(Math.max(1, count)));
    m.clipInstanceValues = new Float32Array(m.clipCapacity * 8);
    m.miB.setInstancing(null);
    m.clipInstances?.destroy();
    m.clipInstances = new VertexBuffer(
      m.device,
      new VertexFormat(m.device, [
        { semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 },
        { semantic: SEMANTIC_ATTR13, components: 4, type: TYPE_FLOAT32 },
      ]),
      m.clipCapacity,
      { usage: BUFFER_DYNAMIC },
    );
    m.miB.setInstancing(m.clipInstances, false);
    m.pieceBytes = m.clipSoftValues.byteLength + m.clipInstances.numBytes + clipCapBytes(m);
  }
  m.clipInstanceValues.set(visible);
  m.clipInstances.setData(m.clipInstanceValues);
  m.miB.instancingCount = count;
}

function clipSoftUpload(m, pixels) {
  if (pixels.length !== m.clipSoftValues.length) {
    for (let i = 0; i < m.clipSoftValues.length; i++) m.clipSoftValues[i] = pixels[i * 4];
    pixels = m.clipSoftValues;
  }
  m.clipSoft.lock().set(pixels);
  m.clipSoft.unlock();
}

// Each observed texel owns a tiny depth patch. Smooth neighbors supply its
// slope; a depth discontinuity supplies no slope across that edge, keeping
// foreground and background as separate layers rather than a stretched strip.
function clipPatches(m, src, field) {
  const { w, h, heights, patches } = field;
  // Texture coordinates depend on the mesh, never on the movie frame. Keep
  // the two separable axes instead of reclamping and flooring all 25 taps
  // at every border vertex on every update. Float64 keeps the original math.
  const maps = (field.sampleMaps ||= clipSampleMaps(m, w, h));
  const sample = (xs, ys, x, y) => {
    const i = x * 3,
      j = y * 3;
    const a = ys[j] * w,
      b = ys[j + 1] * w;
    const lo = xs[i],
      hi = xs[i + 1],
      fx = xs[i + 2],
      fy = ys[j + 2];
    return (
      ((src[a + lo] * (1 - fx) + src[a + hi] * fx) * (1 - fy) +
        (src[b + lo] * (1 - fx) + src[b + hi] * fx) * fy) /
      255
    );
  };
  const softened = (xs, ys, x, y) => {
    let sum = 0;
    for (let j = 0; j < 5; j++)
      for (let k = 0; k < 5; k++) sum += sample(xs, ys, x * 5 + k, y * 5 + j);
    return sum / 25;
  };
  const smooth = (a, b, v) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y <= m.rows; y++)
    for (let x = 0; x <= m.cols; x++) {
      const u = Math.fround(x / m.cols),
        v = Math.fround(y / m.rows);
      const rd = Math.min(x, y, m.cols - x, m.rows - y);
      const raw = sample(maps.gridX, maps.gridY, x * 5 + 2, y * 5 + 2);
      let d = raw,
        edge = 0;
      if (rd <= 6) {
        const weight = smooth(2, 6, rd);
        d = softened(maps.gridX, maps.gridY, x, y) * (1 - weight) + raw * weight;
      } else {
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++)
            edge = Math.max(
              edge,
              Math.abs(sample(maps.edgeX, maps.edgeY, x * 3 + k + 1, y * 3 + j + 1) - raw),
            );
      }
      const offset = (y * (m.cols + 1) + x) * 4;
      field.soft[offset] = d;
      field.soft[offset + 1] = raw;
      field.soft[offset + 2] = edge;
    }
  clipSoftUpload(m, field.soft);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        u = (x + 0.5) / w,
        v = (y + 0.5) / h;
      const rd = Math.min(u * m.cols, (1 - u) * m.cols, v * m.rows, (1 - v) * m.rows);
      let d = src[i] / 255;
      if (rd < 6) {
        const weight = smooth(2, 6, rd);
        d = softened(maps.pixelX, maps.pixelY, x, y) * (1 - weight) + d * weight;
      }
      heights[i] = d;
    }
  const slope = (lo, center, hi, cut) => {
    const a = Math.abs(lo - center) <= cut,
      b = Math.abs(hi - center) <= cut;
    return a && b ? (hi - lo) / 2 : a ? center - lo : b ? hi - center : 0;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        d = heights[i];
      let gx = slope(
        heights[y * w + Math.max(0, x - 1)],
        d,
        heights[y * w + Math.min(w - 1, x + 1)],
        (CLIP_CUT * m.cols) / w,
      );
      let gy = slope(
        heights[Math.max(0, y - 1) * w + x],
        d,
        heights[Math.min(h - 1, y + 1) * w + x],
        (CLIP_CUT * m.rows) / h,
      );
      const extent = (Math.abs(gx) + Math.abs(gy)) / 2;
      const scale = extent > 0 ? Math.min(1, Math.min(d, 1 - d) / extent) : 1;
      gx *= scale;
      gy *= scale;
      patches[i * 4] = d;
      patches[i * 4 + 1] = gx;
      patches[i * 4 + 2] = gy;
      patches[i * 4 + 3] = src[i] / 255;
    }
  // Each cell meets the same lower corner as its four incident neighbors.
  // The cap joins those corners, closing triple junctions without extending
  // an intact, flat picture into an arbitrary colored volume.
  const { corners, floors } = field;
  for (let y = 0; y <= h; y++)
    for (let x = 0; x <= w; x++) {
      let bottom = 1;
      for (let dy = -1; dy <= 0; dy++)
        for (let dx = -1; dx <= 0; dx++) {
          const cx = Math.max(0, Math.min(w - 1, x + dx)),
            cy = Math.max(0, Math.min(h - 1, y + dy));
          const at = (cy * w + cx) * 4;
          const depth =
            patches[at] + patches[at + 1] * (x - cx - 0.5) + patches[at + 2] * (y - cy - 0.5);
          bottom = Math.min(bottom, depth);
        }
      corners[y * (w + 1) + x] = bottom;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const at = (y * w + x) * 4,
        corner = y * (w + 1) + x;
      floors[at] = corners[corner];
      floors[at + 1] = corners[corner + 1];
      floors[at + 2] = corners[corner + w + 1];
      floors[at + 3] = corners[corner + w + 2];
    }
}

function clipSampleMaps(m, w, h) {
  const axis = (count, size, coordinate, offsets) => {
    const out = new Float64Array(count * offsets.length * 3);
    for (let i = 0; i < count; i++)
      for (let k = 0; k < offsets.length; k++) {
        const p = Math.max(0, Math.min(size - 1, (coordinate(i) + offsets[k]) * size - 0.5));
        const lo = Math.floor(p),
          at = (i * offsets.length + k) * 3;
        out[at] = lo;
        out[at + 1] = Math.min(size - 1, lo + 1);
        out[at + 2] = p - lo;
      }
    return out;
  };
  const ox = [-2, -1, 0, 1, 2].map((k) => k * 0.02 * m.clipAspect);
  const oy = [-2, -1, 0, 1, 2].map((k) => k * 0.02);
  return {
    gridX: axis(m.cols + 1, w, (x) => Math.fround(x / m.cols), ox),
    gridY: axis(m.rows + 1, h, (y) => Math.fround(y / m.rows), oy),
    pixelX: axis(w, w, (x) => (x + 0.5) / w, ox),
    pixelY: axis(h, h, (y) => (y + 0.5) / h, oy),
    edgeX: axis(m.cols + 1, w, (x) => Math.fround(x / m.cols), [-1 / m.cols, 0, 1 / m.cols]),
    edgeY: axis(m.rows + 1, h, (y) => Math.fround(y / m.rows), [-1 / m.rows, 0, 1 / m.rows]),
  };
}

// WebGL video uploads may use coded pixels rather than the display-sized
// picture (for example, non-square pixels or a display transform). Use the
// native display canvas unless an untransformed direct upload is established.
const clipVideoModes = new WeakMap();
function directClipVideo(video) {
  const key = `${video.currentSrc}|${video.videoWidth}|${video.videoHeight}`;
  const saved = clipVideoModes.get(video);
  if (saved?.key === key) return saved.direct;
  let direct = false,
    frame;
  try {
    frame = new VideoFrame(video);
    direct =
      frame.rotation === 0 &&
      frame.flip === false &&
      frame.visibleRect.width === video.videoWidth &&
      frame.visibleRect.height === video.videoHeight;
  } catch {
    /* The canvas path also works without WebCodecs. */
  } finally {
    frame?.close();
  }
  clipVideoModes.set(video, { key, direct });
  return direct;
}
// A paused seek must read the decoder's current display picture. A fresh
// canvas texture also avoids reusing differently sized coded video storage.
function clipPicture(m, video) {
  if (!video.paused && directClipVideo(video)) return m.setColor(video);
  if (m.colorSrc instanceof HTMLVideoElement) {
    m.color?.destroy();
    m.color = null;
  }
  const c = (S.clipStill ||= document.createElement("canvas"));
  if (c.width !== video.videoWidth || c.height !== video.videoHeight) {
    c.width = video.videoWidth;
    c.height = video.videoHeight;
  }
  c.getContext("2d").drawImage(video, 0, 0);
  c.currentTime = video.currentTime; // the snapshot's source time, for diagnostics
  m.setColor(c);
}

// Whether the video has a new picture since the last upload (the browser says so where it can,
// else its time moved), so a paused or slow video isn't uploaded again every frame.
function newFrame(v) {
  const moved = v.currentTime !== S.lastTime;
  S.lastTime = v.currentTime;
  const decoded = v.getVideoPlaybackQuality?.().totalVideoFrames ?? v.webkitDecodedFrameCount;
  const changed = decoded !== undefined && decoded !== S.decodedFrames;
  S.decodedFrames = decoded;
  if (S.rvfc !== v) {
    S.rvfc = v;
    S.fresh = true;
    const tick = () => {
      if (S.rvfc !== v) return;
      S.fresh = true;
      v.requestVideoFrameCallback?.(tick);
      player()?.stage?.requestRender?.(0);
    };
    v.requestVideoFrameCallback?.(tick);
  }
  const fresh = S.fresh;
  S.fresh = false;
  const now = performance.now();
  const fallback = moved && (v.paused || now - (S.frameNoticedAt || 0) >= 100);
  if (fresh || changed || fallback) S.frameNoticedAt = now;
  return fresh || changed || fallback;
}

// A decoded picture is often slower than the display clock. Drawing the same
// solid again competes with its next color readback, especially on a phone.
// Keep the regular update clock, but draw only changed clip pixels or poses.
// Captures and other visible scene geometry always retain the normal path.
function clipAlone(m) {
  return !m.layer.meshInstances.some(
    (mi) =>
      mi.visible &&
      mi.node.enabled &&
      mi !== m.miS &&
      mi !== m.miB &&
      mi !== m.miF &&
      mi !== m.clipCapPass &&
      mi !== m.clipTopPass,
  );
}
function watchClipDraws(stage) {
  let previous = null,
    pending = null;
  const signature = () => {
    const m = S.mesh,
      pl = player();
    if (
      S.stage !== stage ||
      !m?.clipOnly ||
      !sharpClipOnly(S.src?.clip) ||
      pl?.loading ||
      stage.graveyard.length ||
      stage.captureWaiters.length ||
      !clipAlone(m)
    )
      return null;
    const camera = stage.cameraEntity.camera;
    return JSON.stringify([
      m.clipRevision,
      m.miB.instancingCount,
      m.u,
      Array.from(m.node.getWorldTransform().data),
      Array.from(stage.cameraEntity.getWorldTransform().data),
      Array.from(camera.projectionMatrix.data),
      camera.clearColor.r,
      camera.clearColor.g,
      camera.clearColor.b,
      stage.app.graphicsDevice.width,
      stage.app.graphicsDevice.height,
    ]);
  };
  stage.app.on("framerender", () => {
    if (stage.captureWaiters.length && S.stage === stage && sharpClipOnly(S.src?.clip))
      fillClip(S.mesh, S.src);
    if (
      S.mesh?.clipWaitingDepth &&
      sharpClipOnly(S.src?.clip) &&
      clipAlone(S.mesh) &&
      !stage.captureWaiters.length
    ) {
      stage.app.renderNextFrame = false;
      return;
    }
    pending = signature();
    if (pending === null) previous = null;
    else if (pending === previous) stage.app.renderNextFrame = false;
  });
  stage.app.on("postrender", () => {
    previous = pending;
  });
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
    tint: !!S.tint, // (tests: the backing in magenta)
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
      // (at the depth of the picture's border, so the two meet with no gap and the edge stays
      // straight however the depth runs along it)
      frame: { across: 0.05 / src.width, down: 0.05 / src.height, z: 0 },
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
  if (!ent || (!wanted() && !backgroundWanted())) {
    if (m.visible || m.miB.visible) hide();
    return;
  }
  if (!m.node.parent) pl.stage.app.root.addChild(m.node);
  m.node.setPosition(ent.getPosition());
  m.node.setRotation(ent.getRotation());
  const s = ent.getLocalScale();
  m.node.setLocalScale(s.x, s.y, s.z);
  if (!wanted() && backgroundWanted()) m.showBackground(true);
  if (S.src?.kind === "clip" && S.src.moving.clip?.long) fillClip(m, S.src); // (keep the video in step)
  if (S.src?.kind === "clip") clipVisibleFaces(m, pl);
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
// (lane Photo depth: `tint` draws the backing in magenta, for the tests)
const tint = (on) => {
  S.tint = !!on;
  sync();
  player()?.stage?.requestRender?.();
};
if (typeof window !== "undefined") window.__psv = { set: setSharpView, state: sharpState, tint };
