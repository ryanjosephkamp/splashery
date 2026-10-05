// Lane QR: a QR code generator made of splats (the "QR code" toy on the
// Studio shelf, labs only). Type a link or any text and it becomes a QR code
// whose modules are crisp cells of splats, in one of seven styles (Classic,
// Dots, Rounded, Bricks, Gems, Bubbles, Neon), on a plate of paper, wood or
// metal. The code always scans: "Scan view" turns it flat and square to the
// camera, and "Check that it scans" renders that view and reads it back
// (src/qr/scan.js), after every change.
//
// A tap bursts the code into its modules, which fall and fly back; the Toy
// tab also has Assemble and Flip. Each module, and each finder and alignment
// pattern, moves as a solid piece of its own (src/qr/field.js, the labs GPU
// program) and lands exactly on its grid again.
//
// Nothing leaves the device: no shortener, no network. The text lives in the
// toy's options, so a #s= link carries it.
//
// The test hook for the QR scan lab (docs/handoff/QR.md): window.__splashery.qr.

import { encodeQR, ECC_RECOVERY, QUIET } from "../qr/encode.js";
import { buildCode, STYLES, PLATES, PRESETS, palette, codeContrast } from "../qr/build.js";
import { qrModifier, MOTION_SECS, MOTION_IDS, PATTERNS, PHASE_RATE } from "../qr/field.js";
import { readCode } from "../qr/scan.js";
import { KINDS, kindById, contentText, shareableFields } from "../qr/content.js";
import { THEMES, themeById, themeOptions } from "../qr/themes.js";
import * as pc from "../pc.js";
// The site's exports (PNG, GIF), loaded when a picture is first made (they
// need the browser's import map, so the Node tools never load them).
const exportsJS = () => import("../exports.js");

export const DEFAULT_TEXT = "https://ryanjosephkamp.github.io/splashery/";
// Defaults and warnings from the QR scan lab's measured scorecard of this
// toy (docs/audits/qr-scan-lab-2026-10.md on its branch, October 3, 2026:
// 3,768 captures, read by jsQR and zxing):
// - level M for every style: on phone-like captures every style read 100%
//   at L and M, while Q and H (denser codes) were where depth styles failed;
// - contrast: reliable from 4:1 (gray at 4.0:1 read 96-98%), poor below 3:1;
// - at least 4 pixels per module on screen, 6 for the depth-heavy styles;
// - version 8 or more in a depth style drops sharply (77% for a long text);
// - light on dark: most phone cameras read it, some scanner apps don't, and
//   Bricks or Gems light on dark never read.
export const eccFor = (o) => (o.ecc && o.ecc !== "auto" ? o.ecc : "M");
export const minContrast = () => 4;
const DEPTH = new Set(["bricks", "gems", "neon", "bubbles"]);
const minModulePx = (o) => (["bricks", "gems", "neon"].includes(o.style) ? 6 : 4);
export const MIN_MODULE_PX = 4;

const MOTIONS = Object.keys(MOTION_SECS);
// Lane QR r3: Alive's speed, from the speed slider (0..1): a quarter as fast
// at 0, normal at 0.5, four times as fast at 1.
export const speedOf = (v) => Math.pow(4, 2 * (Number.isFinite(v) ? v : 0.5) - 1);

// What the open code is, for the panel and the hook.
const QR = { code: null, options: null, error: "", fit: null, kit: null, check: null, checking: false, still: false, gif: null, timer: 0, phase: 0, lastT: null, knock: [0, 0], last: "burst" }; // prettier-ignore

// ---- What the code holds ------------------------------------------------------------------
// A link or plain text lives in the `text` option. Other kinds keep their
// form in `fields` (JSON) and their text is made from it (src/qr/content.js).
// The Wi-Fi password is never in the options, so never in a #s= link or a
// saved scene: it is kept here, in this page's memory, while the page is open.
const SECRET = {}; // kind -> { field: value }

export const kindOf = (o) => (KINDS.some((k) => k.id === o.kind) ? o.kind : "link");

export function fieldsOf(o, kind = kindOf(o)) {
  if (kind === "link") return { url: o.text ?? DEFAULT_TEXT };
  if (kind === "text") return { text: o.text ?? "" };
  let f = {};
  try {
    f = kindOf(o) === kind ? JSON.parse(o.fields || "{}") : {};
  } catch {
    f = {};
  }
  return { ...f, ...(SECRET[kind] || {}) };
}

// The toy's options for a kind and its form (the secret part kept aside).
export function optionsFor(kind, f) {
  if (kind === "link") return { kind, text: String(f.url ?? "").trim(), fields: "" };
  if (kind === "text") return { kind, text: String(f.text ?? ""), fields: "" };
  const keep = shareableFields(kind, f);
  const secret = {};
  for (const k of Object.keys(f)) if (!(k in keep)) secret[k] = f[k];
  SECRET[kind] = secret;
  return { kind, fields: JSON.stringify(keep), text: "" };
}

// The text the code holds.
export function textFor(o) {
  const kind = kindOf(o);
  if (kind === "link" || kind === "text") return o.text ?? DEFAULT_TEXT;
  return contentText(kind, fieldsOf(o, kind));
}

// A Wi-Fi code opened from a link has no password until it is typed again.
const missingSecret = (o) =>
  kindOf(o) === "wifi" && fieldsOf(o).security !== "nopass" && !SECRET.wifi?.password;

function codeFor(o) {
  const text = textFor(o);
  try {
    return { code: encodeQR(text, eccFor(o)), error: "" };
  } catch (err) {
    // Too long: show the start of it, and say so.
    let cut = text;
    while (cut.length > 1) {
      cut = cut.slice(0, Math.floor(cut.length * 0.9));
      try {
        return { code: encodeQR(cut, eccFor(o)), error: err.message };
      } catch {
        // shorter still
      }
    }
    return { code: encodeQR("", eccFor(o)), error: err.message };
  }
}

// ---- Sounds ---------------------------------------------------------------------------
// Soft, not electronic (PACKS.md 7e): the assemble is a soft rush in and a
// muffled settle as the pieces lock; the burst a soft pop, a whoosh out and
// the light patter of pieces landing, then the rush back.
const SOUNDS = {
  assemble: [
    { voice: "breath", f: 900, to: 0.6, decay: 1.4, vol: 0.18 },
    { voice: "thud", at: 1.35, f: 150, decay: 0.25, vol: 0.35 },
    { voice: "wood", at: 1.55, f: 700, decay: 0.15, vol: 0.18 },
  ],
  flip: [
    { voice: "breath", f: 1400, to: 0.7, decay: 0.9, vol: 0.12 },
    { voice: "breath", at: 1.7, f: 1200, to: 0.7, decay: 0.9, vol: 0.12 },
  ],
  // Lane QR r3.
  ripple: [
    { voice: "breath", f: 500, to: 0.8, decay: 1.6, vol: 0.16 },
    { voice: "breath", at: 1.2, f: 420, to: 0.8, decay: 1.4, vol: 0.12 },
  ],
  flap: Array.from({ length: 14 }, (_, i) => ({ voice: "wood", at: 0.2 + i * 0.24, f: 1500 + 90 * (i % 3), decay: 0.05, vol: 0.09 })), // prettier-ignore
  fold: [
    { voice: "breath", f: 1800, to: 0.6, decay: 0.7, vol: 0.12 },
    { voice: "wood", at: 1.15, f: 520, decay: 0.12, vol: 0.12 },
    { voice: "breath", at: 1.35, f: 1600, to: 0.6, decay: 0.7, vol: 0.1 },
    { voice: "wood", at: 2.45, f: 480, decay: 0.12, vol: 0.1 },
    { voice: "breath", at: 2.6, f: 1700, to: 0.7, decay: 1.6, vol: 0.12 },
  ],
  rain: [
    { voice: "breath", f: 900, to: 1.3, decay: 0.6, vol: 0.12 },
    { voice: "patter", at: 1.0, f: 2200, n: 24, decay: 2.2, vol: 0.3 },
    { voice: "wood", at: 3.4, f: 700, decay: 0.14, vol: 0.12 },
  ],
  knock: [
    { voice: "wood", f: 420, decay: 0.12, vol: 0.3 },
    { voice: "breath", f: 800, to: 0.6, decay: 0.5, vol: 0.14 },
    { voice: "wood", at: 1.05, f: 900, decay: 0.08, vol: 0.12 },
    { voice: "wood", at: 1.2, f: 1100, decay: 0.06, vol: 0.08 },
  ],
  cloud: [
    { voice: "breath", f: 2600, to: 0.5, decay: 2.2, vol: 0.12 },
    { voice: "breath", at: 3.0, f: 1300, to: 1.6, decay: 2.0, vol: 0.12 },
  ],
  burst: [
    { voice: "thud", f: 110, decay: 0.3, vol: 0.4 },
    { voice: "breath", f: 700, to: 0.5, decay: 0.9, vol: 0.2 },
    { voice: "wood", at: 1.05, f: 900, decay: 0.12, vol: 0.12 },
    { voice: "wood", at: 1.2, f: 760, decay: 0.12, vol: 0.1 },
    { voice: "breath", at: 2.15, f: 600, to: 1.2, decay: 1.0, vol: 0.16 },
  ],
};
const TAP = { last: {} };

// ---- Scan view ----------------------------------------------------------------------------

// The kit's fit ({ center, scale }) of the code showing now.
function fitNow() {
  const t = QR.kit?.transform;
  return t && Number.isFinite(t.scale) ? t : QR.fit;
}

// The camera flat and square to the code, the whole quiet zone in view with
// a margin past it (`margin` modules). The stage's field of view (38°) spans
// the canvas's narrower side, so the same distance fits any shape of canvas.
export function scanPose(margin = 1) {
  const app = globalThis.__splashery?.app;
  const cam = app?.player?.camera;
  const fit = fitNow();
  if (!cam || !fit || !QR.code) return { yaw: 0, pitch: 0, roll: 0, distance: 3 };
  const half = (QR.code.size / 2 + QUIET + margin) * fit.scale; // toy units
  // The camera aims at the toy's center: the middle of the reach (z from
  // -1.2 to 0.6), 0.3 modules behind the code's face.
  const d = half / Math.tan((19 * Math.PI) / 180) + 0.3 * fit.scale;
  return { yaw: 0, pitch: 0, roll: 0, distance: d / (cam.radius || 1) };
}

function snapScanView() {
  const app = globalThis.__splashery?.app;
  const player = app?.player;
  if (!player) return;
  // On screen, a wider margin keeps the quiet zone clear of the buttons over
  // the stage's edges.
  player.camera.setState(scanPose(3), { snap: true });
  player.stage?.requestRender?.();
}

// Renders the scan view as a square picture of `size` pixels, still.
async function renderScan(app, size) {
  const player = app.player;
  return app.withCapture([size, size], async () => {
    QR.still = true;
    try {
      // Lane QR r3: a first frame starts the splat sort for this view (it
      // finishes on a worker a frame or more later); the second is the
      // picture. Right after a build, the first frame of the finer edges
      // was drawn before any sort, gray and hatched.
      await player.renderAt(player.time, scanPose());
      await new Promise((r) => setTimeout(r, 80));
      const shot = await player.renderAt(player.time, scanPose());
      const out = document.createElement("canvas");
      out.width = out.height = size;
      out.getContext("2d").drawImage(shot, 0, 0, size, size);
      return out;
    } finally {
      QR.still = false;
    }
  });
}

const idle = (app) => {
  const st = app?.player?.motion?.state || {};
  return MOTIONS.every((k) => !(st[k] > 0));
};

// Renders the scan view and reads it back. Sets QR.check:
// { ok, text, reader, inverted, at } (ok: it read back the very text).
export async function checkScan() {
  clearTimeout(QR.timer); // a check asked for now replaces the automatic one
  // One check at a time: a second call waits for the one running, and
  // takes its result only if it was for the code built last.
  while (QR.running) {
    const { promise, kit } = QR.running;
    const r = await promise;
    if (kit === QR.kit) return r;
  }
  const kit = QR.kit;
  const promise = runCheck().finally(() => (QR.running = null));
  QR.running = { promise, kit };
  return promise;
}

// True once the code built last is the one on the stage (the player swaps
// the toy in after the build, so a check started in between would read the
// code before it).
const showing = (app) => !!QR.kit && app?.player?.proc?.ctx?.kit === QR.kit;

async function runCheck() {
  const app = globalThis.__splashery?.app;
  if (!app?.player || !QR.code) return QR.check;
  for (let i = 0; i < 120 && !showing(app); i++) await new Promise((r) => setTimeout(r, 50));
  if (!showing(app)) return (QR.check = { ok: false, read: null, text: QR.code.text, error: "The code wasn't on the stage yet." }); // prettier-ignore
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  QR.checking = true;
  refreshPanel();
  try {
    const canvas = await renderScan(app, 720);
    QR.lastShot = canvas; // for the hook (the lab can see what was read)
    const r = await readCode(canvas);
    const want = QR.code.text;
    QR.check = r
      ? { ok: r.text === want, read: r.text, reader: r.reader, inverted: r.inverted, text: want }
      : { ok: false, read: null, text: want };
  } catch (err) {
    QR.check = { ok: false, read: null, text: QR.code?.text, error: err.message, stack: err.stack };
  } finally {
    QR.checking = false;
  }
  refreshPanel();
  return QR.check;
}

// After each change, a check once the new code is showing and still.
function scheduleCheck() {
  clearTimeout(QR.timer);
  QR.check = null;
  if (typeof window === "undefined" || QR.noAuto) return;
  let tries = 0;
  const go = () => {
    const app = globalThis.__splashery?.app;
    const ready = app?.player?.toyInfo?.id === "qr-code" && document.body.dataset.ready === "true";
    if (ready && showing(app) && idle(app) && !app.busy) return checkScan();
    if (++tries < 40) QR.timer = setTimeout(go, 250);
  };
  QR.timer = setTimeout(go, 600);
}

// ---- Exports ------------------------------------------------------------------------------

// After a PNG, a GIF or a copied link of glowing (dark-wall) Neon: a tip
// that a pale wall scans in every reader, with a one-tap switch in the panel.
const NEON_TIP = "For printing or sharing, Neon on a pale wall scans in every reader.";
function neonTip() {
  const o = QR.options || {};
  if (o.style !== "neon" || palette(o).neonLight) return;
  QR.neonTip = true;
  refreshPanel();
  globalThis.__splashery?.app?.ui?.toast?.(`${NEON_TIP} The switch is in the Toy tab.`, 5000);
}
if (typeof document !== "undefined")
  document.addEventListener(
    "click",
    (e) => {
      const toy = globalThis.__splashery?.app?.player?.toyInfo?.id;
      if (toy === "qr-code" && e.target?.closest?.("#share-link")) setTimeout(neonTip, 50);
    },
    true,
  );

async function savePNG(size = 1600) {
  const app = globalThis.__splashery?.app;
  if (!app) return null;
  return app.withBusy("Making the picture…", async () => {
    const { canvasToBlob, downloadBlob, timestampName } = await exportsJS();
    const canvas = await renderScan(app, size);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, timestampName("png", "splashery-qr"));
    app.ui.toast("Picture saved, with its quiet zone.");
    setTimeout(neonTip, 1500);
    return blob;
  });
}

// An animated GIF of the tap's motion, seen in scan view, ending on the
// code held still for 1.6 seconds (long enough to scan from the GIF); or,
// with motion "alive", one seamless loop of the Alive wave.
export async function makeGIF({
  motion = "burst",
  size = 480,
  fps = 12.5,
  hold = 1.6,
  save = true,
} = {}) {
  const app = globalThis.__splashery?.app;
  if (!app?.player) return null;
  const player = app.player;
  if (motion !== "alive" && !MOTION_SECS[motion]) motion = "burst";
  // Alive: one whole loop of the pattern (it repeats when its phase grows by
  // 2π: 2π / 1.8 s at normal speed), every frame live, so the GIF loops
  // seamlessly; 44 frames at normal speed, fewer when faster.
  const loop = motion === "alive";
  const speed = speedOf(player.motion?.state?.speed);
  const moving = loop ? Math.max(16, Math.min(120, Math.round(44 / speed))) : Math.round(MOTION_SECS[motion] * fps); // prettier-ignore
  const frames = loop ? moving : moving + Math.round(hold * fps);
  const dt = loop ? (2 * Math.PI) / (PHASE_RATE * speed) / moving : 1 / fps;
  const phase0 = QR.phase;
  const { encodeGIF, downloadBlob, timestampName } = await exportsJS();
  return app.withBusy("Making a GIF…", (progress) =>
    // Rendered at 1.5 times the size and scaled down smoothly: the GIF's
    // palette then rounds fewer fine shades into speckle.
    app.withCapture([Math.round(size * 1.5), Math.round(size * 1.5)], async () => {
      const t0 = player.time;
      try {
        const blob = await encodeGIF({
          frames,
          size,
          loopMs: frames * dt * 1000,
          onProgress: (f) => progress(f, "Making a GIF…"),
          renderFrame: async (i) => {
            QR.gif = i < moving ? { key: motion, q: i / moving } : { key: motion, q: 0 };
            if (loop) QR.gif.phase = phase0 + (2 * Math.PI * i) / moving;
            QR.still = !loop && i >= moving;
            const shot = await player.renderAt(t0 + i * dt, scanPose());
            const out = document.createElement("canvas");
            out.width = out.height = size;
            const g = out.getContext("2d");
            g.imageSmoothingQuality = "high";
            g.drawImage(shot, 0, 0, size, size);
            return out;
          },
        });
        if (save) {
          downloadBlob(blob, timestampName("gif", "splashery-qr"));
          app.ui.toast(loop ? "Looping GIF saved: every frame of it scans." : "GIF saved: it ends on the code, held still to scan."); // prettier-ignore
          setTimeout(neonTip, 1500);
        }
        return blob;
      } finally {
        QR.gif = null;
        QR.still = false;
      }
    }),
  );
}

// About how many device pixels a module covers on screen in Scan view.
function modulePx() {
  const c = globalThis.__splashery?.app?.player?.stage?.canvas;
  if (!c || !QR.code) return 0;
  const side = Math.min(c.width, c.height); // device pixels; the view spans the narrower side
  return side / (QR.code.size + 2 * (QUIET + 3));
}

// ---- Full screen ----------------------------------------------------------------------------
// The code alone, in Scan view, on a plain background that fills the screen,
// so another phone can scan it. Esc or a tap closes it.
export async function showFullScreen() {
  const app = globalThis.__splashery?.app;
  if (!app?.player || document.getElementById("qr-fullscreen")) return;
  const side = Math.min(window.innerWidth, window.innerHeight);
  const px = Math.min(2048, Math.round(side * Math.min(2, window.devicePixelRatio || 1)));
  const shot = await renderScan(app, px);
  const pal = palette(QR.options || {});
  const bg = `rgb(${pal.bg.map((v) => Math.round(v * 255)).join(",")})`;
  const box = document.createElement("div");
  box.id = "qr-fullscreen";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "The QR code, full screen. Tap or press Escape to close.");
  box.tabIndex = -1;
  box.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:${bg};cursor:pointer`; // prettier-ignore
  shot.style.cssText = "width:min(100vw,100vh);height:min(100vw,100vh);display:block";
  shot.setAttribute("aria-hidden", "true");
  box.append(shot);
  const close = () => {
    document.removeEventListener("keydown", onKey);
    if (document.fullscreenElement === box) document.exitFullscreen?.().catch(() => {});
    box.remove();
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  box.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  box.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && box.isConnected) close();
  });
  document.body.append(box);
  box.focus();
  box.requestFullscreen?.().catch(() => {}); // the overlay works without it too
}

// ---- The panel ----------------------------------------------------------------------------

let panel = null; // { refresh } while the panel is in the page

function refreshPanel() {
  panel?.refresh();
}

function describe(o) {
  const c = QR.code;
  if (!c) return "";
  const asked = eccFor(o);
  const lvl = c.ecc === asked ? `level ${c.ecc}` : `level ${c.ecc} (raised from ${asked} for free: it fits the same size)`; // prettier-ignore
  return `Version ${c.version}: ${c.size} × ${c.size} modules, error correction ${lvl}, so up to ${ECC_RECOVERY[c.ecc]} of it can be lost and it still scans.`; // prettier-ignore
}

// Warnings about colors that make a code hard to scan, and why.
export function colorWarnings(o) {
  const { ratio, inverted } = codeContrast(o);
  const out = [];
  if (ratio < 3)
    out.push(`Too little contrast (${ratio.toFixed(1)} : 1): many cameras won't read it. Cameras read a code by telling its dark modules from its light ones; make the code darker or the background lighter (4 : 1 or more).`); // prettier-ignore
  else if (ratio < 4)
    out.push(`Low contrast (${ratio.toFixed(1)} : 1). Cameras read a code by telling its dark modules from its light ones, and below about 4 : 1 some can't. Make the code darker or the background lighter.`); // prettier-ignore
  if (inverted) {
    if (o.style === "bricks" || o.style === "gems")
      out.push("Light on dark doesn't work for this style: in the scan lab no reader read light-on-dark Bricks or Gems. Use a dark code on a light background."); // prettier-ignore
    else if (o.style === "dots")
      out.push("Light-on-dark Dots read only about half the time in the scan lab, even in readers that try inverted codes. Use a dark code on a light background."); // prettier-ignore
    else
      out.push(o.style === "neon"
        ? "Neon on a dark wall is light on dark (an inverted code): most phone cameras read it, some scanner apps don't. Put it on a pale wall (the button above) for a code every reader takes."
        : "The code is lighter than its background (an inverted code): most phone cameras read it, some scanner apps don't. Dark on light is the safe choice."); // prettier-ignore
  }
  if (QR.code && DEPTH.has(o.style) && QR.code.version >= 8)
    out.push(`This is a large code (version ${QR.code.version}) in a style with depth, and those scan less often. A shorter text or a flatter style (Classic, Dots, Rounded) scans more surely.`); // prettier-ignore
  if (o.style === "bricks" || o.style === "gems")
    out.push(
      "Hold the phone flat to the code: with real depth, Bricks and Gems read less well from an angle.",
    );
  return out;
}

function renderPanel() {
  const app = globalThis.__splashery?.app;
  const box = document.createElement("div");
  box.className = "qr-panel";
  box.id = "qr-panel";
  const button = (id, label, fn, primary = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = label;
    if (primary) b.className = "primary";
    b.addEventListener("click", fn);
    return b;
  };
  // What the code holds: a choice of kind, and that kind's small form.
  const kindRow = document.createElement("label");
  kindRow.className = "row";
  const kindName = document.createElement("span");
  kindName.textContent = "What it holds";
  const kindPick = document.createElement("select");
  kindPick.id = "qr-kind";
  for (const k of KINDS) kindPick.add(new Option(k.label, k.id));
  kindPick.value = kindOf(QR.options || {});
  kindRow.append(kindName, kindPick);
  const form = document.createElement("div");
  form.className = "qr-form";
  form.id = "qr-form";
  let inputs = {};
  const drawForm = () => {
    form.textContent = "";
    inputs = {};
    const kind = kindById(kindPick.value);
    const now = fieldsOf(QR.options || {}, kind.id);
    for (const fd of kind.fields) {
      const lab = document.createElement("label");
      lab.className = "note";
      lab.style.display = "block";
      lab.textContent = fd.label;
      let el;
      if (fd.choices) {
        el = document.createElement("select");
        for (const ch of fd.choices) el.add(new Option(ch.label, ch.id));
        el.value = now[fd.key] || fd.choices[0].id;
      } else if (fd.check) {
        el = document.createElement("input");
        el.type = "checkbox";
        el.checked = !!now[fd.key];
      } else {
        el = document.createElement(fd.multiline ? "textarea" : "input");
        if (fd.multiline) el.rows = 3;
        else el.type = fd.secret ? "password" : "text";
        el.value = now[fd.key] ?? "";
        el.placeholder = fd.placeholder || "";
        el.spellcheck = false;
        el.autocomplete = "off";
        el.style.cssText = "width:100%;box-sizing:border-box;font:inherit";
        if (!fd.multiline) {
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          });
        }
      }
      el.id = `qr-field-${fd.key}`;
      el.setAttribute("aria-label", fd.label);
      lab.append(document.createElement("br"), el);
      form.append(lab);
      inputs[fd.key] = el;
    }
  };
  kindPick.addEventListener("change", drawForm);
  drawForm();
  const make = button("qr-make", "Make the code", () => apply(), true);
  const apply = () => {
    const kind = kindPick.value;
    const f = {};
    for (const [k, el] of Object.entries(inputs)) f[k] = el.type === "checkbox" ? el.checked : el.value; // prettier-ignore
    app?.setToyOptions(optionsFor(kind, f));
  };
  const row = document.createElement("div");
  row.className = "button-row";
  row.append(make);
  // The styles: each sets its own colors and plate (changed below if wanted).
  const styleRow = document.createElement("div");
  styleRow.className = "button-row qr-styles";
  styleRow.setAttribute("role", "group");
  styleRow.setAttribute("aria-label", "Style");
  const styleButtons = STYLES.map((st) => {
    // A theme's colors stay when the style changes (the style's own preset
    // colors come only with no theme).
    const b = button(`qr-style-${st.id}`, st.label, () => {
      const t = themeById(QR.options?.theme);
      app?.setToyOptions(t ? { style: st.id, plate: PRESETS[st.id].plate, ...themeOptions(t) } : { style: st.id, ...PRESETS[st.id], theme: "" }); // prettier-ignore
    });
    styleRow.append(b);
    return [st.id, b];
  });
  // Neon: one tap between the dark wall (glowing, an inverted code) and a
  // pale wall (dark on light, which every reader takes).
  const wallRow = document.createElement("div");
  wallRow.className = "button-row";
  const wall = button("qr-neon-wall", "", () => {
    const light = palette(QR.options || {}).neonLight;
    app?.setToyOptions(light ? { ...PRESETS.neon } : { ...PRESETS["neon-light"] });
  });
  wallRow.append(wall);
  const tipRow = document.createElement("div");
  tipRow.id = "qr-neon-tip";
  tipRow.className = "note";
  tipRow.hidden = true;
  const tipText = document.createElement("span");
  tipText.textContent = `${NEON_TIP} `;
  const tipGo = button("qr-neon-tip-go", "Switch to a pale wall", () => {
    QR.neonTip = false;
    app?.setToyOptions({ ...PRESETS["neon-light"] });
  });
  tipRow.append(tipText, tipGo);
  const info = document.createElement("p");
  info.className = "note";
  info.id = "qr-info";
  const warn = document.createElement("div");
  warn.className = "warning";
  warn.id = "qr-warning";
  warn.hidden = true;
  const result = document.createElement("p");
  result.className = "note";
  result.id = "qr-result";
  result.setAttribute("role", "status");
  result.style.fontWeight = "600";
  const row2 = document.createElement("div");
  row2.className = "button-row";
  row2.append(
    button("qr-scan-view", "Scan view", () => snapScanView()),
    button("qr-check", "Check that it scans", () => checkScan()),
    button("qr-full", "Full screen", () => showFullScreen()),
  );
  const row3 = document.createElement("div");
  row3.className = "button-row";
  row3.append(
    button("qr-png", "Save a PNG", () => savePNG()),
    button("qr-gif", "Save a GIF", () => makeGIF({ motion: QR.last })),
    button("qr-gif-alive", "Save a looping GIF", () => makeGIF({ motion: "alive" })),
  );
  // Lane QR r3: Alive's patterns. Picking one turns Alive on; the speed is
  // the Alive speed slider below.
  const aliveLabel = document.createElement("p");
  aliveLabel.className = "note";
  aliveLabel.textContent = "Alive colors (every frame still scans; the speed slider is below)";
  const aliveRow = document.createElement("div");
  aliveRow.className = "button-row qr-alive";
  aliveRow.setAttribute("role", "group");
  aliveRow.setAttribute("aria-label", "Alive colors");
  const aliveButtons = PATTERNS.map((pt) => {
    const b = button(`qr-alive-${pt.id}`, pt.label, async () => {
      if ((QR.options?.alivePattern || "wave") !== pt.id) await app?.setToyOptions({ alivePattern: pt.id }); // prettier-ignore
      app?.setControl("alive", 1);
    });
    aliveRow.append(b);
    return [pt.id, b];
  });
  // Lane QR r3: color themes and flag colors.
  const themeLabel = document.createElement("p");
  themeLabel.className = "note";
  themeLabel.textContent =
    "Color themes (each keeps at least 4.5 : 1 between dark and light, so it scans)";
  const themeRow = document.createElement("div");
  themeRow.className = "button-row qr-themes";
  themeRow.setAttribute("role", "group");
  themeRow.setAttribute("aria-label", "Color themes");
  const themeButtons = THEMES.filter((t) => t.family === "palette").map((t) => {
    const b = button(`qr-theme-${t.id}`, t.label, () => app?.setToyOptions(themeOptions(t)));
    b.style.borderLeft = `0.9em solid ${t.fg}`;
    themeRow.append(b);
    return [t.id, b];
  });
  const flagRow = document.createElement("label");
  flagRow.className = "row";
  const flagName = document.createElement("span");
  flagName.textContent = "Flag colors";
  const flagPick = document.createElement("select");
  flagPick.id = "qr-flag";
  flagPick.add(new Option("None", ""));
  for (const t of THEMES.filter((x) => x.family === "flag"))
    flagPick.add(new Option(t.label, t.id));
  flagPick.addEventListener("change", () => {
    const t = themeById(flagPick.value);
    if (t) app?.setToyOptions(themeOptions(t));
    else app?.setToyOptions({ ...PRESETS[QR.options?.style || "classic"], theme: "" });
  });
  flagRow.append(flagName, flagPick);
  const themeNote = document.createElement("p");
  themeNote.className = "note";
  themeNote.id = "qr-theme-note";
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "What the code holds stays on this device: nothing is sent anywhere, and no link shortener is used. But a #s= link to this toy, and a saved scene, carry what the code holds (the link, the text, the contact), so whoever you send them to can read it. A Wi-Fi password is left out of them: after opening a link, type it again. The PNG and the GIF end in scan view, with the quiet zone. Record (Share tab) makes a video, and Save splats keeps the splats."; // prettier-ignore
  const styleLabel = document.createElement("p");
  styleLabel.className = "note";
  styleLabel.textContent = "Style (each comes with its own colors; change them below)";
  box.append(
    kindRow,
    form,
    row,
    styleLabel,
    styleRow,
    wallRow,
    tipRow,
    info,
    warn,
    result,
    row2,
    themeLabel,
    themeRow,
    flagRow,
    themeNote,
    aliveLabel,
    aliveRow,
    row3,
    note,
  );
  panel = {
    refresh() {
      const o = QR.options || {};
      for (const [id, b] of styleButtons) {
        b.setAttribute("aria-pressed", String(id === (o.style || "classic")));
        b.classList.toggle("primary", id === (o.style || "classic"));
      }
      wallRow.hidden = o.style !== "neon";
      // A theme counts while its colors are still the ones showing.
      const th0 = themeById(o.theme);
      const th = th0 && th0.fg === o.fg && th0.bg === o.bg ? th0 : null;
      for (const [id, b] of themeButtons) {
        b.setAttribute("aria-pressed", String(id === th?.id));
        b.classList.toggle("primary", id === th?.id);
      }
      flagPick.value = th?.family === "flag" ? th.id : "";
      themeNote.hidden = !th;
      if (th)
        themeNote.textContent = `${th.family === "flag" ? `${th.label}'s flag colors` : th.label}: contrast ${codeContrast(o).ratio.toFixed(1)} : 1. ${th.notes.join(" ")}`.trim(); // prettier-ignore
      for (const [id, b] of aliveButtons) {
        const on = id === (o.alivePattern || "wave") && !!QR.aliveOn;
        b.setAttribute("aria-pressed", String(on));
        b.classList.toggle("primary", on);
      }
      tipRow.hidden = !(QR.neonTip && o.style === "neon" && !palette(o).neonLight);
      wall.textContent = palette(o).neonLight
        ? "Glow on a dark wall (inverted)"
        : "Put it on a pale wall (every reader)";
      info.textContent = QR.error ? `${QR.error} The code shows the start of it.` : describe(o);
      const w = colorWarnings(o);
      // Alive moves the code: the scan lab's loops read front on and at 10°,
      // but some styles fell to 2 or 3 frames in 12 at 20°.
      if (QR.aliveOn && !w.some((x) => x.startsWith("Hold the phone flat")))
        w.push("Hold the phone flat to the code while Alive is on: a moving code reads less well from an angle."); // prettier-ignore
      const px = modulePx();
      if (px && px < minModulePx(o))
        w.push(`On this screen the code is drawn at about ${px.toFixed(1)} pixels per module; readers need about ${minModulePx(o)} for this style. Use Full screen, a bigger window, or a shorter text (a smaller code).`); // prettier-ignore
      if (missingSecret(o))
        w.unshift("This Wi-Fi code has no password yet: passwords stay out of links and saved scenes, so type it again and tap Make the code."); // prettier-ignore
      warn.textContent = w.join(" ");
      warn.hidden = !w.length;
      const c = QR.check;
      if (QR.checking) result.textContent = "Checking that it scans…";
      else if (!c) result.textContent = "";
      else if (c.ok)
        result.textContent = `✓ Scans: it reads back “${short(c.read)}” (${c.reader}${c.inverted ? ", as an inverted code" : ""}).`; // prettier-ignore
      else if (c.read)
        result.textContent = `✗ It reads “${short(c.read)}”, not your text. Try a higher error correction.`; // prettier-ignore
      else result.textContent = `✗ Doesn't scan yet. ${advice(o)}`;
      result.style.color = c ? (c.ok ? "var(--ok, #1d8a4a)" : "var(--warn, #b3261e)") : "";
    },
    box,
  };
  panel.refresh();
  return box;
}

const short = (s) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);

function advice(o) {
  const tips = [];
  // Higher levels make a denser code, which hurts the depth styles (scan lab).
  if (DEPTH.has(o.style)) tips.push("use a shorter text");
  else if (eccFor(o) !== "H") tips.push("raise the error correction (Q or H)");
  if (codeContrast(o).ratio < 5) tips.push("use more contrast");
  if (o.style !== "classic") tips.push("pick a flatter style (Classic or Rounded)");
  if (o.gradient && o.gradient !== "none") tips.push("drop the gradient");
  if (!tips.length) return "Try a shorter text.";
  const list = tips.length > 1 ? `${tips.slice(0, -1).join(", ")} or ${tips.at(-1)}` : tips[0];
  return `To help it, ${list}.`;
}

// ---- The recipe ---------------------------------------------------------------------------

const choices = (list) => list.map((x) => ({ id: x.id, label: x.label }));

export const RECIPES = {
  "qr-code": {
    alive: true,
    turntable: false,
    options: [
      { key: "text", label: "Text", type: "text", default: DEFAULT_TEXT, hidden: true },
      // What it holds (the panel's choice) and, for kinds other than a link
      // or text, its form as JSON (never the Wi-Fi password).
      { key: "kind", label: "What it holds", type: "select", default: "link", hidden: true, choices: KINDS.map((k) => ({ id: k.id, label: k.label })) }, // prettier-ignore
      { key: "fields", label: "Its details", type: "text", default: "", hidden: true },
      // Picked in the panel's style row, which also sets the style's colors.
      { key: "style", label: "Style", type: "select", default: "classic", choices: choices(STYLES), hidden: true }, // prettier-ignore
      {
        key: "ecc",
        label: "Error correction",
        type: "select",
        default: "auto",
        choices: [
          { id: "auto", label: "Auto (M, which the scan lab found best)" },
          { id: "L", label: "L: 7% can be lost" },
          { id: "M", label: "M: 15%" },
          { id: "Q", label: "Q: 25%" },
          { id: "H", label: "H: 30%" },
        ],
      },
      { key: "fg", label: "Code color", type: "color", default: "#14161c" },
      { key: "bg", label: "Background", type: "color", default: "#ffffff" },
      {
        key: "gradient",
        label: "Gradient",
        type: "select",
        default: "none",
        choices: [
          { id: "none", label: "None" },
          { id: "linear", label: "Linear" },
          { id: "radial", label: "Radial" },
        ],
      },
      { key: "fg2", label: "Gradient to", type: "color", default: "#1d4f9c" },
      {
        key: "eyes",
        label: "Eyes",
        type: "select",
        default: "same",
        choices: [
          { id: "same", label: "Same as the code" },
          { id: "own", label: "Their own color" },
        ],
      },
      { key: "eye", label: "Eye color", type: "color", default: "#b3261e" },
      { key: "plate", label: "Plate", type: "select", default: "paper", choices: choices(PLATES) },
      { key: "back", label: "Back of the tiles", type: "color", default: "#e8743b" },
      { key: "wave", label: "Alive wave color", type: "color", default: "#1d4f9c" },
      // Lane QR r3: Alive's pattern (picked in the panel).
      { key: "alivePattern", label: "Alive pattern", type: "select", default: "wave", hidden: true, choices: choices(PATTERNS) }, // prettier-ignore
      // Lane QR r3: the color theme picked last (its colors are the options
      // above; "" once a color is changed by hand, or a style is picked).
      { key: "theme", label: "Color theme", type: "text", default: "", hidden: true },
    ],
    controls: [
      { key: "assemble", label: "Assemble", type: "pulse", ease: MOTION_SECS.assemble },
      { key: "flip", label: "Flip", type: "pulse", ease: MOTION_SECS.flip },
      { key: "burst", label: "Burst and return", type: "pulse", ease: MOTION_SECS.burst },
      // Lane QR r3.
      { key: "ripple", label: "Ripple", type: "pulse", ease: MOTION_SECS.ripple },
      { key: "flap", label: "Split-flap", type: "pulse", ease: MOTION_SECS.flap },
      { key: "fold", label: "Fold", type: "pulse", ease: MOTION_SECS.fold },
      { key: "rain", label: "Rain", type: "pulse", ease: MOTION_SECS.rain },
      // A second tap knocks again where it lands (not a pause).
      { key: "knock", label: "Knock loose", type: "pulse", ease: MOTION_SECS.knock, pausable: false }, // prettier-ignore
      { key: "cloud", label: "Point cloud", type: "pulse", ease: MOTION_SECS.cloud },
      // Alive: an idle loop in which every frame still scans (src/qr/field.js).
      { key: "alive", label: "Alive", type: "toggle", default: 0, ease: 0.8 },
      { key: "speed", label: "Alive speed", type: "slider", default: 0.5 },
    ],
    // Lane QR r3: a tap knocks the modules loose around where it lands (the
    // Play button, with no point, knocks the middle).
    action: {
      key: "knock",
      label: "Knock loose",
      quiet: MOTIONS,
      at(point) {
        QR.knock = [point?.[0] ?? 0, point?.[1] ?? 0];
        return "knock";
      },
    },
    sounds: () => Object.values(SOUNDS).flat(),
    input: {
      title: "Your QR code",
      fileButton: false,
      live: [{ render: renderPanel }],
      note: "",
      read: async () => ({}),
      shown: () => "",
    },
    // The motions' progress (0 at rest) and the glint go to the GPU program;
    // each motion's sound starts with it.
    drive(t, c, out, info) {
      // One motion at a time: the one that started first plays on.
      const q = (k) => (c[k] > 0 && c[k] < 1 ? 1 - c[k] : 0);
      let key = null;
      let prog = 0;
      for (const k of MOTIONS) {
        const v = q(k);
        if (v > prog) {
          prog = v;
          key = k;
        }
      }
      if (QR.gif) {
        key = MOTION_IDS[QR.gif.key] ? QR.gif.key : null;
        prog = key ? QR.gif.q : 0;
      }
      if (key) QR.last = key;
      out.morph = [key ? MOTION_IDS[key] : 0, prog, QR.knock[0], QR.knock[1]];
      // Alive: its phase grows at the chosen speed (so a change of speed
      // never jumps the colors); a looping GIF sets it frame by frame.
      const dt = QR.lastT == null ? 0 : t - QR.lastT;
      QR.lastT = t;
      if (Math.abs(dt) < 5) QR.phase += dt * PHASE_RATE * speedOf(c.speed);
      const alive = QR.gif ? (QR.gif.alive ?? (QR.gif.key === "alive" ? 1 : 0)) : (c.alive ?? 0);
      const phase = QR.gif?.phase ?? QR.phase;
      out.glow = [alive, phase % (2 * Math.PI * 64), 0, 0];
      const aliveOn = (c.alive ?? 0) > 0.5;
      if (aliveOn !== !!QR.aliveOn) {
        QR.aliveOn = aliveOn;
        Promise.resolve().then(refreshPanel);
      }
      for (const k of MOTIONS) {
        const v = c[k] ?? 0;
        if (v > (TAP.last[k] ?? 0) + 0.5 && !QR.gif) out.cues.push(...SOUNDS[k]);
        TAP.last[k] = v;
      }
    },
    gpuField(o, fit) {
      if (!fit || !Number.isFinite(fit.scale) || !QR.code) return null;
      const pal = palette(o);
      return qrModifier(QR.code.size, fit, { back: pal.back, glint: o.style === "gems", wave: pal.wave, bg: pal.bg, depth: QR.depth ?? 0.14, pattern: o.alivePattern }); // prettier-ignore
    },
    build(k, o) {
      const { code, error } = codeFor(o);
      const { splats, half, depth, perModule } = buildCode(code, o, k.count * 0.95);
      QR.code = code;
      QR.error = error;
      QR.options = { ...o };
      k.data = { style: o.style, size: code.size, version: code.version, ecc: code.ecc, perModule };
      // Reach the plate's corners in depth too, so the fit is the same for
      // every style (the scan view's distance follows it).
      k.reach([half + 1.6, half + 1.6, 0.6]);
      k.reach([-half - 1.6, -half - 1.6, -1.2]);
      k.cloud({ share: splats.length / k.count, jitter: 0, pattern: false }, (rand, i) => splats[i] || null); // prettier-ignore
      k.data.depth = depth;
      QR.depth = depth;
      // The kit fits the toy after build: keep the kit, and read its fit
      // (transform) when the scan view needs it.
      QR.kit = k;
      // The check starts once the new code is on the stage (the player's
      // "toy" event, below).
      QR.check = null;
      Promise.resolve().then(refreshPanel);
    },
  },
};

// ---- The test hook (the QR scan lab) --------------------------------------------------------
// window.__splashery.qr (docs/handoff/QR.md):
//   await qr.set({ text, style, ecc, fg, bg, gradient, fg2, eyes, eye, plate, back })
//   qr.scanView()               snaps the camera to scan view
//   await qr.check()            renders the scan view and reads it back
//   await qr.png(size)          the scan view as a PNG blob (not downloaded)
//   await qr.gif({ motion })    the GIF as a blob (not downloaded)
//   qr.info()                   { text, version, size, ecc, style, check, warnings }
if (typeof window !== "undefined" && window.__splashery) {
  const app = () => window.__splashery.app;
  // After each build of this toy, once it shows: the automatic check.
  window.__splashery.player?.on?.("toy", (info) => {
    if (info?.id === "qr-code") scheduleCheck();
    else clearTimeout(QR.timer);
  });
  window.__splashery.qr = {
    async set(partial = {}) {
      const a = app();
      if (a.player.scene.toy?.id !== "qr-code") throw new Error("Open the QR code toy first.");
      // A style alone brings its preset colors; colors given win over them.
      // What it holds: { kind, fields: { … } } (a form, the password kept
      // aside as in the panel); a plain { text } is a link or text.
      if (partial.fields && typeof partial.fields === "object") {
        partial = { ...partial, ...optionsFor(partial.kind || "link", partial.fields) };
      } else if ("text" in partial && !partial.kind)
        partial = { ...partial, kind: "link", fields: "" };
      // "neon-light" is Neon on a pale wall.
      const preset = partial.style && PRESETS[partial.style] ? PRESETS[partial.style] : {};
      await a.setToyOptions({ ...preset, ...partial, style: preset.style || partial.style || QR.options?.style }); // prettier-ignore
      snapScanView();
      return this.info();
    },
    scanView: () => snapScanView(),
    // false stops the automatic check after each change (tools that step
    // the stage's clock themselves); true turns it back on.
    set autoCheck(on) {
      QR.noAuto = !on;
      if (!on) clearTimeout(QR.timer);
    },
    get autoCheck() {
      return !QR.noAuto;
    },
    // The code's square with its quiet zone on the page (CSS pixels), as the
    // camera sees it now: { x, y, width, height }.
    screenRect() {
      const stage = app().player.stage;
      const ent = stage.toy?.entity;
      const cam = stage.cameraEntity?.camera;
      const fit = fitNow();
      if (!ent || !cam || !fit || !QR.code) return null;
      const H = QR.code.size / 2 + QUIET;
      const m = ent.getWorldTransform();
      const box = stage.canvas.getBoundingClientRect();
      const xs = [];
      const ys = [];
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        // prettier-ignore
        const local = [sx * H, sy * H, 0.02].map((v, k) => (v - fit.center[k]) * fit.scale);
        const w = m.transformPoint(new pc.Vec3(...local));
        const sc = cam.worldToScreen(w);
        xs.push(sc.x + box.left);
        ys.push(sc.y + box.top);
      }
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    },
    scanPose,
    check: () => checkScan(),
    fullScreen: () => showFullScreen(),
    async png(size = 1024) {
      const { canvasToBlob } = await exportsJS();
      return canvasToBlob(await renderScan(app(), size));
    },
    gif: (opts = {}) => makeGIF({ ...opts, save: false }),
    // Lane QR r3: one frame of a motion at progress q (0..1) and/or Alive
    // at a phase (radians), seen in scan view turned by yaw and pitch
    // (degrees), as a PNG data URL of `size` pixels. The toy's own state is
    // left as it was.
    // knock: where Knock loose lands (modules from the code's center);
    // settle: frames rendered first at the same pose (default 1).
    async frame({
      motion = null,
      q = 0,
      alive = 0,
      phase = 0,
      size = 720,
      yaw = 0,
      pitch = 0,
      margin = 1,
      knock = null,
      settle = 1,
    } = {}) {
      const a = app();
      if (knock) QR.knock = knock.slice(0, 2);
      return a.withCapture([size, size], async () => {
        QR.gif = { key: motion || "none", q, alive, phase };
        try {
          const pose = { ...scanPose(margin), yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180 }; // prettier-ignore
          // Frames until the splat sort has caught up with the pose (one
          // when the pose is the last frame's).
          const key = JSON.stringify([pose, size]);
          // settle: warm-up frames at an unchanged pose (the sort runs a
          // frame behind fast pieces, so a clip's moving frames take 2).
          const warm = key === QR.framePose ? settle : 3;
          QR.framePose = key;
          for (let i = 0; i < warm; i++) {
            await a.player.renderAt(a.player.time, pose);
            await new Promise((r) => setTimeout(r, 80));
          }
          const shot = await a.player.renderAt(a.player.time, pose);
          const out = document.createElement("canvas");
          out.width = out.height = size;
          out.getContext("2d").drawImage(shot, 0, 0, size, size);
          return out.toDataURL("image/png");
        } finally {
          QR.gif = null;
        }
      });
    },
    // Lane QR r3: applies a color theme by id (src/qr/themes.js).
    async theme(id) {
      const t = themeById(id);
      if (!t) throw new Error(`No theme ${id}`);
      await app().setToyOptions(themeOptions(t));
      snapScanView();
      return this.info();
    },
    themes: () => THEMES.map((t) => ({ id: t.id, label: t.label, family: t.family, contrast: t.contrast, notes: t.notes })), // prettier-ignore
    motions: () => MOTIONS.slice(),
    patterns: () => PATTERNS.map((p) => p.id),
    // The picture the last check read, as a PNG data URL.
    lastShot: () => QR.lastShot?.toDataURL("image/png") ?? null,
    info: () => ({
      text: QR.code?.text,
      version: QR.code?.version,
      size: QR.code?.size,
      ecc: QR.code?.ecc,
      style: QR.options?.style,
      options: { ...QR.options },
      check: QR.check,
      warnings: colorWarnings(QR.options || {}),
      contrast: codeContrast(QR.options || {}).ratio,
      error: QR.error,
    }),
  };
}
