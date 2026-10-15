import {
  EXPORT_PRESETS as P,
  isPhone,
  exportDimensions,
  sourcePicture,
  gifPlan,
} from "./presets.js";
import { formatBytes } from "../state.js";

const $ = (id) => document.getElementById(id);
function fill(id, choices, selected, label) {
  const el = $(id);
  el.replaceChildren(
    ...choices.map((choice) => {
      const value = choice.value ?? choice;
      return new Option(choice.label ?? `${value}${label}`, value, false, value === selected);
    }),
  );
}
function add(id, label, before) {
  if ($(id)) return;
  const el = document.createElement("select");
  el.id = id;
  el.setAttribute("aria-label", label);
  $(before).before(el);
}
export function populateExportControls(app) {
  add("gif-shape", "GIF shape", "export-gif");
  add("webm-kind", "Video motion", "webm-seconds");
  add("webm-size", "Video size", "export-webm");
  add("webm-shape", "Video shape", "export-webm");
  add("webm-fps", "Video frame rate", "export-webm");
  add("record-quality", "Recording quality", "record-start");
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
  $("webm-row").querySelector("span").textContent = "Video";
  $("record-row").querySelector(".note").textContent =
    "You play, it records (up to 10 minutes, with sound)";
  const note = document.createElement("p");
  note.id = "gif-estimate";
  note.className = "note";
  note.setAttribute("aria-live", "polite");
  $("export-gif").closest(".row").after(note);
  const estimate = () => {
    const o = exportChoices("gif");
    const dims = exportDimensions(o.size, o.shape, sourcePicture(app.player));
    const p = gifPlan({ ...dims, frames: o.frames });
    note.textContent = `Estimated GIF: ${formatBytes(p.estimatedBytes)} (${dims.width} × ${dims.height}). ${p.ok ? "Size varies with the picture." : "This choice needs more memory than this device's export budget. Choose fewer frames or a smaller size."}`;
  };
  for (const id of ["gif-kind", "gif-size", "gif-shape", "gif-frames"])
    $(id).addEventListener("change", estimate);
  app.player.on("toy", estimate);
  estimate();
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
        ? Number($(`${prefix}-${key}`).value)
        : $(`${prefix}-${key}`).value,
    ]),
  );
}
