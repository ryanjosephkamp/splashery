// Lane QR r3: color themes for the QR code toy, and countries' flag colors
// on the code's splats.
//
// A code scans when a camera can tell its dark modules from its light ones.
// The QR scan lab (docs/audits/qr-scan-lab-2026-10.md) found codes reliable
// from a contrast of 4 : 1 between them, so every theme here keeps at least
// TARGET (4.5 : 1) between every dark color it uses and its light color.
//
// Flags: the colors only, never a flag's symbols or layout. The lightest of a
// flag's colors (white, or a pale yellow) becomes the light modules and the
// quiet zone; its darker colors become the code (with a gradient between the
// first two) and the finder "eyes". A color that is too light to stand
// against the light one is darkened, keeping its hue, just enough to reach
// TARGET, and the theme says so (`notes`), so the code still scans. A flag
// with no pale color gets white light modules. The colors are the commonly
// published sRGB values of each flag (Wikipedia's flag articles, October
// 2026); a theme is a nod to the flag, not an official rendering of it.

import { hexRGB, luminance, contrast } from "./build.js";

export const TARGET = 4.5;

const hex = (c) =>
  "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join(""); // prettier-ignore

// The color c darkened (its hue kept: every channel scaled down) until it has
// `target` contrast against the light color `bg`. Returns { c, before }.
export function darkenTo(c, bg, target = TARGET + 0.05) {
  const before = contrast(c, bg);
  if (before >= target) return { c, before };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (
      contrast(
        c.map((v) => v * mid),
        bg,
      ) >= target
    )
      lo = mid;
    else hi = mid;
  }
  return { c: c.map((v) => v * lo), before };
}

// ---- Color themes (item 5 of the brief) --------------------------------------------------
// fg (and fg2 for a gradient): the dark modules; bg: the light modules and
// quiet zone; eye: the finder eyes; wave: Alive's color; back: the back of
// the tiles in Flip and Split-flap.
const PALETTES = [
  { id: "sunset", label: "Sunset", fg: "#4a1d5e", fg2: "#9b2335", gradient: "linear", bg: "#fff3e0", eye: "#a8361a", wave: "#e8622c", back: "#f2a03d" }, // prettier-ignore
  { id: "ocean", label: "Ocean", fg: "#0b3d5c", fg2: "#0d6b73", gradient: "radial", bg: "#eef9fb", eye: "#0a2a4a", wave: "#1597b0", back: "#7fd3e0" }, // prettier-ignore
  { id: "forest", label: "Forest", fg: "#1f3d2b", fg2: "#3b5a22", gradient: "linear", bg: "#f4f1e6", eye: "#5a3a1e", wave: "#3f8f3a", back: "#a9c47f" }, // prettier-ignore
  { id: "neon", label: "Neon", fg: "#1c0045", fg2: "#3a0ca3", gradient: "linear", bg: "#f6f0ff", eye: "#b0005e", wave: "#ff1fbf", back: "#38f0ff" }, // prettier-ignore
  { id: "pastel", label: "Pastel", fg: "#4a3f6b", fg2: "#5d3d5a", gradient: "linear", bg: "#fdeef3", eye: "#3f5a6b", wave: "#b48fd9", back: "#ffd1dc" }, // prettier-ignore
  { id: "mono", label: "Monochrome", fg: "#111111", bg: "#ffffff", eye: "#3a3a3a", wave: "#555555", back: "#bdbdbd" }, // prettier-ignore
  { id: "ink", label: "Ink and paper", fg: "#1b2a49", bg: "#f3ead8", eye: "#7a1f1f", wave: "#2f4f8f", back: "#c9b48a" }, // prettier-ignore
  { id: "candy", label: "Candy", fg: "#a3134f", fg2: "#5e1a8f", gradient: "linear", bg: "#fff0f6", eye: "#6a1b9a", wave: "#ff4f9a", back: "#ffd166" }, // prettier-ignore
  { id: "autumn", label: "Autumn", fg: "#5a260c", fg2: "#7a3410", gradient: "radial", bg: "#fbf3e4", eye: "#3d2b1f", wave: "#d9741f", back: "#e8b04a" }, // prettier-ignore
  { id: "mint", label: "Mint", fg: "#0f4c3a", fg2: "#155e63", gradient: "linear", bg: "#effaf5", eye: "#0a3a5a", wave: "#2bb98a", back: "#9fe8cf" }, // prettier-ignore
  { id: "royal", label: "Royal", fg: "#2b1055", fg2: "#0b3d91", gradient: "linear", bg: "#fbf8ef", eye: "#6b4f00", wave: "#c9a227", back: "#e6c85a" }, // prettier-ignore
  { id: "lava", label: "Lava", fg: "#3a0a0a", fg2: "#8a1c0c", gradient: "radial", bg: "#fff4ec", eye: "#1f1f1f", wave: "#ff5a1f", back: "#ffb347" }, // prettier-ignore
];

// ---- Flags (item 4) -------------------------------------------------------------------------
// Each flag's colors, the most prominent first (names say which is which).
const FLAGS = [
  { id: "us", label: "United States", colors: [["blue", "#3c3b6e"], ["red", "#b22234"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "gb", label: "United Kingdom", colors: [["blue", "#012169"], ["red", "#c8102e"], ["white", "#ffffff"]] }, // prettier-ignore
  {
    id: "ca",
    label: "Canada",
    colors: [
      ["red", "#d52b1e"],
      ["white", "#ffffff"],
    ],
  },
  { id: "mx", label: "Mexico", colors: [["green", "#006847"], ["red", "#ce1126"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "br", label: "Brazil", colors: [["green", "#009739"], ["blue", "#012169"], ["yellow", "#fedd00"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "ar", label: "Argentina", colors: [["light blue", "#74acdf"], ["sun yellow", "#f6b40e"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "fr", label: "France", colors: [["blue", "#002654"], ["red", "#ce1126"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "de", label: "Germany", colors: [["black", "#000000"], ["red", "#dd0000"], ["gold", "#ffcc00"]] }, // prettier-ignore
  { id: "it", label: "Italy", colors: [["green", "#009246"], ["red", "#ce2b37"], ["white", "#ffffff"]] }, // prettier-ignore
  {
    id: "es",
    label: "Spain",
    colors: [
      ["red", "#aa151b"],
      ["yellow", "#f1bf00"],
    ],
  },
  { id: "ie", label: "Ireland", colors: [["green", "#169b62"], ["orange", "#ff883e"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "nl", label: "Netherlands", colors: [["blue", "#21468b"], ["red", "#ae1c28"], ["white", "#ffffff"]] }, // prettier-ignore
  {
    id: "se",
    label: "Sweden",
    colors: [
      ["blue", "#006aa7"],
      ["yellow", "#fecc00"],
    ],
  },
  {
    id: "ua",
    label: "Ukraine",
    colors: [
      ["blue", "#0057b7"],
      ["yellow", "#ffd700"],
    ],
  },
  {
    id: "gr",
    label: "Greece",
    colors: [
      ["blue", "#0d5eaf"],
      ["white", "#ffffff"],
    ],
  },
  { id: "in", label: "India", colors: [["navy", "#000080"], ["green", "#138808"], ["saffron", "#ff9933"], ["white", "#ffffff"]] }, // prettier-ignore
  {
    id: "jp",
    label: "Japan",
    colors: [
      ["red", "#bc002d"],
      ["white", "#ffffff"],
    ],
  },
  { id: "kr", label: "South Korea", colors: [["blue", "#0047a0"], ["red", "#cd2e3a"], ["black", "#000000"], ["white", "#ffffff"]] }, // prettier-ignore
  {
    id: "cn",
    label: "China",
    colors: [
      ["red", "#ee1c25"],
      ["yellow", "#ffff00"],
    ],
  },
  { id: "au", label: "Australia", colors: [["blue", "#012169"], ["red", "#e4002b"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "za", label: "South Africa", colors: [["green", "#007a4d"], ["blue", "#002395"], ["red", "#de3831"], ["black", "#000000"], ["gold", "#ffb612"], ["white", "#ffffff"]] }, // prettier-ignore
  {
    id: "ng",
    label: "Nigeria",
    colors: [
      ["green", "#008751"],
      ["white", "#ffffff"],
    ],
  },
  { id: "ke", label: "Kenya", colors: [["black", "#000000"], ["red", "#bb0000"], ["green", "#006600"], ["white", "#ffffff"]] }, // prettier-ignore
  { id: "jm", label: "Jamaica", colors: [["green", "#009b3a"], ["black", "#000000"], ["gold", "#fed100"]] }, // prettier-ignore
];

// A flag's colors as a scannable theme: the palest color (if it is pale
// enough) for the light modules, the rest for the code and its eyes, each
// darkened just enough where it must be.
export function flagTheme(flag) {
  const cols = flag.colors.map(([name, h]) => ({ name, rgb: hexRGB(h), hex: h }));
  const palest = cols.reduce((a, b) => (luminance(b.rgb) > luminance(a.rgb) ? b : a));
  const usePale = luminance(palest.rgb) >= 0.45;
  const bg = usePale ? palest : { name: "white", rgb: [1, 1, 1], hex: "#ffffff" };
  const notes = [];
  if (!usePale) notes.push("This flag has no pale color, so the light modules are white.");
  const darks = cols.filter((c) => c !== bg);
  const fix = (c) => {
    const { c: rgb, before } = darkenTo(c.rgb, bg.rgb);
    if (rgb !== c.rgb)
      notes.push(`Its ${c.name} is darkened${before >= 3.5 ? " a little" : ""} (${before.toFixed(2)} : 1 → ${TARGET.toFixed(1)} : 1 against the ${bg.name}) so the code scans.`); // prettier-ignore
    return { ...c, rgb };
  };
  // Pale colors that are not the light one (a yellow or an orange on a white
  // flag: under 2.5 : 1) would turn brown if darkened that far, so they go
  // to Alive's color and the back of the tiles instead of the modules.
  const strong = darks.filter((c) => contrast(c.rgb, bg.rgb) >= 2.5);
  const weak = darks.filter((c) => contrast(c.rgb, bg.rgb) < 2.5);
  for (const w of weak)
    notes.push(`Its ${w.name} is too pale to read against the ${bg.name}, so it colors Alive and the back of the tiles instead of the modules.`); // prettier-ignore
  // A flag whose every color is pale (Argentina's light blue and sun on
  // white): its first color, darkened until it scans, is the code.
  if (!strong.length && weak.length) {
    strong.push(weak.shift());
    notes.length = 0;
    for (const w of weak)
      notes.push(`Its ${w.name} is too pale to read against the ${bg.name}, so it colors Alive and the back of the tiles instead of the modules.`); // prettier-ignore
  }
  const used = strong.map(fix);
  const fg = used[0] || fix({ name: "ink", rgb: [0.1, 0.1, 0.1] });
  const fg2 = used[1] || null;
  const eye = used[2] || used[1] || null;
  const accent = weak[0]?.rgb || (used[1] || fg).rgb;
  const t = {
    id: `flag-${flag.id}`,
    label: flag.label,
    family: "flag",
    fg: hex(fg.rgb),
    bg: hex(bg.rgb),
    gradient: fg2 ? "linear" : "none",
    eyes: eye ? "own" : "same",
    wave: hex(accent),
    back: hex(weak[0]?.rgb || (used[1] || used[0] || fg).rgb),
    notes,
    colors: flag.colors.map(([n, h]) => `${n} ${h}`),
  };
  if (fg2) t.fg2 = hex(fg2.rgb);
  if (eye) t.eye = hex(eye.rgb);
  return t;
}

// Every theme: { id, label, family, fg, fg2?, gradient, bg, eyes, eye?, wave,
// back, notes, contrast } (contrast: the lowest between any dark color it
// uses and its light color).
export const THEMES = [
  ...PALETTES.map((p) => ({ eyes: p.eye ? "own" : "same", gradient: "none", ...p, family: "palette", notes: [] })), // prettier-ignore
  ...FLAGS.map(flagTheme),
].map((t) => {
  const darks = [t.fg, t.gradient !== "none" ? t.fg2 : null, t.eyes === "own" ? t.eye : null].filter(Boolean); // prettier-ignore
  const bg = hexRGB(t.bg);
  return { ...t, contrast: Math.min(...darks.map((d) => contrast(hexRGB(d), bg))) };
});

export const themeById = (id) => THEMES.find((t) => t.id === id) || null;

// The toy's options for a theme (its colors; the style and plate stay).
export function themeOptions(t) {
  const o = { theme: t.id, fg: t.fg, bg: t.bg, gradient: t.gradient, eyes: t.eyes, wave: t.wave, back: t.back }; // prettier-ignore
  if (t.fg2) o.fg2 = t.fg2;
  if (t.eye) o.eye = t.eye;
  return o;
}
