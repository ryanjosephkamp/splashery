// Codex task 78d. From Ryan Kamp's Toy Box concept: a name to play with.
// Reuse the Fourier toy's word paths, not the concept's font or renderer.
import { charPath, fourierWord } from "./maths.js";
import { evenTube, evenBox } from "./even.js";
import { clamp, shade, smoothstep, quatAxisAngle } from "../kit.js";
import { TOY_SOUNDS } from "../toy-sounds.js";

const MAX_LETTERS = 24;
const DETAIL = [12000, 24000, 48000, 96000, 192000];
const PAINTS = [
  { id: "pink", label: "Pink", hex: "#ff3d8b" },
  { id: "yellow", label: "Yellow", hex: "#ffd60a" },
  { id: "white", label: "White", hex: "#fffdf5" },
  { id: "orange", label: "Orange", hex: "#ff6a1f" },
  { id: "violet", label: "Violet", hex: "#6a2cff" },
  { id: "ink", label: "Ink", hex: "#37294a" },
  { id: "sky", label: "Sky", hex: "#96f0ff" },
  { id: "red", label: "Red", hex: "#e81c2e" },
];
const DEFAULT_COLORS = [1, 0, 2, 3, 2, 3, 0, 1];
const VERBS = ["spin", "poke", "paint", "drop", "blow"];
const PATHS = new Map();

function glyphPath(ch) {
  if (!PATHS.has(ch)) {
    // A name's hyphen and apostrophe are the only additions to Your words.
    const punctuation =
      ch === "-"
        ? [
            [0.7, 3],
            [3.3, 3],
          ]
        : ch === "'"
          ? [
              [2, 6],
              [1.5, 4.6],
            ]
          : null;
    PATHS.set(ch, punctuation || charPath(ch, 192));
  }
  return PATHS.get(ch);
}

function readName(text) {
  const name = fourierWord(String(text ?? "").slice(0, 256)).replace(/[’‘]/g, "'");
  const chars = [...name].filter((ch) => ch !== " ");
  if (!chars.length) throw new Error("Type a name first.");
  if (chars.length > MAX_LETTERS) throw new Error("Use up to 24 letters, digits, or symbols.");
  const bad = chars.find((ch) => !glyphPath(ch));
  if (bad)
    throw new Error(
      `“${bad}” can't be drawn. Use A–Z, digits, spaces, hyphens, apostrophes, ♥, or ★.`,
    );
  return name;
}

// The same deterministic layout serves build, taps, audio picks, and links.
export function nameLayout(text) {
  const name = readName(text);
  const rows = [];
  let row = "";
  for (const word of name.split(" ")) {
    if (row && row.length + word.length + 1 <= 8) row += ` ${word}`;
    else {
      if (row) rows.push(row);
      let remaining = word;
      while (remaining.length > 8) {
        rows.push(remaining.slice(0, 8));
        remaining = remaining.slice(8);
      }
      row = remaining;
    }
  }
  if (row) rows.push(row);
  const letters = [];
  const widths = rows.map((s) => [...s].reduce((w, ch) => w + (ch === " " ? 0.3 : 0.54), 0));
  rows.forEach((s, r) => {
    let x = -widths[r] / 2;
    for (const char of s) {
      if (char === " ") {
        x += 0.3;
        continue;
      }
      letters.push({
        char,
        center: [x + 0.27, ((rows.length - 1) / 2 - r) * 0.82, 0],
        path: glyphPath(char),
      });
      x += 0.54;
    }
  });
  return { name, letters, width: Math.max(...widths), height: (rows.length - 1) * 0.82 + 0.7 };
}

export function nameBudget(budget, detail = "auto") {
  const requested =
    detail === "auto"
      ? budget <= 60000
        ? 24000
        : budget <= 140000
          ? 48000
          : 96000
      : Number(detail);
  const ceiling = Math.min(budget, DETAIL.includes(requested) ? requested : 96000);
  return DETAIL.filter((n) => n <= ceiling).at(-1) ?? Math.max(1, Math.floor(ceiling));
}

function paintString(text, n) {
  return Array.from({ length: n }, (_, i) => (/^[0-7]$/.test(text?.[i]) ? text[i] : ".")).join("");
}

function pickLetter(layout, point) {
  let pick = 0,
    distance = Infinity;
  for (let i = 0; i < layout.letters.length; i++) {
    const center = layout.letters[i].center;
    const d = Math.hypot(point[0] - center[0], point[1] - center[1]);
    if (d < distance) {
      pick = i;
      distance = d;
    }
  }
  return pick;
}

let active = { layout: nameLayout("RYAN KAMP"), verb: "poke", color: "pink", paints: "" };

function act(point) {
  const pick = point ? pickLetter(active.layout, point) : null;
  if (active.verb === "paint") {
    const paints = [...paintString(active.paints, active.layout.letters.length)];
    const color = Math.max(
      0,
      PAINTS.findIndex((p) => p.id === active.color),
    );
    paints.forEach((_, i) => {
      if (pick === null || pick === i) paints[i] = String(color);
    });
    return { key: "play", pick, options: { paints: paints.join("") } };
  }
  return { key: "play", pick };
}

// All transforms are rigid. A pulse makes a whole letter leave home and
// return; painting changes its saved color and gives it a small bounce.
function letterPose(verb, p, i, letter, layout, selected) {
  const offset = [0, 0, 0];
  let angle = 0;
  const q = clamp((p - (selected ? 0 : i * 0.012)) / (selected ? 1 : 0.72), 0, 1);
  const e = Math.sin(Math.PI * q) ** 2;
  if (verb === "spin") {
    angle = Math.PI * 2 * smoothstep(0, 1, q);
    offset[1] = 0.22 * e;
  } else if (verb === "poke") {
    const kick = Math.sin(q * Math.PI * 5) * Math.exp(-q * 3) * (1 - smoothstep(0.75, 1, q));
    offset[2] = 0.45 * kick;
    offset[1] = 0.12 * e;
    angle = 0.38 * kick;
  } else if (verb === "paint") {
    offset[1] = 0.25 * e;
    angle = 0.25 * Math.sin(Math.PI * 2 * q) * e;
  } else if (verb === "drop") {
    const fall = layout.height / 2 - 0.32 + letter.center[1];
    // Accelerate into the shelf, bounce twice, then rise back to the row.
    const hit = 0.35;
    let y;
    if (q < hit) y = -fall * (q / hit) ** 2;
    else if (q < 0.7)
      y = -fall + 0.2 * Math.abs(Math.sin(((q - hit) * Math.PI) / 0.175)) * (1 - (q - hit) / 0.35);
    else y = -fall * (1 - smoothstep(0.7, 1, q));
    offset[1] = y;
    offset[0] = (i % 2 ? 1 : -1) * 0.12 * e;
    angle = (i % 2 ? 1 : -1) * 0.35 * e;
  } else if (verb === "blow") {
    offset[0] = (0.15 + (i % 3) * 0.02) * e;
    offset[1] = (0.12 + (i % 2) * 0.07) * e;
    offset[2] = 0.08 * e;
    angle = (i % 2 ? 1 : -1) * 0.3 * e;
  }
  // Exact rest poses, including a complete spin (no quaternion sign jump).
  if (q === 0 || q === 1) return { base: letter.center, offset: [0, 0, 0], quat: [0, 0, 0, 1] };
  return { base: letter.center, offset, quat: quatAxisAngle([0, 0, 1], angle) };
}

export const RECIPES = {
  "name-toy": {
    alive: true,
    turntable: false,
    seed: 1999,
    options: [
      { key: "name", label: "Your name", type: "text", default: "RYAN KAMP", hidden: true },
      {
        key: "verb",
        label: "Action",
        type: "select",
        default: "poke",
        choices: VERBS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })),
      },
      { key: "color", label: "Paint color", type: "select", default: "pink", choices: PAINTS },
      { key: "paints", label: "Painted letters", type: "text", default: "", hidden: true },
      {
        key: "detail",
        label: "Detail",
        type: "select",
        default: "auto",
        choices: [
          { id: "auto", label: "Auto (this device)" },
          ...DETAIL.map((n) => ({ id: String(n), label: `${n.toLocaleString("en-US")} splats` })),
        ],
      },
    ],
    controls: [{ key: "play", label: "Play", type: "pulse", ease: 3.4 }],
    action: {
      key: "play",
      label: "Play this action",
      at: act,
    },
    input: {
      title: "Your name",
      placeholder: "Type a name…",
      button: "Make my toy",
      accept: ".txt,text/plain",
      fileButton: "Open a name from a text file…",
      note: "Use up to 24 letters (A–Z), digits, spaces, hyphens, apostrophes, ♥, or ★. Pick an action, then tap a letter; each plays its own note. Play animates the whole name; tap a letter to paint it. Paint colors and the name stay in the scene link. Detail is capped for this device. Blow is a tap: no microphone is needed.",
      async read(text) {
        return { name: readName(text), paints: "" };
      },
      shown: () =>
        `${active.layout.name.replace(/#/g, "♥").replace(/\*/g, "★")} · ${active.layout.letters.length} solid letters · ${active.count?.toLocaleString("en-US") ?? ""} splats`,
    },
    credits: [
      {
        label: "Your name in splats",
        title: "Original procedural letters",
        author: "Made by Ryan with Codex (GPT-6)",
        license: "CC0 1.0",
        changes:
          "From a concept by Ryan Kamp. Reuses Splashery's Your words paths. Code is MIT; procedural shapes are CC0.",
      },
    ],
    toySound(o) {
      let layout;
      try {
        layout = nameLayout(o.name);
      } catch {
        layout = nameLayout("RYAN KAMP");
      }
      const spec = TOY_SOUNDS["name-toy"];
      return { ...spec, notes: spec.notes.split(" ").slice(0, layout.letters.length).join(" ") };
    },
    drive(t, c, out, info) {
      const data = info?.data;
      const layout = data?.layout ?? active.layout;
      const verb = data?.verb ?? active.verb;
      const p = c.play > 0 ? 1 - c.play : 1;
      const picked = info?.tap?.pick;
      const selected = picked !== null && picked !== undefined;
      out.tokens = layout.letters.map((letter, i) => {
        if (selected && picked !== i)
          return { base: letter.center, offset: [0, 0, 0], quat: [0, 0, 0, 1] };
        return letterPose(verb, p, i, letter, layout, selected);
      });
      // Refresh sorting during large travel and once at landing. Limited
      // to 6 Hz so a phone does not sort every frame.
      if (data) {
        const sort = c.play > 0 ? Math.floor((info.time ?? t) * 6) : -1;
        out.resort = sort !== data.sort;
        data.sort = sort;
      }
    },
    build(k, o) {
      let layout;
      try {
        layout = nameLayout(o.name);
      } catch {
        layout = nameLayout("RYAN KAMP");
      }
      const count = nameBudget(k.count, o.detail);
      k.count = count;
      const paints = paintString(o.paints, layout.letters.length);
      const colors = layout.letters.map(
        (_, i) =>
          PAINTS[paints[i] === "." ? DEFAULT_COLORS[i % DEFAULT_COLORS.length] : Number(paints[i])]
            .hex,
      );
      const verb = VERBS.includes(o.verb) ? o.verb : "poke";
      if (verb === "blow") {
        // Frame the gust's travel and tilt, so edge letters stay visible.
        for (const x of [-1, 1])
          for (const y of [-1, 1])
            k.reach([x * (layout.width / 2 + 0.35), y * (layout.height / 2 + 0.35), 0.15]);
      }
      active = { layout, verb, color: o.color, paints, count };
      k.data = { layout, colors, verb, sort: -1 };
      layout.letters.forEach((letter, i) => {
        // The word path goes there and back. Its first half describes the
        // stroke once; heart and star paths use the complete closed loop.
        const path = ["#", "*", "-", "'"].includes(letter.char)
          ? letter.path
          : letter.path.slice(0, 97);
        const curve = (u) => {
          const a = Math.min(path.length - 2, Math.floor(u * (path.length - 1)));
          const f = u * (path.length - 1) - a;
          return [
            (path[a][0] + (path[a + 1][0] - path[a][0]) * f - 2) * 0.1,
            (path[a][1] + (path[a + 1][1] - path[a][1]) * f - 3) * 0.1,
            0,
          ];
        };
        k.add(evenTube(k, curve, 0.05, { caps: true, samples: 192 }), {
          pos: letter.center,
          even: true,
          opacity: 1,
          jitter: 0,
          size: 1.35,
          flat: 0.3,
          kind: "token",
          params: [i, 0],
          pattern: false,
          color: ({ n }) =>
            shade(colors[i], 0.72 + 0.23 * Math.max(0, n[2]) + 0.05 * Math.max(0, n[1])),
        });
      });
      k.add(evenBox(layout.width + 0.12, 0.08, 0.3), {
        pos: [0, -layout.height / 2 - 0.03, 0],
        color: "#ddd4e9",
        even: true,
        opacity: 1,
        jitter: 0,
        pattern: false,
        size: 1.2,
      });
    },
  },
};
