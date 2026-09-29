// A running world: it builds the ground, water, sky, props, signs and the
// character from the world file, keeps the level of detail under the
// tier's budget, moves the character with collision, and tells the page
// when the character reaches a landmark. The page (main.js) owns the menus
// and cards; this module owns what is drawn.

import { Terrain, TERRAIN_LEVELS, groundShare } from "./terrain.js";
import { buildWater, buildSky, buildOcean, WATER_LEVELS } from "./water.js";
import { bakeProp, thinOut, buildSign, PROP_TYPES, PROP_STRIDES } from "./props.js";
import { buildCharacter, JOINTS, BODY, pose, stepGait, WALK_SPEED, RUN_SPEED } from "./character.js"; // prettier-ignore
import { Physics } from "./physics.js";
import { FollowCamera } from "./camera.js";
import { planLevels } from "./lod.js";
import { WORLD_BUDGETS } from "./tiers.js";
import { mulberry32, mixSeed } from "../noise.js";
import { rgb } from "../kit.js";

const DEG = 180 / Math.PI;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class World {
  constructor(view, def, tier, { reducedMotion = false } = {}) {
    this.view = view;
    this.def = def;
    this.tier = tier;
    this.budget = WORLD_BUDGETS[tier] || WORLD_BUDGETS.mid;
    this.reducedMotion = reducedMotion;
    // Landmarks stand on level ground: each flattens a small circle.
    const terrainDef = {
      ...def.terrain,
      flatten: [...def.terrain.flatten, ...def.landmarks.map((l) => ({ at: l.at, radius: 3 }))],
    };
    this.terrain = new Terrain(terrainDef, def.colors, def.seed);
    this.physics = new Physics(this.terrain);
    this.camera = new FollowCamera(this.terrain, { reducedMotion });
    this.viewBlockers = [];
    this.camera.blocked = (p) => this.viewBlocked(p);
    this.items = []; // LOD items: chunks and props
    this.itemById = new Map();
    this.props = [];
    this.signs = [];
    this.queue = [];
    this.time = 0;
    this.lastPlan = null;
    this.planAt = -1;
    this.near = null; // the landmark the character stands at
    this.onLandmark = null; // (landmark | null) => void
    this.char = {
      pos: [0, 0, 0],
      facing: 0,
      gait: { speed: 0, phase: 0 },
      blocked: null,
      moving: false,
    };
  }

  // ---- Build -----------------------------------------------------------------------

  async build(progress = () => {}) {
    const def = this.def;
    const view = this.view;
    view.setClearColor(rgb(def.colors.horizon));
    progress(0.02, "Laying out the ground…");
    // The sky, around the camera.
    const sky = view.container(buildSky(def.colors, { seed: def.seed, clouds: def.sky.clouds }));
    this.sky = view.entity("sky", sky);
    this.skyCount = sky.splatCount;
    // The open sea beyond the chunks.
    if (def.water) {
      const ocean = view.container(buildOcean(this.terrain));
      view.entity("ocean", ocean, { pos: [0, this.terrain.water, 0] });
      this.skyCount += ocean.splatCount;
    }
    // Chunks of ground and water.
    const density = this.budget.density;
    for (const ch of this.terrain.chunks()) {
      const share = groundShare(this.terrain, ch);
      const wet = ch.lo < this.terrain.water + 0.04 && def.water;
      const area = ch.size * ch.size;
      const counts = TERRAIN_LEVELS.map((L, k) => {
        let n = share * area * L.density * density;
        if (k === 0) n += area * 18 * this.budget.grass * 0.6 * (ch.hi > this.terrain.water + 1 ? 1 : 0.3); // prettier-ignore
        if (wet) n += area * WATER_LEVELS[k].density * Math.sqrt(density) * waterShare(this.terrain, ch); // prettier-ignore
        return Math.round(n);
      });
      const item = {
        id: `c${ch.id}`,
        kind: "chunk",
        chunk: ch,
        wet,
        x: ch.center[0],
        z: ch.center[2],
        radius: (ch.size / 2) * Math.SQRT2,
        counts,
        built: [],
        entities: [],
        shown: -1,
      };
      this.addItem(item);
    }
    await this.buildProps(progress);
    progress(0.8, "Painting the signs…");
    this.buildSigns();
    progress(0.86, "Making your character…");
    this.buildCharacter();
    this.spawn();
    progress(0.9, "Growing the grass…");
    // The first view: everything the plan wants, built now.
    this.plan(true);
    let i = 0;
    const total = this.queue.length || 1;
    while (this.queue.length) {
      this.buildQueued(4);
      i++;
      if (i % 2 === 0) {
        progress(0.9 + 0.1 * (1 - this.queue.length / total), "Growing the grass…");
        await nextFrame();
      }
    }
    this.applyPlan();
    progress(1, "Ready");
  }

  addItem(item) {
    this.items.push(item);
    this.itemById.set(item.id, item);
  }

  // Where every prop stands: the world file's own list, then scatter.
  placements() {
    const def = this.def;
    const out = def.props.map((p) => ({ ...p }));
    for (const s of def.scatter) {
      const r = mulberry32(mixSeed(s.seed, "scatter"));
      const half = this.terrain.half - 4;
      let placed = 0;
      for (let tries = 0; placed < s.count && tries < s.count * 60; tries++) {
        let x;
        let z;
        if (s.within) {
          const a = r() * Math.PI * 2;
          const d = Math.sqrt(r()) * s.within.radius;
          x = s.within.at[0] + Math.cos(a) * d;
          z = s.within.at[1] + Math.sin(a) * d;
        } else {
          x = (r() * 2 - 1) * half;
          z = (r() * 2 - 1) * half;
        }
        const surf = this.terrain.surfaceAt(x, z);
        if (s.on !== "any" ? surf !== s.on : surf === "seabed") continue;
        // Clear of landmarks, the spawn point and each other.
        if (def.landmarks.some((l) => Math.hypot(l.at[0] - x, l.at[1] - z) < l.radius + 2)) continue; // prettier-ignore
        if (Math.hypot(def.spawn.at[0] - x, def.spawn.at[1] - z) < 3) continue;
        if (out.some((o) => Math.hypot(o.at[0] - x, o.at[1] - z) < s.spacing * Math.max(1, (o.size + 1) / 4))) continue; // prettier-ignore
        const size = s.size[0] + r() * (s.size[1] - s.size[0]);
        out.push({
          id: `scatter-${s.type}-${placed}`,
          type: s.type,
          at: [x, z],
          lift: 0,
          size,
          turn: r() * 360,
          tilt: 0,
          seed: (s.seed + (placed % 3)) >>> 0, // three looks per scatter
          options: s.options,
          detail: 1,
          collider: null,
        });
        placed++;
      }
    }
    return out;
  }

  async buildProps(progress) {
    const list = this.placements();
    const bakes = new Map();
    let done = 0;
    const kinds = new Set(list.map((p) => `${p.type}|${p.seed}|${p.detail}|${JSON.stringify(p.options)}`)); // prettier-ignore
    for (const p of list) {
      const type = PROP_TYPES[p.type];
      if (!type) {
        console.warn(`Worlds: unknown prop type "${p.type}" (${p.id}) is left out.`);
        continue;
      }
      const key = `${p.type}|${p.seed}|${p.detail}|${JSON.stringify(p.options)}`;
      if (!bakes.has(key)) {
        progress(0.05 + 0.7 * (done / kinds.size), `Growing the ${p.type}…`);
        await nextFrame();
        const baked = await bakeProp(p.type, {
          seed: p.seed,
          options: p.options,
          count: type.count * this.budget.props * p.detail,
        });
        const levels = PROP_STRIDES.map((s) => this.view.container(thinOut(baked.buf, s)));
        bakes.set(key, { ...baked, levels, counts: levels.map((c) => c.splatCount) });
        done++;
      }
      const b = bakes.get(key);
      const y = p.y ?? this.terrain.heightAt(p.at[0], p.at[1]) + p.lift;
      const item = {
        id: `p${p.id}`,
        kind: "prop",
        prop: p,
        bake: b,
        x: p.at[0],
        z: p.at[1],
        y,
        size: p.size,
        radius: b.reach * p.size,
        counts: b.counts,
        entities: [],
        shown: -1,
      };
      this.addItem(item);
      this.props.push(item);
      // Tall props (trees) keep the camera out of their crowns.
      if (p.size > 2.5 && (p.collider === null ? b.collider : p.collider)) this.viewBlockers.push({ x: p.at[0], z: p.at[1], y0: y + p.size * 0.45, y1: y + p.size * 1.05, r: b.reach * p.size * 0.8 }); // prettier-ignore
      // Its invisible collider.
      const col = p.collider === null ? b.collider : p.collider;
      if (col) {
        const s = p.size;
        const off = col.offset || [0, 0];
        const yaw = p.turn;
        const cx = p.at[0] + off[0] * s;
        const cz = p.at[1] + off[1] * s;
        if (col.shape === "box")
          this.physics.add({ id: p.id, shape: "box", x: cx, z: cz, y0: y - 1, y1: y + col.height * s, hx: (col.size[0] * s) / 2, hz: (col.size[1] * s) / 2, yaw }); // prettier-ignore
        else if (col.shape === "sphere")
          this.physics.add({ id: p.id, shape: "sphere", x: cx, z: cz, y0: y, y1: y + col.radius * 2 * s, radius: col.radius * s }); // prettier-ignore
        else
          this.physics.add({ id: p.id, shape: "capsule", x: cx, z: cz, y0: y - 1, y1: y + col.height * s, radius: col.radius * s }); // prettier-ignore
      }
    }
    this.bakes = bakes;
  }

  buildSigns() {
    for (const l of this.def.landmarks) {
      const y = this.terrain.heightAt(l.at[0], l.at[1]);
      const rec = { landmark: l, pos: [l.at[0], y, l.at[1]], top: y + 2.2 };
      if (l.sign !== false) {
        const sign = buildSign(l.label, { seed: this.def.seed, color: this.def.colors.accent, count: Math.round(20000 * this.budget.props) }); // prettier-ignore
        // Signs have levels of detail like props (1 m tall, scaled up).
        const unit = { buf: scaleBuf(sign.buf, 1 / sign.height), foot: [0, 0, 0] };
        const levels = PROP_STRIDES.map((st) => this.view.container(thinOut(unit.buf, st)));
        const item = {
          id: `s${l.id}`,
          kind: "prop",
          prop: { id: `sign-${l.id}`, at: l.at, turn: l.facing, size: sign.height, tilt: 0 },
          bake: { levels },
          x: l.at[0],
          z: l.at[1],
          y,
          size: 6, // readable from farther than its height says
          radius: sign.width / 2,
          counts: levels.map((c) => c.splatCount),
          entities: [],
          shown: -1,
        };
        this.addItem(item);
        const a = (l.facing * Math.PI) / 180;
        this.physics.add({ id: `sign-${l.id}`, shape: "box", x: l.at[0], z: l.at[1], y0: y - 1, y1: y + 2.1, hx: sign.width / 2, hz: 0.12, yaw: l.facing }); // prettier-ignore
        rec.front = [Math.sin(a), Math.cos(a)];
      }
      this.signs.push(rec);
    }
  }

  buildCharacter() {
    const parts = buildCharacter(this.def.character, { count: Math.round(26000 * Math.min(1.2, this.budget.props + 0.25)), seed: this.def.seed }); // prettier-ignore
    const view = this.view;
    const root = view.group("character");
    const joints = { root };
    this.charCount = 0;
    for (const j of JOINTS) {
      const parent = j.parent ? joints[j.parent] : root;
      const g = view.group(`joint-${j.name}`, parent);
      g.setLocalPosition(j.at[0], j.at[1], j.at[2]);
      joints[j.name] = g;
      if (parts[j.name]) {
        const ct = view.container(parts[j.name]);
        view.entity(`part-${j.name}`, ct, { parent: g });
        this.charCount += ct.splatCount;
      }
    }
    this.joints = joints;
  }

  spawn(at = this.def.spawn.at, facing = this.def.spawn.facing) {
    const c = this.char;
    c.pos = [at[0], this.terrain.heightAt(at[0], at[1]), at[1]];
    c.facing = (facing * Math.PI) / 180;
    c.gait = { speed: 0, phase: 0 };
    this.camera.snap(this.focus(), c.facing);
    this.placeCharacter();
  }

  focus() {
    const p = this.char.pos;
    return [p[0], p[1] + 1.45, p[2]];
  }

  // Is a point inside a prop (its collider, or a tree's crown), for the
  // camera? Props are upright cylinders here, a little larger than they are.
  viewBlocked(p) {
    for (const c of this.physics.near(p[0], p[2])) {
      if (p[1] < c.y0 || p[1] > c.y1 + 0.3) continue;
      const r = (c.shape === "box" ? Math.max(c.hx, c.hz) : c.radius) + 0.3;
      if (Math.hypot(p[0] - c.x, p[2] - c.z) < r) return true;
    }
    for (const b of this.viewBlockers) {
      if (p[1] < b.y0 || p[1] > b.y1) continue;
      if (Math.hypot(p[0] - b.x, p[2] - b.z) < b.r) return true;
    }
    return false;
  }

  // ---- Level of detail ---------------------------------------------------------------

  plan(force = false) {
    const cam = this.camera.pos || this.char.pos;
    const moved = this.lastPlan ? Math.hypot(cam[0] - this.lastPlan[0], cam[2] - this.lastPlan[2]) : Infinity; // prettier-ignore
    if (!force && moved < 2.5 && this.time - this.planAt < 2) return;
    // The character's surroundings matter more than the camera's.
    const at = [(cam[0] + this.char.pos[0]) / 2, 0, (cam[2] + this.char.pos[2]) / 2];
    const budget = this.budget.splats - this.fixedCount();
    this.levels = planLevels(this.items, at, this.budget, budget);
    this.lastPlan = cam.slice();
    this.planAt = this.time;
    for (const it of this.items) {
      const lv = this.levels.levels.get(it.id);
      if (it.kind === "chunk" && lv >= 0 && !it.built[lv]) {
        if (!this.queue.includes(it)) this.queue.push(it);
      }
    }
    // Nearest first.
    this.queue.sort((a, b) => Math.hypot(a.x - at[0], a.z - at[2]) - Math.hypot(b.x - at[0], b.z - at[2])); // prettier-ignore
  }

  // Splats that are always drawn: the sky and the character.
  fixedCount() {
    return (this.skyCount || 0) + (this.charCount || 0);
  }

  buildQueued(max = 1) {
    for (let n = 0; n < max && this.queue.length; n++) {
      const it = this.queue.shift();
      const lv = this.levels.levels.get(it.id);
      if (lv < 0 || it.built[lv]) continue;
      this.buildChunk(it, lv);
    }
  }

  buildChunk(it, lv) {
    const ch = it.chunk;
    const ground = ch.ground ? this.terrain.buildGround(ch, lv, { density: this.budget.density, grass: this.budget.grass }) : null; // prettier-ignore
    const water = it.wet
      ? buildWater(this.terrain, ch, lv, { density: this.budget.density })
      : null;
    // One group per chunk and level: its ground, and its water (whose
    // near levels ripple, see waves() in render.js).
    const n = (ground?.count || 0) + (water?.count || 0);
    it.built[lv] = { count: n };
    it.counts[lv] = n;
    if (!n) return;
    const g = this.view.group(`chunk-${ch.id}-${lv}`);
    g.setLocalPosition(ch.x0, this.terrain.water, ch.z0);
    g.enabled = false;
    if (ground?.count) this.view.entity("ground", this.view.container(ground), { parent: g });
    if (water?.count) {
      const e = this.view.entity("water", this.view.container(water), { parent: g });
      if (lv <= 1 && !this.reducedMotion) {
        this.view.waves(e, [ch.x0, ch.z0]);
        (this.waterEntities ||= []).push(e);
      }
    }
    it.entities[lv] = g;
  }

  applyPlan() {
    if (!this.levels) return;
    for (const it of this.items) {
      const lv = this.levels.levels.get(it.id);
      if (it.kind === "chunk") {
        // Keep the old level on show until the new one is built.
        const show = lv >= 0 && it.built[lv] ? lv : it.shown;
        if (show === it.shown && (show < 0 || it.entities[show]?.enabled)) continue;
        it.entities.forEach((e, k) => e && (e.enabled = k === show));
        it.shown = show;
      } else {
        if (lv === it.shown) continue;
        if (lv >= 0 && !it.entities[lv]) {
          const p = it.prop;
          const e = this.view.entity(`prop-${p.id}-${lv}`, it.bake.levels[lv], { pos: [p.at[0], it.y, p.at[1]], yaw: p.turn, scale: p.size }); // prettier-ignore
          if (p.tilt) e.setLocalEulerAngles(p.tilt, p.turn, 0);
          it.entities[lv] = e;
        }
        it.entities.forEach((e, k) => e && (e.enabled = k === lv));
        it.shown = lv;
      }
    }
  }

  // Splats drawn now, by kind and level (for tests and the budget check).
  stats() {
    const out = { tier: this.tier, budget: this.budget.splats, total: 0, fixed: this.fixedCount(), chunks: 0, props: 0, levels: [0, 0, 0, 0], hiddenProps: 0 }; // prettier-ignore
    out.total = out.fixed;
    for (const it of this.items) {
      if (it.shown < 0) {
        if (it.kind === "prop") out.hiddenProps++;
        continue;
      }
      const n = it.kind === "chunk" ? it.built[it.shown]?.count || 0 : it.counts[it.shown];
      out.total += n;
      out[it.kind === "chunk" ? "chunks" : "props"] += n;
      out.levels[it.shown] += n;
    }
    const f = this.view.frameMs.slice(-60).sort((a, b) => a - b);
    out.frameMs = f.length ? f[Math.floor(f.length / 2)] : 0;
    return out;
  }

  // ---- Every frame ---------------------------------------------------------------------

  // input: { x, y (forward), run, amount }.
  update(dt, input) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.stepCharacter(dt, input);
    const run = Math.max(0, Math.min(1, (this.char.gait.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED))); // prettier-ignore
    const { pos, target } = this.overview
      ? this.overviewPose(dt)
      : this.camera.update(this.focus(), dt, run, this.time);
    this.view.setCameraPose(pos, target);
    this.sky.setPosition(pos[0], this.terrain.water, pos[2]);
    this.plan();
    this.buildQueued(1);
    this.applyPlan();
    for (const e of this.waterEntities || []) if (e.parent.enabled) e.gsplat.setParameter("uWdWave", [this.time, 1, 0, 0]); // prettier-ignore
  }

  // The wide view behind the start screen: the whole island from the air,
  // turning slowly (still under reduced motion).
  overviewPose(dt) {
    const t = this.def.terrain;
    if (!this.reducedMotion) this.overviewYaw = (this.overviewYaw ?? 0.6) + dt * 0.04;
    const yaw = this.overviewYaw ?? 0.6;
    const R = Math.max(t.radius[0], t.radius[1]);
    const c = [t.center[0], this.terrain.water + 2, t.center[1]];
    const d = R * 1.75;
    const pos = [c[0] - Math.sin(yaw) * d, c[1] + d * 0.55, c[2] - Math.cos(yaw) * d];
    // Aimed past the island's near shore, so it shows above the start box.
    const k = this.view.canvas.width < this.view.canvas.height ? 0.55 : 0.3;
    const target = [c[0] - Math.sin(yaw) * R * k, c[1] - R * k * 0.9, c[2] - Math.cos(yaw) * R * k];
    return { pos, target };
  }

  stepCharacter(dt, input) {
    const c = this.char;
    const amt = input?.amount || 0;
    let speed = 0;
    if (amt > 0.05 && dt > 0) {
      const { forward, right } = this.camera.axes();
      const dx = forward[0] * input.y + right[0] * input.x;
      const dz = forward[1] * input.y + right[1] * input.x;
      const l = Math.hypot(dx, dz) || 1;
      speed = (input.run ? RUN_SPEED : WALK_SPEED) * Math.min(1, amt);
      const want = Math.atan2(dx / l, dz / l);
      c.facing = turnToward(c.facing, want, dt * 10);
      const res = this.physics.move(c.pos, (dx / l) * speed * dt, (dz / l) * speed * dt);
      const moved = Math.hypot(res.pos[0] - c.pos[0], res.pos[2] - c.pos[2]);
      c.pos = res.pos;
      c.blocked = res.blocked;
      // Against a wall the legs slow down.
      speed = Math.min(speed, moved / dt);
    } else {
      c.blocked = null;
    }
    c.moving = speed > 0.1;
    // A frame with no time (a paused clock) keeps the gait as it is.
    if (dt > 0) stepGait(c.gait, speed, dt);
    this.placeCharacter();
    this.checkLandmarks();
  }

  placeCharacter() {
    const c = this.char;
    const j = this.joints;
    if (!j) return;
    j.root.setPosition(c.pos[0], c.pos[1], c.pos[2]);
    j.root.setEulerAngles(0, c.facing * DEG, 0);
    const p = pose(c.gait, this.time);
    j.hips.setLocalPosition(0, BODY.hip + p.bob, 0);
    for (const name in p.joints) {
      const a = p.joints[name];
      j[name].setLocalEulerAngles(a[0], a[1], a[2]);
    }
  }

  checkLandmarks() {
    const c = this.char;
    let best = null;
    let bd = Infinity;
    for (const s of this.signs) {
      const l = s.landmark;
      const d = Math.hypot(c.pos[0] - l.at[0], c.pos[2] - l.at[1]);
      const reach = s.landmark === this.near ? l.radius + 1.5 : l.radius;
      if (d < reach && d < bd) {
        best = l;
        bd = d;
      }
    }
    if (best !== this.near) {
      this.near = best;
      this.onLandmark?.(best);
    }
  }

  // The landmark whose sign shows nearest a canvas point (CSS pixels), if
  // any is within `slop` pixels of its sign.
  landmarkAt(x, y, slop = 60) {
    let best = null;
    let bd = slop;
    const cam = this.camera.pos;
    for (const s of this.signs) {
      const l = s.landmark;
      if (Math.hypot(cam[0] - l.at[0], cam[2] - l.at[1]) > 70) continue;
      for (const h of [0.6, 1.3, 1.9]) {
        const [sx, sy, front] = this.view.toScreen([l.at[0], s.pos[1] + h, l.at[1]]);
        if (!front) continue;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
    }
    return best;
  }

  // Puts the character in front of a landmark's sign, facing it.
  goTo(l) {
    const s = this.signs.find((x) => x.landmark === l);
    const a = ((l.facing || 0) * Math.PI) / 180;
    const d = Math.min(2.4, l.radius * 0.7);
    const at = [l.at[0] + Math.sin(a) * d, l.at[1] + Math.cos(a) * d];
    this.spawn(at, l.facing + 180);
    this.near = null;
    if (s) this.checkLandmarks();
    this.plan(true);
  }
}

function turnToward(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

// The share of a chunk with water on it.
function waterShare(terrain, ch) {
  let n = 0;
  for (let b = 0; b < 5; b++)
    for (let a = 0; a < 5; a++)
      if (terrain.heightAt(ch.x0 + ((a + 0.5) / 5) * ch.size, ch.z0 + ((b + 0.5) / 5) * ch.size) < terrain.water + 0.04) n++; // prettier-ignore
  return n / 25;
}

function scaleBuf(buf, s) {
  for (let i = 0; i < buf.count * 3; i++) {
    buf.pos[i] *= s;
    buf.scale[i] *= s;
  }
  return buf;
}

function merge(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = new a.constructor(a.count + b.count);
  for (const src of [a, b]) {
    const n = src.count;
    out.pos.set(src.pos.subarray(0, n * 3), out.count * 3);
    out.scale.set(src.scale.subarray(0, n * 3), out.count * 3);
    out.rot.set(src.rot.subarray(0, n * 4), out.count * 4);
    out.color.set(src.color.subarray(0, n * 4), out.count * 4);
    out.count += n;
  }
  return out;
}
