// Lane QR lab r2: three labs toys about how QR codes work, made of splats.
//
//   qr-anatomy  "How a QR code works": tap to light up each part of a real
//               code, or step through encoding your own text, from the mode
//               bits to the chosen mask. Every step is computed by
//               src/qr-lab/steps.js, which tests/qrs-steps.spec.mjs checks
//               against the Nayuki encoder the QR code toy uses.
//   qr-damage   The Damage lab: scratch a code, stick a label on it, tear or
//               burn a corner, smudge it, or damage its splats (blur, shrink,
//               grow, jitter, fade, color drift, curve, tilt, motion). A meter
//               reads the very picture on the stage after each change (jsQR)
//               and counts, block by block, the codewords lost against those
//               error correction can fix. "Heal it" shows the code as a
//               reader read it and lets Reed–Solomon decoding set it right,
//               block by block, until it scans again.
//   qr-three    Three codes in one: three QR codes in the red, green and
//               blue of one square, which Splashery's reader splits apart.
//
// Each module moves as a solid piece (src/qr-lab/field.js, the labs GPU
// program), or as one of the color layers (qr-three, the kit's tokens).
// Nothing leaves the device: the texts live in the toys' options.
//
// The test hook: window.__splashery.qrLab (at the end of this file).

import { encodeSteps, ROLE, LEVELS, LEVEL_RECOVERY, MASKS } from "../qr-lab/steps.js"; // prettier-ignore
import { codeSplats, hexRGB, QUIET } from "../qr-lab/splats.js";
import { applyDamage, warpPoint, KINDS as DAMAGE_KINDS, REGIONS, describeDamage } from "../qr-lab/damage.js"; // prettier-ignore
import { sampleModules, toDark, analyze } from "../qr-lab/read.js";
import { encodeRGB, readRGB } from "../qr-lab/rgb.js";
import { anatomyModifier, damageModifier } from "../qr-lab/field.js";
import * as pc from "../pc.js";

const FG = [0.07, 0.08, 0.1];
const BG = [1, 1, 1];
const TABLE = [0.36, 0.29, 0.22];
const WRONG_DARK = [0.55, 0.08, 0.1];
const WRONG_LIGHT = [1, 0.8, 0.8];
const app = () => globalThis.__splashery?.app;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // prettier-ignore
const bin = (v, n) => v.toString(2).padStart(n, "0");

// ---- jsQR (the vendored copy the QR code toy loads) ------------------------------------------

let jsqr = null;
function loadJsQR() {
  if (jsqr) return Promise.resolve(jsqr);
  const pick = (m) => (typeof m === "function" ? m : m?.default);
  if (globalThis.jsQR) return Promise.resolve((jsqr = pick(globalThis.jsQR)));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/jsqr/jsQR.js", import.meta.url).href;
    s.onload = () => (pick(globalThis.jsQR) ? resolve((jsqr = pick(globalThis.jsQR))) : reject(new Error("The QR reader didn't load."))); // prettier-ignore
    s.onerror = () => reject(new Error("The QR reader didn't load."));
    document.head.appendChild(s);
  });
}
const readImage = (img) =>
  jsqr(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;

// ---- Small panel helpers ----------------------------------------------------------------------

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "style") e.style.cssText = v;
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
function button(id, label, onClick, primary = false) {
  const b = el("button", { type: "button", id, className: primary ? "primary" : "", textContent: label }); // prettier-ignore
  b.addEventListener("click", onClick);
  return b;
}
const row = (...kids) => el("div", { className: "button-row" }, ...kids);
const note = (text) => el("p", { className: "note", textContent: text });
const mono = "font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-all;margin:6px 0"; // prettier-ignore

// Rebuild with new options and then fire a control (as a tile tap does).
async function switchTo(options, key) {
  const player = app()?.player;
  if (!player) return;
  await player.switchTo({ options, key, value: 1 });
}
function fire(key) {
  const player = app()?.player;
  if (!player) return;
  const r = player.motion.act(player.time, null, { key });
  player.scene.motion.controls = { ...player.scene.motion.controls, [key]: player.motion.targets[key] }; // prettier-ignore
  player.stage.requestRender();
  player.emit("action", { ...r, echo: true });
}

// The camera flat and square to the toy, its whole width in view (the
// stage's field of view, 38 degrees, spans the narrower side).
function frontPose(half, margin = 1.5) {
  const fit = app()?.player?.motion?.ctx?.transform;
  const cam = app()?.player?.camera;
  if (!fit || !cam) return { yaw: 0, pitch: 0, roll: 0, distance: 3 };
  const d = ((half + margin) * fit.scale) / Math.tan((19 * Math.PI) / 180);
  return { yaw: 0, pitch: 0, roll: 0, distance: d / (cam.radius || 1) };
}

// ======================================================================================
// How a QR code works
// ======================================================================================

const PARTS = [
  { id: "finder", label: "Finder patterns", role: ROLE.finder, color: "#1f5fbf" },
  { id: "separator", label: "Separators", role: ROLE.separator, color: "#3d8fd6" },
  { id: "timing", label: "Timing patterns", role: ROLE.timing, color: "#d9822b" },
  { id: "alignment", label: "Alignment patterns", role: ROLE.alignment, color: "#7b3fb0" },
  { id: "format", label: "Format information", role: ROLE.format, color: "#2e8b57" },
  { id: "version", label: "Version information", role: ROLE.version, color: "#0f8f86" },
  { id: "dark", label: "The dark module", role: ROLE.darkModule, color: "#c0392b" },
  { id: "data", label: "Data codewords", role: ROLE.data, color: "#2b4c7e" },
  { id: "ecc", label: "Error correction codewords", role: ROLE.ecc, color: "#b03a5b" },
  { id: "remainder", label: "Remainder bits", role: ROLE.remainder, color: "#8a8a8a" },
  { id: "mask", label: "The mask", role: -1, color: "#c47a12" },
];
const partById = (id) => PARTS.find((p) => p.id === id);

// The steps of encoding, in order. Version information only from version 7.
const STEPS = [
  { id: "mode", label: "1. Mode" },
  { id: "count", label: "2. Character count" },
  { id: "data", label: "3. Data bits" },
  { id: "pad", label: "4. Terminator and padding" },
  { id: "ecc", label: "5. Error correction" },
  { id: "blocks", label: "6. Blocks and interleaving" },
  { id: "place", label: "7. Placement" },
  ...MASKS.map((m, i) => ({ id: `mask${i}`, label: `8. Mask ${i}` })),
  { id: "chosen", label: "9. The chosen mask" },
  { id: "format", label: "10. Format information" },
  { id: "version", label: "11. Version information" },
  { id: "done", label: "12. The finished code" },
];
const stepsFor = (s) => STEPS.filter((st) => st.id !== "version" || s.version >= 7);

const AN = { steps: null, options: null, panel: null };

// The steps of the code the options ask for (cached).
function anatomySteps(o) {
  const text = o.text ?? "HELLO WORLD";
  const level = LEVELS.includes(o.level) ? o.level : "Q";
  if (AN.steps && AN.steps.text === text && AN.steps.level === level) return AN.steps;
  try {
    AN.steps = encodeSteps(text, level);
    AN.error = "";
  } catch (err) {
    AN.steps = encodeSteps("HELLO WORLD", level);
    AN.error = err.message;
  }
  return AN.steps;
}

// Which bit of the bit stream a placed data bit is (or -1 for error
// correction and remainder bits).
function streamBit(s, i) {
  if (i < 0 || i >= s.sequence.length * 8) return -1;
  const o = s.origin[i >>> 3];
  if (o.ecc) return -1;
  return (s.blocks[o.block].start + o.index) * 8 + (i & 7);
}
// What a bit of the stream is: mode, count, data, terminator, fill or pad.
function streamPart(s, b) {
  const L = [s.bits.mode.length, s.bits.count.length, s.bits.data.length, s.bits.terminator.length, s.bits.byteFill.length]; // prettier-ignore
  const names = ["mode", "count", "data", "terminator", "fill"];
  let at = 0;
  for (let k = 0; k < L.length; k++) {
    if (b < at + L[k]) return names[k];
    at += L[k];
  }
  return "pad";
}

const BLOCK_HUES = ["#2b6cb0", "#c05621", "#2f855a", "#9b2c2c", "#6b46c1", "#b7791f", "#2c7a7b", "#97266d"]; // prettier-ignore

// The look of every module for the options: { dark (modules shown), color
// (per module [r, g, b]), lift (per module 0/1), state }.
function anatomyLook(s, o) {
  const N = s.size;
  const view = o.view === "encode" ? "encode" : "parts";
  const step = view === "encode" ? (stepsFor(s).find((x) => x.id === o.step) || stepsFor(s)[0]).id : null; // prettier-ignore
  const part = view === "parts" ? partById(o.part) : null;
  // Before the mask steps the code is shown unmasked (the bits as placed).
  const masked = view === "parts" || ["chosen", "format", "version", "done"].includes(step);
  const dark = masked ? s.modules : s.placed;
  const color = new Array(N * N);
  const lift = new Uint8Array(N * N);
  const plain = (i) => (dark[i] ? FG : BG);
  const dim = (i) => (dark[i] ? [0.42, 0.44, 0.48] : [0.93, 0.93, 0.94]);
  const tint = (i, hex) => {
    const c = hexRGB(hex);
    return dark[i] ? mixc(c, [0, 0, 0], 0.25) : mixc(c, [1, 1, 1], 0.78);
  };
  const isData = (i) => s.bitOf[i] >= 0;
  let maskId = s.mask;
  let maskFlip = 1;
  for (let i = 0; i < N * N; i++) color[i] = plain(i);
  if (part) {
    for (let i = 0; i < N * N; i++) {
      const hit = part.id === "mask" ? isData(i) && MASKS[s.mask].f(i % N, (i / N) | 0) : s.role[i] === part.role; // prettier-ignore
      if (hit) {
        color[i] = tint(i, part.color);
        lift[i] = 1;
      } else color[i] = dim(i);
    }
  } else if (step) {
    const hl = (i, hex) => {
      color[i] = tint(i, hex);
      lift[i] = 1;
    };
    const dimRest = () => {
      for (let i = 0; i < N * N; i++) if (!lift[i]) color[i] = isData(i) ? dim(i) : plain(i);
    };
    if (["mode", "count", "data", "pad"].includes(step)) {
      const want = { mode: ["mode"], count: ["count"], data: ["data"], pad: ["terminator", "fill", "pad"] }[step]; // prettier-ignore
      const hex = { mode: "#c0392b", count: "#d9822b", data: "#2b4c7e", pad: "#8a8a8a" }[step];
      for (let i = 0; i < N * N; i++) {
        const b = streamBit(s, s.bitOf[i]);
        if (b >= 0 && want.includes(streamPart(s, b))) hl(i, hex);
      }
      dimRest();
    } else if (step === "ecc") {
      for (let i = 0; i < N * N; i++) if (s.role[i] === ROLE.ecc) hl(i, "#b03a5b");
      dimRest();
    } else if (step === "blocks" || step === "place") {
      // Each block in its own color, codewords in two shades.
      for (let i = 0; i < N * N; i++) {
        const bi = s.bitOf[i];
        if (bi < 0 || bi >= s.sequence.length * 8) continue;
        const o = s.origin[bi >>> 3];
        const c = hexRGB(BLOCK_HUES[o.block % BLOCK_HUES.length]);
        const shade = (bi >>> 3) % 2 ? 0.35 : 0.1;
        color[i] = dark[i]
          ? mixc(c, [0, 0, 0], shade + 0.15)
          : mixc(c, [1, 1, 1], 0.72 + shade * 0.4);
        if (step === "blocks") lift[i] = o.ecc ? 1 : 0;
      }
    } else if (step.startsWith("mask")) {
      maskId = Number(step.slice(4));
      maskFlip = 1; // the drive runs the flip from 0
    } else if (step === "chosen") {
      for (let i = 0; i < N * N; i++) if (isData(i) && MASKS[s.mask].f(i % N, (i / N) | 0)) lift[i] = 1; // prettier-ignore
    } else if (step === "format" || step === "version") {
      const r = step === "format" ? [ROLE.format, ROLE.darkModule] : [ROLE.version];
      for (let i = 0; i < N * N; i++) if (r.includes(s.role[i])) hl(i, step === "format" ? "#2e8b57" : "#0f8f86"); // prettier-ignore
      dimRest();
    }
  }
  return { view, step, part: part?.id || "", dark, color, lift, maskId, maskFlip, masking: !!step?.startsWith("mask") }; // prettier-ignore
}

// The text for a part, from the code's own numbers.
function partText(s, id) {
  const N = s.size;
  const count = (r) => s.role.reduce((n, x) => n + (x === r ? 1 : 0), 0);
  const nAlign = Math.round(count(ROLE.alignment) / 25);
  const fb = bin(s.format, 15);
  switch (id) {
    case "finder":
      return `Three finder patterns, one in each corner but the lower right: 7 × 7 modules each, a dark ring, a light ring and a 3 × 3 dark center. Across their middle a scanner sees dark, light, dark, light, dark in the ratio 1 : 1 : 3 : 1 : 1 from any direction, which is how it finds the code and tells which way up it is.`; // prettier-ignore
    case "separator":
      return `A one-module light border around each finder pattern (${count(ROLE.separator)} modules here), so the finders stand apart from the data.`; // prettier-ignore
    case "timing":
      return `Two lines of alternating dark and light modules, along row 6 and column 6 between the finders (${count(ROLE.timing)} modules here). They tell a scanner how wide a module is and where each row and column runs.`; // prettier-ignore
    case "alignment":
      return nAlign ? `${nAlign} alignment pattern${nAlign > 1 ? "s" : ""} (5 × 5: a dark ring, a light ring, a dark center). A scanner uses them to follow the grid where the code is curved or seen at an angle. Version 1 has none; this is version ${s.version}.` : `Version 1 codes like this one have no alignment patterns. From version 2 on, 5 × 5 patterns (a dark ring, a light ring and a dark center) help a scanner follow the grid where a code is curved or seen at an angle.`; // prettier-ignore
    case "format":
      return `15 bits, stored twice: around the upper left finder, and split between the other two. They hold the error correction level (${s.level}: ${bin({ L: 1, M: 0, Q: 3, H: 2 }[s.level], 2)}) and the mask (${s.mask}: ${bin(s.mask, 3)}), then 10 bits of BCH error correction, all XORed with 101010000010010 so they are never all light. This code's format information is ${fb}.`; // prettier-ignore
    case "version":
      return s.version >= 7 ? `From version 7 on, two 6 × 3 blocks hold the version (${s.version}) in 6 bits and 12 bits of BCH error correction: ${bin(s.versionInfo, 18)}.` : `Codes of version 7 and up carry their version twice in two 6 × 3 blocks. This one is version ${s.version}, so it has none: a scanner tells its version from its size (${N} × ${N} = 4 × ${s.version} + 17 modules across).`; // prettier-ignore
    case "dark":
      return `One module beside the lower left finder (row ${N - 8}, column 8) is always dark, in every QR code.`; // prettier-ignore
    case "data":
      return `${s.dataCodewords.length} data codewords of 8 bits: the mode, the character count, your text and padding (${count(ROLE.data)} modules).`; // prettier-ignore
    case "ecc":
      return `${s.blocks.length * s.eccPerBlock} error correction codewords (${s.blocks.length} block${s.blocks.length > 1 ? "s" : ""} × ${s.eccPerBlock}): Reed–Solomon codes that let a scanner rebuild up to ${s.fixable} wrong codewords in each block. At level ${s.level} that is about ${LEVEL_RECOVERY[s.level]}% of the code.`; // prettier-ignore
    case "remainder":
      return s.remainderBits ? `${s.remainderBits} remainder bits: the data area has room for ${s.remainderBits} more bits than whole codewords fill, so they are left light (before the mask).` : `This version's data area holds whole codewords exactly, so it has no remainder bits (versions 2 to 6 have 7, for example).`; // prettier-ignore
    case "mask":
      return `The data area is XORed with mask ${s.mask}: every module where ${MASKS[s.mask].formula} turns over. Of the eight masks, it scored the lowest penalty (${s.masks[s.mask].penalty.total}), so the code has no big blocks of one color or patterns that look like finders.`; // prettier-ignore
    default:
      return `Version ${s.version}: ${N} × ${N} modules, error correction level ${s.level}. Tap the code, or a part below, to light it up.`; // prettier-ignore
  }
}

const groupText = (s) =>
  s.groups.map((g) => (s.mode === "byte" ? `${g.chars ? JSON.stringify(g.chars) : "…"} ${g.value} → ${g.bits}` : `${JSON.stringify(g.chars)} → ${g.value} → ${g.bits}`)).join("\n"); // prettier-ignore
const bytesText = (list) => list.map((b) => String(b).padStart(3, " ")).join(" ");

// What a step says and shows (title, words, numbers).
function stepText(s, id) {
  const cw = s.bits.count.length;
  switch (id) {
    case "mode":
      return { words: `The text is “${s.text}”. A QR code has modes that pack characters tightly: numeric (digits only, 3 to 10 bits), alphanumeric (capitals, digits, space and $%*+-./:, 2 to 11 bits) and byte (any text, as UTF-8). This text needs ${s.modeName.toLowerCase()} mode, whose 4-bit mode indicator comes first. The lifted modules are where those 4 bits land.`, numbers: `Mode indicator: ${s.bits.mode || "(none: empty text)"}` }; // prettier-ignore
    case "count":
      return { words: `Then the length: ${s.count} ${s.mode === "byte" ? "bytes" : "characters"}, in ${cw} bits (the width depends on the mode and the version: version ${s.version} is in the range ${s.version <= 9 ? "1 to 9" : s.version <= 26 ? "10 to 26" : "27 to 40"}).`, numbers: `Character count: ${s.count} → ${s.bits.count}` }; // prettier-ignore
    case "data":
      return { words: s.mode === "numeric" ? "Digits go in groups of three, each group as a 10-bit number (a last pair takes 7 bits, a last single digit 4)." : s.mode === "alphanumeric" ? "Characters go in pairs: 45 × the first one's value + the second's, in 11 bits (a last single character takes 6)." : "Each byte of the text's UTF-8 goes in 8 bits.", numbers: groupText(s) }; // prettier-ignore
    case "pad": {
      return { words: `The code holds ${s.capacity} data bits at version ${s.version}, level ${s.level}. After the data come up to four 0s (the terminator), 0s to the end of the byte, then the pad bytes 11101100 and 00010001 in turn until it is full.`, numbers: `Terminator: ${s.bits.terminator || "(none: no room)"}\nTo a whole byte: ${s.bits.byteFill || "(none)"}\nPad bytes: ${s.padBytes.length} (${s.padBytes.map((b) => bin(b, 8)).join(" ") || "none"})\n\nData codewords (${s.dataCodewords.length}):\n${bytesText(s.dataCodewords)}` }; // prettier-ignore
    }
    case "ecc":
      return { words: `Reed–Solomon error correction: each block of data codewords is a polynomial, divided by a generator polynomial of degree ${s.eccPerBlock} over the 256-element field GF(2⁸); the remainder is ${s.eccPerBlock} error correction codewords. With them a scanner can rebuild up to ${s.fixable} wrong codewords per block${s.misdecode ? ` (${s.eccPerBlock} / 2, less ${s.misdecode} kept back to catch wrong fixes, as the standard sets for the smallest codes)` : ""}.`, numbers: s.blocks.map((b, j) => `Block ${j + 1} error correction:\n${bytesText(b.ecc)}`).join("\n\n") }; // prettier-ignore
    case "blocks":
      return { words: `Version ${s.version} at level ${s.level} splits the data into ${s.blocks.length} block${s.blocks.length > 1 ? "s" : ""}, each with its own error correction. The codewords are then interleaved: the first codeword of each block, then the second of each, and so on, so a scratch spreads its damage over every block. Each block has its own color here; the lifted ones are error correction.`, numbers: s.blocks.map((b, j) => `Block ${j + 1}: ${b.data.length} data + ${b.ecc.length} error correction codewords`).join("\n") + `\n\nInterleaved (${s.sequence.length}):\n${bytesText(s.sequence)}` }; // prettier-ignore
    case "place":
      return { words: `The bits go in along a zigzag: two columns at a time, from the lower right corner, up, then down, then up, skipping the function patterns and the vertical timing pattern. Tap to watch every bit drop into place. ${s.remainderBits ? `${s.remainderBits} remainder bits are left over at the end.` : ""}`, numbers: `${s.sequence.length * 8} bits along a path of ${s.path.length} modules.` }; // prettier-ignore
    case "chosen":
      return { words: `Mask ${s.mask} scored lowest, so it is the one used (lifted: the modules it turned over).`, numbers: MASKS.map((m, i) => `Mask ${i}: ${String(s.masks[i].penalty.total).padStart(4, " ")}${i === s.mask ? "  ← lowest" : ""}`).join("\n") }; // prettier-ignore
    case "format":
      return { words: `The format information is written in two copies: level ${s.level} and mask ${s.mask}, with 10 bits of BCH error correction, XORed with 101010000010010. The dark module beside the lower left finder is set too.`, numbers: `Level ${s.level}: ${bin({ L: 1, M: 0, Q: 3, H: 2 }[s.level], 2)}, mask ${s.mask}: ${bin(s.mask, 3)}\nWith its error correction and XOR: ${bin(s.format, 15)}` }; // prettier-ignore
    case "version":
      return { words: `Version ${s.version} carries its version in two 6 × 3 blocks: 6 bits of version and 12 of BCH error correction.`, numbers: bin(s.versionInfo ?? 0, 18) }; // prettier-ignore
    case "done":
      return { words: `The finished code: version ${s.version} (${s.size} × ${s.size}), level ${s.level}, mask ${s.mask}. Every step was checked against another encoder (Nayuki's).`, numbers: "" }; // prettier-ignore
    default: {
      const m = Number(id.slice(4));
      const p = s.masks[m].penalty;
      return { words: `Mask ${m} turns over every data module where ${MASKS[m].formula}. The encoder tries all eight and scores each one: runs of five or more of one color, 2 × 2 blocks, patterns that look like a finder, and how far the share of dark modules is from half. The lowest score wins.`, numbers: `Rule 1 (runs): ${p.n1}\nRule 2 (2 × 2 blocks): ${p.n2}\nRule 3 (finder-like): ${p.n3}\nRule 4 (balance, ${(p.darkShare * 100).toFixed(1)}% dark): ${p.n4}\nPenalty: ${p.total}${m === s.mask ? " (the lowest)" : ""}` }; // prettier-ignore
    }
  }
}

function anatomyPanel() {
  const box = el("div", { className: "qrs-anatomy" });
  const modeRow = row(
    button("qrs-view-parts", "The parts", () => switchTo({ view: "parts" }, "lift")),
    button("qrs-view-encode", "Encode your text", () =>
      switchTo({ view: "encode", step: "mode" }, "lift"),
    ),
  );
  // Parts.
  const partsRow = row(...PARTS.map((p) => button(`qrs-part-${p.id}`, p.label, () => switchTo({ view: "parts", part: p.id }, "lift")))); // prettier-ignore
  // Encoding.
  const input = el("input", { type: "text", id: "qrs-text", maxLength: 400, style: "width:100%;box-sizing:border-box" }); // prettier-ignore
  input.setAttribute("aria-label", "Text to encode");
  const level = el("select", { id: "qrs-level" });
  level.setAttribute("aria-label", "Error correction level");
  for (const l of LEVELS) level.append(el("option", { value: l, textContent: `Level ${l} (${LEVEL_RECOVERY[l]}%)` })); // prettier-ignore
  const make = button("qrs-make", "Encode it", () => switchTo({ view: "encode", step: "mode", text: input.value, level: level.value }, "lift"), true); // prettier-ignore
  const nav = row(
    button("qrs-back", "Back", () => go(-1)),
    button("qrs-next", "Next step", () => go(1), true),
  );
  const title = el("p", { id: "qrs-title", style: "font-weight:600;margin:6px 0 2px" });
  const words = el("p", { id: "qrs-words", style: "margin:2px 0" });
  const nums = el("pre", { id: "qrs-numbers", style: mono });
  const err = el("p", { className: "warn", hidden: true });
  const encodeBox = el("div", {}, el("label", { htmlFor: "qrs-text", textContent: "Your text" }), input, row(level, make), nav); // prettier-ignore
  box.append(
    modeRow,
    partsRow,
    encodeBox,
    err,
    title,
    words,
    nums,
    note("Sources: ISO/IEC 18004 as described by Wikipedia's “QR code” article and Thonky's QR code tutorial. Every number here is computed from the code shown; the tests check each step against another encoder (Nayuki's)."), // prettier-ignore
  );
  function go(d) {
    const s = AN.steps;
    if (!s) return;
    const list = stepsFor(s);
    const o = AN.options || {};
    const i = Math.max(
      0,
      list.findIndex((x) => x.id === o.step),
    );
    const j = Math.min(list.length - 1, Math.max(0, i + d));
    const id = list[j].id;
    switchTo(
      { view: "encode", step: id },
      id === "place" ? "place" : id.startsWith("mask") ? "mask" : "lift",
    );
  }
  AN.panel = {
    refresh() {
      const o = AN.options || {};
      const s = AN.steps;
      if (!s) return;
      const enc = o.view === "encode";
      partsRow.hidden = enc;
      encodeBox.hidden = !enc;
      for (const [id, on] of [
        ["qrs-view-parts", !enc],
        ["qrs-view-encode", enc],
      ]) {
        const b = box.querySelector(`#${id}`);
        b.setAttribute("aria-pressed", String(on));
        b.classList.toggle("primary", on);
      }
      for (const p of PARTS) box.querySelector(`#qrs-part-${p.id}`).setAttribute("aria-pressed", String(o.part === p.id)); // prettier-ignore
      if (document.activeElement !== input) input.value = s.text;
      level.value = s.level;
      err.hidden = !AN.error;
      err.textContent = AN.error ? `${AN.error} Showing “HELLO WORLD” instead.` : "";
      if (enc) {
        const list = stepsFor(s);
        const st = list.find((x) => x.id === o.step) || list[0];
        const t = stepText(s, st.id);
        title.textContent = `${st.label} (step ${list.indexOf(st) + 1} of ${list.length})`;
        words.textContent = t.words;
        nums.textContent = t.numbers;
        nums.hidden = !t.numbers;
      } else {
        const p = partById(o.part);
        title.textContent = p ? p.label : `Version ${s.version}, level ${s.level}`;
        words.textContent = partText(s, p?.id);
        nums.textContent = "";
        nums.hidden = true;
      }
    },
  };
  AN.panel.refresh();
  return box;
}

const ANATOMY = {
  alive: true,
  turntable: false,
  options: [
    { key: "text", label: "Text", type: "text", default: "HELLO WORLD", hidden: true },
    { key: "level", label: "Error correction", type: "select", default: "Q", hidden: true, choices: LEVELS.map((l) => ({ id: l, label: l })) }, // prettier-ignore
    { key: "view", label: "View", type: "select", default: "parts", hidden: true, choices: [{ id: "parts", label: "The parts" }, { id: "encode", label: "Encode" }] }, // prettier-ignore
    { key: "part", label: "Part", type: "select", default: "", hidden: true, choices: [{ id: "", label: "None" }, ...PARTS.map((p) => ({ id: p.id, label: p.label }))] }, // prettier-ignore
    { key: "step", label: "Step", type: "select", default: "mode", hidden: true, choices: STEPS.map((s) => ({ id: s.id, label: s.label })) }, // prettier-ignore
  ],
  controls: [
    { key: "lift", label: "Light it up", type: "pulse", ease: 1.2 },
    { key: "place", label: "Place the bits", type: "pulse", ease: 6 },
    { key: "mask", label: "Apply the mask", type: "pulse", ease: 2.4 },
  ],
  action: {
    key: "lift",
    label: "Next part",
    // A tap moves on: the next part, or the next step of the encoding.
    at(point, c) {
      const o = AN.options || {};
      const s = AN.steps;
      if (o.view === "encode" && s) {
        const list = stepsFor(s);
        const i = Math.max(
          0,
          list.findIndex((x) => x.id === o.step),
        );
        const id = list[(i + 1) % list.length].id;
        return { options: { step: id }, key: id === "place" ? "place" : id.startsWith("mask") ? "mask" : "lift" }; // prettier-ignore
      }
      const i = PARTS.findIndex((p) => p.id === o.part);
      return { options: { part: PARTS[(i + 1) % PARTS.length].id }, key: "lift" };
    },
  },
  sounds: () => [],
  input: { title: "How a QR code works", fileButton: false, live: [{ render: anatomyPanel }], note: "", read: async () => ({}), shown: () => "" }, // prettier-ignore
  drive(t, c, out, info) {
    const d = info.data || {};
    // Placement: from nothing to every bit while "place" runs; at rest, all.
    const placing = d.step === "place" && c.place > 0;
    const P = placing ? 1 - c.place : 1;
    // The mask turns over as "mask" runs and stays turned at rest.
    const F = d.masking ? (c.mask > 0 ? 1 - c.mask : 1) : 0;
    // The highlight lifts and settles a little after each tap.
    const L = d.lifted ? 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, (1 - (c.lift ?? 0)) * 1.0)) * (c.lift > 0 ? 1 : 0) : 0; // prettier-ignore
    out.morph = [P, F, L, d.maskId ?? 0];
  },
  gpuField(o, fit) {
    const s = AN.steps;
    if (!fit || !Number.isFinite(fit.scale) || !s) return null;
    return anatomyModifier({ size: s.size, fg: FG, bg: BG, total: s.sequence.length * 8 }, fit);
  },
  build(k, o) {
    const s = anatomySteps(o);
    AN.options = { ...o };
    const look = anatomyLook(s, o);
    const N = s.size;
    const per = N > 45 ? 2 : 3;
    const all = codeSplats(look.dark, N, { per, lightTiles: true, fg: FG, bg: BG });
    const splats = [];
    for (const sp of all) {
      if (sp.mod < 0) {
        splats.push({ ...sp, params: [0, 0], pattern: false });
        continue;
      }
      const i = sp.mod;
      const order = s.bitOf[i];
      const kind = (order >= 0 ? 6 : 0) + (look.lift[i] ? 8 : 0);
      splats.push({ ...sp, color: look.color[i], params: [1 + i, kind + 16 * Math.max(0, order)], pattern: false }); // prettier-ignore
    }
    const H = N / 2 + QUIET;
    k.reach([H + 1, H + 1, 1.5]);
    k.reach([-H - 1, -H - 1, -0.5]);
    k.cloud({ share: Math.min(1, splats.length / k.count), jitter: 0, pattern: false }, (rand, i) => splats[i] || null); // prettier-ignore
    k.data = { size: N, version: s.version, step: look.step, part: look.part, maskId: look.maskId, masking: look.masking, lifted: look.lift.some((x) => x) }; // prettier-ignore
    Promise.resolve().then(() => AN.panel?.refresh());
  },
};

// ======================================================================================
// The Damage lab
// ======================================================================================

const BAKED = ["scratch", "sticker", "tear", "burn", "smudge", "blur", "shrink", "grow", "jitter", "fade", "color"]; // prettier-ignore
const STEP_AMOUNT = 0.12;

// The damage option: "kind:amount:region:seed;…".
export function parseDamage(str) {
  const out = [];
  for (const part of String(str || "").split(";")) {
    const [kind, amount, region, seed] = part.split(":");
    if (!BAKED.includes(kind)) continue;
    const a = Math.min(1, Math.max(0, Number(amount) || 0));
    if (a <= 0) continue;
    out.push({ kind, amount: a, region: REGIONS.some((r) => r.id === region) ? region : "all", seed: Number(seed) || 1 }); // prettier-ignore
  }
  return out;
}
export const formatDamage = (list) =>
  list.filter((d) => d.amount > 0).map((d) => `${d.kind}:${Math.round(d.amount * 1000) / 1000}:${d.region}:${d.seed}`).join(";"); // prettier-ignore

const DM = { codes: null, layout: null, options: null, panel: null, check: null, checking: false, read: null, timer: 0, geo: { tilt: 0, curve: 0, wave: 0, phase: 0 }, lastGeo: "" }; // prettier-ignore

// The codes the options ask for: one, or the four levels side by side.
function damageCodes(o) {
  const text = o.text ?? "https://ryanjosephkamp.github.io/splashery/";
  const levels = o.level === "all" ? LEVELS : [LEVELS.includes(o.level) ? o.level : "M"];
  const key = `${text}|${levels.join("")}`;
  if (DM.codes?.key === key) return DM.codes;
  let codes;
  try {
    codes = levels.map((l) => encodeSteps(text, l));
    DM.error = "";
  } catch (err) {
    codes = levels.map((l) => encodeSteps("https://ryanjosephkamp.github.io/splashery/", l));
    DM.error = err.message;
  }
  // Side by side, every code is drawn at the size of the largest (the
  // smaller ones get the version that size has, so the four share a grid
  // and the same damage lands on the same place in each).
  const v = Math.max(...codes.map((c) => c.version));
  codes = codes.map((c) => (c.version === v ? c : encodeSteps(c.text, c.level, { version: v })));
  DM.codes = { key, codes };
  return DM.codes;
}

// Where each code sits (code units) and the plate's width.
function layoutFor(codes) {
  const N = codes[0].size;
  const span = N + 2 * QUIET;
  if (codes.length === 1) return { N, offsets: [[0, 0]], width: span, half: span / 2 };
  const d = (span + 2) / 2;
  return { N, offsets: [[-d, d], [d, d], [-d, -d], [d, -d]], width: 2 * span + 2, half: span + 1 }; // prettier-ignore
}

// Geometry the drive sets live (tilt, curve, the wave): as damages.
const geoDamages = (g) => [
  { kind: "time", amount: g.wave, t: g.phase },
  { kind: "curve", amount: g.curve },
  { kind: "tilt", amount: g.tilt },
];

function damagePanel() {
  const box = el("div", { className: "qrs-damage" });
  const input = el("input", { type: "text", id: "qrs-dtext", maxLength: 300, style: "width:100%;box-sizing:border-box" }); // prettier-ignore
  input.setAttribute("aria-label", "Text in the code");
  const level = el("select", { id: "qrs-dlevel" });
  level.setAttribute("aria-label", "Error correction");
  for (const [id, label] of [["L", "Level L (7%)"], ["M", "Level M (15%)"], ["Q", "Level Q (25%)"], ["H", "Level H (30%)"], ["all", "All four side by side"]]) level.append(el("option", { value: id, textContent: label })); // prettier-ignore
  level.addEventListener("change", () => switchTo({ level: level.value, show: "damaged" }, "drop"));
  const make = button("qrs-dmake", "Make the code", () => switchTo({ text: input.value, show: "damaged" }, "drop")); // prettier-ignore
  const tools = row(...DAMAGE_KINDS.filter((k) => BAKED.includes(k.id)).map((k) => button(`qrs-tool-${k.id}`, k.label, () => switchTo({ tool: k.id }, "drop")))); // prettier-ignore
  const region = el("select", { id: "qrs-region" });
  region.setAttribute("aria-label", "Where");
  for (const r of REGIONS) region.append(el("option", { value: r.id, textContent: r.label }));
  region.addEventListener("change", () => switchTo({ region: region.value }, "drop"));
  const actions = row(
    button("qrs-add", "Add damage", () => addDamage(), true),
    button("qrs-heal", "Heal it", () => heal()),
    button("qrs-clear", "Clear the damage", () =>
      switchTo({ damage: "", show: "damaged" }, "drop"),
    ),
  );
  const list = el("p", { className: "note", id: "qrs-damage-list" });
  const meter = el("div", { id: "qrs-meter", role: "status", style: "margin:8px 0" });
  box.append(
    el("label", { htmlFor: "qrs-dtext", textContent: "What the code holds" }),
    input,
    row(level, make),
    note("Damage (tap the code to add more of it):"),
    tools,
    row(el("span", { textContent: "Where: " }), region),
    actions,
    list,
    meter,
    note("Tilt, Curve and Move in time are the sliders in the Toy tab. The meter reads the very picture on the stage with jsQR, the reader the QR code toy uses, after every change. The block counts compare what a reader would see at each module's center with the true code: a block scans while it has lost no more codewords than its error correction can fix. Heal it shows the code as it was read and lets Reed–Solomon decoding set each block right."), // prettier-ignore
  );
  DM.panel = {
    refresh() {
      const o = DM.options || {};
      const codes = DM.codes?.codes;
      if (!codes) return;
      if (document.activeElement !== input) input.value = codes[0].text;
      level.value = o.level || "M";
      region.value = o.region || "all";
      for (const k of BAKED) {
        const b = box.querySelector(`#qrs-tool-${k}`);
        const on = (o.tool || "scratch") === k;
        b.setAttribute("aria-pressed", String(on));
        b.classList.toggle("primary", on);
      }
      const dmg = parseDamage(o.damage);
      list.textContent = dmg.length ? `Damage: ${dmg.map((d) => `${describeDamage(d, codes[0].size)} (${REGIONS.find((r) => r.id === d.region).label.toLowerCase()})`).join("; ")}.` : "No damage yet."; // prettier-ignore
      meter.replaceChildren(...meterRows());
    },
  };
  DM.panel.refresh();
  return box;
}

function meterRows() {
  const codes = DM.codes?.codes || [];
  if (DM.checking && !DM.check) return [el("p", { textContent: "Reading the code…" })];
  if (!DM.check) return [];
  return DM.check.codes.map((r, i) => {
    const c = codes[i];
    const head = el("p", { style: `margin:4px 0;font-weight:600;color:${r.scans ? "var(--ok, #1d8a4a)" : "var(--warn, #b3261e)"}` }); // prettier-ignore
    head.textContent = `Level ${c.level}: ${r.scans ? "✓ scans" : "✗ doesn't scan"} (jsQR${r.scans ? ` read “${r.text.length > 40 ? r.text.slice(0, 37) + "…" : r.text}”` : r.text ? " read something else" : " found no code"}).`; // prettier-ignore
    const a = r.analysis;
    const lines = [];
    lines.push(`${a.wrong.length} of ${c.size * c.size} modules read wrong. Format information: ${a.format.ok ? "read right" : "wrong"}${a.format.dist ? ` (${a.format.dist} of 15 bits off; up to 3 can be fixed)` : ""}. Finders: ${a.finders.map((n) => (n ? `${n} wrong` : "intact")).join(", ")}.`); // prettier-ignore
    const blocks = a.blocks.map((b, j) => `block ${j + 1}: ${b.lost} lost of ${b.codewords}, can fix ${b.fixable} → ${b.ok ? "fixed" : "too many"}`); // prettier-ignore
    lines.push(
      `Codewords (${c.blocks.length} block${c.blocks.length > 1 ? "s" : ""}): ${blocks.join("; ")}.`,
    );
    if (r.healed !== undefined)
      lines.push(r.healed ? "After healing: it scans." : "After healing: it still doesn't scan.");
    const bars = el("div", { style: "display:flex;gap:3px;flex-wrap:wrap;margin:2px 0" });
    for (const b of a.blocks) {
      const w = 64;
      const bar = el("div", { title: `${b.lost} lost, ${b.fixable} fixable`, style: `width:${w}px;height:8px;background:var(--line,#ccc);position:relative;border-radius:2px;overflow:hidden` }); // prettier-ignore
      bar.append(el("div", { style: `position:absolute;left:0;top:0;bottom:0;width:${Math.min(w, (w * b.lost) / Math.max(1, b.fixable * 2))}px;background:${b.lost <= b.fixable ? "#d9822b" : "#b3261e"}` })); // prettier-ignore
      bar.append(el("div", { style: `position:absolute;left:${w / 2 - 1}px;top:0;bottom:0;width:2px;background:#333` })); // prettier-ignore
      bars.append(bar);
    }
    return el(
      "div",
      {},
      head,
      bars,
      el("p", { className: "note", style: "margin:2px 0", textContent: lines.join(" ") }),
    );
  });
}

async function addDamage() {
  const o = DM.options || {};
  const tool = o.tool || "scratch";
  const region = o.region || "all";
  const list = parseDamage(o.damage);
  let d = list.find((x) => x.kind === tool && x.region === region);
  if (!d) list.push((d = { kind: tool, amount: 0, region, seed: 1 + list.length }));
  d.amount = Math.min(1, d.amount + STEP_AMOUNT);
  await switchTo({ damage: formatDamage(list), show: "damaged" }, "drop");
}

async function heal() {
  if (!DM.check) await checkDamage();
  if (!DM.check) return;
  DM.read = DM.check.codes.map((r) => r.analysis);
  await switchTo({ show: "read" }, "heal");
}

// Renders the scan view and reads it: jsQR on each code, and each module.
export async function checkDamage() {
  const a = app();
  if (!a?.player || !DM.codes || !DM.layout) return null;
  if (DM.running) return DM.running;
  DM.running = (async () => {
    DM.checking = true;
    DM.panel?.refresh();
    try {
      await loadJsQR();
      const size = 1024;
      const { codes } = DM.codes;
      const L = DM.layout;
      const res = await a.withCapture([size, size], async () => {
        const player = a.player;
        const shot = await player.renderAt(player.time, frontPose(L.half, 1.2));
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const g = canvas.getContext("2d", { willReadFrequently: true });
        g.drawImage(shot, 0, 0, size, size);
        const img = g.getImageData(0, 0, size, size);
        const toPx = projector(size);
        return { img, toPx, geo: { ...DM.geo } };
      });
      const out = [];
      const geo = geoDamages(res.geo);
      for (let k = 0; k < codes.length; k++) {
        const s = codes[k];
        const [ox, oy] = L.offsets[k];
        const at = (r, c) => {
          const p = warpPoint([ox + c - s.size / 2 + 0.5, oy + s.size / 2 - 0.5 - r, 0], geo, s.size, r * s.size + c, L.width); // prettier-ignore
          return res.toPx(p);
        };
        // jsQR on this code's part of the picture (with its quiet zone).
        const corners = [[-QUIET - 0.5, -QUIET - 0.5], [-QUIET - 0.5, s.size + QUIET - 0.5], [s.size + QUIET - 0.5, -QUIET - 0.5], [s.size + QUIET - 0.5, s.size + QUIET - 0.5]].map(([r, c]) => at(r, c)); // prettier-ignore
        const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))));
        const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))));
        const x1 = Math.min(size, Math.ceil(Math.max(...corners.map((p) => p[0]))));
        const y1 = Math.min(size, Math.ceil(Math.max(...corners.map((p) => p[1]))));
        const crop = cropImage(res.img, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
        const text = codes.length === 1 ? readImage(res.img) : readImage(crop);
        const p0 = at(0, 0);
        const p1 = at(0, 1);
        const px = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const samples = sampleModules(res.img, s.size, at, Math.max(0.6, px * 0.22));
        const dark = toDark(samples);
        const analysis = { ...analyze(s, dark), dark };
        out.push({ scans: text === s.text, text, analysis, modulePx: px });
      }
      DM.check = { codes: out, at: Date.now() };
      DM.lastShot = res.img;
    } catch (err) {
      DM.check = { codes: [], error: err.message };
    } finally {
      DM.checking = false;
      DM.running = null;
    }
    DM.panel?.refresh();
    return DM.check;
  })();
  return DM.running;
}

function cropImage(img, x0, y0, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4); // prettier-ignore
  return { width: w, height: h, data };
}

// From code units to pixels of the last captured frame.
function projector(size) {
  const stage = app().player.stage;
  const ent = stage.toy?.entity;
  const cam = stage.cameraEntity.camera;
  const fit = app().player.motion.ctx.transform;
  const m = ent.getWorldTransform();
  const vp = new pc.Mat4().mul2(cam.projectionMatrix, cam.viewMatrix);
  const v = new pc.Vec4();
  return (p) => {
    const w = m.transformPoint(new pc.Vec3((p[0] - fit.center[0]) * fit.scale, (p[1] - fit.center[1]) * fit.scale, (p[2] - fit.center[2]) * fit.scale)); // prettier-ignore
    vp.transformVec4(new pc.Vec4(w.x, w.y, w.z, 1), v);
    return [((v.x / v.w) * 0.5 + 0.5) * size, (1 - ((v.y / v.w) * 0.5 + 0.5)) * size];
  };
}

// After each change, a check once the stage shows it and holds still.
function scheduleDamageCheck(delay = 500) {
  clearTimeout(DM.timer);
  if (typeof window === "undefined" || DM.noAuto) return;
  let tries = 0;
  const go = () => {
    const a = app();
    const st = a?.player?.motion?.state || {};
    const busy = (st.drop ?? 0) > 0 || ((st.heal ?? 0) > 0 && (st.heal ?? 0) < 1) || a?.busy;
    if (a?.player?.toyInfo?.id === "qr-damage" && !busy && document.body.dataset.ready === "true") return checkDamage(); // prettier-ignore
    if (++tries < 60) DM.timer = setTimeout(go, 250);
  };
  DM.timer = setTimeout(go, delay);
}

const DAMAGE = {
  alive: true,
  turntable: false,
  options: [
    { key: "text", label: "Text", type: "text", default: "https://ryanjosephkamp.github.io/splashery/", hidden: true }, // prettier-ignore
    { key: "level", label: "Error correction", type: "select", default: "M", hidden: true, choices: [...LEVELS, "all"].map((l) => ({ id: l, label: l })) }, // prettier-ignore
    { key: "damage", label: "Damage", type: "text", default: "", hidden: true },
    { key: "tool", label: "Damage to add", type: "select", default: "scratch", hidden: true, choices: BAKED.map((k) => ({ id: k, label: k })) }, // prettier-ignore
    { key: "region", label: "Where", type: "select", default: "all", hidden: true, choices: REGIONS.map((r) => ({ id: r.id, label: r.label })) }, // prettier-ignore
    { key: "show", label: "Show", type: "select", default: "damaged", hidden: true, choices: [{ id: "damaged", label: "The damaged code" }, { id: "read", label: "What a reader read" }] }, // prettier-ignore
  ],
  controls: [
    { key: "tilt", label: "Tilt", type: "slider", default: 0 },
    { key: "curve", label: "Curve", type: "slider", default: 0 },
    { key: "wave", label: "Move in time", type: "slider", default: 0 },
    { key: "drop", label: "Damage lands", type: "pulse", ease: 1.8 },
    { key: "heal", label: "Heal", type: "toggle", default: 0, ease: 5 },
  ],
  action: {
    key: "drop",
    label: "Add damage",
    at() {
      const o = DM.options || {};
      const tool = o.tool || "scratch";
      const region = o.region || "all";
      const list = parseDamage(o.damage);
      let d = list.find((x) => x.kind === tool && x.region === region);
      if (!d) list.push((d = { kind: tool, amount: 0, region, seed: 1 + list.length }));
      d.amount = Math.min(1, d.amount + STEP_AMOUNT);
      return { options: { damage: formatDamage(list), show: "damaged" }, key: "drop" };
    },
  },
  sounds: () => [],
  input: { title: "The Damage lab", fileButton: false, live: [{ render: damagePanel }], note: "", read: async () => ({}), shown: () => "" }, // prettier-ignore
  drive(t, c, out, info) {
    const d = info.data || {};
    const D = c.drop > 0 ? 1 - c.drop : 1;
    const H = (c.heal ?? 0) * ((d.blocks ?? 1) + 1.6);
    const g = { tilt: c.tilt ?? 0, curve: c.curve ?? 0, wave: c.wave ?? 0, phase: t * 0.25 };
    DM.geo = g;
    out.morph = [D, H, g.tilt, g.curve];
    out.tokens = [{ visible: g.wave }, { quat: [g.phase, 0, 0, 1], visible: 1 }];
    // A new look: check again once it settles (the wave moves all the time,
    // so it is checked at the moment the check renders).
    const key = `${g.tilt.toFixed(3)},${g.curve.toFixed(3)},${g.wave.toFixed(3)}`;
    if (key !== DM.lastGeo) {
      DM.lastGeo = key;
      if (typeof window !== "undefined") Promise.resolve().then(() => scheduleDamageCheck(700));
    }
    const healDone = (c.heal ?? 0) >= 1;
    if (healDone && !DM.healChecked && d.show === "read") {
      DM.healChecked = true;
      Promise.resolve().then(() => scheduleDamageCheck(200));
    }
    if (!healDone) DM.healChecked = false;
  },
  gpuField(o, fit) {
    if (!fit || !Number.isFinite(fit.scale) || !DM.layout) return null;
    return damageModifier({ size: DM.layout.N, fg: FG, bg: BG, offsets: DM.layout.offsets, width: DM.layout.width, torn: DM.torn || [0, 0] }, fit); // prettier-ignore
  },
  build(k, o) {
    const { codes } = damageCodes(o);
    const L = layoutFor(codes);
    DM.layout = L;
    DM.options = { ...o };
    const N = L.N;
    const S = N * N;
    const damage = parseDamage(o.damage);
    const showRead = o.show === "read" && DM.read?.length === codes.length;
    const per = codes.length > 1 ? 2 : 3;
    const splats = [];
    // The table behind.
    const T = L.half + 2.5;
    const tn = Math.round(2 * T * 1.2);
    for (let j = 0; j < tn; j++) for (let i = 0; i < tn; i++) splats.push({ p: [-T + (i + 0.5) * (2 * T / tn), -T + (j + 0.5) * (2 * T / tn), -0.4], scales: [0.6 * (2 * T / tn), 0.6 * (2 * T / tn), 0.02], quat: [0, 0, 0, 1], color: mixc(TABLE, [0.25, 0.2, 0.15], ((i * 7 + j * 3) % 5) / 12), opacity: 1, params: [0, 4], pattern: false }); // prettier-ignore
    let torn = null;
    codes.forEach((s, ci) => {
      const [ox, oy] = L.offsets[ci];
      const id0 = ci * S;
      if (showRead) {
        // What a reader read: each module a tile of the color it was read as;
        // the ones each block's correction sets right turn over in turn.
        const a = DM.read[ci];
        const read = a.dark;
        // Turn 0: the function patterns and the format information, which a
        // reader knows by their fixed places (BCH fixes the format bits);
        // turn b + 1: what block b's Reed–Solomon decoding sets right.
        const flip = new Int16Array(S).fill(-1);
        const data = (m) =>
          s.role[m] === ROLE.data || s.role[m] === ROLE.ecc || s.role[m] === ROLE.remainder;
        for (let m = 0; m < S; m++) if (!data(m) && read[m] !== s.modules[m]) flip[m] = 0;
        a.changed.forEach((list, b) => list.forEach((m) => (flip[m] = b + 1)));
        for (const sp of codeSplats(read, N, { per, lightTiles: true, fg: FG, bg: BG })) {
          sp.p[0] += ox;
          sp.p[1] += oy;
          const wrong = sp.mod >= 0 && flip[sp.mod] >= 0;
          const kind = wrong ? 5 + 16 * flip[sp.mod] : 0;
          // Modules read wrong show red until their turn sets them right.
          const color = wrong ? (sp.dark ? WRONG_DARK : WRONG_LIGHT) : sp.color;
          splats.push({ ...sp, color, params: [sp.mod >= 0 ? 1 + id0 + sp.mod : 0, kind], pattern: false }); // prettier-ignore
        }
        return;
      }
      const base = codeSplats(s.modules, N, { per, fg: FG, bg: BG });
      const { splats: hit, pieces } = applyDamage(base, damage, { size: N });
      for (const sp of hit) {
        sp.p[0] += ox;
        sp.p[1] += oy;
        const kind = sp.piece === "sticker" ? 1 : 0;
        splats.push({ ...sp, params: [sp.mod >= 0 ? 1 + id0 + sp.mod : 0, kind], pattern: false });
      }
      for (const pcs of pieces)
        for (const sp of pcs.splats) {
          sp.p[0] += ox;
          sp.p[1] += oy;
          if (pcs.kind === "tear") {
            if (ci === 0) torn = torn || pcs.splats.reduce((m, q) => [m[0] + q.p[0] / pcs.splats.length, m[1] + q.p[1] / pcs.splats.length], [0, 0]); // prettier-ignore
            splats.push({ ...sp, params: [sp.mod >= 0 ? 1 + id0 + sp.mod : 0, 2], pattern: false });
          } else {
            const gx = Math.floor(sp.p[0] / 2);
            const gy = Math.floor(sp.p[1] / 2);
            splats.push({ ...sp, params: [1 + (gx + 512) + 1024 * (gy + 512), 3], pattern: false });
          }
        }
    });
    DM.torn = torn;
    const H = L.half;
    k.reach([H + 3, H + 3, 2.5]);
    k.reach([-H - 3, -H - 3, -1]);
    k.cloud({ share: Math.min(1, splats.length / k.count), jitter: 0, pattern: false }, (rand, i) => splats[i] || null); // prettier-ignore
    k.data = { size: N, codes: codes.length, blocks: Math.max(...codes.map((c) => c.blocks.length)), show: showRead ? "read" : "damaged" }; // prettier-ignore
    DM.check = null;
    Promise.resolve().then(() => DM.panel?.refresh());
  },
};

// ======================================================================================
// Three codes in one (X2)
// ======================================================================================

const TH = { rgb: null, options: null, panel: null, result: null };
const TEXTS = ["https://ryanjosephkamp.github.io/splashery/", "Three codes in one square", "Red, green and blue"]; // prettier-ignore

function threePanel() {
  const box = el("div", { className: "qrs-three" });
  const inputs = [0, 1, 2].map((i) => {
    const e = el("input", { type: "text", id: `qrs-t${i}`, maxLength: 120, style: "width:100%;box-sizing:border-box" }); // prettier-ignore
    e.setAttribute("aria-label", `${["Red", "Green", "Blue"][i]} code's text`);
    return e;
  });
  const make = button("qrs-tmake", "Make the codes", () => switchTo({ t1: inputs[0].value, t2: inputs[1].value, t3: inputs[2].value }, "apart"), true); // prettier-ignore
  const readBtn = button("qrs-tread", "Read all three", () => readThree());
  const out = el("div", { id: "qrs-tresult", role: "status" });
  box.append(
    ...inputs.flatMap((e, i) => [
      el("label", { htmlFor: e.id, textContent: `${["Red", "Green", "Blue"][i]} code` }),
      e,
    ]),
    row(make, readBtn),
    out,
    note("Each module's red, green and blue come from three different QR codes, so one square holds three codes: eight colors from white to black. Splashery's reader splits the picture into its red, green and blue and reads each one. An ordinary reader sees only the gray of each module, most of it from green. Tap the square to pull the three codes apart and back."), // prettier-ignore
  );
  TH.panel = {
    refresh() {
      const r = TH.rgb;
      if (!r) return;
      inputs.forEach((e, i) => document.activeElement !== e && (e.value = r.texts[i]));
      const res = TH.result;
      out.replaceChildren();
      if (!res) return;
      res.split.forEach((t, i) => out.append(el("p", { style: "margin:2px 0", textContent: `${["Red", "Green", "Blue"][i]}: ${t === r.texts[i] ? "✓" : "✗"} ${t === null ? "no code found" : `“${t}”`}` }))); // prettier-ignore
      out.append(el("p", { className: "note", textContent: `An ordinary reader (jsQR on the colors as they are): ${res.plain === null ? "found no code" : `read “${res.plain}”${r.texts.includes(res.plain) ? ` (the ${["red", "green", "blue"][r.texts.indexOf(res.plain)]} code)` : ""}`}.` })); // prettier-ignore
    },
  };
  TH.panel.refresh();
  return box;
}

export async function readThree() {
  const a = app();
  if (!a?.player || !TH.rgb) return null;
  await loadJsQR();
  const size = 900;
  const img = await a.withCapture([size, size], async () => {
    const shot = await a.player.renderAt(a.player.time, frontPose(TH.rgb.size / 2 + QUIET, 1.2));
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(shot, 0, 0, size, size);
    return g.getImageData(0, 0, size, size);
  });
  TH.result = { split: readRGB(img, readImage), plain: readImage(img) };
  TH.lastShot = img;
  TH.panel?.refresh();
  return TH.result;
}

const THREE = {
  alive: true,
  turntable: false,
  options: [
    { key: "t1", label: "Red code", type: "text", default: TEXTS[0], hidden: true },
    { key: "t2", label: "Green code", type: "text", default: TEXTS[1], hidden: true },
    { key: "t3", label: "Blue code", type: "text", default: TEXTS[2], hidden: true },
    { key: "level", label: "Error correction", type: "select", default: "M", choices: LEVELS.map((l) => ({ id: l, label: `Level ${l}` })) }, // prettier-ignore
  ],
  controls: [{ key: "apart", label: "Pull apart", type: "pulse", ease: 4.2 }],
  action: { key: "apart", label: "Pull the three apart" },
  sounds: () => [],
  input: { title: "Three codes in one", fileButton: false, live: [{ render: threePanel }], note: "", read: async () => ({}), shown: () => "" }, // prettier-ignore
  drive(t, c, out, info) {
    const d = info.data || {};
    const w = (d.size ?? 25) + 2 * QUIET + 1.5;
    // 0 → 1 → 0 over the pulse: out, hold, back.
    const p = c.apart > 0 ? 1 - c.apart : 0;
    const k = p < 0.3 ? smooth(p / 0.3) : p < 0.7 ? 1 : smooth((1 - p) / 0.3);
    // The square shows while together. Pulled apart, its three codes (each
    // in its own color) move back and out to the sides, so all three fit on
    // the screen side by side, then come back together.
    const on = k > 0.001 ? 1 : 0;
    out.tokens = [
      { offset: [0, 0, 0], visible: 1 - on },
      { offset: [-1.05 * w * k, 0, -3 * w * k], visible: on },
      { offset: [0, 0.02 * w * k, -3 * w * k + 0.3], visible: on },
      { offset: [1.05 * w * k, 0, -3 * w * k], visible: on },
    ];
  },
  build(k, o) {
    const r = encodeRGB([o.t1 ?? TEXTS[0], o.t2 ?? TEXTS[1], o.t3 ?? TEXTS[2]], o.level || "M");
    TH.rgb = r;
    TH.options = { ...o };
    TH.result = null;
    const N = r.size;
    const all = [];
    // Token 0: the square, every module in its own color.
    const ones = new Uint8Array(N * N).fill(1);
    const key = (i) => r.colors[i * 3] * 4 + r.colors[i * 3 + 1] * 2 + r.colors[i * 3 + 2];
    for (const sp of codeSplats(ones, N, { per: 3, fg: FG, bg: BG, key }))
      all.push({ ...sp, color: sp.mod >= 0 ? [r.colors[sp.mod * 3], r.colors[sp.mod * 3 + 1], r.colors[sp.mod * 3 + 2]] : sp.color, kind: "token", params: [0, 0], pattern: false }); // prettier-ignore
    // Tokens 1–3: each channel's code, in its own color on white.
    const tint = [
      [0.86, 0.1, 0.12],
      [0.1, 0.62, 0.2],
      [0.12, 0.25, 0.85],
    ];
    for (let ch = 0; ch < 3; ch++)
      for (const sp of codeSplats(r.codes[ch].modules, N, { per: 2, fg: tint[ch], bg: BG })) all.push({ ...sp, p: [sp.p[0], sp.p[1], sp.p[2] - 0.05 * (ch + 1)], kind: "token", params: [ch + 1, 0], pattern: false }); // prettier-ignore
    const H = N / 2 + QUIET;
    k.reach([H + 1, H + 1, 1]);
    k.reach([-H - 1, -H - 1, -0.5]);
    k.cloud({ share: Math.min(1, all.length / k.count), jitter: 0, pattern: false }, (rand, i) => all[i] || null); // prettier-ignore
    k.data = { size: N };
    Promise.resolve().then(() => TH.panel?.refresh());
  },
};
const smooth = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};

export const RECIPES = { "qr-anatomy": ANATOMY, "qr-damage": DAMAGE, "qr-three": THREE };

// ---- The test hook ---------------------------------------------------------------------------
// window.__splashery.qrLab:
//   anatomy()          { steps, options } of "How a QR code works"
//   damage()           { codes, options, check } of the Damage lab
//   checkDamage()      renders and reads the Damage lab now
//   lastShot()         the Damage lab's last picture read (ImageData)
//   readThree()        reads the three codes in one
//   autoCheck = false  stops the Damage lab's automatic check
if (typeof window !== "undefined" && window.__splashery) {
  window.__splashery.player?.on?.("toy", (info) => {
    if (info?.id === "qr-damage") scheduleDamageCheck(600);
    else clearTimeout(DM.timer);
  });
  window.__splashery.qrLab = {
    anatomy: () => ({ steps: AN.steps, options: AN.options }),
    damage: () => ({ codes: DM.codes?.codes, layout: DM.layout, options: DM.options, check: DM.check }), // prettier-ignore
    checkDamage: () => checkDamage(),
    lastShot: () => DM.lastShot,
    heal: () => heal(),
    addDamage: () => addDamage(),
    readThree: () => readThree(),
    three: () => ({ rgb: TH.rgb, result: TH.result, shot: TH.lastShot }),
    frontPose: (half, margin) => frontPose(half, margin),
    set autoCheck(on) {
      DM.noAuto = !on;
      if (!on) clearTimeout(DM.timer);
    },
  };
}
