// MIT; made by Ryan with Codex (GPT-6). Reuse task 99's actual-frame recorder,
// with the same twenty inputs and camera path. Fail if its controller drifts.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(".cache/photo-3d-fill"),
  original = new URL("./p3d-next-clips.mjs", import.meta.url);
const selection = JSON.parse(
  zlib.gunzipSync(fs.readFileSync(path.join(root, "review-selection.json.gz"))),
);
if (selection.length !== 20 || new Set(selection.map((r) => r.id)).size !== 20)
  throw new Error("Need task 99's original twenty review inputs");
fs.mkdirSync(path.join(root, "atlas-scout"), { recursive: true });
fs.writeFileSync(path.join(root, "atlas-scout/selection.json"), JSON.stringify(selection, null, 2));
let source = fs.readFileSync(original, "utf8");
const replace = (before, after) => {
  if (source.split(before).length !== 2)
    throw new Error("Task 99 clip controller changed: " + before);
  source = source.replace(before, after);
};
replace(
  'const root = path.resolve(".cache/photo-3d-next"),',
  `const root = ${JSON.stringify(root)},`,
);
replace('["classic", "layered-a"]', '["classic", "fill"]');
replace(
  '  "src/photo3d/next/patchmatch.js",',
  '  "src/photo3d/next/fill.js",\n  "tools/p3d-hard-edge-clips.mjs",\n  "src/photo3d/next/patchmatch.js",',
);
replace(
  "Classic and research Layered A; owner votes unmeasured",
  "Classic and research Layered H; owner votes unmeasured",
);
source = source.replace(
  /from "([^"]+)"/g,
  (_, name) =>
    `from ${JSON.stringify(name.startsWith(".") ? new URL(name, original).href : import.meta.resolve(name))}`,
);
await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
