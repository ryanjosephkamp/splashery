// Lane Viewers: makes the Point clouds toy's samples (assets/toys/point-clouds/*.laz) from USGS
// 3D Elevation Program lidar (public domain), read from the USGS's public Entwine Point Tiles on
// AWS (s3://usgs-lidar-public). For each sample it gathers every tile around a place, keeps the
// points inside a box, moves them from Web Mercator to UTM meters (so a measured distance is in
// real meters), thins them evenly to a budget and writes LAZ 1.4.
//
// Needs Python 3 with laspy, lazrs and pyproj (pip install "laspy[lazrs]" pyproj); they are build
// tools, never shipped. Usage: node tools/vwr-samples.mjs [--only id]

import { execFileSync } from "node:child_process";
import fs from "node:fs";

export const CLOUD_SAMPLES = [
  {
    id: "golden-gate",
    project: "CA_SanFrancisco_1_B23",
    lon: -122.4777,
    lat: 37.8103,
    half: [170, 170], // meters east-west, north-south
    budget: 450000,
    utm: 32610,
  },
  {
    id: "palace",
    project: "CA_SanFrancisco_1_B23",
    lon: -122.4484,
    lat: 37.8026,
    half: [150, 150],
    budget: 450000,
    utm: 32610,
  },
  {
    id: "meteor-crater",
    project: "AZ_NorthEast_3_D23",
    lon: -111.0225,
    lat: 35.0274,
    half: [800, 800],
    budget: 450000,
    utm: 32612,
  },
];

const PY = String.raw`
import json, sys, urllib.request, io
import numpy as np, laspy, pyproj
s = json.loads(sys.argv[1])
base = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/%s/" % s["project"]
ept = json.load(urllib.request.urlopen(base + "ept.json"))
B = ept["bounds"]
to3857 = pyproj.Transformer.from_crs(4326, 3857, always_xy=True)
toUtm = pyproj.Transformer.from_crs(3857, s["utm"], always_xy=True)
cx, cy = to3857.transform(s["lon"], s["lat"])
k = 1 / np.cos(np.radians(s["lat"]))  # Web Mercator meters per real meter
hx, hy = s["half"][0] * k, s["half"][1] * k
box = (cx - hx, cy - hy, cx + hx, cy + hy)
def nb(d, x, y, z):
    w = (B[3] - B[0]) / 2 ** d
    return (B[0] + x * w, B[1] + y * w, B[0] + (x + 1) * w, B[1] + (y + 1) * w)
def hits(b):
    return not (b[2] < box[0] or b[0] > box[2] or b[3] < box[1] or b[1] > box[3])
nodes = []
def walk(key):
    h = json.load(urllib.request.urlopen(base + "ept-hierarchy/%s.json" % key))
    for kk, v in h.items():
        d, x, y, z = map(int, kk.split("-"))
        if not hits(nb(d, x, y, z)): continue
        if v == -1:
            if kk != key: walk(kk)
        elif v > 0: nodes.append(kk)
walk("0-0-0-0")
nodes = sorted(set(nodes))
print("nodes", len(nodes), file=sys.stderr)
parts = []
for kk in nodes:
    data = urllib.request.urlopen(base + "ept-data/%s.laz" % kk).read()
    las = laspy.read(io.BytesIO(data))
    m = (las.x >= box[0]) & (las.x <= box[2]) & (las.y >= box[1]) & (las.y <= box[3])
    if m.any():
        parts.append(np.c_[las.x[m], las.y[m], las.z[m], las.intensity[m], las.classification[m], las.return_number[m], las.number_of_returns[m]])
a = np.concatenate(parts)
# Keep real points: drop the noise classes (7 low noise, 18 high noise).
a = a[(a[:, 4] != 7) & (a[:, 4] != 18)]
total = len(a)
rng = np.random.default_rng(7)
# Even thinning: one point per small cube (shuffled first, so which point a cube keeps is fair),
# with the cube sized so about the budget survive. A random share leaves holes and clumps.
if len(a) > s["budget"]:
    a = a[rng.permutation(len(a))]
    span = a[:, :2].max(0) - a[:, :2].min(0)
    v = float(np.sqrt(span[0] * span[1] / s["budget"]))
    for _ in range(8):
        key = np.floor((a[:, :3] - a[:, :3].min(0)) / v).astype(np.int64)
        _, first = np.unique(key, axis=0, return_index=True)
        if abs(len(first) - s["budget"]) < s["budget"] * 0.03: break
        v *= (len(first) / s["budget"]) ** 0.5
    a = a[np.sort(first)][: s["budget"]]
ux, uy = toUtm.transform(a[:, 0], a[:, 1])
h = laspy.LasHeader(point_format=6, version="1.4")
h.scales = [0.01, 0.01, 0.01]
h.offsets = [np.floor(ux.min()), np.floor(uy.min()), np.floor(a[:, 2].min())]
h.add_crs(pyproj.CRS.from_epsg(s["utm"]))
h.system_identifier = "USGS 3DEP (public domain)"
h.generating_software = "Splashery tools/vwr-samples.mjs"
las = laspy.LasData(h)
las.x, las.y, las.z = ux, uy, a[:, 2]
las.intensity = a[:, 3].astype(np.uint16)
las.classification = a[:, 4].astype(np.uint8)
las.return_number = a[:, 5].astype(np.uint8)
las.number_of_returns = a[:, 6].astype(np.uint8)
las.write(s["out"])
print(json.dumps({"id": s["id"], "points": int(len(a)), "inBox": int(total), "nodes": len(nodes)}))
`;

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null; // prettier-ignore
fs.mkdirSync("assets/toys/point-clouds", { recursive: true });
for (const s of CLOUD_SAMPLES) {
  if (only && s.id !== only) continue;
  const out = `assets/toys/point-clouds/${s.id}.laz`;
  const res = execFileSync("python3", ["-c", PY, JSON.stringify({ ...s, out })], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1 << 26,
  });
  console.log(res.trim(), `${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}
