// MIT. Five fresh-browser phone observations per method, with rotating order.
// Run alone after closing competing browser audits. This is one-input screening.
import fs from "node:fs";
import path from "node:path";
import { inventory } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { measureNext } from "./p3d-next-browser.mjs";
import { median } from "./p3d-next-score.mjs";
const args = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const root = path.resolve(args.root || ".cache/photo-3d-next"),
  id = args.sample || "new-13-60172881",
  out = path.join(root, "isolated-cost");
fs.mkdirSync(out, { recursive: true });
const entry = [
  ...inventory(),
  ...inventory({ manifest: path.join(root, "extra-manifest.json") }),
].find((x) => x.id === id);
if (!entry) throw new Error("Unknown cost input");
const server = await localServer([entry]),
  methods = ["classic", "layered-a", "layered-b"],
  result = {
    input: id,
    scope:
      "One phone input, five fresh-browser observations per method; not the corpus cost gate or a physical phone",
    complete: false,
    rows: [],
  };
try {
  for (let trial = 0; trial < 5; trial++)
    for (let k = 0; k < 3; k++) {
      const candidate = methods[(trial + k) % 3],
        b = candidate === "layered-b",
        folder = path.join(out, `${trial}-${candidate}`);
      fs.mkdirSync(folder, { recursive: true });
      const observation = await measureNext(entry, "phone", {
        server,
        out: folder,
        poses: [[0, 0]],
        depth: 0.5,
        diagnostics: false,
        candidate,
        band: b ? 2 : 3,
        clean: b,
        patch: { passes: b ? 5 : 3, radius: b ? 3 : 2, coherent: b },
      });
      fs.writeFileSync(path.join(folder, "observation.json"), JSON.stringify(observation));
      result.rows.push({
        trial,
        candidate,
        first3dMs: observation.timing.first3dMs,
        peakPssBytes: observation.memory.peakPssBytes,
        source: observation.timing.source,
        overlayProof: observation.overlayProof,
      });
      fs.writeFileSync(path.join(out, "cost.json"), JSON.stringify(result, null, 2));
      console.log(
        trial,
        candidate,
        Math.round(observation.timing.first3dMs),
        observation.memory.peakPssBytes,
      );
    }
  result.complete = true;
  result.methods = methods.map((candidate) => {
    const rows = result.rows.filter((r) => r.candidate === candidate);
    return {
      candidate,
      medianMs: median(rows.map((r) => r.first3dMs)),
      peakPssBytes: Math.max(...rows.map((r) => r.peakPssBytes)),
      observations: rows.length,
    };
  });
} finally {
  fs.writeFileSync(path.join(out, "cost.json"), JSON.stringify(result, null, 2));
  await server.close();
}
