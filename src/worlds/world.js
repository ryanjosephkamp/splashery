// A running world: it builds the ground, water, sky, props, signs and the
// character from the world file, keeps the level of detail under the
// tier's budget, moves the character with collision, and tells the page
// when the character reaches a landmark. The page (main.js) owns the menus
// and cards; this module owns what is drawn.

import { Terrain, TERRAIN_LEVELS, BLADES, groundShare } from "./terrain.js";
import { buildWater, buildSky, buildOcean, WATER_LEVELS } from "./water.js";
import { bakeProp, thinOut, buildSign, gradeFoliage, PROP_TYPES, PROP_STRIDES } from "./props.js";
import { buildCharacter, JOINTS, BODY, pose, stepGait, WALK_SPEED, RUN_SPEED, CHARACTER_SPLATS } from "./character.js"; // prettier-ignore
import { Physics } from "./physics.js";
import { FollowCamera } from "./camera.js";
import { planLevels } from "./lod.js";
import { WORLD_BUDGETS } from "./tiers.js";
import { Lighting } from "./lighting.js";
import { loadHybridAssets, groundTiles, groundMaterial, groundColor, waterMaterial, waterMeshes, skyDome, skyMaterial, useHDRI, signBoard } from "./hybrid.js"; // prettier-ignore
import { loadMeshCharacter, loadHuman, loadSplatPerson, stepMeshCharacter } from "./mesh-character.js"; // prettier-ignore
import { MeshProps, MESH_PROP_TYPES } from "./mesh-props.js";
import * as pc from "../pc.js";
import { mulberry32, mixSeed } from "../noise.js";
import { rgb } from "../kit.js";

// Prop types whose leaves hybrid mode regrades (props.js, gradeFoliage).
const FOLIAGE = ["palm", "pine", "oak", "bush"];

const DEG = 180 / Math.PI;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class World {
  // mode: "splats" or "hybrid" (docs/WORLDS.md, "Rendering").
  // characterModel: "splats", "mesh", "kenney" or "auto" (mesh-character.js).
  constructor(
    view,
    def,
    tier,
    {
      reducedMotion = false,
      mode = def.render,
      shadows = true,
      characterModel = def.character.model,
      frame = null,
    } = {},
  ) {
    // prettier-ignore
    this.view = view;
    this.def = def;
    this.tier = tier;
    this.mode = mode === "hybrid" ? "hybrid" : "splats";
    this.hybrid = this.mode === "hybrid";
    this.shadows = shadows;
    // The camera frame (lighting.js): hybrid mode on high and max, or as
    // asked (?frame=0|1).
    this.useFrame = this.hybrid && (frame ?? ["high", "max"].includes(tier));
    // "auto": the realistic person in hybrid mode, the splat character in
    // splats mode.
    const cm = characterModel === "auto" ? (this.hybrid ? "mesh" : "splats") : characterModel;
    this.characterModel = ["mesh", "kenney", "splat-person"].includes(cm) ? cm : "splats";
    // Walking and running speeds (the realistic person's own are slower).
    this.speeds = { walk: WALK_SPEED, run: RUN_SPEED };
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
    // One sun, shadows, haze and the grade, in both modes.
    const budget = this.shadows ? this.budget : { ...this.budget, shadows: 0 };
    this.lighting = new Lighting(view, def, budget, this.mode);
    if (this.useFrame) this.lighting.enableFrame();
    this.skyCount = 0;
    if (this.hybrid) await this.buildModels(progress);
    else {
      // The sky, around the camera.
      const sky = view.container(buildSky(def.colors, { seed: def.seed, clouds: def.sky.clouds }));
      this.sky = view.entity("sky", sky, { layer: "sky" });
      this.skyCount = sky.splatCount;
      // The open sea beyond the chunks.
      if (def.water) {
        const ocean = view.container(buildOcean(this.terrain));
        view.entity("ocean", ocean, { pos: [0, this.terrain.water, 0] });
        this.skyCount += ocean.splatCount;
      }
      // The ground's depth and the shadow catcher.
      this.lighting.buildCatcher(this.terrain);
    }
    // Chunks of ground and water.
    const density = this.budget.density;
    for (const ch of this.terrain.chunks()) {
      const share = groundShare(this.terrain, ch);
      const wet = ch.lo < this.terrain.water + 0.04 && def.water;
      const area = ch.size * ch.size;
      // (Hybrid mode draws only the near grass as splats.)
      const counts = TERRAIN_LEVELS.map((L, k) => {
        let n = this.hybrid ? 0 : share * area * L.density * density;
        if (k === 0) n += area * BLADES * this.budget.grass * 0.6 * (ch.hi > this.terrain.water + 1 ? 1 : 0.3); // prettier-ignore
        if (wet && !this.hybrid) n += area * WATER_LEVELS[k].density * Math.sqrt(density) * waterShare(this.terrain, ch); // prettier-ignore
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
    if (this.characterModel !== "splats") await this.buildMeshCharacter();
    else this.buildCharacter();
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

  // Hybrid mode's models: the sky dome and the HDRI's light, the ground and
  // the water (hybrid.js).
  async buildModels(progress) {
    const view = this.view;
    const app = view.app;
    progress(0.03, "Painting the sky…");
    const assets = await loadHybridAssets(app);
    this.assets = assets;
    // Turn the sky so its sun sits where the world's sun is.
    const sunAz = this.def.light.sun.azimuth;
    const turn = assets.sky.sun.u - sunAz / 360;
    useHDRI(app, assets.hdr, this.hdriRotation(assets.sky.sun.u, sunAz), assets.sky.exposure || 1);
    app.scene.fog.color = new pc.Color(...assets.sky.horizon);
    this.lighting.sun.light.shadowIntensity = 1;
    const dome = new pc.Entity("sky-dome");
    dome.addComponent("render", { meshInstances: [new pc.MeshInstance(skyDome(view.device, { rows: assets.sky.domeRows, turn }), skyMaterial(assets))], castShadows: false, receiveShadows: false, layers: [view.app.scene.layers.getLayerByName("Skybox").id] }); // prettier-ignore
    app.root.addChild(dome);
    this.sky = dome;
    progress(0.04, "Laying out the ground…");
    await nextFrame();
    const mat = groundMaterial(assets, this.terrain);
    const step = this.tier === "low" ? 1 : 0.5;
    this.groundTiles = groundTiles(view.device, this.terrain, { step, above: this.terrain.water - this.def.terrain.clearDepth - 4, color: groundColor(this.terrain) }); // prettier-ignore
    for (const t of this.groundTiles) {
      const e = new pc.Entity("ground-tile");
      e.addComponent("render", { meshInstances: [new pc.MeshInstance(t.mesh, mat)], castShadows: false, receiveShadows: true, layers: [view.worldLayer.id] }); // prettier-ignore
      app.root.addChild(e);
    }
    this.groundMaterial = mat;
    if (this.def.water) {
      const wm = waterMaterial(this.def);
      for (const m of waterMeshes(view.device, this.terrain)) {
        const e = new pc.Entity("water");
        e.addComponent("render", { meshInstances: [new pc.MeshInstance(m, wm)], castShadows: false, receiveShadows: true, layers: [view.surfaceLayer.id] }); // prettier-ignore
        app.root.addChild(e);
      }
      this.waterMaterial = wm;
    }
  }

  // The skybox rotation (degrees about y) that puts the HDRI's sun, at `u`
  // across the image, at the world's sun azimuth.
  hdriRotation(u, azimuth) {
    return (u - 0.5) * 360 - azimuth + (this.def.light.hdriTurn || 0);
  }

  addItem(item) {
    this.items.push(item);
    this.itemById.set(item.id, item);
  }

  // Where every prop stands: the world file's own list, then scatter.
  placements() {
    const def = this.def;
    // Props and scatters marked for the other mode are left out.
    const here = (x) => !x.only || x.only === this.mode;
    const out = def.props.filter(here).map((p) => ({ ...p }));
    for (const s of def.scatter.filter(here)) {
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
    // Hybrid mode draws rocks, stones, driftwood and stumps as models
    // (mesh-props.js).
    const models = [];
    for (const p of list) {
      if (this.hybrid && MESH_PROP_TYPES[p.type]) {
        models.push(p);
        continue;
      }
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
        // Hybrid mode: trees and bushes in deeper greens, shaded inside.
        if (this.hybrid && FOLIAGE.includes(p.type)) gradeFoliage(baked.buf, p.seed);
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
    if (models.length) await this.buildMeshProps(models, progress);
  }

  async buildMeshProps(list, progress) {
    progress(0.76, "Setting the rocks…");
    const mp = new MeshProps(this.view.app, { shadows: this.shadows && this.budget.shadows > 0, near: this.budget.near }); // prettier-ignore
    await mp.load(new Set(list.map((p) => MESH_PROP_TYPES[p.type].kind)));
    for (const p of list) {
      const type = MESH_PROP_TYPES[p.type];
      const y = p.y ?? this.terrain.heightAt(p.at[0], p.at[1]) + p.lift;
      if (type.as === "scatter") {
        mp.addScatter(p, y, type);
        continue;
      }
      const col = mp.add(p, y, type);
      if (col && p.collider !== false) this.physics.add(col);
    }
    mp.finishScatter();
    this.meshProps = mp;
  }

  buildSigns() {
    for (const l of this.def.landmarks) {
      const y = this.terrain.heightAt(l.at[0], l.at[1]);
      const rec = { landmark: l, pos: [l.at[0], y, l.at[1]], top: y + 2.2 };
      if (l.sign !== false && this.hybrid) {
        // A model: a wooden board with the title painted on.
        const width = buildSign(l.label, { count: 1 }).width;
        const board = signBoard(this.view.device, { title: l.title, label: l.label, accent: this.def.colors.accent, width }); // prettier-ignore
        board.setLocalPosition(l.at[0], y, l.at[1]);
        board.setLocalEulerAngles(0, l.facing, 0);
        this.view.app.root.addChild(board);
        const a = (l.facing * Math.PI) / 180;
        this.physics.add({ id: `sign-${l.id}`, shape: "box", x: l.at[0], z: l.at[1], y0: y - 1, y1: y + 2.1, hx: width / 2, hz: 0.12, yaw: l.facing }); // prettier-ignore
        rec.front = [Math.sin(a), Math.cos(a)];
        rec.board = board;
      } else if (l.sign !== false) {
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
          size: 14, // letters stay whole: full detail to about 80 m
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
    // Lane Character: the character's splats per tier (CHARACTER_SPLATS).
    const parts = buildCharacter(this.def.character, { count: CHARACTER_SPLATS[this.tier] ?? CHARACTER_SPLATS.mid, seed: this.def.seed }); // prettier-ignore
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
        view.entity(`part-${j.name}`, ct, { parent: g, shadows: this.shadows });
        this.charCount += ct.splatCount;
      }
    }
    this.joints = joints;
  }

  // The lit, skinned character (mesh-character.js). In splats mode, where
  // no sky lights the models, a soft ambient light stands in for it.
  async buildMeshCharacter() {
    const look = this.def.character;
    const cm = this.characterModel;
    const count = CHARACTER_SPLATS[this.tier] ?? CHARACTER_SPLATS.mid;
    const {
      model,
      meta,
      splats = 0,
    } = cm === "mesh"
      ? await loadHuman(this.view.app, { tier: this.tier, look })
      : cm === "splat-person"
        ? await loadSplatPerson(this.view.app, this.view, { tier: this.tier, look, count })
        : await loadMeshCharacter(this.view.app);
    if (cm !== "kenney") this.speeds = { walk: meta.walkSpeed, run: meta.runSpeed };
    const root = this.view.group("character");
    root.addChild(model);
    // The first pose now (idle), not the model's rest pose. (Only once it
    // has a parent: the clips find their bones from there.)
    if (this.characterModel !== "kenney") model.anim.update(0.001);
    this.joints = { root };
    this.meshCharacter = model;
    this.charCount = splats;
    if (!this.hybrid) this.view.app.scene.ambientLight = new pc.Color(...this.def.light.hazeColor.map((v) => v * 0.55)); // prettier-ignore
  }

  spawn(at = this.def.spawn.at, facing = this.def.spawn.facing) {
    const c = this.char;
    c.pos = [at[0], this.terrain.heightAt(at[0], at[1]), at[1]];
    c.facing = (facing * Math.PI) / 180;
    c.gait = { speed: 0, phase: 0 };
    this.lastDt = 0;
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
    // (The aerial view behind the start screen looks at the whole island.)
    const t = this.def.terrain;
    const at = this.overview
      ? [t.center[0], 0, t.center[1]]
      : [(cam[0] + this.char.pos[0]) / 2, 0, (cam[2] + this.char.pos[2]) / 2];
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

  // Plans again now and builds everything the plan wants (a short pause:
  // after Enter, and after a jump across the world).
  catchUp() {
    this.plan(true);
    while (this.queue.length) this.buildQueued(8);
    this.applyPlan();
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
    // Hybrid mode: only the near grass (the ground and water are models).
    const ground = ch.ground && (!this.hybrid || lv === 0) ? this.terrain.buildGround(ch, lv, { density: this.budget.density, grass: this.budget.grass, carpet: !this.hybrid }) : null; // prettier-ignore
    const water = it.wet && !this.hybrid ? buildWater(this.terrain, ch, lv, { density: this.budget.density }) : null; // prettier-ignore
    // One group per chunk and level: its ground, and its water (whose
    // near levels ripple, see waves() in render.js).
    const n = (ground?.count || 0) + (water?.count || 0);
    it.built[lv] = { count: n };
    it.counts[lv] = n;
    if (!n) return;
    const g = this.view.group(`chunk-${ch.id}-${lv}`);
    g.setLocalPosition(ch.x0, this.terrain.water, ch.z0);
    g.enabled = false;
    if (ground?.count) this.view.entity("ground", this.view.container(ground), { parent: g, layer: "ground" }); // prettier-ignore
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
          const e = this.view.entity(`prop-${p.id}-${lv}`, it.bake.levels[lv], { pos: [p.at[0], it.y, p.at[1]], yaw: p.turn, scale: p.size, shadows: this.shadows && lv === 0 }); // prettier-ignore
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
    const out = { tier: this.tier, budget: this.budget.splats, total: 0, fixed: this.fixedCount(), chunks: 0, props: 0, levels: [0, 0, 0, 0, 0], hiddenProps: 0 }; // prettier-ignore
    out.total = out.fixed;
    out.mode = this.mode;
    // Models drawn (hybrid mode's ground tiles, water, sky and signs; splats
    // mode's ground depth and shadow catcher).
    out.models = this.view.app.root.findComponents("render").filter((r) => r.enabled && r.entity.enabled).length; // prettier-ignore
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
    if (this.meshProps) out.meshProps = this.meshProps.stats();
    return out;
  }

  // ---- Every frame ---------------------------------------------------------------------

  // input: { x, y (forward), run, amount }.
  update(dt, input) {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.stepCharacter(dt, input);
    const { walk: ws, run: rs } = this.speeds;
    const run = Math.max(0, Math.min(1, (this.char.gait.speed - ws) / (rs - ws)));
    const { pos, target } = this.overview
      ? this.overviewPose(dt)
      : this.camera.update(this.focus(), dt, run, this.time);
    this.view.setCameraPose(pos, target);
    this.lighting.update(pos);
    this.meshProps?.update(pos);
    if (this.hybrid) this.sky.setPosition(pos[0], pos[1], pos[2]);
    else this.sky.setPosition(pos[0], this.terrain.water, pos[2]);
    this.waterMaterial?.setParameter("uWdWater", [this.reducedMotion ? 0 : this.time, 0, 0, 0]);
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
      speed = (input.run ? this.speeds.run : this.speeds.walk) * Math.min(1, amt);
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
    this.lastDt = dt;
    this.placeCharacter();
    this.checkLandmarks();
  }

  placeCharacter() {
    const c = this.char;
    const j = this.joints;
    if (!j) return;
    j.root.setPosition(c.pos[0], c.pos[1], c.pos[2]);
    j.root.setEulerAngles(0, c.facing * DEG, 0);
    if (this.meshCharacter) {
      stepMeshCharacter(this.meshCharacter, c.gait.speed, this.lastDt || 0);
      return;
    }
    const p = pose(c.gait, this.time);
    // Lane Character: the hips also sway sideways (p.hips).
    const h = p.hips || [0, 0, 0];
    j.hips.setLocalPosition(h[0], BODY.hip + p.bob, h[2]);
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
    this.catchUp();
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
