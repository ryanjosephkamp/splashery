// Ideal, externally meshing spur gears. Geometry is in modules; the model
// uses a 2 mm module. Time is seconds, angles are radians, and speeds are rpm.
// KHK: https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html
// https://khkgears.net/new/gear_knowledge/gear_technical_reference/involute_gear_profile.html
export const TAU = 2 * Math.PI;
export const PRESSURE = (25 * Math.PI) / 180;
export const STEP = 1 / 120;
export const RUN_SECONDS = 4;
export const inv = (a) => Math.tan(a) - a;

export function dimensions(teeth) {
  const pitch = teeth / 2;
  return { pitch, base: pitch * Math.cos(PRESSURE), tip: pitch + 1, root: pitch - 1.25 };
}

export function speedRatios(teeth) {
  return teeth.map((n, i) => ((i % 2 ? -1 : 1) * teeth[0]) / n);
}

// Tooth half-width at radius r. Below the base circle the root extension
// is radial. 25° permits the 12-tooth input without undercut (2/sin²α < 12).
export function halfTooth(teeth, r) {
  const { base } = dimensions(teeth);
  const a = Math.acos(Math.min(1, base / r));
  return Math.PI / (2 * teeth) + inv(PRESSURE) - inv(a);
}

export function inGear(teeth, x, y) {
  const r = Math.hypot(x, y);
  const { root, tip } = dimensions(teeth);
  if (r <= root) return true;
  if (r > tip) return false;
  const pitch = TAU / teeth;
  const a = Math.atan2(y, x);
  const local = a - Math.round(a / pitch) * pitch;
  return Math.abs(local) <= halfTooth(teeth, r);
}

export function outline(teeth) {
  const { root, base, tip } = dimensions(teeth);
  const pts = [];
  const point = (r, a) => pts.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let tooth = 0; tooth < teeth; tooth++) {
    const a = (tooth * TAU) / teeth;
    point(root, a - halfTooth(teeth, root));
    for (let j = 0; j <= 10; j++) {
      const r = Math.max(root, base) + ((tip - Math.max(root, base)) * j) / 10;
      point(r, a - halfTooth(teeth, r));
    }
    for (let j = 1; j <= 4; j++) point(tip, a + halfTooth(teeth, tip) * (j / 2 - 1));
    for (let j = 9; j >= 0; j--) {
      const r = Math.max(root, base) + ((tip - Math.max(root, base)) * j) / 10;
      point(r, a + halfTooth(teeth, r));
    }
    const h = halfTooth(teeth, root);
    point(root, a + h);
    for (let j = 1; j < 5; j++) point(root, a + h + ((TAU / teeth - 2 * h) * j) / 5);
  }
  return pts;
}

// The axle centers follow a straight line, preventing unintended contact
// between nonadjacent gears for every allowed combination of tooth counts.
export function layout(teeth) {
  const beta = -Math.PI / 2 + 0.24;
  let distance = 0;
  const gears = teeth.map((n, i) => {
    if (i) distance += (teeth[i - 1] + n) / 2;
    return { teeth: n, x: distance * Math.cos(beta), y: distance * Math.sin(beta), phase: 0 };
  });
  gears[0].phase = beta;
  for (let i = 1; i < gears.length; i++) {
    const previous = gears[i - 1];
    // N₁(φ₁−β) + N₂(φ₂−β−π) = π mod 2π: tooth faces a gap.
    gears[i].phase =
      beta + Math.PI + (Math.PI - previous.teeth * (previous.phase - beta)) / gears[i].teeth;
  }
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const g of gears) {
    const r = dimensions(g.teeth).tip;
    bounds[0] = Math.min(bounds[0], g.x - r);
    bounds[1] = Math.min(bounds[1], g.y - r);
    bounds[2] = Math.max(bounds[2], g.x + r);
    bounds[3] = Math.max(bounds[3], g.y + r);
  }
  const cx = (bounds[0] + bounds[2]) / 2;
  const cy = (bounds[1] + bounds[3]) / 2;
  for (const g of gears) {
    g.x -= cx;
    g.y -= cy;
  }
  return gears;
}

export class GearTrain {
  constructor(teeth) {
    this.teeth = teeth;
    this.gears = layout(teeth);
    this.ratios = speedRatios(teeth);
    this.angle = 0;
    this.rpm = 0;
    this.remaining = 0;
    this.accumulator = 0;
    this.last = null;
    this.tapN = 0;
    this.dragging = false;
  }

  spin() {
    this.remaining = Math.round(RUN_SECONDS / STEP);
    this.accumulator = 0;
    this.rpm = 60;
    this.dragging = false;
  }

  advance(dt) {
    if (!this.remaining || this.dragging) return;
    // Prescribed-speed integration is exact at each fixed step; only the
    // input is integrated, so the gear constraint never accumulates drift.
    // Ignore long inactive gaps, like the site's own motion clock.
    this.accumulator += Math.min(0.25, Math.max(0, dt));
    while (this.accumulator + 1e-10 >= STEP && this.remaining > 0) {
      this.angle += TAU * STEP;
      this.accumulator -= STEP;
      this.remaining--;
    }
    if (!this.remaining) {
      this.rpm = 0;
      this.accumulator = 0;
    }
  }

  angles() {
    return this.ratios.map((r) => r * this.angle);
  }
  speeds() {
    return this.ratios.map((r) => r * this.rpm);
  }
}
