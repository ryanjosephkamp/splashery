#!/usr/bin/env node
// Lane Hands-on H3: makes the Storybook's PDF (the owner's idea of October 9,
// 2026: a real storybook with pages, read in the Your book toy, in place of
// the built book). The story and its pictures are drawn here, in HTML and
// SVG, and printed to PDF by Chromium; nothing is fetched.
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/hh3-storybook.mjs [out.pdf]
//
// Writes assets/toys/storybook/storybook.pdf by default (6 x 8 inches).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] || "assets/toys/storybook/storybook.pdf";

// The pictures: flat shapes, a sky and a ground, the lamp somewhere in it.
const C = { ink: "#3b2f2a", lamp: "#e8b04a", glow: "#fff1b8", sea: "#4f8fbf", sand: "#e9d29a", grass: "#7fb069", night: "#23315a", day: "#bfe3f5", dusk: "#f4b48a", red: "#c2453d" }; // prettier-ignore

const lamp = (x, y, s = 1, lit = true) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    ${lit ? `<circle cx="0" cy="-58" r="46" fill="${C.glow}" opacity="0.55"/>` : ""}
    <rect x="-16" y="-8" width="32" height="10" rx="3" fill="${C.ink}"/>
    <rect x="-3" y="-44" width="6" height="38" fill="${C.ink}"/>
    <path d="M-26 -44 L26 -44 L16 -76 L-16 -76 Z" fill="${C.lamp}" stroke="${C.ink}" stroke-width="3"/>
    <circle cx="-7" cy="-58" r="3" fill="${C.ink}"/><circle cx="7" cy="-58" r="3" fill="${C.ink}"/>
    <path d="M-7 -50 Q0 -45 7 -50" stroke="${C.ink}" stroke-width="2.5" fill="none"/>
  </g>`;

const sky = (col, h = 300) => `<rect width="400" height="${h}" fill="${col}"/>`;
const sun = (x, y, col = "#ffd65c") => `<circle cx="${x}" cy="${y}" r="26" fill="${col}"/>`;
const moon = (x, y) => `<circle cx="${x}" cy="${y}" r="20" fill="#f6f1d8"/><circle cx="${x + 9}" cy="${y - 6}" r="18" fill="${C.night}"/>`; // prettier-ignore
const stars = (n, seed = 1) => {
  let s = seed;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: n }, () => `<circle cx="${(r() * 400).toFixed(0)}" cy="${(r() * 150).toFixed(0)}" r="${(1 + r() * 1.6).toFixed(1)}" fill="#fffbe6"/>`).join(""); // prettier-ignore
};
const waves = (y, col) => `<path d="M0 ${y} Q25 ${y - 10} 50 ${y} T100 ${y} T150 ${y} T200 ${y} T250 ${y} T300 ${y} T350 ${y} T400 ${y} V300 H0 Z" fill="${col}"/>`; // prettier-ignore
const hill = (col, y = 220) => `<path d="M0 ${y} Q100 ${y - 40} 200 ${y - 10} T400 ${y - 20} V300 H0 Z" fill="${col}"/>`; // prettier-ignore
const desk = () => `<rect x="40" y="220" width="320" height="18" rx="4" fill="#a0714f"/><rect x="60" y="238" width="14" height="62" fill="#8a5f41"/><rect x="326" y="238" width="14" height="62" fill="#8a5f41"/>`; // prettier-ignore
const window_ = (inside) => `<rect x="230" y="40" width="130" height="120" rx="6" fill="${C.ink}"/><rect x="238" y="48" width="114" height="104" fill="${inside}"/><rect x="292" y="48" width="6" height="104" fill="${C.ink}"/><rect x="238" y="97" width="114" height="6" fill="${C.ink}"/>`; // prettier-ignore
const gull = (x, y) => `<path d="M${x - 12} ${y} Q${x - 6} ${y - 8} ${x} ${y} Q${x + 6} ${y - 8} ${x + 12} ${y}" stroke="${C.ink}" stroke-width="2.5" fill="none"/>`; // prettier-ignore
const boat = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-40 0 L40 0 L28 18 L-28 18 Z" fill="${C.red}" stroke="${C.ink}" stroke-width="3"/><rect x="-2" y="-52" width="4" height="52" fill="${C.ink}"/><path d="M2 -50 L34 -8 L2 -8 Z" fill="#fffaf0" stroke="${C.ink}" stroke-width="2"/></g>`; // prettier-ignore
const cart = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-50" y="-30" width="100" height="34" rx="4" fill="#8bb3d9" stroke="${C.ink}" stroke-width="3"/><circle cx="-30" cy="8" r="11" fill="${C.ink}"/><circle cx="30" cy="8" r="11" fill="${C.ink}"/></g>`; // prettier-ignore
const shell = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-14 6 Q0 -22 14 6 Z" fill="#f4c7c3" stroke="${C.ink}" stroke-width="2"/><path d="M0 6 L0 -10 M-6 6 L-3 -8 M6 6 L3 -8" stroke="${C.ink}" stroke-width="1.5"/></g>`; // prettier-ignore

const pic = (body) => `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

// The story (original, for this toy): ten pages.
const pages = [
  {
    cover: true,
    title: "The Little Lamp Who Wanted to See the Sea",
    pic: pic(sky(C.night) + stars(40, 3) + moon(320, 60) + waves(230, C.sea) + lamp(150, 232, 1.3)),
  },
  {
    text: "On a desk by a window lived a little lamp named Lumi. Every night Lumi glowed, so that the girl at the desk could read her books.",
    pic: pic(sky("#f3e6cf") + window_(C.night) + `<g>${stars(8, 7).replace(/cy="(\d+)"/g, (m, y) => `cy="${55 + (y % 90)}"`).replace(/cx="(\d+)"/g, (m, x) => `cx="${242 + (x % 106)}"`)}</g>` + desk() + lamp(130, 220, 1.1) + `<rect x="190" y="204" width="56" height="16" fill="#d9534f"/><rect x="194" y="194" width="50" height="10" fill="#5b8bd6"/>`), // prettier-ignore
  },
  {
    text: "One of the books was about the sea. It had big blue waves, white birds and a little red boat. “I wish I could see the sea,” said Lumi.",
    pic: pic(sky(C.day) + sun(80, 70) + waves(190, C.sea) + boat(250, 196) + gull(140, 80) + gull(175, 60) + gull(300, 95)), // prettier-ignore
  },
  {
    text: "So one morning Lumi hopped down from the desk, out of the door and into the big wide world. Hop, hop, hop!",
    pic: pic(sky(C.day) + sun(330, 60) + hill(C.grass) + `<rect x="40" y="90" width="80" height="120" fill="#c98b5b" stroke="${C.ink}" stroke-width="3"/><rect x="66" y="150" width="28" height="60" fill="${C.ink}"/>` + lamp(220, 222, 0.9, false) + `<path d="M150 200 q10 -14 20 0 M180 205 q10 -14 20 0" stroke="${C.ink}" stroke-width="2" fill="none"/>`), // prettier-ignore
  },
  {
    text: "The road was long. A kind girl with a cart stopped. “Where are you going, little lamp?” “To the sea!” said Lumi. “Hop in!”",
    pic: pic(sky(C.day) + sun(60, 60) + hill("#95c47e", 230) + `<rect x="0" y="240" width="400" height="60" fill="#c8b48e"/>` + cart(230, 252) + lamp(225, 222, 0.8, false)), // prettier-ignore
  },
  {
    text: "They rolled over hills and past fields, until the air smelled of salt and the sky grew wide. Then Lumi heard it: shhh, shhh, shhh.",
    pic: pic(sky(C.dusk) + sun(200, 200, "#ffb347") + waves(215, "#6f9fc8") + `<rect x="0" y="250" width="400" height="50" fill="${C.sand}"/>` + gull(90, 110) + gull(310, 90)), // prettier-ignore
  },
  {
    text: "The sea! It was bigger than every page of the book. Lumi played in the sand and found a pink shell, as small as a button.",
    pic: pic(sky(C.day) + sun(330, 55) + waves(170, C.sea) + `<rect x="0" y="215" width="400" height="85" fill="${C.sand}"/>` + lamp(150, 262, 0.9, false) + shell(230, 262)), // prettier-ignore
  },
  {
    text: "When night came, the sea was dark, and a little red boat could not find its way to shore. So Lumi glowed as brightly as a lamp can glow.",
    pic: pic(sky(C.night) + stars(30, 11) + moon(70, 60) + waves(190, "#2c4f7a") + boat(290, 198) + `<rect x="0" y="235" width="400" height="65" fill="#a8956a"/>` + lamp(110, 258, 1.1)), // prettier-ignore
  },
  {
    text: "The boat saw the light and sailed safely home. “Thank you, little lamp!” called the sailor. Lumi felt warm all the way to the bulb.",
    pic: pic(sky(C.night) + stars(30, 5) + moon(330, 60) + waves(200, "#2c4f7a") + boat(190, 228) + lamp(90, 262, 1)), // prettier-ignore
  },
  {
    text: "The next night Lumi was back on the desk, glowing for the girl and her books, with a pink shell beside it. The End.",
    pic: pic(sky("#f3e6cf") + window_(C.night) + desk() + lamp(150, 220, 1.1) + shell(230, 214)), // prettier-ignore
  },
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: 6in 8in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, "DejaVu Serif", serif; color: ${C.ink}; }
  .page { width: 6in; height: 8in; padding: 0.45in; page-break-after: always; display: flex; flex-direction: column; background: #fffaf0; }
  .page:last-child { page-break-after: auto; }
  .page svg { width: 100%; height: auto; border-radius: 10px; }
  .page p { font-size: 19pt; line-height: 1.4; margin: 0.35in 0 0; }
  .num { margin-top: auto; text-align: center; font-size: 11pt; opacity: 0.6; }
  .cover { background: ${C.night}; color: #fff7dd; justify-content: center; }
  .cover h1 { font-size: 30pt; line-height: 1.15; text-align: center; margin: 0.3in 0 0; }
</style></head><body>
${pages
  .map((p, i) =>
    p.cover
      ? `<div class="page cover">${p.pic}<h1>${p.title}</h1></div>`
      : `<div class="page">${p.pic}<p>${p.text}</p><div class="num">${i}</div></div>`,
  )
  .join("\n")}
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.pdf({ path: out, width: "6in", height: "8in", printBackground: true });
await browser.close();
console.log(`${out}: ${pages.length} pages, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
