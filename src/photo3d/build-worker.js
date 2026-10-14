// The depth model is owned by task 37. This worker only constructs the surfaces
// from an already available photo and depth map.
import { buildPhotoSplats, preparePhotoColors } from "../packs/photo-3d-core.js";
import { backingField, depthBytes } from "../live/relief-height.js";
import { surfaceGrid } from "./surface.js";

let colors;
self.onmessage = ({ data: { type, id, photo, depth, options, cells } }) => {
  try {
    if (type === "colors") {
      colors = { id, photo, prepared: preparePhotoColors(photo, options) };
      self.postMessage({ id, precomputed: true });
      return;
    }
    const cached = colors?.id === options.colorKey ? colors : null;
    let s;
    try {
      s = buildPhotoSplats(cached?.photo || photo, depth, {
        ...options,
        prepared: cached?.prepared,
        sharpCells: cells,
      });
    } finally {
      // Weights are single-build work, including a stale-token fallback or a
      // failed build. Keep only the source-color preparation for later depth edits.
      if (colors) colors.prepared.depthWeights = null;
    }
    const f = Math.min(1, Math.sqrt(cells / (s.gx * s.gy)));
    const cols = Math.max(8, Math.round(s.gx * f)),
      rows = Math.max(8, Math.round(s.gy * f));
    const backRows = Math.max(8, Math.round((96 * rows) / cols));
    s.background.surface = surfaceGrid(cols, rows, {
      depth: depthBytes(s.depth),
      band: s.cellBand,
      gx: s.gx,
      gy: s.gy,
      compact: true,
    });
    s.background.field = backingField(depthBytes(s.depth), s.cellBand, s.gx, s.gy, {
      cols: 96,
      rows: backRows,
      reach: s.background.reach,
      inset: 0.998,
      rim: Math.max(6 / rows, 0.03 * Math.max(1, cols / rows)),
      base: 0.5,
    });
    try {
      if (options.bitmap !== false && typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(photo.w, photo.h);
        canvas
          .getContext("2d", { willReadFrequently: true })
          .putImageData(
            new ImageData(
              new Uint8ClampedArray(
                photo.data.buffer,
                photo.data.byteOffset,
                photo.data.byteLength,
              ),
              photo.w,
              photo.h,
            ),
            0,
            0,
          );
        s.bitmap = canvas.transferToImageBitmap();
      }
    } catch {
      // Texture preparation is optional; retain valid geometry for the
      // existing canvas fallback on browsers without a usable worker canvas.
    }
    const buffers = new Set();
    const collect = (v) => {
      if (ArrayBuffer.isView(v)) buffers.add(v.buffer);
      else if (v && typeof v === "object") for (const x of Object.values(v)) collect(x);
    };
    collect(s);
    self.postMessage({ id, result: s }, s.bitmap ? [...buffers, s.bitmap] : [...buffers]);
  } catch (e) {
    self.postMessage({ id, error: e.message || String(e) });
  }
};
