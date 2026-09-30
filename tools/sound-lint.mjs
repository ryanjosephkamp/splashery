#!/usr/bin/env node
// Checks toys' tap sounds against the owner's sound preferences (docs/PACKS.md,
// section 7e). Each sound is rendered offline (an OfflineAudioContext in
// headless Chromium, through the app's own limiter; recorded samples are
// loaded first) and measured, and its spec is read:
//
//   clicks   sharp transients: short bursts of high-frequency energy
//   whistle  a narrow tone held above about 2 kHz
//   vroom    a rising pitch sweep (the "acceleration" hum), heard or in the
//            spec (a tonal voice with `to` above 1)
//   noise    wind, wave, whoosh and other noise beds louder than the main
//            sound (each layer is rendered alone and compared)
//   music    instrument voices playing a tune or chord on a toy that isn't on
//            the music shelf
//   level    the peak and loudness against the kit's range
//
// It serves the repository itself (no other server needed).
//
//   node tools/sound-lint.mjs --toy cat-statue            # one toy (or several: a,b)
//   node tools/sound-lint.mjs --shelf space               # a shelf (a category id)
//   node tools/sound-lint.mjs --changed                   # toys whose sound differs from main
//   node tools/sound-lint.mjs --all                       # every toy
//   node tools/sound-lint.mjs --spec '{"voice":"hum","to":3}'  # any spec, as JSON
//     (with --toy <id> too, it is checked as that toy's sound, for its shelf)
//   node tools/sound-lint.mjs --changed --base=origin/main --json
//
// A line per toy lists what it found: "!" marks a clear violation, "~" a
// warning worth a listen. Toys on the music shelf, the owner's exceptions
// (7e) and toys he marked "keep" in tools/sound-review.json report
// violations as warnings only. Exits 1 when any clear violation remains.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { TOYS } from "../src/toys.js";
import { TOY_SOUNDS } from "../src/toy-sounds.js";
import { specFor } from "../src/voices.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  const a = args[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true; // prettier-ignore
};

// The thresholds. A "clear violation" fails the run; a warning is listed.
// Set against the whole shelf on September 30, 2026: the toys the owner
// complained about fail, the ones he likes pass.
export const LINT = {
  // Sharp transients in one sound. Crunches and taps have them too, so they
  // fail only when the spec also uses a clicking voice (click, switch, ratchet).
  clicks: { warn: 6, fail: 8 },
  whistle: { warn: 0.12, fail: 0.25 }, // seconds a narrow tone above 1.4 kHz holds
  // A heard pitch rise (a ratio held over 0.3 s or more); a spec's tonal
  // voice gliding up (`to`) warns above 1.15 and fails from 1.5.
  vroom: { warn: 1.2, fail: 1.4, specWarn: 1.15, specFail: 1.5 },
  // A wind, wave or hiss bed's loudness over the main sound's (other noise
  // beds, such as a whoosh, only warn), and its loudness when it is the
  // whole sound.
  noise: { warn: 0.6, fail: 1, aloneWarn: 0.1, aloneFail: 0.13 },
  peak: { warn: 0.8, fail: 0.95 },
  loud: { warn: 0.2, fail: 0.3 }, // the loudest 50 ms (RMS)
};

// The owner's exceptions (7e): sounds he likes as they are.
const EXCEPTIONS = new Set(["mandelbulb", "sorting-machine", "looped-transformer", "newtons-cradle", "ocean-liner", "pyramids"]); // prettier-ignore
const MUSIC_SHELF = "music";
const NOISE_BEDS = new Set(["wind", "wave", "hiss", "whoosh", "breath", "rumble"]);
const HARSH_BEDS = new Set(["wind", "wave", "hiss"]); // the owner's "overwhelming" ones
const CLICKERS = new Set(["click", "switch", "ratchet"]);
const INSTRUMENTS = new Set(["grand", "upright", "harpsichord", "organ", "synth", "vibes", "pluck", "nylon", "harp", "sitar", "twang", "bell", "chimes", "bar", "marimba", "glass", "tine", "pad"]); // prettier-ignore
const TONAL = new Set(["hum", "drone", "tone", "engine", "theremin", "synth", "buzz", "whistle", "squeak", "pad", "shimmer", "sonar", "horn", "brass", "zap"]); // prettier-ignore

let review = {};
try {
  review =
    JSON.parse(fs.readFileSync(path.join(root, "tools/sound-review.json"), "utf8")).toys || {};
} catch {
  // No review file: no "keep" marks.
}

// ---- Which toys --------------------------------------------------------------------

function changedToys(base) {
  let old;
  try {
    const src = execSync(`git show ${base}:src/toy-sounds.js`, { cwd: root, encoding: "utf8" });
    const file = path.join(root, ".cache", `sound-lint-base-${process.pid}.mjs`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, src);
    old = import(file).then((m) => (fs.rmSync(file), m.TOY_SOUNDS));
  } catch (e) {
    throw new Error(`Can't read src/toy-sounds.js at ${base}: ${e.message}`);
  }
  return old.then(
    (prev) =>
    Object.keys(TOY_SOUNDS).filter((id) => JSON.stringify(prev[id]) !== JSON.stringify(TOY_SOUNDS[id])), // prettier-ignore
  );
}

const SOUNDS = { ...TOY_SOUNDS };
let ids = [];
if (typeof opt("spec") === "string") {
  const id = typeof opt("toy") === "string" ? opt("toy") : "spec";
  SOUNDS[id] = JSON.parse(opt("spec"));
  ids = [id];
} else if (opt("toy")) ids = String(opt("toy")).split(",");
else if (opt("shelf")) {
  const shelves = String(opt("shelf")).split(",");
  ids = TOYS.filter((t) => shelves.includes(t.category)).map((t) => t.id);
  if (!ids.length) throw new Error(`No toys on shelf "${opt("shelf")}"`);
} else if (opt("changed"))
  ids = await changedToys(typeof opt("base") === "string" ? opt("base") : "origin/main");
else if (opt("all")) ids = Object.keys(TOY_SOUNDS);
else {
  console.log(
    "Usage: node tools/sound-lint.mjs --toy <id> | --shelf <category> | --changed | --all",
  );
  process.exit(2);
}
for (const id of ids) if (!SOUNDS[id]) throw new Error(`No sound for toy "${id}"`);
if (!ids.length) {
  console.log("No toys to check.");
  process.exit(0);
}

// ---- Static checks on the spec --------------------------------------------------------

function layers(spec) {
  return [].concat(spec).filter(Boolean);
}

function specNotes(id, spec) {
  const out = [];
  const cat = TOYS.find((t) => t.id === id)?.category;
  const both = specFor(spec, true) === specFor(spec, false) ? [spec] : [specFor(spec, true), specFor(spec, false)]; // prettier-ignore
  for (const l of both.flatMap(layers)) {
    if (TONAL.has(l.voice) && (l.to ?? 1) > LINT.vroom.specWarn)
      out.push({ kind: "vroom", value: l.to, fail: l.to >= LINT.vroom.specFail, text: `${l.voice} glides up ×${l.to}` }); // prettier-ignore
    if (cat !== MUSIC_SHELF && INSTRUMENTS.has(l.voice) && l.notes) {
      const chords = String(l.notes)
        .trim()
        .split(/\s+/)
        .filter((n) => n !== "-");
      const tune = chords.length >= 3 || chords.some((c) => c.includes("+"));
      out.push({ kind: "music", value: chords.length, fail: tune, text: `${l.voice} plays "${l.notes}"` }); // prettier-ignore
    }
    if (CLICKERS.has(l.voice) && cat !== MUSIC_SHELF)
      out.push({ kind: "clicks", value: l.n ?? 1, fail: false, text: `${l.voice} voice` });
  }
  return out;
}

// ---- Render and measure -------------------------------------------------------------

const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".html": "text/html" }; // prettier-ignore
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.join(root, url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(url === "/" ? 200 : 404, { "content-type": "text/html" });
    return res.end(url === "/" ? "<!doctype html><title>lint</title>" : "");
  }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const jobs = [];
for (const id of ids) {
  const spec = SOUNDS[id];
  const toggle = typeof spec === "object" && !Array.isArray(spec) && "on" in spec;
  if (toggle) {
    jobs.push({ id, part: "on", spec: specFor(spec, true) });
    jobs.push({ id, part: "off", spec: specFor(spec, false) });
  } else jobs.push({ id, part: "", spec });
}

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage();
await page.goto(`${origin}/`);
const measured = await page.evaluate(
  async ({ jobs, noiseBeds }) => {
    const { playSpec, loadSamples, SAMPLES } = await import("/src/voices.js");
    const { masterChain } = await import("/src/sound.js");
    SAMPLES.base = "/assets/sounds/";
    const rate = 22050;
    const seconds = 6;

    async function render(spec) {
      const ctx = new OfflineAudioContext(1, rate * seconds, rate);
      await loadSamples(ctx, spec);
      playSpec(ctx, masterChain(ctx), 0.01, spec);
      return (await ctx.startRendering()).getChannelData(0);
    }

    function levels(d) {
      const W = Math.round(rate * 0.05);
      let acc = 0;
      let loud = 0;
      let peak = 0;
      for (let i = 0; i < d.length; i++) {
        acc += d[i] * d[i] - (i >= W ? d[i - W] * d[i - W] : 0);
        loud = Math.max(loud, Math.sqrt(Math.max(0, acc) / W));
        peak = Math.max(peak, Math.abs(d[i]));
      }
      return { loud, peak };
    }

    // Sharp transients: 1 ms frames of the first difference (it favors
    // highs), an onset that jumps well above the last ~10 ms and dies away
    // within ~10 ms.
    function clicks(d) {
      const F = Math.round(rate * 0.001);
      const E = [];
      for (let i = 0; i + F < d.length; i += F) {
        let e = 0;
        for (let j = i + 1; j < i + F; j++) e += (d[j] - d[j - 1]) ** 2;
        E.push(e);
      }
      const max = Math.max(...E);
      const floor = max * 0.004;
      let n = 0;
      for (let k = 12; k < E.length - 12; k++) {
        let before = 0;
        for (let j = k - 12; j < k - 1; j++) before += E[j];
        before /= 11;
        if (E[k] < floor || E[k] < 10 * before) continue;
        let top = k;
        while (top + 1 < E.length && E[top + 1] > E[top]) top++;
        let end = top;
        while (end < E.length && E[end] > E[top] * 0.2) end++;
        if (end - top <= 10) {
          n++;
          k = end + 8;
        }
      }
      return n;
    }

    function fft(re, im) {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
          [re[i], re[j]] = [re[j], re[i]];
          [im[i], im[j]] = [im[j], im[i]];
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const a = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len)
          for (let j = 0; j < len / 2; j++) {
            const wr = Math.cos(a * j);
            const wi = Math.sin(a * j);
            const xr = re[i + j + len / 2] * wr - im[i + j + len / 2] * wi;
            const xi = re[i + j + len / 2] * wi + im[i + j + len / 2] * wr;
            re[i + j + len / 2] = re[i + j] - xr;
            im[i + j + len / 2] = im[i + j] - xi;
            re[i + j] += xr;
            im[i + j] += xi;
          }
      }
    }

    // Short-time spectra: 2048-point frames, 256 apart (11.6 ms).
    function spectra(d) {
      const N = 2048;
      const hop = 256;
      const frames = [];
      const hann = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); // prettier-ignore
      for (let s = 0; s + N < d.length; s += hop) {
        const re = new Float32Array(N);
        const im = new Float32Array(N);
        let any = 0;
        for (let i = 0; i < N; i++) {
          re[i] = d[s + i] * hann[i];
          any += re[i] * re[i];
        }
        if (any < 1e-7) {
          frames.push(null);
          continue;
        }
        fft(re, im);
        const P = new Float32Array(N / 2);
        for (let i = 0; i < N / 2; i++) P[i] = re[i] * re[i] + im[i] * im[i];
        frames.push(P);
      }
      return { frames, hz: rate / N, dt: hop / rate };
    }

    // The strongest narrow peak in a band: its frequency, how far it stands
    // above the band's median, and its share of the frame's power.
    function peakIn(P, hz, lo, hi) {
      const a = Math.ceil(lo / hz);
      const b = Math.min(P.length - 2, Math.floor(hi / hz));
      let best = a;
      let total = 0;
      for (let i = 1; i < P.length; i++) total += P[i];
      for (let i = a; i <= b; i++) if (P[i] > P[best]) best = i;
      const band = Array.from(P.subarray(a, b + 1)).sort((x, y) => x - y);
      const median = band[Math.floor(band.length / 2)] || 1e-12;
      const power = P[best - 1] + P[best] + P[best + 1];
      // Parabolic interpolation for a finer frequency.
      const [l, c, r] = [P[best - 1], P[best], P[best + 1]].map((x) => Math.log(x + 1e-20));
      const shift = (l - r) / (2 * (l - 2 * c + r) || 1);
      return { f: (best + shift) * hz, tonal: P[best] / median, share: power / (total || 1), total }; // prettier-ignore
    }

    function whistle({ frames, hz, dt }) {
      const maxTotal = Math.max(...frames.map((P) => (P ? P.reduce((a, b) => a + b, 0) : 0)));
      let best = 0;
      let run = 0;
      let f0 = 0;
      let at = 0;
      for (let k = 0; k < frames.length; k++) {
        const P = frames[k];
        const p = P && peakIn(P, hz, 1400, 9500);
        const ok = p && p.tonal > 200 && p.share > 0.3 && p.total > maxTotal * 0.01;
        if (ok && run && Math.abs(p.f / f0 - 1) < 0.04) run++;
        else if (ok) {
          run = 1;
          f0 = p.f;
        } else run = 0;
        if (ok) f0 = p.f;
        if (run * dt > best) {
          best = run * dt;
          at = f0;
        }
      }
      return { seconds: best, f: at };
    }

    // A smooth upward pitch sweep of a strong, tonal partial below 2 kHz.
    function vroom({ frames, hz, dt }) {
      const maxTotal = Math.max(...frames.map((P) => (P ? P.reduce((a, b) => a + b, 0) : 0)));
      let best = { ratio: 1, seconds: 0 };
      let start = null;
      let prev = null;
      let lowest = Infinity;
      let len = 0;
      for (let k = 0; k < frames.length; k++) {
        const P = frames[k];
        const p = P && peakIn(P, hz, 50, 2000);
        const ok = p && p.tonal > 30 && p.share > 0.2 && p.total > maxTotal * 0.01;
        const smooth = ok && prev && p.f / prev > 0.985 && p.f / prev < 1.12;
        if (smooth) {
          len++;
          lowest = Math.min(lowest, p.f);
          const ratio = p.f / lowest;
          if (len * dt >= 0.3 && ratio > best.ratio) best = { ratio, seconds: len * dt, from: lowest, to: p.f }; // prettier-ignore
        } else {
          start = ok ? p.f : null;
          lowest = start ?? Infinity;
          len = 0;
        }
        prev = ok ? p.f : null;
      }
      return best;
    }

    const out = [];
    for (const job of jobs) {
      const d = await render(job.spec);
      const lv = levels(d);
      const sp = spectra(d);
      const r = {
        id: job.id,
        part: job.part,
        peak: lv.peak,
        loud: lv.loud,
        clicks: clicks(d),
        whistle: whistle(sp),
        vroom: vroom(sp),
      };
      // Noise beds against the main sound: each layer alone.
      const ls = [].concat(job.spec).filter(Boolean);
      if (ls.length > 1) {
        let bed = 0;
        let main = 0;
        let bedVoice = "";
        for (const l of ls) {
          const { loud } = levels(await render(l));
          if (noiseBeds.includes(l.voice)) {
            if (loud > bed) [bed, bedVoice] = [loud, l.voice];
          } else main = Math.max(main, loud);
        }
        if (bed && main) r.noise = { ratio: bed / main, voice: bedVoice };
        else if (bed && !main) r.noiseOnly = bedVoice;
      } else if (ls.length === 1 && noiseBeds.includes(ls[0].voice)) r.noiseOnly = ls[0].voice;
      out.push(r);
    }
    return out;
  },
  { jobs, noiseBeds: [...NOISE_BEDS] },
);
await browser.close();
server.close();

// ---- Report ---------------------------------------------------------------------

const results = [];
for (const id of ids) {
  const toy = TOYS.find((t) => t.id === id);
  const lenient =
    EXCEPTIONS.has(id) || toy?.category === MUSIC_SHELF || review[id]?.status === "keep";
  const found = [];
  const add = (kind, value, fail, text) => found.push({ kind, value, fail: fail && !lenient, text }); // prettier-ignore
  for (const n of specNotes(id, SOUNDS[id])) add(n.kind, n.value, n.fail, n.text);
  const clicker = layers(specFor(SOUNDS[id], true)).concat(layers(specFor(SOUNDS[id], false))).some((l) => CLICKERS.has(l.voice)); // prettier-ignore
  for (const m of measured.filter((m) => m.id === id)) {
    const p = m.part ? `${m.part}: ` : "";
    if (m.clicks >= LINT.clicks.warn) add("clicks", m.clicks, clicker && m.clicks >= LINT.clicks.fail, `${p}${m.clicks} sharp transients`); // prettier-ignore
    if (m.whistle.seconds >= LINT.whistle.warn)
      add("whistle", m.whistle.seconds, m.whistle.seconds >= LINT.whistle.fail, `${p}a ${Math.round(m.whistle.f)} Hz tone held ${m.whistle.seconds.toFixed(2)} s`); // prettier-ignore
    if (m.vroom.ratio >= LINT.vroom.warn)
      add("vroom", m.vroom.ratio, m.vroom.ratio >= LINT.vroom.fail, `${p}pitch rises ${Math.round(m.vroom.from)}→${Math.round(m.vroom.to)} Hz over ${m.vroom.seconds.toFixed(2)} s`); // prettier-ignore
    if (m.noise && m.noise.ratio >= LINT.noise.warn)
      add("noise", m.noise.ratio, HARSH_BEDS.has(m.noise.voice) && m.noise.ratio >= LINT.noise.fail, `${p}${m.noise.voice} at ${m.noise.ratio.toFixed(2)}× the main sound`); // prettier-ignore
    if (m.noiseOnly && m.loud >= LINT.noise.aloneWarn)
      add("noise", m.loud, HARSH_BEDS.has(m.noiseOnly) && m.loud >= LINT.noise.aloneFail, `${p}only ${m.noiseOnly} noise, at ${m.loud.toFixed(3)}`); // prettier-ignore
    if (m.peak >= LINT.peak.warn) add("level", m.peak, m.peak >= LINT.peak.fail, `${p}peak ${m.peak.toFixed(2)}`); // prettier-ignore
    if (m.loud >= LINT.loud.warn) add("level", m.loud, m.loud >= LINT.loud.fail, `${p}loudness ${m.loud.toFixed(3)}`); // prettier-ignore
  }
  const stats = measured
    .filter((m) => m.id === id)
    .map((m) => `${m.part ? m.part + " " : ""}peak ${m.peak.toFixed(2)} loud ${m.loud.toFixed(3)}`)
    .join(", ");
  results.push({ id, lenient, found, stats, measured: measured.filter((m) => m.id === id) });
}

const failing = results.filter((r) => r.found.some((f) => f.fail));
if (opt("json")) process.stdout.write(JSON.stringify(results, null, 1) + "\n");
else {
  for (const r of results) {
    const marks = r.found.map((f) => `${f.fail ? "!" : "~"} ${f.text}`).join("; ");
    console.log(`${r.id.padEnd(22)} ${marks || "ok"}${r.lenient && r.found.length ? " (exception)" : ""}  [${r.stats}]`); // prettier-ignore
  }
  console.log(`\n${results.length} toys, ${failing.length} with a clear violation${failing.length ? ": " + failing.map((r) => r.id).join(", ") : ""}`); // prettier-ignore
}
process.exit(failing.length ? 1 : 0);
