import { cropSettings, cropWindow, pictureAt } from "./fit.js";
import { shapeHalf } from "../qr/circle.js";

// A cheap preview while dragging; rebuild and scan only after Use this crop.
export function cropPanel({ picture, options, size, apply }) {
  const editable = (o) => {
    const c = cropSettings(o);
    if (o.shape !== "circle" && c.pictureFit === "circle") return { ...c, pictureFit: "code" };
    return c.pictureFit === "legacy"
      ? { ...c, pictureFit: o.shape === "circle" ? "circle" : "code" }
      : c;
  };
  const box = document.createElement("details");
  box.id = "qrc-crop";
  const summary = document.createElement("summary");
  summary.textContent = "Fit your picture";
  summary.style.cssText = "min-height:44px;box-sizing:border-box;padding:10px 0;cursor:pointer";
  const help = document.createElement("p");
  help.className = "note";
  help.textContent =
    "Drag to move your picture, use the zoom slider, or focus the preview and use the arrow keys. The clear band keeps the code readable.";
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Crop preview");
  canvas.setAttribute("aria-describedby", "qrc-crop-help");
  help.id = "qrc-crop-help";
  canvas.style.cssText =
    "width:100%;max-width:240px;display:block;margin:8px auto;touch-action:none;cursor:move;border:1px solid currentColor;border-radius:8px";
  const label = (text, input) => {
    const l = document.createElement("label");
    l.append(text, input);
    return l;
  };
  const zoom = document.createElement("input");
  zoom.type = "range";
  zoom.min = "1";
  zoom.max = "4";
  zoom.step = "0.05";
  zoom.setAttribute("aria-label", "Zoom your picture");
  zoom.style.cssText = "width:100%;min-height:44px";
  const zoomValue = document.createElement("output");
  const fit = document.createElement("select");
  fit.style.cssText = "min-height:44px;max-width:100%";
  fit.setAttribute("aria-label", "Picture fit");
  for (const [id, name] of [
    ["code", "Fit the square code"],
    ["circle", "Fill the whole circle"],
  ]) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    fit.append(opt);
  }
  const status = document.createElement("p");
  status.className = "note";
  status.setAttribute("role", "status");
  const buttons = document.createElement("div");
  buttons.className = "button-row";
  const button = (text, action) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", action);
    buttons.append(b);
    return b;
  };
  let draft = cropSettings();
  let source = null;
  let saved = "";
  let from = null;
  let busy = false;
  function draw() {
    if (!source) return;
    const o = { ...options(), ...draft };
    const N = size();
    const H =
      o.shape === "circle" && draft.pictureFit === "circle"
        ? shapeHalf(N, "circle", o.quiet)
        : N / 2;
    const g = canvas.getContext("2d");
    const img = g.createImageData(240, 240);
    for (let y = 0; y < 240; y++)
      for (let x = 0; x < 240; x++) {
        const col = pictureAt(
          source,
          o,
          N,
          ((x + 0.5) / 240 - 0.5) * 2 * H,
          (0.5 - (y + 0.5) / 240) * 2 * H,
        );
        const i = (y * 240 + x) * 4;
        for (let c = 0; c < 3; c++) img.data[i + c] = col[c] * 255;
        img.data[i + 3] =
          o.shape === "circle" &&
          draft.pictureFit === "circle" &&
          Math.hypot(x + 0.5 - 120, y + 0.5 - 120) > 120
            ? 0
            : 255;
      }
    g.putImageData(img, 0, 0);
    if (o.shape === "circle" && draft.pictureFit === "circle") {
      const a = (120 * N) / (2 * H);
      g.strokeStyle = "white";
      g.lineWidth = 2;
      g.strokeRect(120 - a, 120 - a, 2 * a, 2 * a);
    }
    zoom.value = String(draft.cropZoom);
    zoom.setAttribute("aria-valuetext", `${draft.cropZoom.toFixed(2)} times`);
    zoomValue.textContent = `${draft.cropZoom.toFixed(2)}×`;
    fit.value =
      draft.pictureFit === "legacy" ? (o.shape === "circle" ? "circle" : "code") : draft.pictureFit;
    fit.options[1].disabled = o.shape !== "circle";
    status.textContent = "Preview. Use this crop to update and scan the code.";
  }
  zoom.addEventListener("input", () => {
    draft.cropZoom = +zoom.value;
    draw();
  });
  fit.addEventListener("change", () => {
    draft.pictureFit = fit.value;
    draw();
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (!source || busy || from) return;
    canvas.focus({ preventScroll: true });
    from = { id: e.pointerId, x: e.clientX, y: e.clientY, crop: { ...draft } };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* Synthetic pointers have no capture. */
    }
    e.preventDefault();
    e.stopPropagation();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!from || from.id !== e.pointerId) return;
    e.stopPropagation();
    const crop = cropWindow(source, from.crop);
    const width = canvas.getBoundingClientRect().width;
    if (source.w !== crop.side)
      draft.cropX = Math.max(
        0,
        Math.min(
          1,
          from.crop.cropX - (((e.clientX - from.x) / width) * crop.side) / (source.w - crop.side),
        ),
      );
    if (source.h !== crop.side)
      draft.cropY = Math.max(
        0,
        Math.min(
          1,
          from.crop.cropY - (((e.clientY - from.y) / width) * crop.side) / (source.h - crop.side),
        ),
      );
    draw();
  });
  const end = (e) => {
    if (e.pointerId === from?.id) from = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);
  canvas.addEventListener("keydown", (e) => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (!delta || busy || !source) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const crop = cropWindow(source, draft);
    if (source.w !== crop.side)
      draft.cropX = Math.max(
        0,
        Math.min(1, draft.cropX - Math.sign(source.w - crop.side) * delta[0] * step),
      );
    if (source.h !== crop.side)
      draft.cropY = Math.max(
        0,
        Math.min(1, draft.cropY - Math.sign(source.h - crop.side) * delta[1] * step),
      );
    e.preventDefault();
    e.stopPropagation();
    draw();
  });
  const use = button("Use this crop", async () => {
    busy = true;
    use.disabled = true;
    try {
      await apply({ ...draft, pictureFit: fit.value });
      status.textContent = "Crop applied. See the scan result below.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      busy = false;
      use.disabled = false;
    }
  });
  button("Reset crop", () => {
    draft = { ...draft, cropX: 0.5, cropY: 0.5, cropZoom: 1 };
    draw();
  });
  button("Cancel", () => {
    draft = editable(options());
    draw();
    box.open = false;
  });
  box.append(
    summary,
    help,
    canvas,
    label("Picture fit", fit),
    label("Zoom ", zoom),
    zoomValue,
    buttons,
    status,
  );
  return {
    element: box,
    refresh() {
      const pic = picture();
      const o = options();
      box.hidden = !pic || (o.picture !== "own" && cropSettings(o).pictureFit === "legacy");
      const next = JSON.stringify([cropSettings(o), o.shape, o.quiet]);
      if (pic !== source || next !== saved) {
        const replaced = pic !== source;
        source = pic;
        saved = next;
        draft = editable(o);
        if (replaced && o.picture === "own") box.open = true;
        draw();
      }
    },
  };
}
