// Lane Viewers: makes the small test files in tests/fixtures/vwr/ from our own numbers (no outside
// files). Splat files: a seeded ball of 2,000 splats written as PLY by tests/fixtures.mjs, then
// turned into compressed PLY and SOG by splat-transform (a devDependency). Point clouds: a seeded
// patch of 3,000 points written as LAS 1.2 (format 3), LAS 1.4 (format 7) and LAZ of both by laspy
// with lazrs (Python build tools), plus the truth as JSON. Run: node tools/vwr-fixtures.mjs

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makePly } from "../tests/fixtures.mjs";

const OUT = "tests/fixtures/vwr";
fs.mkdirSync(OUT, { recursive: true });

// Splats.
const ply = path.join(OUT, "ball.ply");
fs.writeFileSync(ply, makePly(2000));
const st = "node_modules/@playcanvas/splat-transform/bin/cli.mjs";
for (const out of ["ball.compressed.ply", "ball.sog"]) {
  execFileSync("node", [st, "-w", "-g", "cpu", ply, path.join(OUT, out)], { stdio: "ignore" });
}
fs.unlinkSync(ply); // the tests make the PLY themselves (makePly(2000))

// Point clouds.
const PY = String.raw`
import json, sys, numpy as np, laspy
out = sys.argv[1]
rng = np.random.default_rng(3)
n = 3000
x = 552000 + rng.random(n) * 80
y = 4182000 + rng.random(n) * 60
z = 20 + rng.random(n) * 15
inten = (rng.random(n) * 50000).astype(np.uint16)
cls = np.array([2, 5, 6, 9, 1])[np.arange(n) % 5].astype(np.uint8)
red = (np.arange(n) * 97 % 256 * 257).astype(np.uint16)
green = (np.arange(n) * 53 % 256 * 257).astype(np.uint16)
blue = (np.arange(n) * 31 % 256 * 257).astype(np.uint16)
for ver, fmt, name in [("1.2", 3, "patch12"), ("1.4", 7, "patch14")]:
    h = laspy.LasHeader(point_format=fmt, version=ver)
    h.scales = [0.001, 0.001, 0.001]
    h.offsets = [552000, 4182000, 0]
    las = laspy.LasData(h)
    las.x, las.y, las.z = x, y, z
    las.intensity, las.classification = inten, cls
    las.red, las.green, las.blue = red, green, blue
    las.write(out + "/" + name + ".las")
    las.write(out + "/" + name + ".laz")
q = lambda v: (np.round((v - 0) / 0.001) * 0.001)
json.dump({"count": n, "x": [round(float(v), 3) for v in x[:20]], "y": [round(float(v), 3) for v in y[:20]],
           "z": [round(float(v), 3) for v in z[:20]], "intensity": inten[:20].tolist(), "cls": cls[:20].tolist(),
           "red8": (red[:20] >> 8).tolist(), "min": [float(x.min()), float(y.min()), float(z.min())],
           "max": [float(x.max()), float(y.max()), float(z.max())]}, open(out + "/patch.json", "w"))
`;
execFileSync("python3", ["-c", PY, OUT], { stdio: "inherit" });

// Text clouds and a point PLY, from the same seeded idea (small, written here).
let s = 5;
const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const rows = [];
for (let i = 0; i < 500; i++)
  rows.push([10 + rnd() * 4, 20 + rnd() * 3, 1 + rnd() * 2, Math.floor(rnd() * 255), Math.floor(rnd() * 255), Math.floor(rnd() * 255)]); // prettier-ignore
fs.writeFileSync(path.join(OUT, "points.xyz"), rows.map((r) => `${r[0].toFixed(4)} ${r[1].toFixed(4)} ${r[2].toFixed(4)} ${r[3]} ${r[4]} ${r[5]}`).join("\n") + "\n"); // prettier-ignore
fs.writeFileSync(
  path.join(OUT, "points.pts"),
  `${rows.length}\n` + rows.map((r, i) => `${r[0].toFixed(4)} ${r[1].toFixed(4)} ${r[2].toFixed(4)} ${(i % 4000) - 2048} ${r[3]} ${r[4]} ${r[5]}`).join("\n") + "\n", // prettier-ignore
);
fs.writeFileSync(
  path.join(OUT, "points-ascii.ply"),
  `ply\nformat ascii 1.0\nelement vertex ${rows.length}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n` +
    rows.map((r) => r.map((v, k) => (k < 3 ? v.toFixed(4) : v)).join(" ")).join("\n") +
    "\n",
);
fs.writeFileSync(path.join(OUT, "points.json"), JSON.stringify(rows.slice(0, 10).map((r) => r.map((v, k) => (k < 3 ? Number(v.toFixed(4)) : v))))); // prettier-ignore
for (const f of fs.readdirSync(OUT)) console.log(f, fs.statSync(path.join(OUT, f)).size);
