// MIT. A deterministic 20-input phone scout, using the atlas's original probes.
// This is a scout, not the 118-input acceptance gate or an owner blind result.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { inventory } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { POSES } from "./p3df/scoring.mjs";
import { measureNext } from "./p3d-next-browser.mjs";
const args = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const root = path.resolve(args.root || ".cache/photo-3d-next"),
  out = path.join(root, "atlas-scout");
fs.mkdirSync(out, { recursive: true });
const atlas = JSON.parse(fs.readFileSync(path.join(root, "atlas-atlas.json"))),
  extra = inventory({ manifest: path.join(root, "extra-manifest.json") }),
  all = [...inventory(), ...extra],
  selected = [],
  used = new Set();
for (const [key, count, category] of [
  ["streaks", 10, "ribbons"],
  ["halos", 5, "boundaries"],
  ["missing", 5, "thin parts"],
]) {
  const ranked = atlas.inputs
    .filter((x) => Number.isFinite(x.profiles.phone.values[key]) && !used.has(x.id))
    .sort(
      (a, b) =>
        b.profiles.phone.values[key] - a.profiles.phone.values[key] || a.id.localeCompare(b.id),
    );
  for (const r of ranked.slice(0, count)) {
    used.add(r.id);
    selected.push({ id: r.id, category, rankScore: r.profiles.phone.values[key] });
  }
}
const entries = selected.map((x) => all.find((e) => e.id === x.id));
if (entries.some((x) => !x)) throw new Error("Frozen atlas input is missing");
const server = await localServer(entries),
  result = {
    complete: false,
    scope: "20 deterministic phone inputs, nine poses; not the full atlas gate",
    selection: selected,
    rows: [],
  };
fs.writeFileSync(path.join(out, "selection.json"), JSON.stringify(selected, null, 2));
try {
  for (const entry of entries) {
    const probeFile = path.join(root, "atlas-probes", entry.id + "-phone-anchors.json.gz");
    if (!fs.existsSync(probeFile))
      throw new Error("Download the original compressed probes first: " + entry.id);
    const frozen = JSON.parse(zlib.gunzipSync(fs.readFileSync(probeFile)));
    for (const candidate of (args.candidates || "classic,layered-a,layered-b").split(",")) {
      const folder = path.join(out, candidate);
      fs.mkdirSync(folder, { recursive: true });
      const file = path.join(folder, entry.id + ".json"),
        b = candidate === "layered-b";
      const row = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file))
        : {
            id: entry.id,
            candidate,
            photoHash: entry.sha256,
            ...(await measureNext(entry, "phone", {
              server,
              out: folder,
              poses: POSES,
              depth: 0.5,
              diagnostics: true,
              frozen,
              candidate,
              band: b ? 2 : 3,
              clean: b,
              patch: { passes: b ? 5 : 3, radius: b ? 3 : 2, coherent: b },
            })),
          };
      fs.writeFileSync(file, JSON.stringify(row));
      result.rows.push(row);
      fs.writeFileSync(path.join(out, "scout.json"), JSON.stringify(result));
      console.log(entry.id, candidate, JSON.stringify(row.values));
    }
  }
  result.complete =
    result.rows.length ===
    entries.length * (args.candidates || "classic,layered-a,layered-b").split(",").length;
} finally {
  fs.writeFileSync(path.join(out, "scout.json"), JSON.stringify(result));
  await server.close();
}
