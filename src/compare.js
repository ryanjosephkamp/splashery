// Studio media: "Show the original". The flat picture (a photo, a GIF's or video's frames, a
// video's own clip) in a small card over a corner of the stage, beside the 3D result, so a
// person can turn the 3D one and see what the effect did. Photo to 3D, Moving photo to 3D and
// Video to 3D each ask for it with an option, and keep it in step: the card shows what the toy
// shows (a video's flight time, a clip's frame) and goes away when another toy is chosen. Nothing here loads before somebody switches the option on.
//
//   const card = original(owner);   // the one card; another owner takes it over
//   card.image({ w, h, data, label })           // a photo's pixels (RGBA)
//   card.frames({ w, h, frame: (i) => RGBA, label })  // a clip's frames; sync({ frame: i })
//   card.video({ srcs: [{ url, type }], label })     // a video; sync({ time, playing })
//   card.sync({ time, playing, frame })         // every frame the toy draws
//   card.hide()

const STYLE = `
.smd-original { position: fixed; z-index: 24; top: 88px; left: 12px; width: min(34vw, 200px); margin: 0; padding: 4px;
  background: var(--panel, #fff); color: var(--ink, #111); border: 1px solid var(--line-strong, #8c8c8c); border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25); pointer-events: none; font: 12px/1.3 var(--font-sans, system-ui, sans-serif); }
.smd-original[hidden] { display: none; }
.smd-original figcaption { padding: 3px 4px 1px; font-weight: 600; }
.smd-original canvas, .smd-original video { display: block; width: 100%; height: auto; border-radius: 6px; background: #000; }
@media (min-width: 900px) { .smd-original { width: min(22vw, 320px); top: 96px; left: 18px; } }
`;

const CARDS = new Map();
let active = null; // the owner whose card shows

function root() {
  let el = document.querySelector(".smd-original");
  if (el) return el;
  if (!document.getElementById("smd-original-style")) {
    const s = document.createElement("style");
    s.id = "smd-original-style";
    s.textContent = STYLE;
    document.head.append(s);
  }
  el = document.createElement("figure");
  el.className = "smd-original";
  el.setAttribute("role", "img");
  el.hidden = true;
  document.body.append(el);
  return el;
}

// The type a browser can play (an MP4 where it can, else WebM: some Chromium builds can't play H.264).
export function playableSource(srcs) {
  const v = document.createElement("video");
  const rank = (s) => (/mp4/.test(s.type) ? 0 : 1);
  return [...srcs].sort((a, b) => rank(a) - rank(b)).find((s) => v.canPlayType(s.type)) || srcs[0];
}

export function original(owner) {
  if (CARDS.has(owner)) return CARDS.get(owner);
  const state = {
    rate: 0,
    prev: null,
    kind: null,
    canvas: null,
    video: null,
    frame: null,
    shown: -1,
    seen: 0,
  };
  const card = {
    owner,
    state,
    // The card's media: swapped out when a toy shows something else.
    clear() {
      if (state.blob) URL.revokeObjectURL(state.blob);
      state.blob = null;
      const el = root();
      el.replaceChildren();
      state.canvas = state.video = state.frame = null;
      state.kind = null;
      state.shown = -1;
    },
    caption(label) {
      const c = document.createElement("figcaption");
      c.textContent = label || "Original";
      root().append(c);
    },
    take() {
      active = owner;
      state.seen = performance.now();
      root().hidden = false;
    },
    image({ w, h, data, label }) {
      card.clear();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
      root().append(c);
      card.caption(label);
      state.kind = "image";
      state.canvas = c;
      card.take();
    },
    frames({ w, h, frame, label }) {
      card.clear();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      root().append(c);
      card.caption(label);
      state.kind = "frames";
      state.canvas = c;
      state.frame = frame;
      card.take();
    },
    video({ srcs, label, muted = true }) {
      card.clear();
      const v = document.createElement("video");
      const s = playableSource(srcs);
      v.muted = muted;
      v.loop = false;
      v.playsInline = true;
      v.preload = "auto";
      // The clip is a few megabytes: kept in memory as a blob, so a seek never waits on the server (a
      // static host without range requests can't seek a video it hasn't downloaded yet).
      fetch(s.url)
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((b) => {
          if (state.video !== v) return;
          state.blob = URL.createObjectURL(b);
          v.src = state.blob;
        })
        .catch(() => {
          if (state.video === v && !v.src) v.src = s.url;
        });
      root().append(v);
      card.caption(label);
      state.kind = "video";
      state.video = v;
      card.take();
    },
    // Called with what the toy shows now: { frame } for frames, { time, playing } for a video.
    sync({ time = 0, playing = false, frame = 0 } = {}) {
      if (active !== owner) return;
      state.seen = performance.now();
      if (state.kind === "frames" && frame !== state.shown) {
        state.shown = frame;
        const c = state.canvas;
        const px = state.frame(frame);
        if (px) c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(px), c.width, c.height), 0, 0); // prettier-ignore
      } else if (state.kind === "video") {
        const v = state.video;
        if (!(v.readyState >= 1)) return;
        const t = Math.max(0, Math.min(v.duration || time, time));
        // While it plays, the video runs on its own clock and is pulled back only when it has
        // drifted by a third of a second (and not while it is still seeking, nor more than once a
        // second: a device that draws only a frame or two a second flies slower than the clock, the
        // engine stepping at most a tenth of a second a frame, and a seek on every frame would never
        // let the video run). Held still, it is exact.
        const now = performance.now();
        const drift = Math.abs(v.currentTime - t);
        // (a recorder that steps the clock by hand, __clipT, wants every frame exact)
        if (!playing || globalThis.__clipT !== undefined) {
          if (drift > 0.02) v.currentTime = t;
        } else if (!v.seeking && drift > 0.35 && now - state.sought > 1000) {
          state.sought = now;
          v.currentTime = t;
        }
        const run = playing && globalThis.__clipT === undefined;
        if (run && v.paused) v.play().catch(() => {});
        else if (!run && !v.paused) v.pause();
      }
    },
    hide() {
      if (!state.kind && active !== owner) return;
      if (active === owner) active = null;
      const v = state.video;
      if (v) v.pause();
      card.clear();
      const el = document.querySelector(".smd-original");
      if (el && !active) el.hidden = true;
    },
    // What the card shows now (for the tests).
    info() {
      const v = state.video;
      return { kind: state.kind, active: active === owner, time: v ? v.currentTime : null, paused: v ? v.paused : null, frame: state.shown, w: (state.canvas || v)?.width || v?.videoWidth || 0 }; // prettier-ignore
    },
  };
  CARDS.set(owner, card);
  return card;
}

// Another toy chosen: the card goes with the toy that asked for it (owner is the toy's id).
setInterval(() => {
  if (active && globalThis.window?.__splashery?.player?.scene?.toy?.id !== active) CARDS.get(active)?.hide(); // prettier-ignore
}, 400);
