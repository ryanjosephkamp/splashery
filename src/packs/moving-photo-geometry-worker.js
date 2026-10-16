// Work ahead on already estimated depth; never opens media or runs a model.
import {
  prepareGeometry,
  geometryField,
  geometryRaster,
  indexClipCaps,
  drawFields,
  surfaceDepth,
} from "./moving-photo-geometry.js";
import { clipRasterPlanes } from "./moving-photo-raster.js";
let field, nativeRaster, aspect, cols, rows;
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue
    .then(async () => {
      if (data.init) {
        aspect = data.aspect;
        cols = data.cols;
        rows = data.rows;
        const module = await prepareGeometry();
        field = geometryField(module, data.w, data.h, data.cols, data.rows);
        nativeRaster = geometryRaster(module);
        return;
      }
      const started = performance.now();
      const count = field.compute(data.source, true, aspect);
      const { instances, indices } = drawFields(field, count, cols, rows);
      const result = {
        id: data.id,
        count,
        soft: surfaceDepth(field),
        instances,
        indices,
        raster: data.raster
          ? {
              key: data.raster.key,
              ...indexClipCaps(
                clipRasterPlanes(instances, field.w, field.h, data.raster, nativeRaster),
                field.w,
                field.h,
              ),
            }
          : null,
      };
      result.workMs = performance.now() - started;
      const transfers = [result.soft.buffer, result.instances.buffer, result.indices.buffer];
      if (result.raster) {
        transfers.push(result.raster.instances.buffer);
        if (result.raster.caps)
          transfers.push(result.raster.caps.positions.buffer, result.raster.caps.indices.buffer);
        if (result.raster.tops)
          transfers.push(result.raster.tops.positions.buffer, result.raster.tops.indices.buffer);
      }
      self.postMessage(result, transfers);
    })
    .catch((error) => self.postMessage({ id: data.id, error: error.message }));
};
