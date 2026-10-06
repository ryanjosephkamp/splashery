// Lane PDF lab: Save as PDF, from the Share tab (labs). Loaded only when
// someone opens it; pdf-lib (vendor/pdf-lib/) only when a PDF is made.
//
// "Still + live toy" (the default): a sharp still of the toy as it is now,
// its name, how-to line and About text, credits and licenses, and a link and
// QR code that open the live toy with this scene. "Moving recording": a
// second page that plays one tap as a flip book in desktop Firefox and
// Acrobat (docs/audits/pdf-motion-2026-10.md), with a still first page for
// every other viewer.

import { toySound } from "../toy-sounds.js";
import { samplesIn } from "../voices.js";
import { SOUND_CREDITS } from "../sound-credits.js";
import { findToy, categoryLabel } from "../toys.js";
import { toyHelp } from "../toy-help.js";
import { buildShareHash, shareURL, downloadBlob } from "../exports.js";
import { formatBytes } from "../state.js";
import { defCredits, madeOfNote, SITE_NOTE, longDate, toyLink } from "./entry.js";
import { captureStill, captureRecording, jpegOf, downscale, sampleFactor } from "./capture.js";
import { buildToyPDF, estimateRecording, qrFor } from "./pdf.js";
import { QUIET } from "../qr/encode.js";

export const SIZES = [
  { id: 320, label: "Small (320 px)" },
  { id: 420, label: "Medium (420 px)" },
  { id: 540, label: "Large (540 px)" },
];
export const RATES = [8, 12, 15];
export const LENGTHS = [4, 6, 10];
const QUALITY = 0.86;

// The explainer page: what a PDF can do.
export const EXPLAINER = new URL("../../pdf-lab/", import.meta.url).href;

// ---- What the page says --------------------------------------------------------

// The toy on the stage, with the link to this scene. `base` replaces the
// site's address in the link (the samples link to the live site).
export async function appEntry(app, { base = null } = {}) {
  const player = app.player;
  const info = player.toyInfo || {};
  const def = info.id ? findToy(info.id) : null;
  const help = toyHelp(info);
  const credits = defCredits(def, info);
  // Recorded sounds in the toy's tap (as the About tab lists them).
  const seen = new Set();
  const specs = [info.id ? toySound(info.id) : null, ...(app.recipeSounds?.() || [])];
  for (const file of samplesIn(specs, [], true)) {
    const c = SOUND_CREDITS[file];
    if (!c || seen.has(c.source)) continue;
    seen.add(c.source);
    credits.push({ label: c.label || "Sound", title: c.title, author: c.author, license: c.license, licenseUrl: c.licenseUrl, source: c.source }); // prettier-ignore
  }
  if (app.flagCredit) {
    const f = app.flagCredit;
    credits.push({ label: "Flag colors", title: `Flag of ${f.name}`, author: "Wikimedia Commons", license: f.license, source: f.source }); // prettier-ignore
  }
  const notes = [madeOfNote(info.kind === "captured" ? "captured" : info.kind), SITE_NOTE];
  const res = await buildShareHash(app.exportScene());
  let url;
  if (res.ok) url = base ? `${base}#s=${res.hash}` : shareURL(res.hash);
  else if (info.id && def) {
    url = await toyLink(info.id, base || new URL("../../", import.meta.url).href);
    notes.unshift(
      "This scene is too big for a link, so the link and code open the toy as it starts.",
    );
  }
  if (player.scene.toy.media?.file || player.scene.toy.kind === "file")
    notes.unshift("Your own file stays on your device: the link carries the settings only.");
  return {
    id: info.id || "toy",
    label: help.label || info.label || "Splashery toy",
    shelf: def ? categoryLabel(def.category) : "",
    howTo: help.howTo,
    about: help.about,
    credits,
    notes: notes.filter(Boolean),
    url,
    date: longDate(),
  };
}

// Reads the page's QR code back with jsQR (vendor/jsqr/), as a phone would
// read the printed page: true when it gives the link exactly.
export async function checkQR(url) {
  const { readCode } = await import("../qr/scan.js");
  const q = qrFor(url);
  const px = 4;
  const c = document.createElement("canvas");
  c.width = c.height = q.total * px;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000";
  for (let r = 0; r < q.size; r++)
    for (let k = 0; k < q.size; k++)
      if (q.dark[r * q.size + k]) g.fillRect((k + QUIET) * px, (r + QUIET) * px, px, px);
  const got = await readCode(c, { native: false });
  return got?.text === url;
}

// ---- Making the file ---------------------------------------------------------------

// The most a recording can add, from one frame made as the recording makes
// them (rendered larger, downscaled, the same quality).
export async function estimate(app, { size, fps, maxSeconds }) {
  const player = app.player;
  const big = Math.round(size * sampleFactor(player, size, 2));
  const sample = await app.withCapture([big, big], async () =>
    jpegOf(downscale(await player.stage.captureFrame(), size), QUALITY),
  );
  const frames = Math.round(maxSeconds * fps);
  return { frames, bytes: estimateRecording({ frames, sampleBytes: sample.length }) };
}

// Makes the PDF (no saving). mode: "still" | "moving".
export async function makeToyPDF(
  app,
  { mode = "still", size = 420, fps = 8, maxSeconds = 6, base = null, onProgress } = {},
) {
  const entry = await appEntry(app, { base });
  if (entry.url && !(await checkQR(entry.url)))
    throw new Error("The QR code didn't read back as the link, so no PDF was made.");
  onProgress?.(0.05, "Taking a picture…");
  entry.still = await captureStill(app);
  let recording = null;
  let est = null;
  if (mode === "moving") {
    est = await estimate(app, { size, fps, maxSeconds });
    recording = await captureRecording(app, {
      size,
      fps,
      maxSeconds,
      quality: QUALITY,
      onProgress: (f) => onProgress?.(0.1 + f * 0.8, "Recording one tap…"),
    });
  }
  onProgress?.(0.92, "Writing the PDF…");
  const bytes = await buildToyPDF(entry, { recording });
  return { bytes, entry, recording, estimate: est };
}

function fileName(entry) {
  const slug = String(entry.id || "toy").replace(/[^a-z0-9-]+/gi, "-");
  return `splashery-${slug}.pdf`;
}

// Asks where to save first (while the tap still counts as the person's), when
// the browser can; otherwise the PDF downloads as other exports do.
async function pickFile(name) {
  if (typeof window.showSaveFilePicker !== "function") return null;
  try {
    return await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
    });
  } catch (err) {
    if (err?.name === "AbortError") return false;
    return null;
  }
}

async function save(bytes, name, handle) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  if (handle) {
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
  } else downloadBlob(blob, name);
}

// ---- The dialog ----------------------------------------------------------------------

const CSS = `
.pdfx{border:1px solid var(--line);border-radius:var(--radius);padding:0;max-width:min(30rem,calc(100vw - 32px));width:100%;background:var(--page);color:var(--ink);box-shadow:var(--shadow);font:inherit}
.pdfx::backdrop{background:rgba(0,0,0,.45)}
.pdfx form{display:grid;gap:12px;padding:18px 18px 16px}
.pdfx h2{margin:0;font-size:1.15rem}
.pdfx p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.4}
.pdfx label.opt{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start;border:1px solid var(--line);border-radius:10px;padding:10px 12px;cursor:pointer}
.pdfx label.opt:has(input:checked){border-color:var(--accent);background:var(--accent-soft)}
.pdfx label.opt input{margin-top:3px}
.pdfx label.opt b{font-weight:600}
.pdfx label.opt span.small{grid-column:2;color:var(--muted);font-size:.86rem;line-height:1.35}
.pdfx .moving{display:grid;gap:8px;grid-column:1/-1;margin-top:4px}
.pdfx .moving[hidden]{display:none}
.pdfx .row3{display:flex;flex-wrap:wrap;gap:8px}
.pdfx .row3 label{display:grid;gap:2px;font-size:.8rem;color:var(--muted)}
.pdfx select{font:inherit;font-size:.9rem}
.pdfx .est{font-size:.88rem;color:var(--ink)}
.pdfx .buttons{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.pdfx .buttons button{font:inherit;padding:8px 14px;border-radius:999px;border:1px solid var(--line-strong);background:transparent;color:var(--ink);cursor:pointer}
.pdfx .buttons button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.pdfx a{color:var(--accent)}
`;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") e.textContent = v;
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
}

function select(id, label, options, value) {
  const s = el("select", { id });
  for (const o of options) s.append(el("option", { value: o.id, text: o.label }));
  s.value = String(value);
  return el("label", {}, label, s);
}

let dialog = null;

export function openPdfDialog(app) {
  if (!document.getElementById("pdfx-css")) document.head.append(el("style", { id: "pdfx-css", text: CSS })); // prettier-ignore
  dialog?.remove();
  const still = el("input", { type: "radio", name: "pdfx-mode", value: "still", checked: true });
  const moving = el("input", { type: "radio", name: "pdfx-mode", value: "moving" });
  const est = el("p", { class: "est", id: "pdfx-estimate", "aria-live": "polite", text: "" });
  const opts = el(
    "div",
    { class: "moving", hidden: true },
    el(
      "div",
      { class: "row3" },
      select("pdfx-size", "Picture", SIZES, 420),
      select("pdfx-fps", "Pictures a second", RATES.map((r) => ({ id: r, label: String(r) })), 8), // prettier-ignore
      select("pdfx-max", "At most", LENGTHS.map((s) => ({ id: s, label: `${s} seconds` })), 6), // prettier-ignore
    ),
    est,
  );
  const save1 = el("button", { type: "submit", class: "primary", id: "pdfx-save", text: "Save PDF" }); // prettier-ignore
  const cancel = el("button", { type: "button", id: "pdfx-cancel", text: "Cancel" });
  const form = el(
    "form",
    { method: "dialog" },
    el("h2", { text: "Save as PDF" }),
    el("label", { class: "opt" }, still, el("b", { text: "Still + live toy" }), el("span", { class: "small", text: "A sharp picture of the toy as it is now, what it is and how to play, its credits, and a link and QR code that open the live toy, set up the same way. Works in every PDF app and on paper." })), // prettier-ignore
    el("label", { class: "opt" }, moving, el("b", { text: "Moving recording (desktop Firefox and Acrobat)" }), el("span", { class: "small", text: "Adds a page that plays one tap, picture by picture, with play and step buttons. It plays in desktop Firefox and Adobe Acrobat; phones and other apps show its first picture. It is a recording, not the toy: you can't turn it or tap it there." }), opts), // prettier-ignore
    el("p", {}, el("a", { href: EXPLAINER, target: "_blank", rel: "noopener", text: "Can a toy move in a PDF?" }), " What we found, with samples to try."), // prettier-ignore
    el("div", { class: "buttons" }, cancel, save1),
  );
  dialog = el("dialog", { class: "pdfx", id: "pdfx", "aria-labelledby": "pdfx-title" }, form);
  form.querySelector("h2").id = "pdfx-title";
  document.body.append(dialog);
  const values = () => ({
    mode: moving.checked ? "moving" : "still",
    size: Number(form.querySelector("#pdfx-size").value),
    fps: Number(form.querySelector("#pdfx-fps").value),
    maxSeconds: Number(form.querySelector("#pdfx-max").value),
  });
  let estToken = 0;
  const refresh = async () => {
    opts.hidden = !moving.checked;
    if (!moving.checked) return;
    const token = ++estToken;
    est.textContent = "Working out the size…";
    try {
      const v = values();
      const e = await estimate(app, v);
      if (token !== estToken) return;
      est.dataset.bytes = String(e.bytes);
      est.dataset.frames = String(e.frames);
      est.textContent = `About ${formatBytes(e.bytes)} at most for the recording (up to ${e.frames} pictures), plus the still page.`; // prettier-ignore
    } catch {
      if (token === estToken) est.textContent = "";
    }
  };
  for (const r of [still, moving]) r.addEventListener("change", refresh);
  opts.addEventListener("change", refresh);
  cancel.addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = values();
    const name = `splashery-${String(app.player.toyInfo?.id || "toy").replace(/[^a-z0-9-]+/gi, "-")}.pdf`; // prettier-ignore
    const handle = await pickFile(name);
    if (handle === false) return; // cancelled in the file picker
    dialog.close();
    await app.withBusy("Making a PDF…", async (progress) => {
      const out = await makeToyPDF(app, { ...v, onProgress: progress });
      await save(out.bytes, fileName(out.entry), handle);
      const extra = out.recording ? ` with ${out.recording.frames.length} pictures` : "";
      app.ui.toast(`PDF saved (${formatBytes(out.bytes.length)}${extra}).`);
    });
  });
  dialog.addEventListener("close", () => (estToken += 1));
  dialog.showModal();
  return dialog;
}
