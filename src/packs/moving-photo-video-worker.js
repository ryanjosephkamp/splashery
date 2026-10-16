import {
  prepareGeometry,
  geometryField,
  geometryRaster,
  indexClipCaps,
  drawFields,
  surfaceDepth,
} from "./moving-photo-geometry.js";
import { guidedDepth, nearAt, blendNear } from "./moving-photo-depth.js";
import { clipRasterPlanes } from "./moving-photo-raster.js";
let field,
  nativeRaster,
  aspect,
  canvas,
  context,
  width,
  height,
  cols,
  rows,
  colorCanvas,
  colorContext;
let queue = Promise.resolve();
let rgba,
  directCopy = true;
self.onmessage = ({ data }) => {
  queue = queue
    .then(async () => {
      if (data.close) {
        self.close();
        return;
      }
      if (data.init) {
        width = data.w;
        height = data.h;
        aspect = data.aspect;
        cols = data.cols;
        rows = data.rows;
        const module = await prepareGeometry();
        field = geometryField(module, width, height, data.cols, data.rows);
        nativeRaster = geometryRaster(module);
        canvas = new OffscreenCanvas(width, height);
        context = canvas.getContext("2d", { willReadFrequently: true });
        context.imageSmoothingQuality = "high";
        return;
      }
      const started = performance.now();
      const phases = {};
      let last = started;
      const phase = (name) => {
        const now = performance.now();
        phases[name] = now - last;
        last = now;
      };
      let bitmap, picture;
      try {
        const fw = data.frame.displayWidth,
          fh = data.frame.displayHeight;
        if (!colorCanvas || colorCanvas.width !== fw || colorCanvas.height !== fh) {
          colorCanvas = new OffscreenCanvas(fw, fh);
          colorContext = colorCanvas.getContext("2d", { willReadFrequently: true });
        }
        let cpuPicture = false;
        const rect = data.frame.visibleRect;
        if (
          directCopy &&
          data.frame.rotation === 0 &&
          data.frame.flip === false &&
          rect.width === fw &&
          rect.height === fh &&
          data.frame.copyTo
        ) {
          try {
            const size = data.frame.allocationSize({ format: "RGBA" });
            if (!rgba || rgba.byteLength !== size) rgba = new Uint8ClampedArray(size);
            await data.frame.copyTo(rgba, { format: "RGBA", colorSpace: "srgb" });
            picture = new ImageData(rgba, fw, fh);
            colorContext.putImageData(picture, 0, 0);
            cpuPicture = true;
          } catch {
            directCopy = false;
          }
        }
        if (!cpuPicture) colorContext.drawImage(data.frame, 0, 0);
        phase("nativePicture");
        let near;
        if (data.guided) blendNear(data.depth, 1, 2, data.blend);
        else
          near = nearAt(
            data.depth,
            1,
            2,
            data.blend,
            width,
            height,
            new Float32Array(width * height),
          );
        phase("interpolateDepth");
        if (data.guided) {
          context.drawImage(cpuPicture ? colorCanvas : data.frame, 0, 0, width, height);
          const colors = context.getImageData(0, 0, width, height).data;
          phase("guidePixels");
          near = guidedDepth(
            data.depth.blend,
            data.depth.ms.w,
            data.depth.ms.h,
            colors,
            width,
            height,
          );
          phase("colorGuidance");
        }
        bitmap = picture ? await createImageBitmap(picture) : colorCanvas.transferToImageBitmap();
        phase("nativeBitmap");
        const depth = Uint8Array.from(near, (v) => Math.round(v * 255));
        const count = field.compute(depth, true, aspect);
        phase("geometry");
        const { instances, indices } = drawFields(field, count, cols, rows),
          soft = surfaceDepth(field);
        phase("drawSelection");
        const raster = data.raster
          ? {
              key: data.raster.key,
              ...indexClipCaps(
                clipRasterPlanes(instances, width, height, data.raster, nativeRaster),
                width,
                height,
              ),
            }
          : null;
        phase("rasterBounds");
        const transfers = [depth.buffer, instances.buffer, indices.buffer, soft.buffer, bitmap];
        if (raster) {
          transfers.push(raster.instances.buffer);
          if (raster.caps) transfers.push(raster.caps.positions.buffer, raster.caps.indices.buffer);
          if (raster.tops) transfers.push(raster.tops.positions.buffer, raster.tops.indices.buffer);
        }
        data.frame.close();
        self.postMessage(
          {
            frameClosed: true,
            id: data.id,
            time: data.time,
            depth,
            count,
            instances,
            indices,
            soft,
            bitmap,
            raster,
            workerMs: performance.now() - started,
            phases,
          },
          transfers,
        );
        bitmap = null;
      } finally {
        data.frame.close();
        bitmap?.close();
      }
    })
    .catch((error) => {
      data.frame?.close();
      self.postMessage({ id: data.id, error: error.message });
    });
};
