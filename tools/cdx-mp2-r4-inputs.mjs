// Five original CC0 clips: rigid objects, occlusions, thin edges, and fast motion.
// No model, external footage, people, marks, or generated images are used.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const dir = "assets/toys/moving-photo-3d";
const scratch = "work/r4-input-frames";
fs.mkdirSync(scratch, { recursive: true });
const w = 256,
  h = 144;
const scenes = [
  ["blocks", "mp4", 24],
  ["gate", "webm", 24],
  ["wheel", "mov", 24],
  ["orbit", "gif", 16],
  ["fast", "webm", 60],
];
const add = (a, b) => a.map((v, i) => v + b[i]);
const turn = ([x, y, z], a) => [
  x * Math.cos(a) + z * Math.sin(a),
  y,
  z * Math.cos(a) - x * Math.sin(a),
];
const project = ([x, y, z]) => [
  w / 2 + (110 * x) / (z + 6),
  h / 2 - (110 * (y - 0.15)) / (z + 6),
  z + 6,
];
const corners = Array.from({ length: 8 }, (_, i) => [
  i & 1 ? 1 : -1,
  i & 2 ? 1 : -1,
  i & 4 ? 1 : -1,
]);
const faces = [
  [0, 1, 3, 2],
  [4, 6, 7, 5],
  [0, 4, 5, 1],
  [2, 3, 7, 6],
  [0, 2, 6, 4],
  [1, 5, 7, 3],
];
function picture(scene, frame, fps) {
  const t = frame / fps,
    rgba = new Uint8Array(w * h * 3),
    zbuf = new Float64Array(w * h).fill(Infinity);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const at = (y * w + x) * 3;
      rgba[at] = 24 + y / 3;
      rgba[at + 1] = 38 + y / 4;
      rgba[at + 2] = 56 + y / 6;
    }
  const triangle = (a, b, c, color) => {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-7) return;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
      x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
      y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const u =
          ((b[0] - x - 0.5) * (c[1] - y - 0.5) - (b[1] - y - 0.5) * (c[0] - x - 0.5)) / area;
        const v =
          ((c[0] - x - 0.5) * (a[1] - y - 0.5) - (c[1] - y - 0.5) * (a[0] - x - 0.5)) / area;
        const q = 1 - u - v;
        if (u < 0 || v < 0 || q < 0) continue;
        const z = 1 / (u / a[2] + v / b[2] + q / c[2]),
          i = y * w + x;
        if (z >= zbuf[i]) continue;
        zbuf[i] = z;
        rgba.set(color, i * 3);
      }
  };
  const cube = (center, size, angle, color) => {
    const p = corners.map((v) =>
      project(
        add(
          turn(
            v.map((q, i) => q * size[i]),
            angle,
          ),
          center,
        ),
      ),
    );
    faces.forEach((face, j) => {
      const colorFace = color.map((c) => Math.round(c * (0.55 + j * 0.08)));
      triangle(p[face[0]], p[face[1]], p[face[2]], colorFace);
      triangle(p[face[0]], p[face[2]], p[face[3]], colorFace);
    });
  };
  for (let z = -1; z < 8; z++)
    for (let x = -5; x < 6; x++) {
      const p = [
        [x, -1, z],
        [x + 1, -1, z],
        [x, -1, z + 1],
        [x + 1, -1, z + 1],
      ].map(project);
      const c = (x + z) % 2 ? [92, 114, 120] : [45, 64, 75];
      triangle(p[0], p[1], p[2], c);
      triangle(p[1], p[3], p[2], c);
    }
  if (scene === "blocks") {
    cube([-0.6, 0.1, -0.4], [0.75, 0.9, 0.6], t * 0.8, [225, 135, 65]);
    cube([1.2 + Math.sin(t * 3) * 0.5, -0.4, -1.8], [0.35, 0.45, 0.35], -t, [65, 185, 210]);
    cube([-1.8, -0.4, 1], [0.4, 0.5, 0.4], 0.2, [150, 205, 90]);
  } else if (scene === "gate") {
    for (const x of [-1.5, 1.5]) cube([x, 0.1, 0], [0.2, 1.1, 0.25], 0, [180, 175, 150]);
    cube([0, 1.2, 0], [1.7, 0.15, 0.25], 0, [180, 175, 150]);
    cube([Math.sin(t * 3) * 1.2, -0.1, -1.4], [0.55, 0.65, 0.35], t * 0.4, [210, 75, 65]);
    cube([0, 0, 1], [0.13, 1, 0.2], 0, [80, 175, 200]);
  } else if (scene === "wheel") {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + t * 2;
      cube([Math.cos(a) * 1.25, Math.sin(a) * 1.25 + 0.4, 0], [0.19, 0.19, 0.2], a, [200, 160, 70]);
    }
    cube([0, 0.4, 0], [0.3, 0.3, 0.5], t * 2, [80, 180, 200]);
  } else {
    const speed = scene === "fast" ? 10 : 2;
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 + t * speed;
      cube(
        [Math.cos(a) * 1.5, 0.2 + Math.sin(a * 2) * 0.5, Math.sin(a) * 1.5],
        [0.3, 0.4, 0.3],
        a,
        [70 + i * 30, 190 - i * 15, 210 - i * 25],
      );
    }
    cube([0, 0, 0.5], [0.25, 1, 0.25], 0, [215, 115, 65]);
  }
  return Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), rgba]);
}
const manifest = {
  license: "CC0-1.0",
  author: "made by Ryan with Codex (GPT-6)",
  generator: "tools/cdx-mp2-r4-inputs.mjs",
  clips: [],
};
for (const [scene, ext, fps] of scenes) {
  const input = path.join(scratch, scene);
  fs.mkdirSync(input, { recursive: true });
  for (let frame = 0; frame < fps * 2; frame++)
    fs.writeFileSync(`${input}/${String(frame).padStart(3, "0")}.ppm`, picture(scene, frame, fps));
  const file = `${dir}/cdx-mp2-r4-${scene}.${ext}`;
  const codec =
    ext === "gif"
      ? ["-vf", "split[a][b];[a]palettegen[p];[b][p]paletteuse", "-loop", "0"]
      : ext === "webm"
        ? ["-c:v", "libvpx-vp9", "-crf", "18", "-b:v", "0", "-pix_fmt", "yuv420p"]
        : ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  const audio =
    scene === "blocks"
      ? [
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=330:sample_rate=22050:duration=2",
          "-c:a",
          "aac",
          "-b:a",
          "32k",
        ]
      : [];
  execFileSync("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-y",
    "-framerate",
    String(fps),
    "-i",
    `${input}/%03d.ppm`,
    ...audio,
    ...codec,
    file,
  ]);
  const bytes = fs.readFileSync(file);
  manifest.clips.push({
    id: `own-${scene}`,
    file,
    format: ext,
    width: w,
    height: h,
    fps,
    frames: fps * 2,
    seconds: 2,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
fs.writeFileSync(`${scratch}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
