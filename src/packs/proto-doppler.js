import { evenBox, evenTube } from "./even.js";
import { TOY_SOUNDS } from "../toy-sounds.js";
import {
  AIR_SPEED,
  SOURCE_HZ,
  PASS_SECONDS,
  EFFECT_SECONDS,
  METERS_PER_UNIT,
  HALF_PATH,
  createSimulation,
  advanceSimulation,
  receivedFrequencies,
  machAngle,
} from "./proto-doppler/physics.js";

import { boardClip } from "./proto-doppler/clip.js";

const PATH_X = -0.2;
let lastAudio = null;

function stopAudio(data) {
  if (!data?.audio) return;
  const { oscillators, gain, ctx } = data.audio;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
  oscillators.forEach((o) => {
    try {
      o.stop(ctx.currentTime + 0.06);
    } catch {
      /* Already stopped. */
    }
  });
  data.audio = null;
}

function soundFrame(data, sound, frequencies, active) {
  if (!active || !sound?.enabled) {
    stopAudio(data);
    return;
  }
  if (!data.audio && frequencies.length) {
    stopAudio(lastAudio);
    const ctx = sound.audio();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(sound.master);
    let ended = 0;
    const oscillators = [0, 1].map(() => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.connect(gain);
      o.onended = () => {
        o.disconnect();
        if (++ended === 2) gain.disconnect();
      };
      o.start();
      // Switching toys stops drive; this also bounds the sound's lifetime.
      o.stop(ctx.currentTime + Math.max(0.1, PASS_SECONDS - data.sim.elapsed + 0.1));
      return o;
    });
    data.audio = { ctx, gain, oscillators };
    lastAudio = data;
  }
  if (!data.audio) return;
  const { ctx, gain, oscillators } = data.audio;
  // In subsonic mode both oscillators share the same frequency; Mach mode mixes two branches.
  const tones = frequencies.filter((f) => Number.isFinite(f) && f < 20000);
  oscillators.forEach((o, i) =>
    o.frequency.setTargetAtTime(tones[i] ?? tones[0] ?? SOURCE_HZ, ctx.currentTime, 0.015),
  );
  gain.gain.setTargetAtTime(tones.length ? TOY_SOUNDS.doppler.vol / 2 : 0, ctx.currentTime, 0.015);
}

function line(k, points, radius, color, extra = {}) {
  k.add(
    evenTube(
      k,
      (t) => {
        const s = t * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(s));
        return points[i].map((v, j) => v + (points[i + 1][j] - v) * (s - i));
      },
      radius,
    ),
    { color, even: true, jitter: 0, opacity: 1, size: 1.25, ...extra },
  );
}

export const RECIPES = {
  doppler: {
    alive: true,
    kernel: "sharp",
    density: 0.24, // Capped at 14,000 splats on every tier, including phones.
    gpuField: (o, fit) => boardClip(fit),
    turntable: false,
    tiltLock: true,
    options: [
      {
        key: "speed",
        label: "Speed (m/s; excess in Mach mode)",
        type: "slider",
        min: 17.15,
        max: 308.7,
        step: 17.15,
        default: 34.3,
      },
      { key: "mach", label: "Go past Mach 1", type: "switch", default: false },
    ],
    controls: [{ key: "pass", label: "One pass", type: "pulse", ease: EFFECT_SECONDS }],
    action: { key: "pass", label: "One pass", quiet: ["pass"], at: () => ({ key: "pass" }) },
    drive(t, c, out, info) {
      if (typeof window !== "undefined" && window.innerWidth < 760)
        out.body = { offset: [0, -0.4, 0] };
      const data = info.data;
      if (!data) return;
      const active = c.pass > 0.0005;
      const elapsed = active ? (1 - c.pass) * EFFECT_SECONDS : 0;
      if (!active || elapsed + 1e-7 < data.sim.elapsed) {
        data.sim = createSimulation(data.options);
        stopAudio(data);
      }
      const sim = advanceSimulation(data.sim, elapsed);
      const passing = active && elapsed < PASS_SECONDS;
      let y = active ? sim.y / METERS_PER_UNIT : -HALF_PATH / METERS_PER_UNIT;
      let z = 0.17;
      // After the pass, the solid source returns behind the board through a
      // service lane. It emerges at its starting point before the pulse ends.
      if (active && elapsed >= PASS_SECONDS) {
        const reset = (elapsed - PASS_SECONDS) / (EFFECT_SECONDS - PASS_SECONDS);
        if (reset < 0.18) z -= (0.55 * reset) / 0.18;
        else if (reset < 0.82) {
          z = -0.38;
          y = 1.15 - (2.3 * (reset - 0.18)) / 0.64;
        } else {
          y = -1.15;
          z = -0.38 + (0.55 * (reset - 0.82)) / 0.18;
        }
      }
      out.parts.source = { offset: [0, y + 1.15, z - 0.17] };
      sim.waves.forEach((w, i) => {
        const radius = (AIR_SPEED * (sim.elapsed * sim.timeScale - w.at)) / METERS_PER_UNIT;
        out.parts[`wave${i}`] = {
          offset: [PATH_X, w.y / METERS_PER_UNIT, 0],
          scale: radius,
          visible: active && radius > 0.04 ? 1 : 0,
        };
      });
      for (let i = sim.waves.length; i < 12; i++) out.parts[`wave${i}`] = { visible: 0 };
      const angle = machAngle(sim.speed);
      for (const [name, sign] of [
        ["coneLeft", -1],
        ["coneRight", 1],
      ]) {
        out.parts[name] = {
          offset: [PATH_X, y, 0],
          angle: sign * (angle ?? 0),
          scale: 6.5,
          visible: passing && angle ? 1 : 0,
        };
      }
      // Re-sort rigid pieces periodically where they stand, especially behind the board.
      const sort = Math.floor(elapsed * 8);
      out.resortPose = sort !== data.sort;
      data.sort = sort;
      const frequencies = receivedFrequencies(passing ? sim.y : -HALF_PATH, sim.speed);
      soundFrame(data, info.sound, passing ? frequencies : [], passing && info.tap?.key === "pass");
      const heard = frequencies.length
        ? frequencies
            .map((f) => (f > 9999 ? "shock" : frequencies.length > 1 ? f.toFixed(0) : f.toFixed(1)))
            .join(" / ") + " Hz"
        : "No wave yet";
      out.legend = {
        items: [
          { text: `${SOURCE_HZ} Hz • air ${AIR_SPEED} m/s` },
          { text: `${sim.speed.toFixed(1)} m/s • Mach ${(sim.speed / AIR_SPEED).toFixed(2)}` },
          { text: frequencies.length > 1 ? `Hz: ${heard.replace(" Hz", "")}` : `Heard: ${heard}` },
          { text: angle ? `Cone: ${((angle * 180) / Math.PI).toFixed(1)}°` : "Tap for one pass" },
        ],
      };
    },
    build(k, o) {
      k.count = Math.min(k.count, 14000);
      stopAudio(lastAudio);
      k.data = { options: { ...o }, sim: createSimulation(o), sort: -1 };
      const solid = { even: true, jitter: 0, opacity: 1, size: 0.9, pattern: false };
      // A vertical demonstration board uses the phone's available height.
      k.cloud({ share: 0.28 }, (_, j, n) => {
        const nx = Math.round(Math.sqrt((n * 2.45) / 3.05));
        const ny = Math.ceil(n / nx);
        return {
          p: [
            -1.225 + (((j % nx) + 0.5) * 2.45) / nx,
            -1.525 + ((Math.floor(j / nx) + 0.5) * 3.05) / ny,
            0,
          ],
          scales: [(2.45 / nx) * 0.62, (3.05 / ny) * 0.62, 0.012],
          color: "#172b40",
          opacity: 1,
          pattern: false,
        };
      });
      line(
        k,
        [
          [PATH_X, -1.25, 0.09],
          [PATH_X, 1.25, 0.09],
        ],
        0.014,
        "#61798b",
      );
      line(
        k,
        [
          [PATH_X - 0.08, 1.15, 0.09],
          [PATH_X, 1.28, 0.09],
          [PATH_X + 0.08, 1.15, 0.09],
        ],
        0.018,
        "#c5d2de",
      );
      // The listener's measurement point is 0.5 m beside the path. The large
      // headphone symbol is a diagram marker, linked to that point.
      line(
        k,
        [
          [PATH_X + 0.005, 0, 0.13],
          [0.34, 0, 0.13],
        ],
        0.015,
        "#ffd277",
      );
      k.add(k.sphere(0.045), {
        ...solid,
        pos: [PATH_X + 0.005, 0, 0.17],
        color: "#ffd277",
        weight: 2,
      });
      line(
        k,
        [
          [0.32, -0.09, 0.15],
          [0.32, 0.12, 0.15],
          [0.4, 0.24, 0.15],
          [0.59, 0.24, 0.15],
          [0.68, 0.12, 0.15],
          [0.68, -0.09, 0.15],
        ],
        0.04,
        "#ffd277",
      );
      for (const x of [0.32, 0.68])
        k.add(k.ellipsoid(0.065, 0.12, 0.065), {
          ...solid,
          pos: [x, -0.04, 0.18],
          color: "#ffd277",
          weight: 2,
        });
      const source = k.part("source", { pivot: [PATH_X, -1.15, 0.17] });
      k.add(evenBox(0.3, 0.3, 0.16), {
        ...solid,
        pos: [PATH_X, -1.15, 0.17],
        color: "#ec7047",
        part: source,
        weight: 3,
      });
      k.add(k.ellipsoid(0.12, 0.12, 0.035), {
        ...solid,
        pos: [PATH_X, -1.15, 0.28],
        color: "#253f54",
        part: source,
        weight: 3,
      });
      k.add(k.ellipsoid(0.055, 0.055, 0.04), {
        ...solid,
        pos: [PATH_X, -1.15, 0.31],
        color: "#ffa67c",
        part: source,
        weight: 3,
      });
      // Twelve independent wavefronts. Each stays centered at its emission
      // location; expansion moves only that wave, never the source or listener.
      for (let i = 0; i < 12; i++) {
        const part = k.part(`wave${i}`, { pivot: [0, 0, 0.115] });
        k.cloud({ share: 0.035 }, (_, j, n) => {
          const a = (2 * Math.PI * j) / n;
          return {
            p: [Math.cos(a), Math.sin(a), 0.115],
            scales: [0.016, 0.016, 0.006],
            color: "#79dce8",
            opacity: 1,
            part,
            pattern: false,
          };
        });
      }
      // Build the cone edges small inside the resting bounds, then grow and
      // turn each rigid edge to the true Mach angle during the pass.
      for (const name of ["coneLeft", "coneRight"]) {
        const part = k.part(name, { axis: [0, 0, 1], pivot: [0, 0, 0.14] });
        k.cloud({ share: 0.025 }, (_, j, n) => ({
          p: [0, (-0.2 * j) / (n - 1), 0.14],
          scales: [0.003, 0.003, 0.0015],
          color: "#ffb666",
          opacity: 1,
          part,
          pattern: false,
        }));
      }
    },
  },
};
