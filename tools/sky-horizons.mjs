#!/usr/bin/env node
// Lane Night sky: fetches reference positions from JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api,
// keyless) for the Night sky's tests, and prints them as JSON to record in
// tests/sky.spec.mjs (the test never calls Horizons itself). Build-time only.
//
//   node tools/sky-horizons.mjs > .cache/sky/horizons.json

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const BODIES = { sun: "10", moon: "301", mercury: "199", venus: "299", mars: "499", jupiter: "599", saturn: "699", uranus: "799", neptune: "899" }; // prettier-ignore
const TIMES = ["1990-06-15 00:00", "2000-01-01 12:00", "2026-10-05 00:00", "2045-03-20 06:00"];
// A topocentric check: the Royal Observatory, Greenwich, and New York City.
const SITES = [
  { name: "Greenwich", lon: -0.0015, lat: 51.4769, km: 0.046 },
  { name: "New York", lon: -74.006, lat: 40.7128, km: 0.01 },
];

async function query(params) {
  const u = new URL(API);
  const base = { format: "text", MAKE_EPHEM: "YES", EPHEM_TYPE: "OBSERVER", ANG_FORMAT: "DEG", CSV_FORMAT: "YES", TIME_DIGITS: "MINUTES" }; // prettier-ignore
  for (const [k, v] of Object.entries({ ...base, ...params })) u.searchParams.set(k, k === "format" ? v : `'${v}'`);
  const r = await fetch(u);
  const text = await r.text();
  const head = /\n\s*Date__\(UT\)__HR:MN,(.*)\n/.exec(text);
  const body = /\$\$SOE\n([\s\S]*?)\n\$\$EOE/.exec(text);
  if (!head || !body) throw new Error(`Horizons: ${text.slice(0, 400)}`);
  const cols = ["date", ...head[1].split(",").map((s) => s.trim())];
  return body[1].split("\n").map((line) => {
    const f = line.split(",").map((s) => s.trim());
    return Object.fromEntries(cols.map((c, i) => [c, f[i]]));
  });
}

const out = { source: "JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api)", fetched: new Date().toISOString().slice(0, 10), geocentric: [], topocentric: [] }; // prettier-ignore
for (const t of TIMES) {
  for (const [name, id] of Object.entries(BODIES)) {
    const [row] = await query({ COMMAND: id, CENTER: "500@399", START_TIME: t, STOP_TIME: `${t.slice(0, 11)}${t.slice(11, 13)}:01`, STEP_SIZE: "1m", QUANTITIES: "1" }); // prettier-ignore
    out.geocentric.push({ body: name, utc: t, ra: Number(row["R.A._(ICRF)"]), dec: Number(row["DEC_(ICRF)"]) }); // prettier-ignore
  }
}
for (const s of SITES) {
  for (const t of TIMES.slice(2)) {
    for (const name of ["sun", "moon", "jupiter"]) {
      const [row] = await query({ COMMAND: BODIES[name], CENTER: "coord@399", COORD_TYPE: "GEODETIC", SITE_COORD: `${s.lon},${s.lat},${s.km}`, START_TIME: t, STOP_TIME: `${t.slice(0, 11)}${t.slice(11, 13)}:01`, STEP_SIZE: "1m", QUANTITIES: "4,10" }); // prettier-ignore
      out.topocentric.push({ site: s.name, lat: s.lat, lon: s.lon, body: name, utc: t, az: Number(row["Azi_(a-app)"]), alt: Number(row["Elev_(a-app)"]), illum: Number(row["Illu%"]) }); // prettier-ignore
    }
  }
}
console.log(JSON.stringify(out, null, 1));
