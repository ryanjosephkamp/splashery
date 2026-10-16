// Sources opened October 11, 2026:
// https://sengpielaudio.com/calculator-RT60.htm (500 Hz table and Sabine)
// https://sengpielaudio.com/calculator-roommodes.htm (rigid rectangular modes)
// https://reuk.github.io/wayverb/image_source.html (specular paths and 1/r pressure)
// Physical coordinates here are [length, height, width], in meters.
export const SOUND_SPEED = 343; // m/s, air at 20 °C
export const STEP = 1 / 120; // seconds of display time
export const RAY_SLOW = 80;
export const DURATION = 3.8;
export const CLAP_AT = 0.16;
export const MATERIALS = {
  concrete: { label: "Concrete (painted)", alpha: 0.06, color: "#a9b3bd" },
  wood: { label: "Wood", alpha: 0.1, color: "#cda270" },
  curtain: { label: "Curtain (heavy)", alpha: 0.55, color: "#9f6779" },
  carpet: { label: "Carpet on concrete", alpha: 0.14, color: "#68847b" },
};
export const SURFACES = ["left", "right", "floor", "ceiling", "back", "front"];

export function roomMath(o = {}) {
  const bounded = (key, value, lo, hi) =>
    Math.max(lo, Math.min(hi, Number.isFinite(+o[key]) ? +o[key] : value));
  const length = bounded("length", 10, 4, 12);
  const width = bounded("width", 8, 3, 10);
  const height = bounded("height", 3, 2, 5);
  const dimensions = [length, height, width];
  const areas = [
    width * height,
    width * height,
    length * width,
    length * width,
    length * height,
    length * height,
  ];
  const materials = SURFACES.map((key) => MATERIALS[o[key]] || MATERIALS.concrete);
  const volume = length * width * height;
  const absorption = areas.reduce((a, area, i) => a + area * materials[i].alpha, 0);
  const rt60 = (0.161 * volume) / absorption;
  const source = [length * 0.36, Math.min(1.4, height * 0.45), width * 0.4];
  const listener = [length * 0.68, source[1], width * 0.65];
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  const directLength = distance(source, listener);
  const paths = [{ points: [source, listener], length: directLength, alpha: 0, wall: "direct" }];
  // Image source mirrored across each of the six planes. The line from
  // image to listener intersects that plane at the specular bounce point.
  SURFACES.forEach((wall, i) => {
    const axis = Math.floor(i / 2);
    const plane = i % 2 ? dimensions[axis] : 0;
    const image = [...source];
    image[axis] = 2 * plane - source[axis];
    const u = (plane - image[axis]) / (listener[axis] - image[axis]);
    const bounce = image.map((v, j) => v + u * (listener[j] - v));
    paths.push({
      points: [source, bounce, listener],
      length: distance(image, listener),
      alpha: materials[i].alpha,
      wall,
    });
  });
  for (const p of paths) p.delay = p.length / SOUND_SPEED;
  const modes = [];
  // Orders through 3 suffice for the three lowest modes: a fourth-order
  // mode always has at least three lower axial modes on its own axis.
  for (let nx = 0; nx <= 3; nx++)
    for (let ny = 0; ny <= 3; ny++)
      for (let nz = 0; nz <= 3; nz++) {
        if (!(nx || ny || nz)) continue;
        modes.push({
          orders: [nx, ny, nz],
          hz: (SOUND_SPEED / 2) * Math.hypot(nx / length, ny / width, nz / height),
        });
      }
  modes.sort((a, b) => a.hz - b.hz);
  return {
    length,
    width,
    height,
    areas,
    materials,
    volume,
    absorption,
    rt60,
    source,
    listener,
    paths,
    modes: modes.slice(0, 3),
  };
}

export function pressure(mode, room, p) {
  const [nx, ny, nz] = mode.orders;
  return (
    Math.cos((Math.PI * nx * p[0]) / room.length) *
    Math.cos((Math.PI * ny * p[2]) / room.width) *
    Math.cos((Math.PI * nz * p[1]) / room.height)
  );
}

export function alongPath(path, traveled) {
  const points = path.points;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const d = Math.hypot(...a.map((v, j) => v - b[j]));
    if (traveled <= d || i === points.length - 1) {
      const u = Math.max(0, Math.min(1, traveled / d));
      return a.map((v, j) => v + (b[j] - v) * u);
    }
    traveled -= d;
  }
}

export function newSimulation() {
  return { time: 0, distance: 0, envelope: 1 };
}

// Fixed-step constant-velocity transport (exact for ds/dt = c/80), and
// the exact exponential update for dp/dt = -ln(1000) p / RT60. No unstable
// Euler oscillator or variable-step physics. Display time is slowed 80×.
export function advance(sim, target, rt60) {
  const due = Math.min(DURATION, Math.max(0, target));
  while (sim.time + STEP <= due + 1e-9) {
    sim.time += STEP;
    if (sim.time > CLAP_AT) {
      const h = Math.min(STEP, sim.time - CLAP_AT);
      sim.distance += (SOUND_SPEED * h) / RAY_SLOW;
      sim.envelope *= Math.exp((-Math.log(1000) * h) / (RAY_SLOW * rt60));
    }
  }
  return sim;
}
