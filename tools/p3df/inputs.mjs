// MIT. Inventory only; private inputs are never uploaded or added to Git.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ALL_SAMPLES } from "../../src/packs/photo-3d.js";
import { HARD_CASE_SAMPLES } from "../../src/packs/hard-case-samples.js";
export const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export const ROOT = path.resolve(new URL("../../", import.meta.url).pathname);
export function inventory({ input, manifest } = {}) {
  let rows = [];
  if (input) {
    const folder = path.resolve(input);
    rows = fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((f) => f.isFile() && /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .map((f, i) => ({
        id: `private-${String(i + 1).padStart(3, "0")}`,
        label: f.name,
        file: path.join(folder, f.name),
        kind: "private",
        license: "Private local file; not licensed for publication",
        author: "Local user",
        source: null,
      }));
  } else if (manifest) {
    const file = path.resolve(manifest),
      d = JSON.parse(fs.readFileSync(file));
    rows = (Array.isArray(d) ? d : d.inputs).map((r) => ({
      ...r,
      file: path.resolve(path.dirname(file), r.file),
      ...(r.depthFile ? { depthFile: path.resolve(path.dirname(file), r.depthFile) } : {}),
      ...(r.truth ? { truth: path.resolve(path.dirname(file), r.truth) } : {}),
    }));
  } else {
    rows = [...new Map([...ALL_SAMPLES, ...HARD_CASE_SAMPLES].map((s) => [s.id, s])).values()].map(
      (s) => {
        const file = path.join(ROOT, "assets/toys/photo-3d", s.dir || "", s.file || s.id);
        return {
          ...s,
          kind: "builtin",
          file: file + "." + (s.ext || "jpg"),
          depthFile: file + ".depth",
        };
      },
    );
    const truth = path.join(ROOT, "tests/fixtures/truth"),
      m = JSON.parse(fs.readFileSync(path.join(truth, "manifest.json")));
    rows.push(
      ...m.scenes.map((s) => ({
        id: "truth-" + s.id,
        label: s.label,
        category: s.stress,
        kind: "truth",
        file: path.join(truth, s.id, "still/still.jpg"),
        truth: path.join(truth, s.id, "still/poses.json"),
        source: "https://github.com/ryanjosephkamp/splashery/tree/main/tests/fixtures/truth",
        author: "made by Ryan with Codex (GPT-6)",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      })),
    );
  }
  if (!rows.length)
    throw new Error(
      "No supported photos found. Use JPEG, PNG, WebP, or a browser-supported HEIC file.",
    );
  const ids = new Set();
  return rows.map((r) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(r.id) || ids.has(r.id))
      throw new Error("Input IDs must be unique safe filenames.");
    ids.add(r.id);
    if (!fs.statSync(r.file).isFile()) throw new Error("Missing input: " + r.id);
    if (r.kind === "builtin") {
      const s = [...ALL_SAMPLES, ...HARD_CASE_SAMPLES].find((s) => s.id === r.id);
      if (!s) throw new Error("Unknown built-in sample: " + r.id);
      const expected = path.join(ROOT, "assets/toys/photo-3d", s.dir || "", s.file || s.id);
      if (
        hash(fs.readFileSync(r.file)) !== hash(fs.readFileSync(expected + "." + (s.ext || "jpg")))
      )
        throw new Error("Built-in source bytes do not match the registered sample: " + r.id);
      if (!r.depthFile) r.depthFile = expected + ".depth";
      if (hash(fs.readFileSync(r.depthFile)) !== hash(fs.readFileSync(expected + ".depth")))
        throw new Error("Built-in depth bytes do not match the registered sample: " + r.id);
    }
    const referenceAssets = r.truth
      ? JSON.parse(fs.readFileSync(r.truth))
          .frames.flatMap((p) => [p.depth, p.mask])
          .filter(Boolean)
          .map((p) => ({
            file: p,
            sha256: hash(fs.readFileSync(path.resolve(path.dirname(r.truth), p))),
          }))
      : [];
    return {
      ...r,
      sha256: hash(fs.readFileSync(r.file)),
      ...(r.depthFile ? { depthSha256: hash(fs.readFileSync(r.depthFile)) } : {}),
      ...(r.truth
        ? {
            truthSha256: hash(
              Buffer.concat([
                fs.readFileSync(r.truth),
                Buffer.from(JSON.stringify(referenceAssets)),
              ]),
            ),
            referenceAssets,
          }
        : {}),
    };
  });
}
