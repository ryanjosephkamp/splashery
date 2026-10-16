// Bind cached pixel evidence to the numeric method and the actual public input bytes.
import fs from "node:fs";
import crypto from "node:crypto";
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export function inputFingerprintsR3(entries) {
  return entries.map((s) => {
    const base = `assets/toys/photo-3d/${s.dir ? `${s.dir}/` : ""}${s.file || s.id}`;
    const photo = s.builtin ? `${base}.${s.ext || "jpg"}` : s.file;
    const depth = s.builtin ? `${base}.depth` : s.depthFile;
    return {
      id: s.id,
      photo,
      depth,
      photoHash: sha(fs.readFileSync(photo)),
      depthHash: sha(fs.readFileSync(depth)),
    };
  });
}
export function pixelMethodHashR3() {
  const source = fs.readFileSync("tools/cdx-p3d2-r3-measure.mjs", "utf8");
  const numeric = source.slice(
    source.indexOf("export function holesR3"),
    source.indexOf("async function main"),
  );
  return sha(
    Buffer.concat([Buffer.from(numeric), fs.readFileSync("tools/cdx-p3d2-r3-common.mjs")]),
  );
}
