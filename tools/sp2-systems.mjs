#!/usr/bin/env node
// Lane Space r2: real planetary systems for the "Real star systems" toy.
// Reads each system's planets from the NASA Exoplanet Archive (its
// Planetary Systems Composite Parameters table, pscomppars, through its TAP
// service; NASA mission data, CC0) and writes
// assets/toys/star-systems/systems.json:
//
//   { systems: [{ id, name, distanceLy, star: { teff, radiusSun },
//                 planets: [{ name, periodDays, aAU, radiusEarth }] }] }
//
// The inner Solar System is added for comparison, from NASA's planetary
// fact sheets (NSSDC).
//
//   node tools/sp2-systems.mjs

import fs from "node:fs";

const OUT = "assets/toys/star-systems/systems.json";
const TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";
const SYSTEMS = [
  { id: "trappist-1", host: "TRAPPIST-1", name: "TRAPPIST-1" },
  { id: "toi-178", host: "TOI-178", name: "TOI-178" },
  { id: "55-cnc", host: "55 Cnc", name: "55 Cancri" },
];
const PC_LY = 3.26156;

const out = { about: "Made by tools/sp2-systems.mjs from the NASA Exoplanet Archive (pscomppars) and NASA's planetary fact sheets.", systems: [] }; // prettier-ignore
for (const s of SYSTEMS) {
  const q = `select pl_name,pl_orbper,pl_orbsmax,pl_rade,st_teff,st_rad,sy_dist from pscomppars where hostname='${s.host}' order by pl_orbper`; // prettier-ignore
  const r = await fetch(`${TAP}?query=${encodeURIComponent(q)}&format=json`);
  if (!r.ok) throw new Error(`${s.host}: HTTP ${r.status}`);
  const rows = await r.json();
  out.systems.push({
    id: s.id,
    name: s.name,
    distanceLy: Math.round(rows[0].sy_dist * PC_LY * 10) / 10,
    star: { teff: rows[0].st_teff, radiusSun: rows[0].st_rad },
    planets: rows.map((p) => ({
      name: p.pl_name,
      periodDays: p.pl_orbper,
      aAU: p.pl_orbsmax,
      radiusEarth: p.pl_rade,
    })),
  });
}
// NSSDC planetary fact sheets: orbital period (days), semimajor axis
// (10^6 km, as AU), mean radius (km, as Earth radii of 6,371 km).
const AU = 149.598;
out.systems.push({
  id: "inner-solar-system",
  name: "The inner Solar System",
  distanceLy: 0,
  star: { teff: 5772, radiusSun: 1 },
  planets: [
    { name: "Mercury", periodDays: 87.969, aAU: 57.909 / AU, radiusEarth: 2439.7 / 6371 },
    { name: "Venus", periodDays: 224.701, aAU: 108.21 / AU, radiusEarth: 6051.8 / 6371 },
    { name: "Earth", periodDays: 365.256, aAU: 149.598 / AU, radiusEarth: 1 },
    { name: "Mars", periodDays: 686.98, aAU: 227.956 / AU, radiusEarth: 3389.5 / 6371 },
  ],
});
fs.mkdirSync("assets/toys/star-systems", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
for (const s of out.systems) console.log(`${s.name}: ${s.planets.length} planets`);
