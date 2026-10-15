// Explicit opt-ins leave every old recipe's border and style-driven eyes alone.
// Qualification evidence: docs/audits/picture-qr-fit-2026-10-study.json.
export const FIT_EXTRA = 0.28;
export const FIT_BAND = 2;
export const paleDecoration = (color) => color.map((c) => 0.94 + 0.06 * c);
export const fitDecoration = (color, size, x, y, quiet) =>
  Math.max(Math.abs(x), Math.abs(y)) < size / 2 + quiet + FIT_BAND ? paleDecoration(color) : color;
export const BORDER_CHOICES = [
  { id: "legacy", label: "Original (4 modules)" },
  { id: "wide", label: "Wide (4 modules, pale band)" },
  { id: "thin", label: "Thin (1 module, pale band)" },
];
export const EYE_CHOICES = [
  { id: "style", label: "Original eyes" },
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
];
export const pictureEyeChoices = (shape) =>
  shape === "circle" ? EYE_CHOICES : EYE_CHOICES.filter((c) => c.id === "style");
export function pictureFitOptions(o) {
  return o.shape === "circle" ? o : { ...o, eyeShape: "style", circleBorder: "legacy" };
}
export function borderSettings(o = {}) {
  const quiet = { wide: 4, medium: 2, thin: 1, none: 0 }[o.circleBorder];
  return { quiet: quiet ?? 4, pale: quiet !== undefined || (o.eyeShape && o.eyeShape !== "style") };
}
export function fittedOptions(o = {}) {
  return (
    (o.pictureFit && o.pictureFit !== "legacy") ||
    (o.circleBorder && o.circleBorder !== "legacy") ||
    (o.eyeShape && o.eyeShape !== "style")
  );
}
export const FIT_OPTIONS = [
  {
    key: "circleBorder",
    label: "Circle border",
    type: "select",
    hidden: true,
    default: "legacy",
    choices: BORDER_CHOICES,
  },
  {
    key: "eyeShape",
    label: "Eyes",
    type: "select",
    hidden: true,
    default: "style",
    choices: EYE_CHOICES,
  },
];

export function fitControls({ options, apply, picture = false }) {
  const box = document.createElement("div");
  const select = (label, choices, key) => {
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = label;
    const input = document.createElement("select");
    input.setAttribute("aria-label", label);
    for (const c of choices) {
      const item = document.createElement("option");
      item.value = c.id;
      item.textContent = c.label;
      input.append(item);
    }
    input.addEventListener("change", () => apply({ [key]: input.value }));
    row.append(name, input);
    box.append(row);
    return { row, input };
  };
  const border = select("Circle border", BORDER_CHOICES, "circleBorder");
  const eyes = select("Eyes", EYE_CHOICES, "eyeShape");
  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    "Thinner borders and new eyes use a pale band beside the code. The rest of the ring keeps its color. Circle eyes did not pass every reader's scan trials. Picture QR keeps its original eyes in Square mode.";
  box.append(note);
  return {
    element: box,
    refresh() {
      const o = options();
      border.row.hidden = o.shape !== "circle";
      border.input.value = o.circleBorder || "legacy";
      eyes.row.hidden = picture && o.shape !== "circle";
      eyes.input.value = o.eyeShape || "style";
    },
  };
}
