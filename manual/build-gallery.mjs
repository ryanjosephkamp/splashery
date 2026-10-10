// Writes Level 4's "Sixty more programs" cards into manual/index.html, from src/equation-gallery.json
// (Codex task 33, reviewed in Manual r3 part 2). Each card has the program's thumbnail, its one-line
// description, its source, the program itself (folded), and a "Run it" link that opens the Splat
// equation toy with that program, in a new tab. Run it again after the gallery file changes:
//
//   node manual/build-gallery.mjs
//
// It replaces everything between the two GALLERY markers in index.html.

import fs from "node:fs";
import zlib from "node:zlib";
import { readStatements, compileProgram, FIELDS } from "../src/packs/splat-equation.js";

const SITE = "https://ryanjosephkamp.github.io/splashery/";
const entries = JSON.parse(fs.readFileSync(new URL("../src/equation-gallery.json", import.meta.url), "utf8")); // prettier-ignore
const indexUrl = new URL("./index.html", import.meta.url);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); // prettier-ignore
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // prettier-ignore

// The scene a link carries: the equation toy, with this program typed in (as its text box does).
function sceneFor(entry) {
  const set = readStatements(entry.program);
  const prog = compileProgram(set);
  const options = { preset: "custom" };
  for (const name of FIELDS) options[name] = prog.fields[name] || "";
  return {
    app: "splashery",
    version: 3,
    createdAt: "2026-10-10T00:00:00.000Z",
    seed: 341441,
    toy: { kind: "builtin", id: "splat-equation", options },
    look: { background: "page", theme: "auto", accent: "auto", splatScale: 1, exposure: 1 },
    effects: {
      poke: { on: false, strength: 0.6, wobble: 0.5 },
      wind: { on: false, strength: 0.55, direction: 0 },
      dissolve: { on: false, spread: 0.55, speed: 0.5 },
      drop: { on: false, bounce: 0.45, scatter: 0.5 },
      magnet: { on: false, strength: 0.7, radius: 0.45 },
      twist: { on: false, amount: 0.5, wobble: 0.3, axis: "y" },
      slice: { on: false, position: 0, sweep: 0.35, axis: "x" },
      paint: { on: false, size: 0.5, splash: 0.5, color: "#e63b2e" },
    },
    paint: { stamps: [] },
    camera: { yaw: 0.55, pitch: 0.28, roll: 0, distance: 5 },
    autoplay: { turntable: true, effect: "none" },
    pattern: { id: "none", flag: "", projection: "wrap", repeats: 1, colors: ["#ffffff", "#e63b2e", "#0b4f9c"], scale: 0.5, amount: 1, detail: 0.6 }, // prettier-ignore
    motion: { alive: true, move: "still", speed: 0.5, controls: {} },
  };
}

const link = (entry) =>
  `${SITE}#s=d.${b64url(zlib.deflateRawSync(Buffer.from(JSON.stringify(sceneFor(entry)))))}`;

function card(entry) {
  const src = entry.source
    ? `<a href="${esc(entry.source)}" target="_blank" rel="noopener">About the shape</a>`
    : "";
  return `          <article class="card" id="g-${esc(entry.id)}">
            <img src="../assets/gallery/${esc(entry.id)}.webp" alt="${esc(entry.title)}, made of splats" loading="lazy" width="256" height="256" />
            <div class="body">
              <h5>${esc(entry.title)}</h5>
              <p>${esc(entry.about)}</p>
              <details class="fold program">
                <summary>Show the program</summary>
                <pre><code>${esc(entry.program)}</code></pre>
              </details>
              <p class="card-links"><a class="button" href="${link(entry)}" target="_blank" rel="noopener">Run it</a> ${src}</p>
            </div>
          </article>`;
}

const groups = [...new Set(entries.map((e) => e.group))];
let out = "      <!-- GALLERY:START (written by manual/build-gallery.mjs; do not edit by hand) -->\n";
for (const g of groups) {
  const list = entries.filter((e) => e.group === g);
  const slug = g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  out += `      <details class="fold gallery-group" id="gallery-${slug}">
        <summary>${esc(g)} (${list.length} programs)</summary>
        <div class="gallery gallery-grid">
${list.map(card).join("\n")}
        </div>
      </details>\n`;
}
out += "      <!-- GALLERY:END -->\n";

const html = fs.readFileSync(indexUrl, "utf8");
const a = html.indexOf("      <!-- GALLERY:START");
const b = html.indexOf("      <!-- GALLERY:END -->\n");
if (a < 0 || b < 0) throw new Error("The GALLERY markers are not in index.html yet.");
fs.writeFileSync(indexUrl, html.slice(0, a) + out + html.slice(b + "      <!-- GALLERY:END -->\n".length));
console.log(`${entries.length} programs in ${groups.length} groups written.`);
