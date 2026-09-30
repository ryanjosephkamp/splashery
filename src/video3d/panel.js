// Video to 3D (lane Video 3D): the card over the stage that shows the pipeline's progress (frames
// picked, camera path, training, with a live picture of the training) and, when it is done, the
// timing readout (each stage's seconds, frames used, splats, the WebGPU adapter) and a button to
// save the result as a PLY. Browser only.

const STAGES = [
  ["frames", "Frames picked"],
  ["decode", "Frames decoded"],
  ["path", "Camera path"],
  ["seed", "Splats seeded"],
  ["train", "Training"],
  ["export", "Export"],
];

// Splat.js's steps while it works out the camera path, in plain words.
const PATH_STEPS = {
  features: "Finding features in each frame",
  matching: "Matching frames to each other",
  pass: "Starting from the best pair",
  register: "Placing cameras",
  ba: "Refining the whole path",
  focal: "Trying lens widths",
  solved: "Camera path done",
};

const CSS = `
.v3d-card { position: fixed; z-index: 4; top: 84px; left: 18px; width: min(300px, calc(100% - 32px));
  box-sizing: border-box; padding: 12px 14px; background: var(--paper, #fff); color: var(--ink, #111);
  border: 1px solid var(--line, #ddd); border-radius: var(--radius, 12px); box-shadow: var(--shadow);
  font: 13px/1.4 var(--font-body, sans-serif); }
.v3d-card h2 { font-size: 14px; margin: 0 0 6px; }
.v3d-card ol { list-style: none; margin: 0; padding: 0; }
.v3d-card li { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; color: var(--faint, #525252); }
.v3d-card li.on { color: var(--ink, #111); font-weight: 600; }
.v3d-card li.done { color: var(--muted, #3f3f3f); }
.v3d-card li span:last-child { font-family: var(--font-mono, monospace); font-size: 12px; }
.v3d-card .v3d-bar { height: 4px; margin: 6px 0; background: var(--line, #ddd); border-radius: 2px; overflow: hidden; }
.v3d-card .v3d-bar i { display: block; height: 100%; width: 0; background: var(--accent, #0b4f9c); transition: width 0.2s; }
.v3d-card canvas { display: block; width: 100%; aspect-ratio: 16 / 9; margin: 6px 0; border-radius: 6px; background: #000; }
.v3d-card canvas[hidden] { display: none; }
.v3d-card .v3d-note { margin: 6px 0 0; color: var(--muted, #3f3f3f); font-size: 12px; }
.v3d-card .v3d-err { margin: 6px 0 0; padding: 6px 8px; border-radius: 6px; background: var(--warn-soft, #fff4dc); color: var(--warn, #7a4b00); }
.v3d-card .v3d-row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.v3d-card button { font: inherit; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--line-strong, #8c8c8c);
  background: var(--page, #fff); color: var(--ink, #111); cursor: pointer; }
.v3d-card button.primary { background: var(--accent, #0b4f9c); color: var(--accent-ink, #fff); border-color: transparent; }
.v3d-card dl { display: grid; grid-template-columns: auto 1fr; gap: 1px 10px; margin: 6px 0 0; font-size: 12px; }
.v3d-card dt { color: var(--faint, #525252); }
.v3d-card dd { margin: 0; font-family: var(--font-mono, monospace); overflow-wrap: anywhere; }
@media (max-width: 760px) { .v3d-card { top: 76px; left: 16px; } }
`;

let card = null;

function el(tag, attrs = {}, text = "") {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}

// The card, made the first time it is needed. Returns its API.
export function progressCard() {
  if (card && card.root.isConnected) return card;
  if (!document.getElementById("v3d-style")) {
    const st = el("style", { id: "v3d-style" });
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = el("section", { class: "v3d-card", id: "v3d-card", "aria-live": "polite" });
  const title = el("h2", {}, "Video to 3D");
  const list = el("ol");
  const rows = {};
  for (const [id, label] of STAGES) {
    const li = el("li", { "data-stage": id });
    li.append(el("span", {}, label), el("span", {}, ""));
    list.append(li);
    rows[id] = li;
  }
  const bar = el("div", { class: "v3d-bar" });
  const fill = el("i");
  bar.append(fill);
  const preview = el("canvas", { width: "480", height: "270", "aria-label": "The training, seen from one of the video's cameras" }); // prettier-ignore
  preview.hidden = true;
  const note = el("p", { class: "v3d-note" });
  const err = el("p", { class: "v3d-err", role: "alert" });
  err.hidden = true;
  const stats = el("dl");
  stats.hidden = true;
  const buttons = el("div", { class: "v3d-row" });
  root.append(title, list, bar, preview, note, err, stats, buttons);
  document.body.append(root);
  const started = {};
  const secs = {};
  let current = null;

  const api = {
    root,
    preview,
    reset(text = "") {
      for (const li of Object.values(rows)) {
        li.className = "";
        li.lastChild.textContent = "";
      }
      for (const k of Object.keys(started)) delete started[k];
      for (const k of Object.keys(secs)) delete secs[k];
      current = null;
      fill.style.width = "0";
      preview.hidden = true;
      err.hidden = true;
      stats.hidden = true;
      stats.replaceChildren();
      buttons.replaceChildren();
      note.textContent = text;
      root.hidden = false;
    },
    // e: { stage, done, total, note }
    progress(e) {
      if (!rows[e.stage]) {
        if (e.note) note.textContent = e.note;
        return;
      }
      const now = performance.now();
      if (current !== e.stage) {
        if (current) {
          rows[current].className = "done";
          secs[current] = (now - started[current]) / 1000;
          rows[current].lastChild.textContent = `${secs[current].toFixed(1)} s`;
        }
        current = e.stage;
        started[current] = now;
        rows[current].className = "on";
        if (current === "train") preview.hidden = false;
      }
      const part = e.total ? Math.min(1, e.done / e.total) : 0;
      fill.style.width = `${Math.round(part * 100)}%`;
      const count = e.total > 1 ? `${e.done} / ${e.total}` : "";
      rows[current].lastChild.textContent = count;
      if (e.stage === "train") note.textContent = e.note ? `Training: ${e.note}` : "";
      else if (e.stage === "path")
        note.textContent = `${PATH_STEPS[e.note] || "Solving"}${count ? `: ${count}` : ""}`; // prettier-ignore
      else note.textContent = "";
    },
    fail(message) {
      if (current) rows[current].className = "done";
      err.textContent = message;
      err.hidden = false;
      preview.hidden = true;
      const close = el("button", { type: "button", id: "v3d-close" }, "Hide");
      close.addEventListener("click", () => (root.hidden = true));
      buttons.replaceChildren(close);
    },
    // result: videoTo3D's; onSave(): saves the PLY.
    done(result, { onSave, onClose } = {}) {
      if (current) {
        rows[current].className = "done";
        rows[current].lastChild.textContent = `${((performance.now() - started[current]) / 1000).toFixed(1)} s`; // prettier-ignore
      }
      // The pipeline's own timings (each stage, measured where it ran).
      const t = result.timings || {};
      for (const [id] of STAGES) if (t[id] != null) rows[id].lastChild.textContent = `${t[id].toFixed(1)} s`; // prettier-ignore
      fill.style.width = "100%";
      preview.hidden = true;
      note.textContent =
        "Done. Turn and zoom it, or tap Replay flight to fly the video's own path.";
      readout(stats, result);
      stats.hidden = false;
      buttons.replaceChildren();
      if (onSave) {
        const save = el("button", { type: "button", class: "primary", id: "v3d-save" }, "Save as PLY"); // prettier-ignore
        save.addEventListener("click", onSave);
        buttons.append(save);
      }
      const close = el("button", { type: "button", id: "v3d-close" }, "Hide");
      close.addEventListener("click", () => {
        root.hidden = true;
        onClose?.();
      });
      buttons.append(close);
    },
    stopButton(onStop) {
      const stop = el("button", { type: "button", id: "v3d-stop" }, "Stop");
      stop.addEventListener("click", onStop);
      buttons.replaceChildren(stop);
    },
    hide() {
      root.hidden = true;
    },
  };
  card = api;
  return api;
}

export function hideCard() {
  if (card) card.root.hidden = true;
}

function readout(dl, r) {
  const s = r.stats || {};
  const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
  const rows = [
    ["Total", `${(r.timings?.total ?? 0).toFixed(1)} s`],
    [
      "Stretch",
      `${s.start?.toFixed(1)}–${s.end?.toFixed(1)} s, ${s.rate?.toFixed(1)} frames a second`,
    ],
    ["Frames", `${s.frames} picked, ${s.registered} placed`],
    ["Points", `${(s.points ?? 0).toLocaleString("en-US")}`],
    ["Splats", `${(s.splats ?? 0).toLocaleString("en-US")} (${mb(s.plyBytes ?? 0)} PLY)`],
    [
      "Training",
      `${(s.iters ?? 0).toLocaleString("en-US")} steps${s.psnr ? `, ${s.psnr} dB` : ""}`,
    ],
    ["Setting", s.tier],
    ["WebGPU", s.adapter],
  ];
  dl.replaceChildren();
  for (const [k, v] of rows) dl.append(el("dt", {}, k), el("dd", {}, String(v ?? "")));
}
