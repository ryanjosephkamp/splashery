// Lane Molecule viewer: reading a structure (in a Web Worker when there is one)
// and fetching an entry from the Protein Data Bank by its code.
//
// fetchEntry() asks RCSB for https://files.rcsb.org/download/<code>.cif only
// when the person types a code and asks for it (CLAUDE.md, "Live data"; the
// owner's "PDB fetch yes", October 5, 2026). Nothing is sent but the code in
// the address, nothing is stored, and the file is read on this device.

import { readStructure } from "./parse.js";
import { orient } from "./geom.js";

export const RCSB = "https://files.rcsb.org/download/";
// The largest entry file the viewer fetches (bigger ones would pass the atom
// cap anyway, and a phone shouldn't download them for nothing).
export const MAX_FETCH_BYTES = 60e6;

let worker = null;
let nextId = 1;
const waiting = new Map();

function startWorker() {
  if (worker !== null) return worker;
  worker = false;
  if (typeof Worker === "undefined" || typeof window === "undefined") return worker;
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error));
      else w.resolve(e.data.model);
    };
    worker.onerror = (e) => {
      // A worker that can't start (an old browser): read on the page instead.
      e.preventDefault?.();
      for (const w of waiting.values()) w.fallback();
      waiting.clear();
      worker.terminate();
      worker = false;
    };
  } catch {
    worker = false;
  }
  return worker;
}

// Reads a structure file and turns it to face the viewer. In the browser the
// work happens in a worker; in Node (the tools and tests) right here.
export function readModel(text, fileName = "") {
  const direct = () => orient(readStructure(text, fileName));
  const w = startWorker();
  if (!w) return Promise.resolve().then(direct);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, {
      resolve,
      reject,
      fallback: () => Promise.resolve().then(direct).then(resolve, reject),
    });
    w.postMessage({ id, text: String(text), fileName });
  });
}

// "1crn" -> "1CRN"; null when it isn't a PDB code (four characters, a digit first).
export function pdbCode(text) {
  const s = String(text ?? "").trim();
  return /^[1-9][A-Za-z0-9]{3}$/.test(s) ? s.toUpperCase() : null;
}

// Fetches an entry's mmCIF file from RCSB. Returns { text, url, bytes, at }.
// `fetchFn` lets the tests stand in for the network.
export async function fetchEntry(code, { fetchFn = globalThis.fetch, progress = () => {} } = {}) {
  const url = `${RCSB}${code}.cif`;
  progress(`Fetching ${code} from the Protein Data Bank (RCSB)…`);
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 90000) : 0;
  let r;
  try {
    r = await fetchFn(url, { signal: ctl?.signal, credentials: "omit", referrerPolicy: "no-referrer" }); // prettier-ignore
  } catch (err) {
    clearTimeout(timer);
    throw new Error(
      err?.name === "AbortError"
        ? `RCSB took too long to send ${code}. Try again, or open one of the samples.`
        : `Could not reach RCSB to fetch ${code} (offline?). The samples above work offline.`,
    );
  }
  if (r.status === 404) {
    clearTimeout(timer);
    throw new Error(`The Protein Data Bank has no entry ${code} as an mmCIF file. Check the code.`);
  }
  if (!r.ok) {
    clearTimeout(timer);
    throw new Error(`RCSB answered ${r.status} for ${code}. Try again later.`);
  }
  const size = Number(r.headers?.get?.("content-length")) || 0;
  if (size > MAX_FETCH_BYTES) {
    clearTimeout(timer);
    ctl?.abort();
    throw new Error(`${code}'s file is ${Math.round(size / 1e6)} MB, more than the viewer reads (${MAX_FETCH_BYTES / 1e6} MB). Try a smaller entry.`); // prettier-ignore
  }
  const text = await r.text();
  clearTimeout(timer);
  if (text.length > MAX_FETCH_BYTES)
    throw new Error(`${code}'s file is more than the viewer reads (${MAX_FETCH_BYTES / 1e6} MB). Try a smaller entry.`); // prettier-ignore
  return { text, url, bytes: text.length, at: new Date() };
}
