// Original kit-built test places, CC0, made by Ryan with Codex (GPT-6).
// Surfaces are sampled, not supplied as collision boxes: scans use the same path.
import { Kit } from "../kit.js";

export const ROOMS = [
  { id: "gallery", label: "Sunlit gallery", half: [5, 6], spawn: [0, 0, -3.5] },
  { id: "courtyard", label: "Garden courtyard", half: [5, 6], spawn: [0, 0, -3.5] },
];

export function roomSurfaces(id) {
  const surfaces = [];
  const add = (origin, u, v, normal, color, pattern = "plain") =>
    surfaces.push({ origin, u, v, normal, color, pattern });
  add([-5, 0, -6], [10, 0, 0], [0, 0, 12], [0, 1, 0], "#b9b1a0", "tile");
  add([-5, 0, 6], [10, 0, 0], [0, 3.6, 0], [0, 0, -1], "#d8d1be");
  add([-5, 0, -6], [0, 0, 12], [0, 3.6, 0], [1, 0, 0], "#bbc9bf");
  add([5, 0, -6], [0, 0, 12], [0, 3.6, 0], [-1, 0, 0], "#b6c8cc");
  if (id === "gallery") {
    add([-5, 0, -6], [10, 0, 0], [0, 3.6, 0], [0, 0, 1], "#d1c6b4");
    add([-5, 3.6, -6], [10, 0, 0], [0, 0, 12], [0, -1, 0], "#eee7d8");
    // Low dais, 20 cm high, and a partition with an opening on either side.
    add([-1.4, 0.2, 1], [2.8, 0, 0], [0, 0, 2], [0, 1, 0], "#b27b57");
    add([-1.4, 0, 1], [2.8, 0, 0], [0, 0.2, 0], [0, 0, -1], "#8a624c");
    add([-1.2, 0, 4.3], [2.4, 0, 0], [0, 2.8, 0], [0, 0, -1], "#618483");
    // Three abstract, original colored wall panels (no images or external art).
    for (let i = 0; i < 3; i++)
      add(
        [-4.94, 1.05, -3.8 + i * 3.1],
        [0, 0, 1.5],
        [0, 1.4, 0],
        [1, 0, 0],
        ["#b26343", "#547675", "#a18a4b"][i],
        "panel",
      );
  } else {
    // Open south edge deliberately exercises capture support and the soft edge.
    for (const x of [-3.5, 2.5]) {
      add([x, 0.65, 0.7], [1, 0, 0], [0, 0, 2], [0, 1, 0], "#5f8054");
      add([x, 0, 0.7], [1, 0, 0], [0, 0.65, 0], [0, 0, -1], "#aa7557");
      add([x, 0, 2.7], [1, 0, 0], [0, 0.65, 0], [0, 0, 1], "#aa7557");
      add([x, 0, 0.7], [0, 0, 2], [0, 0.65, 0], [-1, 0, 0], "#aa7557");
      add([x + 1, 0, 0.7], [0, 0, 2], [0, 0.65, 0], [1, 0, 0], "#aa7557");
    }
  }
  return surfaces;
}

export function buildRoom(id = "gallery", { spacing = 0.16 } = {}) {
  const def = ROOMS.find((r) => r.id === id);
  if (!def) throw new Error("Choose one of the two test places.");
  const samples = [];
  for (const s of roomSurfaces(id)) {
    const nu = Math.ceil(Math.hypot(...s.u) / spacing);
    const nv = Math.ceil(Math.hypot(...s.v) / spacing);
    for (let j = 0; j <= nv; j++)
      for (let i = 0; i <= nu; i++) {
        const p = s.origin.map((v, a) => v + (s.u[a] * i) / nu + (s.v[a] * j) / nv);
        const tile =
          s.pattern === "tile" && (Math.floor((p[0] + 5) * 1.4) + Math.floor((p[2] + 6) * 1.4)) % 2;
        const panel = s.pattern === "panel" && Math.sin(j * 0.24 + i * 0.14) > 0.3;
        const color = tile ? "#a29f8f" : panel ? "#d7b481" : s.color;
        samples.push({
          p,
          n: s.normal,
          size: (spacing * 0.78) / 0.01,
          flat: 0.025,
          color,
          opacity: 1,
          pattern: false,
        });
      }
  }
  const kit = new Kit(115, { count: samples.length, fit: false });
  kit.cloud({ share: 1, jitter: 0, pattern: false }, (_r, i) => samples[i] || null);
  const it = kit.emit();
  while (!it.next().done);
  return { ...def, buffer: kit.buf };
}
