#!/usr/bin/env node
// Lane Baked engine (docs/handoff/BakedEngine.md): checks a toy package from an outside builder
// against every rule in builders/RULES.md that a machine can check, before it is ported into
// Splashery. It prints what blocks the port and what only warns, and exits 1 only on a block.
//
//   node tools/port-check.mjs <folder> [--json]
//
// A package is a folder with:
//   recipe.mjs     the kit recipe (imports Splashery's own modules by relative path)
//   manifest.json  the baked asset's manifest (tools/port-convert.mjs writes it), with its
//                  credit filled in; other files under assets/ (a texture, a sound) are listed
//                  in "extraAssets": [{ path, title, author, source, license, licenseUrl,
//                  checked, changes, nc? }]
//   assets/        the asset files (the baked tiers, and any extra assets)
//   record.md      the builder's record: what was made, how, with which agent and model, what
//                  ran in a real browser, and its "Rule check" line
//
// Blocks: a missing piece of the package; an external URL in an import, fetch or the like, or
// any CDN host (D1); PlayCanvas reached any way but src/pc.js, or a bare module name (D1, D2); a
// secret or token (C1, E3); an asset under assets/ the manifest doesn't list, a listed file
// that's missing or whose hash doesn't match, or an asset with no source or no license, or a
// license outside B1 (CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, public domain or NASA); an NC
// asset without "nc": true (B2); more than 15 moving parts; a British spelling in the record or
// the manifest's text (E4). Warns (D4, size is a recommendation): a default tier over 15 MB, the
// largest tier over 40 MB, a file over 20 MB; and a British spelling in a string in the code (it
// may be a key that stays as it is), a URL in the code outside an import (a credit link is fine),
// a recipe with no prepare(), an AI-made asset (A3: label it), and a record with no "Rule check".

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { britishIn } from "./us-english.mjs";

const MB = 1024 * 1024;

const CDN = /\b(unpkg\.com|cdn\.jsdelivr\.net|jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|cdn\.skypack\.dev|ga\.jspm\.io|jspm\.dev|googleapis\.com|gstatic\.com|cdn\.tailwindcss\.com|code\.jquery\.com)\b/i; // prettier-ignore
const SECRETS = [
  [/\bhf_[A-Za-z0-9]{20,}\b/, "a Hugging Face token (hf_…)"],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/, "an API key (sk-…)"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "a GitHub token (ghp_…)"],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/, "a GitHub token (github_pat_…)"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "a Google API key"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/, "a Slack token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_\-./+]{16,}["']/i, "a key or password assigned in the code"],
]; // prettier-ignore
// B1: the licenses a Splashery asset may carry.
const LICENSES = [
  [/^cc0\b|^cc zero|^creative commons zero/i, "CC0"],
  [/^cc[- ]by[- ]nc[- ]sa\b/i, "CC BY-NC-SA"],
  [/^cc[- ]by[- ]nc\b(?![- ]nd)/i, "CC BY-NC"],
  [/^cc[- ]by[- ]sa\b/i, "CC BY-SA"],
  [/^cc[- ]by\b(?![- ](nd|nc[- ]nd))/i, "CC BY"],
  [/^public domain\b|^pd\b|^public-domain\b/i, "public domain"],
  [/^nasa\b/i, "NASA"],
];
const CODE = /\.(m?js|html)$/;
const TEXT = /\.(m?js|json|md|txt|html|css|glsl|wgsl|py|csv)$/i;

export function licenseOf(text) {
  const t = String(text || "").trim();
  if (!t || /\bnd\b|noderiv/i.test(t)) return null;
  for (const [re, name] of LICENSES) if (re.test(t)) return name;
  return null;
}

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// The string literals of a line of code.
const strings = (line) =>
  [...line.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? ""); // prettier-ignore

// Checks one package folder: { blocks: [], warns: [], notes: [] } (each a line of text).
export function checkPackage(dir) {
  const blocks = [];
  const warns = [];
  const notes = [];
  const block = (s) => blocks.push(s);
  const warn = (s) => warns.push(s);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    block(`${dir} is not a folder.`);
    return { blocks, warns, notes };
  }
  for (const need of ["recipe.mjs", "manifest.json", "record.md"])
    if (!fs.existsSync(path.join(dir, need))) block(`The package has no ${need}.`);
  if (!fs.existsSync(path.join(dir, "assets"))) block("The package has no assets/ folder.");
  const files = walk(dir);

  // ---- Code: URLs, CDNs, PlayCanvas, module names; secrets in every text file ----
  for (const f of files) {
    if (!TEXT.test(f)) continue;
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      const at = `${f}:${i + 1}`;
      for (const [re, what] of SECRETS) if (re.test(line)) block(`${at}: ${what}. Never commit secrets (C1, E3).`); // prettier-ignore
      if (!CODE.test(f)) return;
      if (CDN.test(line)) block(`${at}: a CDN (${line.match(CDN)[0]}). Everything the page loads is in the repo (D1).`); // prettier-ignore
      const specs = [
        ...line.matchAll(/\bimport\s*(?:[\w*{}\s,]+from\s*)?["'`]([^"'`]+)["'`]/g),
        ...line.matchAll(/\bexport\s+(?:\*|\{[^}]*\})\s*from\s*["'`]([^"'`]+)["'`]/g),
        ...line.matchAll(/\bimport\(\s*["'`]([^"'`]+)["'`]/g),
      ].map((m) => m[1]);
      for (const s of specs) {
        if (/^[a-z]+:\/\//i.test(s) || s.startsWith("//")) block(`${at}: imports from ${s}. No external code (D1).`); // prettier-ignore
        else if (/playcanvas/i.test(s) || /vendor\//.test(s)) block(`${at}: imports ${s}. PlayCanvas and vendored code are reached only through src/pc.js (D2).`); // prettier-ignore
        else if (!s.startsWith(".") && !s.startsWith("/")) block(`${at}: imports "${s}", a bare module name. The site has no bundler or install step (D1).`); // prettier-ignore
      }
      if (
        /\b(fetch|importScripts|WebSocket|EventSource|XMLHttpRequest|sendBeacon)\b[^;]*["'`](https?:)?\/\/[^"'`]+/.test(
          line,
        ) ||
        /\bnew\s+URL\(\s*["'`]https?:\/\//.test(line) ||
        /\bsrc\s*=\s*["'`]https?:\/\//.test(line)
      )
        // prettier-ignore
        block(`${at}: reaches an outside address. The page loads only its own files (C1, D1).`);
      else if (
        /https?:\/\//.test(line) &&
        !/\b(source|licenseUrl|url|page|href|link)\s*:/.test(line)
      )
        // prettier-ignore
        warn(`${at}: a URL in the code. Fine as a credit link; never something the page loads.`);
      if (/\b(window|globalThis|self)\.pc\b/.test(line)) block(`${at}: reaches PlayCanvas as a global. Import it from src/pc.js (D2).`); // prettier-ignore
      for (const s of strings(line))
        for (const [gb, us] of britishIn(s)) warn(`${at}: "${gb}" → ${us} (American English, E4; a key saved in links stays as it is).`); // prettier-ignore
    });
  }
  const recipe = fs.existsSync(path.join(dir, "recipe.mjs")) ? fs.readFileSync(path.join(dir, "recipe.mjs"), "utf8") : ""; // prettier-ignore
  if (recipe && !/\bprepare\s*\(/.test(recipe))
    warn("recipe.mjs has no prepare(): a baked asset loads there (src/baked.js, loadBaked).");

  // ---- The record ----
  if (fs.existsSync(path.join(dir, "record.md"))) {
    const rec = fs.readFileSync(path.join(dir, "record.md"), "utf8");
    rec.split("\n").forEach((line, i) => {
      for (const [gb, us] of britishIn(line.replace(/`[^`]*`/g, " "))) block(`record.md:${i + 1}: "${gb}" → ${us} (American English, E4).`); // prettier-ignore
    });
    if (!/rule check/i.test(rec))
      warn('record.md has no "Rule check" line (none, or the rules it touches).');
  }

  // ---- The manifest and its assets ----
  let m = null;
  try {
    m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  } catch (e) {
    if (fs.existsSync(path.join(dir, "manifest.json"))) block(`manifest.json is not JSON (${e.message}).`); // prettier-ignore
  }
  const listed = new Set();
  const assets = [];
  if (m) {
    if (m.format !== "splashery-baked-manifest") block('manifest.json is not a baked manifest (format "splashery-baked-manifest"; tools/port-convert.mjs writes it).'); // prettier-ignore
    if ((m.parts || []).filter((p) => p.id).length > 15) block(`The asset has ${(m.parts || []).filter((p) => p.id).length} moving parts; a kit toy moves at most 15.`); // prettier-ignore
    const tiers = (m.tiers || []).slice().sort((a, b) => a.splats - b.splats);
    if (!tiers.length) block("manifest.json lists no tiers.");
    assets.push({ what: `the baked asset${m.id ? ` "${m.id}"` : ""}`, credit: m.credit || {}, nc: m.nc, aiMade: m.aiMade, files: tiers.flatMap((t) => t.files || []) }); // prettier-ignore
    for (const x of m.extraAssets || []) assets.push({ what: x.path || "an extra asset", credit: x, nc: x.nc, aiMade: x.aiMade, files: [{ path: x.path, sha256: x.sha256 }] }); // prettier-ignore
    for (const a of assets) {
      const c = a.credit;
      if (!c.source) block(`${a.what} has no source (B2: its source page).`);
      if (!c.author) warn(`${a.what} has no author.`);
      if (!c.checked) warn(`${a.what} has no date the license was checked (B2).`);
      const lic = licenseOf(c.license);
      if (!c.license) block(`${a.what} has no license (B1).`);
      else if (!lic) block(`${a.what} is "${c.license}", which isn't allowed (B1: CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, public domain, or NASA; never ND).`); // prettier-ignore
      if (lic && /NC/.test(lic) && a.nc !== true) block(`${a.what} is ${lic} but has no "nc": true (B2).`); // prettier-ignore
      if (lic && /SA|NC/.test(lic)) notes.push(`${a.what} is ${lic}: its license notice shows beside it, and anything made from it keeps the license (B2).`); // prettier-ignore
      if (a.aiMade) warn(`${a.what} is AI-made: only as a labeled Studio sample, never for science, math, engineering, the photoreal shelves or real places (A3).`); // prettier-ignore
      for (const t of [c.title, c.changes, c.author]) if (t) for (const [gb, us] of britishIn(String(t))) block(`manifest.json: "${gb}" → ${us} (American English, E4).`); // prettier-ignore
      for (const f of a.files) {
        if (!f.path) continue;
        listed.add(f.path);
        const full = path.join(dir, f.path);
        if (!fs.existsSync(full)) {
          block(`${f.path} is in the manifest but not in the package.`);
          continue;
        }
        if (f.sha256 && sha256(full) !== f.sha256) block(`${f.path} doesn't match its hash in the manifest.`); // prettier-ignore
      }
    }
    // D4: size is a recommendation.
    const size = (t) => (t.files || []).reduce((s, f) => s + (fs.existsSync(path.join(dir, f.path)) ? fs.statSync(path.join(dir, f.path)).size : 0), 0); // prettier-ignore
    for (const t of tiers) notes.push(`Tier of ${t.splats} splats: ${(size(t) / MB).toFixed(2)} MB in ${(t.files || []).length} file(s).`); // prettier-ignore
    if (tiers.length) {
      const def = tiers.find((t) => t.splats === m.defaultTier) || tiers.filter((t) => t.splats <= 400000).pop() || tiers[0]; // prettier-ignore
      if (size(def) > 15 * MB) warn(`The default tier (${def.splats} splats) is ${(size(def) / MB).toFixed(1)} MB; aim for 15 MB or less on a first load (D4).`); // prettier-ignore
      const top = tiers[tiers.length - 1];
      if (size(top) > 40 * MB) warn(`The largest tier (${top.splats} splats) is ${(size(top) / MB).toFixed(1)} MB; opt-in tiers go up to about 40 MB (D4).`); // prettier-ignore
    }
  }
  for (const f of files) {
    if (f.startsWith("assets/") && !listed.has(f)) block(`${f} is not listed in the manifest (every asset carries its record, B2).`); // prettier-ignore
    const bytes = fs.statSync(path.join(dir, f)).size;
    if (bytes > 20 * MB) warn(`${f} is ${(bytes / MB).toFixed(1)} MB; keep each file under 20 MB (D4).`); // prettier-ignore
  }
  return { blocks, warns, notes };
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1] || "")}`).href) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("Usage: node tools/port-check.mjs <folder> [--json]");
    process.exit(2);
  }
  const r = checkPackage(path.resolve(dir));
  if (args.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    for (const b of r.blocks) console.log(`BLOCK  ${b}`);
    for (const w of r.warns) console.log(`warn   ${w}`);
    for (const n of r.notes) console.log(`note   ${n}`);
    console.log(
      r.blocks.length
        ? `\n${r.blocks.length} block${r.blocks.length === 1 ? "" : "s"}: not ready to port.`
        : `\nNothing blocks the port (${r.warns.length} warning${r.warns.length === 1 ? "" : "s"}).`,
    );
  }
  process.exit(r.blocks.length ? 1 : 0);
}
