// Retain the exact ROS1 records used by five phone recipes, without changing
// the original population count used to size their splats. Full scans stay
// available for larger budgets and existing tools.
import fs from "node:fs";
import crypto from "node:crypto";
import { decodeSplats } from "../src/packs/real-objects.js";
import { SOURCES } from "./ro-sources.mjs";

const shares = {
  "water-bottle": 0.8,
  sunglasses: 0.78,
  "baseball-cap": 0.78,
  "fountain-pen": 0.75,
  "soda-can": 0.7,
};
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const records = [];
for (const [id, share] of Object.entries(shares))
  for (const budget of [90000, 210000]) {
    const source = `assets/toys/${id}/${id}.splats`;
    const file = `assets/toys/${id}/${id}-opening${budget === 210000 ? "-mid" : ""}.splats`;
    const full = fs.readFileSync(source);
    const decoded = decodeSplats(full);
    const capacity = Math.min(Math.floor(budget * share), decoded.n);
    const bytes = Buffer.concat([
      full.subarray(0, 44),
      Buffer.alloc(4),
      full.subarray(44, 44 + capacity * 14),
    ]);
    bytes.write("ROP1");
    bytes.writeUInt32LE(capacity, 44);
    const prefix = decodeSplats(bytes);
    const arrays = {};
    for (const key of ["pos", "nrm", "sig", "rgb", "part"]) {
      const a = prefix[key];
      const b = decoded[key].subarray(0, a.length);
      const hash = sha(new Uint8Array(a.buffer));
      if (hash !== sha(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)))
        throw new Error(`${id}: ${key} changed`);
      arrays[key] = hash;
    }
    fs.writeFileSync(file, bytes);
    records.push({
      id,
      budget,
      source,
      file,
      sourceSha256: sha(full),
      sha256: sha(bytes),
      originalCount: decoded.n,
      capacity,
      beforeBytes: full.length,
      afterBytes: bytes.length,
      decodedPrefixEqual: true,
      arrays,
      credit: {
        title: SOURCES[id].title,
        author: SOURCES[id].author,
        url: SOURCES[id].url,
        license: SOURCES[id].license,
        inheritedFrom: "tools/ro-sources.mjs, CREDITS.md, and the toy's in-app credit",
        originalLicenseCheck: "September 29, 2026, as recorded by the original bake tool",
        liveLicenseCheck: "October 13, 2026; see this audit's source-pages.json",
        transformation: "Exact prefix copy made by Ryan with Codex (GPT-6); same asset license",
      },
    });
    console.log(
      `${id}: ${full.length} -> ${bytes.length} bytes; ${capacity} exact records, original population ${decoded.n}`,
    );
  }
fs.mkdirSync("docs/audits/load-time-2026-10", { recursive: true });
fs.writeFileSync(
  "docs/audits/load-time-2026-10/prefixes.json",
  JSON.stringify(records, null, 2) + "\n",
);
