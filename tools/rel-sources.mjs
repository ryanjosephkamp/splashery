#!/usr/bin/env node
// Real elements (lane Elements, prefix rel): reads every element's page on Images of Elements
// (images-of-elements.com, Jumk.de Webprojects) and lists its main photo, the photo's caption and
// the page's license line, for the lane to check by hand. Writes .cache/rel/sources.json; the
// checked choices live in src/elements-real/samples.js.
//
//   node tools/rel-sources.mjs
import fs from "node:fs";
import path from "node:path";
import { ELEMENT_LIST } from "../src/chem/atom-model.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cache = path.join(root, ".cache/rel");
fs.mkdirSync(path.join(cache, "pages"), { recursive: true });

// The site's page names (British spellings, and its own "tenessine").
const SLUG = { Al: "aluminium", Cs: "caesium", Ts: "tenessine" };
export const slugOf = (el) => SLUG[el.symbol] || el.name.toLowerCase();

async function get(url, file) {
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "SplasheryBuild/1.0 (build tool)" } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const t = await r.text();
      fs.writeFileSync(file, t);
      return t;
    } catch (e) {
      if (i === 3) throw e;
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
    }
  }
}

const text = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const out = [];
for (const el of ELEMENT_LIST) {
  const slug = slugOf(el);
  const url = `https://images-of-elements.com/${slug}.php`;
  let page;
  try {
    page = await get(url, path.join(cache, "pages", `${slug}.php`));
  } catch (e) {
    out.push({ z: el.z, symbol: el.symbol, slug, url, error: String(e.message || e) });
    continue;
  }
  const body = page.replace(/<script[\s\S]*?<\/script>/g, " ");
  const imgs = [...body.matchAll(/src="s\/([^"]+\.(?:jpg|png))"/g)].map((m) => m[1]);
  const t = text(body);
  const a = t.indexOf(`${el.z} ${el.symbol} `);
  const b = t.indexOf("Page last changed");
  const caption = a >= 0 ? t.slice(a, b > a ? b : a + 1500) : "";
  out.push({
    z: el.z,
    symbol: el.symbol,
    slug,
    url,
    images: imgs,
    ccby: /creativecommons\.org\/licenses\/by\/3\.0/.test(page),
    caption: caption.slice(0, 1600),
  });
}
fs.writeFileSync(path.join(cache, "sources.json"), JSON.stringify(out, null, 1));
console.log(`${out.length} pages, ${out.filter((o) => o.error).length} errors`);
