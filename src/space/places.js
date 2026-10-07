// Lane Space r3: what is at a spot on a real world, for the label a tap
// shows. Earth's countries, states and provinces, cities, peaks, seas and
// regions come from Natural Earth (public domain); the other worlds' named
// features from the IAU's Gazetteer of Planetary Nomenclature (USGS,
// public domain). tools/sp3-places.mjs trims both into the files read here.
// Works in the browser and in Node (the tests), like src/space/maps.js.
//
//   import { loadPlaces } from "../space/places.js";
//   const p = await loadPlaces("earth");
//   p.at(48.857, 2.352)  // { title: "Paris", lines: ["Île-de-France, France"], source: "Natural Earth" }

import { TILES } from "./zoom.js";

const root = new URL("../../assets/toys/", import.meta.url);
const isNode = root.protocol === "file:";
const DEG = Math.PI / 180;

async function bytes(rel) {
  const url = new URL(rel, root);
  if (isNode) {
    const fs = await import("node:fs/promises");
    const b = await fs.readFile(url);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel}.`);
  return new Uint8Array(await r.arrayBuffer());
}
const json = async (rel) => JSON.parse(new TextDecoder().decode(await bytes(rel)));

async function inflate(data) {
  if (isNode) {
    const zlib = await import("node:zlib");
    const b = zlib.inflateSync(data);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// The great-circle distance between two spots, in radians.
export function arc(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * DEG) / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(((lon2 - lon1) * DEG) / 2) ** 2; // prettier-ignore
  return 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const km = (x) => (x >= 100 ? Math.round(x / 10) * 10 : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString("en-US"); // prettier-ignore
const meters = (m) => `${Math.round(m).toLocaleString("en-US")} m`;

// ---- Earth ----------------------------------------------------------------------------------

// The run-length layers of places.bin (see tools/sp3-places.mjs): value at a cell.
function layersOf(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const W = dv.getUint16(4, true);
  const H = dv.getUint16(6, true);
  const n = buf[8];
  return { W, H, n, body: buf.subarray(12) };
}

async function earthPlaces() {
  const [meta, raw] = await Promise.all([json("real-earth/places.json"), bytes("real-earth/places.bin")]); // prettier-ignore
  const { W, H, n, body } = layersOf(raw);
  const data = await inflate(body);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // Where each row of each layer starts.
  const rows = new Uint32Array(n * H);
  let o = 0;
  for (let k = 0; k < n * H; k++) {
    rows[k] = o;
    o += 2 + 4 * dv.getUint16(o, true);
  }
  const cell = (layer, lat, lon) => {
    const j = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
    let x = (lon + 180) % 360;
    if (x < 0) x += 360;
    const i = Math.min(W - 1, Math.floor((x / 360) * W));
    let p = rows[layer * H + j];
    const count = dv.getUint16(p, true);
    p += 2;
    for (let r = 0; r < count; r++, p += 4) if (i < dv.getUint16(p + 2, true)) return dv.getUint16(p, true); // prettier-ignore
    return 0;
  };
  // Cities in cells of 2° for the nearest-city search.
  const grid = new Map();
  meta.cities.forEach((c, k) => {
    const key = `${Math.floor(c[1] / 2)},${Math.floor(c[2] / 2)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(k);
  });
  const R = 6371;
  const near = (lat, lon, list, maxKm) => {
    let best = null;
    let bd = maxKm / R;
    for (const [k, x] of list) {
      const d = arc(lat, lon, x[1], x[2]);
      if (d < bd) ((bd = d), (best = k));
    }
    return best === null ? null : { k: best, km: bd * R };
  };
  const nearCity = (lat, lon, maxKm) => {
    const a = Math.floor(lat / 2);
    const b = Math.floor(lon / 2);
    const span = Math.ceil(maxKm / 222) + 1;
    const list = [];
    for (let i = -span; i <= span; i++)
      for (let j = -span * 3; j <= span * 3; j++) {
        let bb = b + j;
        if (bb < -90) bb += 180;
        if (bb >= 90) bb -= 180;
        for (const k of grid.get(`${a + i},${bb}`) || []) list.push([k, meta.cities[k]]);
      }
    return near(lat, lon, list, maxKm);
  };
  const peakList = meta.peaks.map((p, k) => [k, p]);
  return {
    source: "Natural Earth (public domain)",
    // What is at a spot: { title, lines, source, kind }.
    at(lat, lon) {
      const st = cell(0, lat, lon);
      const wa = cell(1, lat, lon);
      const rg = cell(2, lat, lon);
      const is = cell(3, lat, lon);
      const lines = [];
      let title = "";
      const water = wa ? meta.water[wa - 1] : null;
      const region = rg ? meta.regions[rg - 1] : null;
      const island = is ? meta.islands[is - 1] : null;
      if (st && !(water && water[1] === "lake")) {
        const [sName, sType, ci] = meta.states[st - 1];
        const country = meta.countries[ci];
        // The nearest peak close by, else the nearest city (in it, or near it).
        const peak = near(lat, lon, peakList, 30);
        const city = nearCity(lat, lon, 150);
        if (peak) {
          const p = meta.peaks[peak.k];
          title = p[0];
          lines.push(`${p[4] === "volcano" ? "a volcano" : "a peak"}, ${meters(p[3])} high${peak.km > 3 ? `, ${km(peak.km)} km away` : ""}`); // prettier-ignore
        } else if (city) {
          const c = meta.cities[city.k];
          // Inside a city of its size, roughly; else near it.
          const radius = Math.max(4, Math.min(30, 3 * Math.log10(Math.max(1000, c[3]) / 300) ** 1.6));
          title = city.km <= radius ? c[0] : `Near ${c[0]}`;
          if (city.km > radius) lines.push(`${km(city.km)} km from ${c[0]}`);
        }
        const place = sName && sName !== country ? `${sName}${sType && !/unknown/i.test(sType) ? ` (${sType.toLowerCase()})` : ""}, ${country}` : country; // prettier-ignore
        if (!title) title = sName || country;
        lines.push(place);
        if (region && !lines.some((l) => l.includes(region[0]))) lines.push(`in the ${region[0].replace(/^the /i, "")}`); // prettier-ignore
        else if (island) lines.push(`on ${island[0]}`);
        return { title, lines, source: this.source, kind: "land", country, state: sName, city: title.replace(/^Near /, "") }; // prettier-ignore
      }
      if (water) {
        title = water[1] === "lake" && !/lake|lac|lago|reservoir|sea|loch|lough|pond/i.test(water[0]) ? `Lake ${water[0]}` : water[0]; // prettier-ignore
        if (st) lines.push(meta.countries[meta.states[st - 1][2]]);
        if (island) lines.push(`by ${island[0]}`);
        const city = nearCity(lat, lon, 120);
        if (city) lines.push(`${km(city.km)} km from ${meta.cities[city.k][0]}`);
        return { title, lines, source: this.source, kind: water[1] === "lake" ? "lake" : "sea" };
      }
      if (island) return { title: island[0], lines: [], source: this.source, kind: "land" };
      return { title: "The open sea", lines: [], source: this.source, kind: "sea" };
    },
  };
}

// ---- The Gazetteer --------------------------------------------------------------------------

// Kinds that name a broad stretch of ground (shown as where the spot lies).
const BROAD = new Set(["ME", "PL", "TA", "RE", "VS", "OC", "LG", "PM", "LC", "PA", "SI", "AL", "TE"]); // prettier-ignore

async function gazetteerPlaces(world, radiusKm) {
  const toy = TILES[world]?.toy;
  const d = await json(`${toy}/names-${world}.json`);
  const list = d.features;
  const kind = (c) => d.kinds[c] || "feature";
  return {
    source: "IAU and USGS Gazetteer of Planetary Nomenclature (public domain)",
    at(lat, lon) {
      // Every feature the spot is inside (within half its size of its center),
      // and the nearest one's edge otherwise.
      const inside = [];
      let nearest = null;
      let nd = Infinity;
      for (const f of list) {
        const dk = arc(lat, lon, f[2], f[3]) * radiusKm;
        const half = Math.max(0.5, f[4] / 2);
        if (dk <= half) inside.push({ f, dk });
        const edge = dk - half;
        if (edge < nd) ((nd = edge), (nearest = { f, dk }));
      }
      inside.sort((a, b) => a.f[4] - b.f[4]);
      const small = inside.find((x) => !BROAD.has(x.f[1])) || inside[0];
      const broad = [...inside].reverse().find((x) => BROAD.has(x.f[1]) && x !== small);
      const lines = [];
      let title;
      if (small) {
        const f = small.f;
        title = f[0];
        lines.push(`${kind(f[1])}${f[4] >= 1 ? `, ${km(f[4])} km across` : ""}`);
      } else if (nearest) {
        const f = nearest.f;
        title = `Near ${f[0]}`;
        lines.push(`${km(Math.max(1, nd))} km from the ${kind(f[1])} ${f[0]}`);
      } else title = "Unnamed ground";
      // A bigger feature it lies on (a caldera on its volcano), and the broad
      // ground round it (a mare, a plain).
      let last = small;
      for (const x of inside) {
        if (!last || lines.length >= 3 || x === small || x === broad || BROAD.has(x.f[1]) || x.f[4] <= last.f[4] * 1.5) continue; // prettier-ignore
        lines.push(`on ${x.f[0]} (${kind(x.f[1])}, ${km(x.f[4])} km across)`);
        last = x;
      }
      if (broad) lines.push(`in ${broad.f[0]} (${kind(broad.f[1])})`);
      return { title, lines, source: this.source, kind: small ? small.f[1] : "", feature: small?.f[0] ?? null }; // prettier-ignore
    },
  };
}

const CACHE = new Map();
// The places of a world (cached), or null for a world without names.
export function loadPlaces(world, radiusKm) {
  if (!CACHE.has(world))
    CACHE.set(world, world === "earth" ? earthPlaces() : TILES[world] ? gazetteerPlaces(world, radiusKm) : Promise.resolve(null)); // prettier-ignore
  return CACHE.get(world);
}
