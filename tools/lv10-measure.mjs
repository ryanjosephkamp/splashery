#!/usr/bin/env node
// Lane Live r10: how closely Sound in a box and the Chladni plate follow a
// song, measured in Node with the toys' own physics and the Song landscape's
// own analysis (song-analysis.js), on the test song (tools/lv10-song.mjs).
// Each toy frame (30 a second) takes the song's frame at that moment, its
// strongest pitch and loudness, the modes they ring, the toy's smoothing of
// the modes' strengths, and one step of the beads or the sand, as the toys
// do it in the page.
//
//   node tools/lv10-measure.mjs [--root=<a checkout>] [--shape=cube|flask] [--json]
//
// --root measures another checkout (main, for the "before" numbers).

import { songSamples, songSeconds } from "./lv10-song.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const root = opt("root", new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
const shape = opt("shape", "cube");
const C = await import(`${root}/src/packs/chladni-3d.js`);
const S = await import(`${root}/src/packs/chladni-sand.js`);
const ST = await import(`${root}/src/packs/studio.js`);
const SA = await import(`${root}/src/packs/song-analysis.js`);
const { bands } = await import(`${root}/src/packs/studio-audio.js`);

const RATE = 44100;
const samples = songSamples(RATE);
const nFrames = SA.frameCount(samples.length / RATE);
const A = SA.makeAnalyser(RATE);
const feat = SA.makeFeatures(nFrames);
SA.analyzeFrames(A, samples, 0, nFrames, feat);
feat.done.fill(1);
const BAND_HZ = bands(12).centers;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// The toys' strongest(): the voiced pitch, else the loudest band.
function strongest(i) {
  if (i < 0 || i >= feat.n) return null;
  const nfi = SA.FIELDS.length;
  const db = feat.feat[i * nfi + SA.F.rms];
  let hz = feat.feat[i * nfi + SA.F.f0];
  if (!(hz > 0)) {
    let top = -Infinity;
    for (let b = 0; b < feat.nf; b++) {
      const v = feat.bands[i * feat.nf + b];
      if (v > top) {
        top = v;
        hz = BAND_HZ[b];
      }
    }
  }
  return hz > 0 ? { hz, db } : null;
}

// The toys' followDrive / follow: strengths eased toward what the sound asks.
function follower(tau = 0.08) {
  const amps = new Map();
  return (want, dt) => {
    const k = 1 - Math.exp(-dt / tau);
    const seen = new Set();
    for (const w of want) {
      seen.add(w.mode.id);
      const was = amps.get(w.mode.id) ?? { mode: w.mode, a: 0 };
      was.a += (w.a - was.a) * k;
      amps.set(w.mode.id, was);
    }
    for (const [key, v] of amps) {
      if (seen.has(key)) continue;
      v.a -= v.a * k;
      if (v.a < 1e-3) amps.delete(key);
    }
    return [...amps.values()];
  };
}

let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FPS = 30;
const dt = 1 / FPS;
const secs = songSeconds();

function run(kind) {
  const follow = follower(C.LIVE?.follow ?? 0.08);
  const lad = kind === "box" ? C.ladder(shape) : null;
  const box = kind === "box" ? new C.Beads(6000, C.cellMode(shape === "cube" ? "cube-012" : "flask-0-2"), rand) : null; // prettier-ignore
  const sand = kind === "plate" ? new S.Sand(6000, rand) : null;
  const chosen = ST.modeById("2-3+");
  const log = [];
  let prevPos = box ? Float32Array.from(box.P) : Float32Array.from([...sand.X, ...sand.Y]);
  for (let f = 0; f * dt < secs; f++) {
    const t = f * dt;
    const s = strongest(Math.floor(t / SA.HOP));
    let want = [];
    if (s) {
      if (kind === "box") {
        const loud = clamp01((s.db + 54) / 30);
        want = loud > 0 ? C.cellDrive(s.hz, loud, shape).modes : [];
      } else {
        const hz = ST.foldHz(s.hz);
        const loud = clamp01((s.db + 54) / 30);
        const seen = new Set();
        for (const m of ST.MODES) {
          const key = m.n * m.n + m.m * m.m;
          if (seen.has(key)) continue;
          seen.add(key);
          const pick = chosen.n === m.n && chosen.m === m.m ? chosen : ST.MODES.find((q) => q.n === m.n && q.m === m.m && q.s > 0) || m; // prettier-ignore
          const x = (1200 * Math.log2(hz / ST.singFreq(pick))) / 150;
          const a = loud / (1 + x * x);
          if (a > 0.02) want.push({ mode: pick, a });
        }
      }
    }
    const mix = follow(want, dt);
    if (kind === "box") box.step(dt, mix, 0, C.LIVE?.secs);
    else
      sand.step(
        dt,
        mix.map((v) => ({ n: v.mode.n, m: v.mode.m, s: v.mode.s, a: v.a })),
      );
    const lead = mix.reduce((b, d) => (!b || d.a > b.a ? d : b), null);
    // The beads' mean speed this frame, in cell (or plate) widths a second.
    const pos = box ? box.P : null;
    let sp = 0;
    if (box) {
      for (let i = 0; i < pos.length; i++) sp += Math.abs(pos[i] - prevPos[i]);
      sp = sp / (pos.length / 3) / 2 / dt; // (sum of |dx|+|dy|+|dz|, an L1 speed)
      prevPos = Float32Array.from(pos);
    } else {
      const cur = Float32Array.from([...sand.X, ...sand.Y]);
      for (let i = 0; i < cur.length; i++) sp += Math.abs(cur[i] - prevPos[i]);
      sp = sp / (cur.length / 2) / dt;
      prevPos = cur;
    }
    const settled = lead && lead.a > 0.05 ? (box ? box.settled(lead.mode) : sand.settled(lead.mode)) : null; // prettier-ignore
    log.push({
      t,
      lead: lead && lead.a > 0.05 ? lead.mode.id : null,
      a: lead?.a ?? 0,
      sp,
      settled,
    });
  }
  return log;
}

function summarize(log) {
  // How often the leading mode (the figure the sound asks for) changes.
  const runs = [];
  let cur = null;
  for (const r of log) {
    if (r.lead !== cur?.id) {
      if (cur) runs.push(cur);
      cur = { id: r.lead, t0: r.t, t1: r.t, rows: [] };
    }
    cur.t1 = r.t + dt;
    cur.rows.push(r);
  }
  if (cur) runs.push(cur);
  const held = runs.filter((r) => r.id);
  const changes = held.length;
  const dur = held.map((r) => r.t1 - r.t0).sort((a, b) => a - b);
  // For each figure held 0.4 s or more: how far the beads got toward it (the
  // settled measure's rise from the change to the end), and how long until
  // it rose by 0.2.
  const rises = [];
  const reach = [];
  const ends = [];
  for (const r of held) {
    if (r.t1 - r.t0 < 0.4) continue;
    const s0 = r.rows[0].settled ?? 0;
    const s1 = r.rows[r.rows.length - 1].settled ?? 0;
    rises.push(s1 - s0);
    ends.push(s1);
    const hit = r.rows.find((q) => (q.settled ?? 0) >= s0 + 0.2);
    reach.push(hit ? hit.t - r.t0 : Infinity);
  }
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const playing = log.filter((r) => r.lead);
  return {
    seconds: +secs.toFixed(1),
    figureChangesPerSecond: +(changes / secs).toFixed(2),
    medianHoldSeconds: +med(dur).toFixed(2),
    figuresHeld04: rises.length,
    medianRiseOfSettled: +med(rises).toFixed(2),
    reached02: `${reach.filter((x) => x < Infinity).length} of ${reach.length}`,
    medianTimeToRise02: med(reach) === Infinity ? "never" : +med(reach).toFixed(2),
    medianSettledAtEnd: +med(ends).toFixed(2),
    formed05: `${ends.filter((x) => x >= 0.5).length} of ${ends.length}`,
    meanSettledOnCurrent: +mean(playing.map((r) => r.settled ?? 0)).toFixed(2),
    meanSpeed: +mean(playing.map((r) => r.sp)).toFixed(3),
    p90Speed: +playing.map((r) => r.sp).sort((a, b) => a - b)[Math.floor(playing.length * 0.9)].toFixed(3), // prettier-ignore
    quietLastThird: +mean(playing.slice(Math.floor(playing.length * 0.66)).map((r) => r.sp)).toFixed(3), // prettier-ignore
  };
}

// The step response: settled beads, then one new mode at a loudness; when
// the settled measure on the new mode passes 0.5 and 0.8 (single runs).
function stepResponse(kind, loud) {
  const out = [];
  const pairs = kind === "box" ? [["cube-012", "cube-111"], ["cube-110", "cube-122"], ["cube-111", "cube-112"], ["cube-010", "cube-012"]] : [["1-3-", "2-3-"], ["2-3-", "1-2+"], ["1-3+", "2-3+"]]; // prettier-ignore
  for (const [a, b] of pairs) {
    const follow = follower(C.LIVE?.follow ?? 0.08);
    let mA, mB, st;
    if (kind === "box") {
      const lad = C.ladder("cube");
      mA = lad.find((m) => m.id === a);
      mB = lad.find((m) => m.id === b);
      st = new C.Beads(6000, mA, rand);
      for (let i = 0; i < 6 * FPS; i++) st.step(dt, [{ mode: mA, a: 1 }]);
    } else {
      mA = ST.modeById(a);
      mB = ST.modeById(b);
      st = new S.Sand(6000, rand);
      for (let i = 0; i < 6 * FPS; i++) st.step(dt, [{ n: mA.n, m: mA.m, s: mA.s, a: 1 }]);
    }
    // The note, as the toy's mapping turns a loudness into a mode strength.
    const aB = kind === "box" ? C.cellDrive(C.heardFreq(mB), loud, "cube").modes.find((d) => d.mode.id === b).a : loud; // prettier-ignore
    let t50 = null;
    let t80 = null;
    let first = null;
    const P0 = kind === "box" ? Float32Array.from(st.P) : null;
    for (let i = 1; i <= 5 * FPS; i++) {
      const mix = follow([{ mode: mB, a: aB }], dt);
      if (kind === "box") st.step(dt, mix, 0, C.LIVE?.secs);
      else
        st.step(
          dt,
          mix.map((v) => ({ n: v.mode.n, m: v.mode.m, s: v.mode.s, a: v.a })),
        );
      const s = st.settled(mB);
      if (t50 === null && s > 0.5) t50 = i * dt;
      if (t80 === null && s > 0.8) t80 = i * dt;
      if (kind === "box" && first === null) {
        // Visible motion: a tenth of the beads moved 1% of the cell (about
        // 2 px at phone size).
        let k = 0;
        for (let j = 0; j < st.n; j++) if (Math.hypot(st.P[j * 3] - P0[j * 3], st.P[j * 3 + 1] - P0[j * 3 + 1], st.P[j * 3 + 2] - P0[j * 3 + 2]) > 0.02) k++; // prettier-ignore
        if (k > st.n * 0.1) first = i * dt;
      }
    }
    out.push({ from: a, to: b, loud, end: +st.settled(mB).toFixed(2), t50: t50 && +t50.toFixed(2), t80: t80 && +t80.toFixed(2), ...(kind === "box" ? { visible: first && +first.toFixed(2) } : {}) }); // prettier-ignore
  }
  return out;
}

const result = {
  box: summarize(run("box")),
  plate: summarize(run("plate")),
  stepBox: [...stepResponse("box", 1), ...stepResponse("box", 0.6)],
  stepPlate: [...stepResponse("plate", 1), ...stepResponse("plate", 0.6)],
};
if (args.includes("--json")) console.log(JSON.stringify(result, null, 1));
else {
  console.log(`root ${root}, shape ${shape}`);
  console.log("box  ", JSON.stringify(result.box));
  console.log("plate", JSON.stringify(result.plate));
  for (const r of result.stepBox) console.log("step box  ", JSON.stringify(r));
  for (const r of result.stepPlate) console.log("step plate", JSON.stringify(r));
}
