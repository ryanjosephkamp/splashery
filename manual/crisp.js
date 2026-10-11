// Crisp canvases for the manual's demos. A demo draws in its canvas's "logical" size (the width and
// height attributes in the page, such as 400 by 400). crisp() makes the canvas's backing store
// match what the screen really shows (CSS size times devicePixelRatio, capped), scales the
// context so the demo's code is unchanged, and redraws when the size or the pixel ratio changes.
// Inside a demo, cv.width and cv.height still read the logical size (see below), so a demo's math
// keeps working in the same units. Only rasters meant to be soft (heat maps, splats) go through
// putSoft(), which paints them at the logical size and lets the screen scale them.

const MAX_DPR = 3;
const MAX_SIDE = 2400;
const protoWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width");
const protoHeight = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");
const registry = new Set();

// The ratio of backing pixels to logical units for one canvas.
export const scaleOf = (cv) => (cv._crisp ? cv._crisp.k : 1);

function apply(cv, cx, redraw) {
  const st = cv._crisp;
  const css = cv.clientWidth;
  if (!css) return; // hidden (inside a closed fold); the observer fires when it shows
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const k = Math.max(1, Math.min(MAX_SIDE / Math.max(st.w, st.h), (css * dpr) / st.w));
  const bw = Math.round(st.w * k);
  const bh = Math.round(st.h * k);
  st.k = bw / st.w;
  if (protoWidth.get.call(cv) !== bw || protoHeight.get.call(cv) !== bh) {
    protoWidth.set.call(cv, bw); // resizing clears the canvas and resets the transform
    protoHeight.set.call(cv, bh);
  }
  cx.setTransform(st.k, 0, 0, bh / st.h, 0, 0);
  if (redraw) redraw();
}

// Returns the 2D context. `redraw` runs after every resize or change of pixel ratio.
export function crisp(cv, redraw) {
  const lw = cv.width;
  const lh = cv.height;
  cv._crisp = { w: lw, h: lh, k: 1 };
  cv.style.aspectRatio = `${lw} / ${lh}`;
  Object.defineProperty(cv, "width", { get: () => lw, set: protoWidth.set.bind(cv), configurable: true }); // prettier-ignore
  Object.defineProperty(cv, "height", { get: () => lh, set: protoHeight.set.bind(cv), configurable: true }); // prettier-ignore
  const cx = cv.getContext("2d");
  const again = () => apply(cv, cx, redraw);
  registry.add(again);
  apply(cv, cx, null); // no redraw yet: the demo is still setting itself up
  new ResizeObserver(again).observe(cv);
  return cx;
}

// The pixel ratio changes when the person zooms or moves the window to another screen.
const watchRatio = () => {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  mq.addEventListener("change", () => {
    registry.forEach((f) => f());
    watchRatio();
  }, { once: true }); // prettier-ignore
};
watchRatio();

// Paint an ImageData soft: at its own size, then scaled by the context (smoothing on).
let scratch = null;
export function putSoft(cx, img, x = 0, y = 0, smooth = true) {
  scratch ??= document.createElement("canvas");
  scratch.width = img.width;
  scratch.height = img.height;
  scratch.getContext("2d").putImageData(img, 0, 0);
  cx.save();
  cx.imageSmoothingEnabled = smooth;
  cx.drawImage(scratch, x, y);
  cx.restore();
}
