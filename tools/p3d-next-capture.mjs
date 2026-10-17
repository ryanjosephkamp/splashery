// MIT. New true-target yardstick capture. Raw data stays in ignored local cache.
import fs from "node:fs";
import path from "node:path";
import { inventory } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { POSES } from "./p3df/scoring.mjs";
import { measureNext } from "./p3d-next-browser.mjs";
import { createHash } from "node:crypto";
const args = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const candidate = args.candidate || "classic",
  out = path.resolve(args.out || `.cache/photo-3d-next/${candidate}`);
fs.mkdirSync(out, { recursive: true });
const entries = inventory(args.manifest ? { manifest: args.manifest } : {}).filter((x) =>
  args.samples ? args.samples.split(",").includes(x.id) : x.kind === "truth",
);
if (!entries.length) throw new Error("No selected inputs");
const inputs = Object.fromEntries(
  [
    "src/photo3d/next/patchmatch.js",
    "src/photo3d/next/clean-color.js",
    "src/photo3d/build-worker.js",
    "src/live/relief-mesh.js",
    "tools/p3df/browser.mjs",
    "tools/p3d-next-browser.mjs",
    "tools/p3d-next-shader.mjs",
  ].map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")]),
);
const settings = {
  candidate,
  inputs,
  band: Number(args.band || 3),
  passes: Number(args.passes || 3),
  radius: Number(args.radius || 2),
  coherent: args.coherent === "true",
  clean: args.clean === "true",
  diagnostics: args.diagnostics === "true",
  ids: entries.map((e) => ({ id: e.id, hash: e.sha256 })),
};
const settingsFile = path.join(out, "settings.json");
if (
  fs.existsSync(settingsFile) &&
  JSON.stringify(JSON.parse(fs.readFileSync(settingsFile))) !== JSON.stringify(settings)
)
  throw new Error("Output settings or sources changed; use a new folder");
let importedClassic = null;
if (!fs.existsSync(settingsFile) && fs.existsSync(path.join(out, "capture.json"))) {
  if (candidate !== "classic" || args["import-classic"] !== "true")
    throw new Error("Legacy output has no identity guard; use a new folder");
  const prior = fs.readFileSync(path.join(out, "capture.json"));
  importedClassic = {
    captureSha256: createHash("sha256").update(prior).digest("hex"),
    reason:
      "Classic frames captured before skipping unused source diagnostics; frames and frozen camera support are retained, timing is not used for acceptance.",
  };
  fs.writeFileSync(
    path.join(out, "imported-classic.json"),
    JSON.stringify(importedClassic, null, 2),
  );
}
fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
const server = await localServer(entries),
  result = {
    candidate,
    settings,
    importedClassic,
    started: new Date().toISOString(),
    complete: false,
    rows: [],
  };
const save = () =>
  fs.writeFileSync(path.join(out, "capture.json"), JSON.stringify(result, null, 2));
try {
  for (const entry of entries)
    for (const profile of (args.profiles || "phone,desktop").split(",")) {
      const file = path.join(out, `${entry.id}-${profile}.json`);
      const row = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file))
        : {
            id: entry.id,
            profile,
            photoHash: entry.sha256,
            ...(await measureNext(entry, profile, {
              server,
              out,
              poses: POSES,
              depth: 0.5,
              diagnostics: args.diagnostics === "true",
              candidate,
              clean: settings.clean,
              band: settings.band,
              patch: {
                passes: settings.passes,
                radius: settings.radius,
                coherent: settings.coherent,
              },
            })),
          };
      row.appProfile = row.appProfile || row.profile;
      row.profile = profile;
      if (
        row.id !== entry.id ||
        row.photoHash !== entry.sha256 ||
        row.rows.length !== 9 ||
        row.targetCameras.length !== 9
      )
        throw new Error("Cached capture identity differs");
      for (const pose of row.rows)
        for (const [file, hash] of Object.entries(pose.artifacts))
          if (
            createHash("sha256")
              .update(fs.readFileSync(path.join(out, file)))
              .digest("hex") !== hash
          )
            throw new Error("Cached native artifact changed: " + file);
      fs.writeFileSync(file, JSON.stringify(row));
      result.rows.push(row);
      save();
      console.log(entry.id, profile, row.timing.first3dMs.toFixed(0));
    }
  result.complete = true;
  save();
} finally {
  await server.close();
}
