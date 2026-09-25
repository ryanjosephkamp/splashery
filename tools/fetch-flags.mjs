#!/usr/bin/env node
// Fetches national flags from Wikimedia Commons for the pattern layer and
// writes assets/flags/<code>.svg plus assets/flags/flags.json. Every file's
// licence is read from the Commons API (extmetadata) and only public-domain
// or CC0 files are kept; anything else is reported and skipped.
//
//   node tools/fetch-flags.mjs            # all flags
//   node tools/fetch-flags.mjs fr jp      # some flags
//
// The list is the 193 UN member states, the two UN observer states, Kosovo
// and Taiwan. Commons file titles follow "Flag of <name>.svg".

import fs from "node:fs";
import path from "node:path";
import { svgAspect } from "./flag-aspects.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(root, "assets/flags");
const UA = "SplasheryBuild/1.0 (https://github.com/ryanjosephkamp/splashery; build tool)";
const API = "https://commons.wikimedia.org/w/api.php";

// [code, display name, Commons title when it is not "Flag of <name>.svg"]
export const COUNTRIES = [
  ["af", "Afghanistan"],
  ["al", "Albania"],
  ["dz", "Algeria"],
  ["ad", "Andorra"],
  ["ao", "Angola"],
  ["ag", "Antigua and Barbuda"],
  ["ar", "Argentina"],
  ["am", "Armenia"],
  ["au", "Australia"],
  ["at", "Austria"],
  ["az", "Azerbaijan"],
  ["bs", "Bahamas", "Flag of the Bahamas.svg"],
  ["bh", "Bahrain"],
  ["bd", "Bangladesh"],
  ["bb", "Barbados"],
  ["by", "Belarus"],
  ["be", "Belgium"],
  ["bz", "Belize"],
  ["bj", "Benin"],
  ["bt", "Bhutan"],
  ["bo", "Bolivia"],
  ["ba", "Bosnia and Herzegovina"],
  ["bw", "Botswana"],
  ["br", "Brazil"],
  ["bn", "Brunei"],
  ["bg", "Bulgaria"],
  ["bf", "Burkina Faso"],
  ["bi", "Burundi"],
  ["cv", "Cabo Verde", "Flag of Cape Verde.svg"],
  ["kh", "Cambodia"],
  ["cm", "Cameroon"],
  ["ca", "Canada"],
  ["cf", "Central African Republic", "Flag of the Central African Republic.svg"],
  ["td", "Chad"],
  ["cl", "Chile"],
  ["cn", "China", "Flag of the People's Republic of China.svg"],
  ["co", "Colombia"],
  ["km", "Comoros", "Flag of the Comoros.svg"],
  ["cg", "Congo", "Flag of the Republic of the Congo.svg"],
  ["cd", "DR Congo", "Flag of the Democratic Republic of the Congo.svg"],
  ["cr", "Costa Rica"],
  ["ci", "Côte d'Ivoire", "Flag of Côte d'Ivoire.svg"],
  ["hr", "Croatia"],
  ["cu", "Cuba"],
  ["cy", "Cyprus"],
  ["cz", "Czechia", "Flag of the Czech Republic.svg"],
  ["dk", "Denmark"],
  ["dj", "Djibouti"],
  ["dm", "Dominica"],
  ["do", "Dominican Republic", "Flag of the Dominican Republic.svg"],
  ["ec", "Ecuador"],
  ["eg", "Egypt"],
  ["sv", "El Salvador"],
  ["gq", "Equatorial Guinea"],
  ["er", "Eritrea"],
  ["ee", "Estonia"],
  ["sz", "Eswatini"],
  ["et", "Ethiopia"],
  ["fj", "Fiji"],
  ["fi", "Finland"],
  ["fr", "France"],
  ["ga", "Gabon"],
  ["gm", "Gambia", "Flag of The Gambia.svg"],
  ["ge", "Georgia"],
  ["de", "Germany"],
  ["gh", "Ghana"],
  ["gr", "Greece"],
  ["gd", "Grenada"],
  ["gt", "Guatemala"],
  ["gn", "Guinea"],
  ["gw", "Guinea-Bissau"],
  ["gy", "Guyana"],
  ["ht", "Haiti"],
  ["hn", "Honduras"],
  ["hu", "Hungary"],
  ["is", "Iceland"],
  ["in", "India"],
  ["id", "Indonesia"],
  ["ir", "Iran"],
  ["iq", "Iraq"],
  ["ie", "Ireland"],
  ["il", "Israel"],
  ["it", "Italy"],
  ["jm", "Jamaica"],
  ["jp", "Japan"],
  ["jo", "Jordan"],
  ["kz", "Kazakhstan"],
  ["ke", "Kenya"],
  ["ki", "Kiribati"],
  ["kw", "Kuwait"],
  ["kg", "Kyrgyzstan"],
  ["la", "Laos"],
  ["lv", "Latvia"],
  ["lb", "Lebanon"],
  ["ls", "Lesotho"],
  ["lr", "Liberia"],
  ["ly", "Libya"],
  ["li", "Liechtenstein"],
  ["lt", "Lithuania"],
  ["lu", "Luxembourg"],
  ["mg", "Madagascar"],
  ["mw", "Malawi"],
  ["my", "Malaysia"],
  ["mv", "Maldives"],
  ["ml", "Mali"],
  ["mt", "Malta"],
  ["mh", "Marshall Islands", "Flag of the Marshall Islands.svg"],
  ["mr", "Mauritania"],
  ["mu", "Mauritius"],
  ["mx", "Mexico"],
  ["fm", "Micronesia", "Flag of the Federated States of Micronesia.svg"],
  ["md", "Moldova"],
  ["mc", "Monaco"],
  ["mn", "Mongolia"],
  ["me", "Montenegro"],
  ["ma", "Morocco"],
  ["mz", "Mozambique"],
  ["mm", "Myanmar"],
  ["na", "Namibia"],
  ["nr", "Nauru"],
  ["np", "Nepal"],
  ["nl", "Netherlands", "Flag of the Netherlands.svg"],
  ["nz", "New Zealand"],
  ["ni", "Nicaragua"],
  ["ne", "Niger"],
  ["ng", "Nigeria"],
  ["kp", "North Korea"],
  ["mk", "North Macedonia"],
  ["no", "Norway"],
  ["om", "Oman"],
  ["pk", "Pakistan"],
  ["pw", "Palau"],
  ["pa", "Panama"],
  ["pg", "Papua New Guinea"],
  ["py", "Paraguay"],
  ["pe", "Peru"],
  ["ph", "Philippines", "Flag of the Philippines.svg"],
  ["pl", "Poland"],
  ["pt", "Portugal"],
  ["qa", "Qatar"],
  ["ro", "Romania"],
  ["ru", "Russia"],
  ["rw", "Rwanda"],
  ["kn", "Saint Kitts and Nevis"],
  ["lc", "Saint Lucia"],
  ["vc", "Saint Vincent and the Grenadines"],
  ["ws", "Samoa"],
  ["sm", "San Marino"],
  ["st", "São Tomé and Príncipe", "Flag of Sao Tome and Principe.svg"],
  ["sa", "Saudi Arabia"],
  ["sn", "Senegal"],
  ["rs", "Serbia"],
  ["sc", "Seychelles"],
  ["sl", "Sierra Leone"],
  ["sg", "Singapore"],
  ["sk", "Slovakia"],
  ["si", "Slovenia"],
  ["sb", "Solomon Islands", "Flag of the Solomon Islands.svg"],
  ["so", "Somalia"],
  ["za", "South Africa"],
  ["kr", "South Korea"],
  ["ss", "South Sudan"],
  ["es", "Spain"],
  ["lk", "Sri Lanka"],
  ["sd", "Sudan"],
  ["sr", "Suriname"],
  ["se", "Sweden"],
  ["ch", "Switzerland"],
  ["sy", "Syria"],
  ["tj", "Tajikistan"],
  ["tz", "Tanzania"],
  ["th", "Thailand"],
  ["tl", "Timor-Leste", "Flag of East Timor.svg"],
  ["tg", "Togo"],
  ["to", "Tonga"],
  ["tt", "Trinidad and Tobago"],
  ["tn", "Tunisia"],
  ["tr", "Türkiye", "Flag of Turkey.svg"],
  ["tm", "Turkmenistan"],
  ["tv", "Tuvalu"],
  ["ug", "Uganda"],
  ["ua", "Ukraine"],
  ["ae", "United Arab Emirates", "Flag of the United Arab Emirates.svg"],
  ["gb", "United Kingdom", "Flag of the United Kingdom.svg"],
  ["us", "United States", "Flag of the United States.svg"],
  ["uy", "Uruguay"],
  ["uz", "Uzbekistan"],
  ["vu", "Vanuatu"],
  ["ve", "Venezuela"],
  ["vn", "Vietnam"],
  ["ye", "Yemen"],
  ["zm", "Zambia"],
  ["zw", "Zimbabwe"],
  // UN observer states, Kosovo and Taiwan.
  ["va", "Vatican City", "Flag of the Vatican City.svg"],
  ["ps", "Palestine"],
  ["xk", "Kosovo"],
  ["tw", "Taiwan", "Flag of the Republic of China.svg"],
];

const OK_LICENCES = /^(public domain|pd|cc0)/i;

// Names read with "the" in a sentence ("in the colours of the Netherlands").
const WITH_THE = new Set([
  "bs",
  "cf",
  "km",
  "cg",
  "cd",
  "do",
  "gm",
  "mv",
  "mh",
  "nl",
  "ph",
  "sb",
  "ae",
  "gb",
  "us",
]);

function stripTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function getJSON(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`GET ${url} failed`);
}

// Downloads politely: one file at a time, a pause between files, and
// backoff (honouring Retry-After) when Commons asks us to slow down.
async function getBytes(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      await sleep(350);
      return Buffer.from(await res.arrayBuffer());
    }
    const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt;
    console.log(`  ${res.status} from ${new URL(url).host}, waiting ${Math.round(wait / 1000)} s`);
    await sleep(wait);
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const only = process.argv.slice(2);
const want = COUNTRIES.filter(([code]) => !only.length || only.includes(code));
const titleOf = ([, name, title]) => title || `Flag of ${name}.svg`;
fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, "flags.json");
const old = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).flags
  : [];
const byCode = new Map(old.map((f) => [f.code, f]));
const problems = [];

for (let i = 0; i < want.length; i += 40) {
  const batch = want.slice(i, i + 40);
  const titles = batch.map((c) => `File:${titleOf(c)}`);
  const url =
    `${API}?action=query&format=json&formatversion=2&redirects=1&prop=imageinfo` +
    `&iiprop=url|size|extmetadata&titles=${encodeURIComponent(titles.join("|"))}`;
  const j = await getJSON(url);
  const pages = j.query?.pages || [];
  // Map requested titles through normalisation and redirects.
  const alias = new Map();
  for (const n of j.query?.normalized || []) alias.set(n.from, n.to);
  for (const r of j.query?.redirects || []) alias.set(r.from, r.to);
  const resolve = (t) => {
    let x = t;
    for (let k = 0; k < 4 && alias.has(x); k++) x = alias.get(x);
    return x;
  };
  for (const c of batch) {
    const [code, name] = c;
    const title = resolve(`File:${titleOf(c)}`);
    const page = pages.find((p) => p.title === title);
    const info = page?.imageinfo?.[0];
    if (!info) {
      problems.push(`${code}: no file ${title}`);
      continue;
    }
    const meta = info.extmetadata || {};
    const lic = stripTags(meta.LicenseShortName?.value);
    const licCode = stripTags(meta.License?.value);
    if (!OK_LICENCES.test(lic) && !OK_LICENCES.test(licCode)) {
      problems.push(`${code}: ${title} is "${lic || licCode}", not public domain; skipped`);
      continue;
    }
    const file = `${code}.svg`;
    const have = byCode.get(code);
    const bytes =
      have && have.source === info.descriptionurl && fs.existsSync(path.join(outDir, file))
        ? fs.readFileSync(path.join(outDir, file))
        : await getBytes(info.url.split("?")[0]);
    if (!bytes) {
      problems.push(`${code}: download failed`);
      continue;
    }
    fs.writeFileSync(path.join(outDir, file), bytes);
    byCode.set(code, {
      code,
      name,
      ...(WITH_THE.has(code) ? { the: true } : {}),
      file,
      source: info.descriptionurl,
      license: /cc0/i.test(lic + licCode) ? "CC0" : "Public domain",
      author: stripTags(meta.Artist?.value).slice(0, 160) || "Wikimedia Commons contributors",
      bytes: bytes.length,
      aspect: svgAspect(bytes.toString("utf8")),
    });
    console.log(`${code}: ${title} (${lic}, ${bytes.length} bytes)`);
  }
}

const flags = COUNTRIES.map(([code]) => byCode.get(code)).filter(Boolean);
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      about:
        "National flags for Splashery's pattern layer, from Wikimedia Commons. Each file's licence was read from the Commons API when it was fetched (tools/fetch-flags.mjs); only public-domain and CC0 files are kept.",
      fetched: new Date().toISOString().slice(0, 10),
      flags,
    },
    null,
    1,
  ) + "\n",
);
console.log(`\n${flags.length} flags in ${path.relative(root, manifestPath)}`);
if (problems.length) {
  console.log(`\nProblems:\n${problems.join("\n")}`);
  process.exitCode = 1;
}
