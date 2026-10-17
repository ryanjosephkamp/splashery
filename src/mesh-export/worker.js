import { loadSource } from "./sources.js";
import { reconstruct } from "./reconstruct.js";
import { encodeMesh } from "./formats.js";

let mesh = null,
  metadata = null;
self.onmessage = async ({ data }) => {
  const { id, command } = data;
  try {
    if (command === "convert") {
      const profile = data.options.profile || "desktop";
      const progress = (fraction, text) => self.postMessage({ id, progress: fraction, text });
      const source = await loadSource(data.source, profile, progress);
      metadata = source.metadata;
      mesh = reconstruct(source.table, data.options, progress);
      // Keep the export mesh in this worker. Transfer a bounded preview copy.
      const preview = {
        positions: mesh.positions.slice(),
        normals: mesh.normals.slice(),
        colors: mesh.colors.slice(),
        indices: mesh.indices.slice(),
      };
      self.postMessage(
        { id, result: { report: mesh.report, metadata, preview } },
        Object.values(preview).map((a) => a.buffer),
      );
    } else if (command === "save") {
      if (!mesh) throw new Error("Convert a source before saving.");
      const files = encodeMesh(mesh, data.format, { ...metadata, ...data.metadata });
      self.postMessage(
        { id, result: { files } },
        files.map((f) => f.bytes.buffer),
      );
    } else throw new Error("Unknown mesh command.");
  } catch (e) {
    self.postMessage({ id, error: e?.message || String(e) });
  }
};
