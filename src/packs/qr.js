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
import { qrModifier, MOTION_SECS } from "../qr/field.js";
import { readCode } from "../qr/scan.js";
import * as pc from "../pc.js";
// The site's exports (PNG, GIF), loaded when a picture is first made (they
// need the browser's import map, so the Node tools never load them).
const exportsJS = () => import("../exports.js");

export const DEFAULT_TEXT = "https://ryanjosephkamp.github.io/splashery/";
// Styles that change the modules' shape or light get level Q by default
// (25% may be lost and it still scans); flat ones M.
const FANCY = new Set(["dots", "rounded", "bricks", "gems", "bubbles", "neon"]);
export const eccFor = (o) => (o.ecc && o.ecc !== "auto" ? o.ecc : FANCY.has(o.style) ? "Q" : "M");
const MOTIONS = ["assemble", "flip", "burst"];

// What the open code is, for the panel and the hook.
const QR = { code: null, options: null, error: "", fit: null, kit: null, check: null, checking: false, still: false, gif: null, timer: 0 }; // prettier-ignore

function codeFor(o) {
  const text = o.text ?? DEFAULT_TEXT;
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
  if (typeof window === "undefined") return;
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

async function savePNG(size = 1600) {
  const app = globalThis.__splashery?.app;
  if (!app) return null;
  return app.withBusy("Making the picture…", async () => {
    const { canvasToBlob, downloadBlob, timestampName } = await exportsJS();
    const canvas = await renderScan(app, size);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, timestampName("png", "splashery-qr"));
    app.ui.toast("Picture saved, with its quiet zone.");
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
  // Alive: one whole loop of the wave (it repeats every 2π / 1.8 s of the
  // toy's clock), every frame live, so the GIF loops seamlessly.
  const loop = motion === "alive";
  const moving = loop ? 44 : Math.round(MOTION_SECS[motion] * fps);
  const frames = loop ? moving : moving + Math.round(hold * fps);
  const dt = loop ? (2 * Math.PI) / 1.8 / moving : 1 / fps;
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
        }
        return blob;
      } finally {
        QR.gif = null;
        QR.still = false;
      }
    }),
  );
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
    out.push(`Low contrast (${ratio.toFixed(1)} : 1). Cameras read a code by telling its dark modules from its light ones; below about 3 : 1 many can't. Make the code darker or the background lighter.`); // prettier-ignore
  if (inverted)
    out.push(o.style === "neon"
      ? "Neon is light on dark (an inverted code). Many phone cameras read it, but not every reader does; for print, Classic dark on light is the safest."
      : "The code is lighter than its background (an inverted code). Not every reader scans those: dark on light is the safe choice."); // prettier-ignore
  return out;
}

function renderPanel() {
  const app = globalThis.__splashery?.app;
  const box = document.createElement("div");
  box.className = "qr-panel";
  box.id = "qr-panel";
  const label = document.createElement("label");
  label.className = "note";
  label.htmlFor = "qr-text";
  label.textContent = "Text or link";
  const text = document.createElement("textarea");
  text.id = "qr-text";
  text.rows = 3;
  text.spellcheck = false;
  text.style.cssText = "width:100%;box-sizing:border-box;resize:vertical;font:inherit";
  text.value = QR.options?.text ?? DEFAULT_TEXT;
  text.maxLength = 2900;
  const row = document.createElement("div");
  row.className = "button-row";
  const button = (id, label, fn, primary = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = label;
    if (primary) b.className = "primary";
    b.addEventListener("click", fn);
    return b;
  };
  const make = button("qr-make", "Make the code", () => apply(), true);
  const apply = () => {
    const v = text.value;
    if (v === (QR.options?.text ?? DEFAULT_TEXT)) return scheduleCheck();
    app?.setToyOptions({ text: v });
  };
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      apply();
    }
  });
  row.append(make);
  // The styles: each sets its own colors and plate (changed below if wanted).
  const styleRow = document.createElement("div");
  styleRow.className = "button-row qr-styles";
  styleRow.setAttribute("role", "group");
  styleRow.setAttribute("aria-label", "Style");
  const styleButtons = STYLES.map((st) => {
    const b = button(`qr-style-${st.id}`, st.label, () => app?.setToyOptions({ style: st.id, ...PRESETS[st.id] })); // prettier-ignore
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
  );
  const row3 = document.createElement("div");
  row3.className = "button-row";
  row3.append(
    button("qr-png", "Save a PNG", () => savePNG()),
    button("qr-gif", "Save a GIF", () => makeGIF()),
    button("qr-gif-alive", "Save a looping GIF", () => makeGIF({ motion: "alive" })),
  );
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "Your text stays on this device: nothing is sent anywhere, and no link shortener is used. The PNG and the GIF end in scan view, with the quiet zone. Record (Share tab) makes a video, and Save splats keeps the splats."; // prettier-ignore
  const styleLabel = document.createElement("p");
  styleLabel.className = "note";
  styleLabel.textContent = "Style (each comes with its own colors; change them below)";
  box.append(label, text, row, styleLabel, styleRow, wallRow, info, warn, result, row2, row3, note);
  panel = {
    refresh() {
      const o = QR.options || {};
      for (const [id, b] of styleButtons) {
        b.setAttribute("aria-pressed", String(id === (o.style || "classic")));
        b.classList.toggle("primary", id === (o.style || "classic"));
      }
      wallRow.hidden = o.style !== "neon";
      wall.textContent = palette(o).neonLight
        ? "Glow on a dark wall (inverted)"
        : "Put it on a pale wall (every reader)";
      info.textContent = QR.error ? `${QR.error} The code shows the start of it.` : describe(o);
      const w = colorWarnings(o);
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
  if (eccFor(o) !== "H") tips.push("raise the error correction (Q or H)");
  if (codeContrast(o).ratio < 4.5) tips.push("use more contrast");
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
      // Picked in the panel's style row, which also sets the style's colors.
      { key: "style", label: "Style", type: "select", default: "classic", choices: choices(STYLES), hidden: true }, // prettier-ignore
      {
        key: "ecc",
        label: "Error correction",
        type: "select",
        default: "auto",
        choices: [
          { id: "auto", label: "Auto (M, or Q for the fancier styles)" },
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
    ],
    controls: [
      { key: "assemble", label: "Assemble", type: "pulse", ease: MOTION_SECS.assemble },
      { key: "flip", label: "Flip", type: "pulse", ease: MOTION_SECS.flip },
      { key: "burst", label: "Burst and return", type: "pulse", ease: MOTION_SECS.burst },
      // Alive: an idle loop in which every frame still scans (src/qr/field.js).
      { key: "alive", label: "Alive", type: "toggle", default: 0, ease: 0.8 },
    ],
    action: { key: "burst", label: "Burst and return", quiet: MOTIONS },
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
      const q = (k) => (c[k] > 0 && c[k] < 1 ? 1 - c[k] : 0);
      const m = [q("assemble"), q("flip"), q("burst")];
      if (QR.gif) {
        m.fill(0);
        m[MOTIONS.indexOf(QR.gif.key)] = QR.gif.q;
      }
      const alive = QR.gif ? (QR.gif.key === "alive" ? 1 : 0) : (c.alive ?? 0);
      out.morph = [m[0], m[1], m[2], alive];
      for (const k of MOTIONS) {
        const v = c[k] ?? 0;
        if (v > (TAP.last[k] ?? 0) + 0.5 && !QR.gif) out.cues.push(...SOUNDS[k]);
        TAP.last[k] = v;
      }
    },
    gpuField(o, fit) {
      if (!fit || !Number.isFinite(fit.scale) || !QR.code) return null;
      const pal = palette(o);
      return qrModifier(QR.code.size, fit, pal.back, o.style === "gems", pal.wave);
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
      // "neon-light" is Neon on a pale wall.
      const preset = partial.style && PRESETS[partial.style] ? PRESETS[partial.style] : {};
      await a.setToyOptions({ ...preset, ...partial, style: preset.style || partial.style || QR.options?.style }); // prettier-ignore
      snapScanView();
      return this.info();
    },
    scanView: () => snapScanView(),
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
    async png(size = 1024) {
      const { canvasToBlob } = await exportsJS();
      return canvasToBlob(await renderScan(app(), size));
    },
    gif: (opts = {}) => makeGIF({ ...opts, save: false }),
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
      error: QR.error,
    }),
  };
}
