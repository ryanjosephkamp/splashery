import {
  EXPORT_PRESETS as P,
  isPhone,
  exportDimensions,
  sourcePicture,
  gifPlan,
  recordingPlan,
} from "./presets.js";
import { formatBytes } from "../state.js";

const $ = (id) => document.getElementById(id);
function fill(id, choices, selected, label) {
  const el = $(id);
  if (!el) return;
  el.replaceChildren(
    ...choices.map((choice) => {
      const value = choice.value ?? choice;
      return new Option(choice.label ?? `${value}${label}`, value, false, value === selected);
    }),
  );
}
function add(id, label, slot, caption = label) {
  if ($(id)) return;
  const parent = $(slot);
  if (!parent) return;
  const el = document.createElement("select");
  el.id = id;
  el.setAttribute("aria-label", label);
  if (slot === "record-row") parent.append(el);
  else {
    const field = document.createElement("label");
    field.className = "clip-field";
    const text = document.createElement("span");
    text.textContent = caption;
    field.append(text, el);
    parent.append(field);
  }
}
function extraRow(id, slot, inside = false) {
  if ($(id) || !$(slot)) return;
  const row = document.createElement("div");
  row.id = id;
  row.className = "clip-settings";
  if (inside) {
    row.style.flexBasis = "100%";
    $(slot).append(row);
  } else $(slot).after(row);
}
export function populateExportControls(app) {
  extraRow("gif-options-row", "gif-row");
  add("gif-shape", "GIF shape", "gif-options-row", "Shape");
  add("webm-kind", "Video motion", "webm-row", "Motion");
  add("webm-size", "Video size", "webm-row", "Size");
  extraRow("video-options-row", "webm-row", true);
  add("webm-shape", "Video shape", "video-options-row", "Shape");
  add("webm-fps", "Video frame rate", "video-options-row", "Frame rate");
  add("record-quality", "Recording quality", "record-row");
  for (const [prefix, preset] of [
    ["gif", P.gif],
    ["webm", P.video],
  ]) {
    fill(`${prefix}-kind`, preset.kinds, preset.defaults.kind);
    fill(`${prefix}-size`, preset.sizes, preset.defaults.size, " px");
    fill(`${prefix}-shape`, preset.shapes, preset.defaults.shape);
  }
  fill("gif-frames", P.gif.frames, P.gif.defaults.frames, " frames");
  fill("webm-seconds", P.video.seconds, P.video.defaults.seconds, " s");
  fill("webm-fps", P.video.fps, P.video.defaults.fps, " fps");
  fill(
    "record-quality",
    P.record.qualities.filter((q) => !isPhone() || q.value !== "max"),
    P.record.defaults.quality,
  );
  let note = $("gif-estimate");
  if (!note && $("gif-options-row")) {
    note = document.createElement("p");
    note.id = "gif-estimate";
    note.className = "note";
    note.setAttribute("aria-live", "polite");
    $("gif-options-row").after(note);
  }
  const estimate = () => {
    if (!note) return;
    const o = exportChoices("gif");
    const dims = exportDimensions(o.size, o.shape, sourcePicture(app.player));
    const p = gifPlan({ ...dims, frames: o.frames });
    note.textContent = `Estimated GIF: ${formatBytes(p.estimatedBytes)} (${dims.width} × ${dims.height}). ${p.ok ? "Size varies with the picture." : "This choice needs more memory than this device's export budget. Choose fewer frames or a smaller size."}`;
  };
  for (const id of ["gif-kind", "gif-size", "gif-shape", "gif-frames"])
    $(id)?.addEventListener("change", estimate);
  app.player.on("toy", estimate);
  estimate();
  const recordLimit = () => {
    const text = $("record-note");
    const canvas = $("stage");
    if (!text || !canvas) return;
    const rect = app.ui?.recordingSize?.() || canvas.getBoundingClientRect();
    const plan = recordingPlan({
      width: rect.width,
      height: rect.height,
      dpr: window.devicePixelRatio || 1,
      tierCap: app.player.stage.pixelCap ?? 3,
      quality: $("record-quality")?.value || P.record.defaults.quality,
    });
    const time = `${Math.floor(plan.maxSeconds / 60)}:${String(plan.maxSeconds % 60).padStart(2, "0")}`;
    text.textContent = `You play, it records, with sound (up to ${time}). The size budget can stop a take sooner.${plan.quality === "max" ? " Max also stops if this device cannot keep up." : ""} When you stop, you can watch it before you save it.`;
  };
  $("record-quality")?.addEventListener("change", recordLimit);
  window.addEventListener("resize", recordLimit);
  if ($("stage")) new ResizeObserver(recordLimit).observe($("stage"));
  recordLimit();
}
export function exportChoices(type) {
  const prefix = type === "video" ? "webm" : type;
  const keys =
    type === "gif"
      ? ["kind", "frames", "size", "shape"]
      : ["kind", "seconds", "size", "shape", "fps"];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      ["size", "frames", "seconds", "fps"].includes(key)
        ? Number($(`${prefix}-${key}`)?.value ?? (type === "gif" ? P.gif : P.video).defaults[key])
        : ($(`${prefix}-${key}`)?.value ?? (type === "gif" ? P.gif : P.video).defaults[key]),
    ]),
  );
}
