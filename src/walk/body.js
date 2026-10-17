export const WALK_LIMITS = Object.freeze({ step: 0.25, slope: 35, speed: 1.35, gravity: 9.81 });

export class CapsuleBody {
  constructor(grid, spawn) {
    this.grid = grid;
    this.pos = grid.spawn(spawn);
    this.spawn = this.pos.slice();
    this.radius = 0.28;
    this.height = 1.7;
    this.vy = 0;
    this.blocked = null;
    this.accumulator = 0;
    this.distance = 0;
  }
  update(dt, input = {}) {
    this.accumulator += Math.max(0, Math.min(dt, 0.1));
    while (this.accumulator >= 1 / 120 - 1e-10) {
      this.step(1 / 120, input);
      this.accumulator -= 1 / 120;
    }
    return this.pos;
  }
  step(dt, { x = 0, z = 0 } = {}) {
    const len = Math.max(1, Math.hypot(x, z));
    const dx = (x / len) * WALK_LIMITS.speed * dt,
      dz = (z / len) * WALK_LIMITS.speed * dt;
    this.blocked = null;
    const before = this.pos.slice();
    if (dx || dz) {
      // Axis retries retain the tangential component when meeting a wall.
      if (!this.tryMove(dx, dz)) {
        if (Math.abs(dx) > Math.abs(dz)) {
          this.tryMove(dx, 0);
          this.tryMove(0, dz);
        } else {
          this.tryMove(0, dz);
          this.tryMove(dx, 0);
        }
      }
    }
    this.distance += Math.hypot(this.pos[0] - before[0], this.pos[2] - before[2]);
    const s = this.grid.safeSupport(this.pos[0], this.pos[2], this.pos[1] + 0.03, this.radius, 1);
    if (s) {
      this.vy -= WALK_LIMITS.gravity * dt;
      this.pos[1] = Math.max(s.height, this.pos[1] + this.vy * dt);
      if (this.pos[1] <= s.height + 0.001) this.vy = 0;
    }
  }
  tryMove(dx, dz) {
    if (!dx && !dz) return false;
    const [x, y, z] = this.pos;
    const s = this.grid.safeSupport(
      x + dx,
      z + dz,
      y + WALK_LIMITS.step + 0.001,
      this.radius,
      0.75,
    );
    if (!s) {
      this.blocked = "edge";
      return false;
    }
    if (s.slope > WALK_LIMITS.slope) {
      this.blocked = "slope";
      return false;
    }
    const h = Math.max(y, s.height);
    if (
      s.height - y > WALK_LIMITS.step + 0.001 ||
      !this.grid.clear([x + dx, h, z + dz], this.radius, this.height)
    ) {
      this.blocked = "wall";
      return false;
    }
    this.pos = [x + dx, h, z + dz];
    return true;
  }
  reset() {
    this.pos = this.spawn.slice();
    this.vy = 0;
    this.accumulator = 0;
    this.blocked = null;
  }
}
