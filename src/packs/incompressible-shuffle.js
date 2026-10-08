// Native Splashery pilot: local affine material trajectories from family 376.
import { path, unmap, STAGES } from "./incompressible-shuffle-core.js";
const world = ([x, y, z]) => [x, z, y]; // manuscript z is vertical; kit Y is up
const sub = (a, b) => a.map((v, i) => v - b[i]);
const corners = [
  [-0.4, -0.4],
  [0.4, -0.4],
  [-0.4, 0.4],
  [0.4, 0.4],
];
const patchCorners = [
  [-0.1, -0.1],
  [0.1, -0.1],
  [0.1, 0.1],
  [-0.1, 0.1],
];
let active;
const source =
  "https://github.com/openai/math/blob/adc7f1241b42e322a6451854ab7e4b4c146bf78a/preprints/Finite-Instructions-and-Solenoidal-Shear-Flows-September-27-2026/manuscript.pdf";
function pick(point) {
  const m = active;
  if (!m) return;
  const p = world(point);
  let best = null,
    dist = Infinity;
  for (let branch = 0; branch < 2; branch++) {
    const label = unmap(p, branch, m.lambda, m.time);
    if (Math.max(...label.map(Math.abs)) > 0.52) continue;
    for (let index = 0; index < m.samples[branch].length; index++) {
      const q = path(m.samples[branch][index], branch, m.lambda, m.time);
      const d = q.reduce((s, v, i) => s + (v - p[i]) ** 2, 0);
      if (d < dist) {
        dist = d;
        best = { branch, index };
      }
    }
  }
  if (best && dist < 0.15 ** 2) return { key: "pin", pick: best };
  return { key: "go" };
}
export const RECIPES = {
  "incompressible-shuffle": {
    alive: true,
    turntable: false,
    options: [
      {
        key: "stretch",
        label: "Stretch ×",
        type: "select",
        default: "2",
        choices: [
          { id: "0.5", label: "½" },
          { id: "1", label: "1" },
          { id: "2", label: "2" },
        ],
      },
    ],
    controls: [
      { key: "go", label: "Swap / replay", type: "pulse", ease: 12, pausable: false },
      { key: "pause", label: "Pause", type: "toggle", default: 0, ease: 0.01 },
      { key: "reset", label: "Reset to start", type: "toggle", default: 0, ease: 0.01 },
      { key: "pin", label: "Pin particle", type: "pulse", ease: 0.1 },
    ],
    action: { key: "go", label: "Swap / replay", at: pick, quiet: ["pin", "reset"] },
    credits: [
      {
        label: "Construction source · §3, pp. 5–9",
        title: "Finite Instructions and Solenoidal Shear Flows",
        source,
        author: "OpenAI",
        license: "Source repository: Apache 2.0; original visual geometry",
        licenseUrl:
          "https://github.com/openai/math/blob/adc7f1241b42e322a6451854ab7e4b4c146bf78a/LICENSE",
      },
    ],
    build(k, o) {
      const lambda = Number(o.stretch ?? 2);
      path([0, 0], 0, lambda, 0);
      const m = (k.data = {
        lambda,
        time: 0,
        playing: false,
        last: null,
        tap: 0,
        slider: 0,
        samples: [[], []],
        pin: null,
      });
      active = m;
      const budget = Math.min(k.count, 36000),
        count = (n) => (n * 160000) / k.count;
      for (let b = 0; b < 2; b++) {
        // Quantize before creating original labels: exactly the weights encoded by skin4.
        k.cloud({ count: count(Math.floor(budget * 0.38)), pattern: false }, (_rand, i, n) => {
          const side = Math.ceil(Math.sqrt(n));
          const u = Math.round(((i % side) / (side - 1)) * 1023) / 1023;
          const v = Math.round((Math.floor(i / side) / (Math.ceil(n / side) - 1)) * 1023) / 1023;
          const label = [-0.4 + 0.8 * u, -0.4 + 0.8 * v];
          m.samples[b].push(label);
          const line =
            Math.min(Math.abs(((u * 8) % 1) - 0.5), Math.abs(((v * 8) % 1) - 0.5)) < 0.06;
          const patch = Math.abs(label[0]) <= 0.1 && Math.abs(label[1]) <= 0.1;
          return {
            p: world(path(label, b, lambda, 0)),
            skin: [b * 4, b * 4 + 1, b * 4 + 2, b * 4 + 3, u, v],
            size: 0.48,
            color: patch ? "#fff1ac" : line ? "#f2fbff" : b ? "#ff865e" : "#32cce0",
            opacity: 0.96,
            pattern: false,
          };
        });
      }
      for (let b = 0; b < 2; b++)
        for (let j = 0; j < 4; j++)
          k.cloud({ count: count(100), pattern: false }, (_r, i, n) => ({
            p: [0, 0, 0],
            skin: [17 + b * 4 + j, 17 + b * 4 + ((j + 1) % 4), i / Math.max(1, n - 1)],
            size: 0.7,
            color: "#fff6bf",
            opacity: 1,
            pattern: false,
          }));
      // A selected material path is exactly seven straight spatial segments; the
      // smooth clock changes traversal speed, not these segments' geometry.
      for (let j = 0; j < 7; j++)
        k.cloud({ count: count(Math.floor(budget * 0.016)), pattern: false }, (_r, i, n) => ({
          p: [0, 0, 0],
          skin: [8 + j, 9 + j, i / Math.max(1, n - 1)],
          size: 0.52,
          color: "#ffe3a0",
          opacity: 0.7,
          pattern: false,
        }));
      k.cloud({ count: count(100), pattern: false }, (r) => {
        const a = r() * Math.PI * 2,
          z = r() * 2 - 1,
          s = Math.sqrt(1 - z * z) * 0.038;
        return {
          p: [s * Math.cos(a), z * 0.038, s * Math.sin(a)],
          kind: "token",
          params: [16, 0],
          size: 0.7,
          color: "#fff9d5",
          pattern: false,
        };
      });
      // Quiet dotted landing guides, not simulated fields.
      k.cloud({ count: count(Math.floor(budget * 0.07)), pattern: false }, (_r, i, n) => {
        const b = i % 2,
          x = b ? 1.25 : -1.25,
          t = Math.floor(i / 2) / Math.ceil(n / 2),
          a = t * Math.PI * 2;
        return {
          p: [x + 0.88 * Math.cos(a), -0.08, 0.88 * Math.sin(a)],
          size: 0.65,
          color: b ? "#a26358" : "#40838d",
          opacity: 0.6,
          pattern: false,
        };
      });
      for (const x of [-2.3, 2.3])
        for (const y of [-0.15, 2.6]) for (const z of [-1.25, 1.25]) k.reach([x, y, z]);
    },
    drive(t, c, out, info) {
      const m = info.data;
      if (!m) return;
      active = m;
      const dt = m.last === null ? 0 : Math.max(0, t - m.last);
      m.last = t;
      if (m.playing && c.pause < 0.5) m.time = Math.min(1, m.time + dt / 12);
      if (m.time === 1) m.playing = false;
      const reset = c.reset >= 0.5;
      if (reset !== Boolean(m.reset)) {
        m.reset = reset;
        m.time = 0;
        m.playing = false;
      }
      if (info.tap && info.tap.n !== m.tap) {
        m.tap = info.tap.n;
        if (info.tap.key === "pin")
          m.pin = info.tap.pick ?? { branch: 0, index: Math.floor(m.samples[0].length * 0.68) };
        else if (info.tap.key === "reset") {
          m.time = 0;
          m.playing = false;
        } else if (info.tap.key === "go") {
          m.time = 0;
          m.playing = true;
        }
      }
      if (info.slider && info.slider.n !== m.slider) {
        m.slider = info.slider.n;
        m.time = Math.max(0, Math.min(1, info.slider.value));
        m.playing = false;
      }
      out.tokens = [];
      for (let b = 0; b < 2; b++)
        for (let j = 0; j < 4; j++)
          out.tokens[b * 4 + j] = {
            offset: world(
              sub(path(corners[j], b, m.lambda, m.time), path(corners[j], b, m.lambda, 0)),
            ),
          };
      const pin = m.pin ?? { branch: 0, index: Math.floor(m.samples[0].length * 0.68) },
        label = m.samples[pin.branch][pin.index] ?? [0, 0];
      for (let j = 0; j < 8; j++)
        out.tokens[8 + j] = {
          offset: world(path(label, pin.branch, m.lambda, j / 8)),
          visible: m.pin ? 1 : 0,
        };
      out.tokens[16] = {
        offset: world(path(label, pin.branch, m.lambda, m.time)),
        visible: m.pin ? 1 : 0,
      };
      for (let b = 0; b < 2; b++)
        for (let j = 0; j < 4; j++)
          out.tokens[17 + b * 4 + j] = {
            offset: world(path(patchCorners[j], b, m.lambda, m.time)),
          };
      const sortKey = `${m.time}:${m.pin?.branch ?? -1}:${m.pin?.index ?? -1}`;
      out.resort = sortKey !== m.sortKey;
      m.sortKey = sortKey;
      const stage = Math.min(6, Math.max(0, Math.floor((m.time * 16 - 1) / 2)));
      out.legend = {
        title:
          m.playing && c.pause >= 0.5
            ? "Paused · turn Pause off to play"
            : m.time === 0
              ? "Two sheets. Seven moves."
              : m.time >= 0.875
                ? "Swapped · area unchanged"
                : `${stage + 1}/7 · ${STAGES[stage]}`,
        items: [
          { text: `Stretch ×${m.lambda} · patch area 0.04` },
          {
            text: m.pin ? "Pinned particle · complete path" : "Tap a sheet to pin a particle",
            dim: true,
          },
        ],
      };
      out.slider = { id: `shuffle:${Math.round(m.time * 1000)}`, label: "Sequence", value: m.time };
    },
  },
};
