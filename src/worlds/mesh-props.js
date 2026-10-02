// Model props for hybrid mode (docs/WORLDS.md, "Model props"): scanned
// rocks, stones, a shell, driftwood and a stump from Poly Haven (CC0), built
// by tools/wd-props.py into assets/worlds/props/<kind>.glb. Each variant has
// three levels of detail (nodes v<variant>_lod<level>), 1 m tall (or long)
// with its foot at the origin.
//
// - Big things (boulders, driftwood, stumps, and the pebble heaps, made of
//   stones) are one entity each, switching level by distance.
// - Small things scattered by the hundred (beach stones and shells) are
//   drawn instanced: one draw per variant, at their middle level.
//
// In hybrid mode the world file's "boulder" and "pebbles" props become
// models; "stone", "shell", "driftwood" and "stump" exist only as models.

import * as pc from "../pc.js";
import { mulberry32, mixSeed } from "../noise.js";

const BASE = new URL("../../assets/worlds/props/", import.meta.url);

// Prop type: the model kind it draws, and how ("single", "heap" or "scatter").
export const MESH_PROP_TYPES = {
  boulder: { kind: "boulder", as: "single", collider: "capsule", shadows: true },
  pebbles: { kind: "stone", as: "heap", collider: "capsule", shadows: true },
  stone: { kind: "stone", as: "scatter", collider: false, shadows: false },
  shell: { kind: "shell", as: "scatter", collider: false, shadows: false },
  driftwood: { kind: "driftwood", as: "single", collider: "box", shadows: true },
  stump: { kind: "stump", as: "single", collider: "capsule", shadows: true },
};

// Distances (meters, times the tier's near distance over 12) where a model
// drops to its next level; bigger props keep detail further.
export const MESH_LOD = [14, 40];

export function lodFor(distance, size, near = 12) {
  const k = (near / 12) * Math.max(1, Math.sqrt(size));
  return distance < MESH_LOD[0] * k ? 0 : distance < MESH_LOD[1] * k ? 1 : 2;
}

export class MeshProps {
  constructor(app, { shadows = true, near = 12 } = {}) {
    this.app = app;
    this.shadows = shadows;
    this.near = near;
    this.items = [];
    this.scatter = new Map(); // "kind|variant" -> list of matrices
    this.meta = null;
    this.res = {};
    this.root = new pc.Entity("mesh-props");
    app.root.addChild(this.root);
    this.lastLevels = [0, 0, 0];
  }

  async load(kinds) {
    this.meta = await fetch(new URL("props.json", BASE)).then((r) => r.json());
    await Promise.all(
      [...kinds].map(
        (k) =>
          new Promise((resolve, reject) =>
            this.app.assets.loadFromUrl(new URL(`${k}.glb`, BASE).href, "container", (err, a) => {
              if (err) return reject(new Error(err));
              this.res[k] = a.resource;
              resolve();
            }),
          ),
      ),
    );
    for (const res of Object.values(this.res))
      for (const m of res.materials || []) {
        const mat = m.resource || m;
        if (mat && "useFog" in mat) {
          mat.useFog = true;
          mat.update();
        }
      }
  }

  variants(kind) {
    return this.meta.kinds[kind].variants;
  }

  // One model at one level: an entity with its render component.
  instance(kind, v, level) {
    const e = this.res[kind].instantiateRenderEntity({ castShadows: false, receiveShadows: true });
    // Keep only the node for this variant and level.
    const want = `v${v}_lod${level}`;
    let found = null;
    for (const r of e.findComponents("render")) if (r.entity.name === want) found = r.entity;
    if (!found) throw new Error(`Worlds: ${kind}.glb has no ${want}.`);
    found.remove();
    e.destroy();
    found.setLocalPosition(0, 0, 0);
    return found;
  }

  // A prop placed by the world: returns its collider (or null).
  add(p, y, type) {
    const vs = this.variants(type.kind);
    const r = mulberry32(mixSeed(p.seed, `mesh-${p.id}`));
    const s = p.size;
    const holder = new pc.Entity(`mprop-${p.id}`);
    holder.setLocalPosition(p.at[0], y, p.at[1]);
    holder.setLocalEulerAngles(p.tilt || 0, p.turn, 0);
    this.root.addChild(holder);
    const pieces = [];
    if (type.as === "heap") {
      // A heap of stones: a few, leaning on each other.
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r();
        const d = i === 0 ? 0 : 0.18 + r() * 0.12;
        pieces.push({ v: Math.floor(r() * vs.length), at: [Math.cos(a) * d, Math.sin(a) * d], size: (i === 0 ? 0.42 : 0.22 + r() * 0.16), turn: r() * 360, tilt: (r() - 0.5) * 30 }); // prettier-ignore
      }
    } else pieces.push({ v: Math.floor(r() * vs.length), at: [0, 0], size: 1, turn: 0, tilt: 0 });
    const levels = [];
    for (let lv = 0; lv < 3; lv++) {
      const g = new pc.Entity(`lod${lv}`);
      for (const pc_ of pieces) {
        const m = this.instance(type.kind, pc_.v, lv);
        m.setLocalPosition(pc_.at[0], 0, pc_.at[1]);
        m.setLocalEulerAngles(pc_.tilt, pc_.turn, 0);
        m.setLocalScale(pc_.size, pc_.size, pc_.size);
        for (const rc of m.findComponents("render"))
          rc.castShadows = type.shadows && this.shadows && lv < 2;
        g.addChild(m);
      }
      g.enabled = false;
      holder.addChild(g);
      levels.push(g);
    }
    holder.setLocalScale(s, s, s);
    const item = {
      id: p.id,
      type: p.type,
      x: p.at[0],
      z: p.at[1],
      size: s,
      levels,
      shown: -1,
      holder,
    };
    this.items.push(item);
    // Its invisible collider, from the model's measured size.
    const dims = vs[pieces[0].v].size; // [x, height, depth]
    if (!type.collider) return null;
    if (type.collider === "box") {
      return { id: p.id, shape: "box", x: p.at[0], z: p.at[1], y0: y - 1, y1: y + dims[1] * s, hx: (dims[0] * s) / 2, hz: (dims[2] * s) / 2, yaw: p.turn }; // prettier-ignore
    }
    const rad = type.as === "heap" ? 0.4 * s : Math.min(dims[0], dims[2]) * 0.42 * s;
    return { id: p.id, shape: "capsule", x: p.at[0], z: p.at[1], y0: y - 1, y1: y + dims[1] * s * (type.as === "heap" ? 0.5 : 1), radius: rad }; // prettier-ignore
  }

  // A small scattered thing: drawn later, instanced.
  addScatter(p, y, type, tiltTo) {
    const vs = this.variants(type.kind);
    const r = mulberry32(mixSeed(p.seed, `scatter-${p.id}`));
    const v = Math.floor(r() * vs.length);
    const key = `${type.kind}|${v}`;
    if (!this.scatter.has(key)) this.scatter.set(key, []);
    const m = new pc.Mat4();
    const q = new pc.Quat().setFromEulerAngles((r() - 0.5) * 20 + (tiltTo?.[0] || 0), p.turn, (r() - 0.5) * 20 + (tiltTo?.[1] || 0)); // prettier-ignore
    // Half sunk in the sand.
    const h = vs[v].size[1] * p.size;
    m.setTRS(new pc.Vec3(p.at[0], y - h * 0.3, p.at[1]), q, new pc.Vec3(p.size, p.size, p.size));
    this.scatter.get(key).push(m);
  }

  // Builds the instanced draws for everything scattered.
  finishScatter() {
    const device = this.app.graphicsDevice;
    for (const [key, mats] of this.scatter) {
      const [kind, v] = key.split("|");
      const e = this.instance(kind, Number(v), 1);
      const data = new Float32Array(mats.length * 16);
      mats.forEach((m, i) => data.set(m.data, i * 16));
      const vb = new pc.VertexBuffer(device, pc.VertexFormat.getDefaultInstancingFormat(device), mats.length, { data }); // prettier-ignore
      for (const rc of e.findComponents("render"))
        for (const mi of rc.meshInstances) {
          mi.setInstancing(vb);
          // One bounding box around them all is fine: they are all near the
          // beach; it isn't culled by pieces.
          mi.cull = false;
        }
      e.name = `mscatter-${kind}`;
      this.root.addChild(e);
    }
  }

  // Each frame: the level each prop shows, by its distance to the camera.
  update(cam) {
    const counts = [0, 0, 0];
    for (const it of this.items) {
      const d = Math.hypot(it.x - cam[0], it.z - cam[2]);
      const lv = lodFor(d, it.size, this.near);
      counts[lv]++;
      if (lv === it.shown) continue;
      if (it.shown >= 0) it.levels[it.shown].enabled = false;
      it.levels[lv].enabled = true;
      it.shown = lv;
    }
    this.lastLevels = counts;
  }

  stats() {
    let scattered = 0;
    for (const m of this.scatter.values()) scattered += m.length;
    return { props: this.items.length, levels: this.lastLevels.slice(), scattered };
  }
}
