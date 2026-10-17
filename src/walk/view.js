import { WorldView } from "../worlds/render.js";
import { JOINTS, BODY, pose, stepGait } from "../worlds/character.js";
import { SplatBuffer } from "../generators.js";

export class WalkView {
  static async create(canvas, profile) {
    const prefer = new URLSearchParams(location.search).get("renderer") || "auto";
    const v = new WalkView(await WorldView.create(canvas, { prefer }), profile);
    return v;
  }
  constructor(view, profile) {
    this.world = view;
    this.profile = profile;
    this.camera = view.camera;
    this.entities = [];
    this.resources = [];
    this.frameMs = [];
    // Keep the phone's full-resolution controls while spending fewer pixels on
    // the splat layer. This is a render budget, independent of collision detail.
    this.pixelRatio = profile === "low" ? 0.8 : 1;
    this.autoResolution = true;
    this.resolutionFrames = 0;
    view.setPixelRatio(this.pixelRatio);
    view.setClearColor([0.72, 0.81, 0.82]);
    this.camera.camera.nearClip = 0.06;
    this.camera.camera.farClip = 150;
    this.camera.camera.fov = 70;
    this.gait = { phase: 0, speed: 0 };
    this.time = 0;
    view.setKernel("sharp");
  }
  get app() {
    return this.world.app;
  }
  clear() {
    for (const e of this.entities) e.destroy();
    for (const r of this.resources) r.destroy();
    this.entities = [];
    this.resources = [];
    this.chunks = [];
    this.joints = null;
  }
  entity(name, buffer, opts) {
    const ct = this.world.container(buffer);
    this.resources.push(ct);
    const entity = this.world.entity(name, ct, opts);
    return entity;
  }
  setPlace(result, grid) {
    this.clear();
    this.chunks = result.chunks.map((chunk, i) => {
      const full = this.entity(`walk-${i}`, chunk.buffer);
      const half = new SplatBuffer(Math.ceil(chunk.buffer.count / 2));
      for (let j = 0; j < chunk.buffer.count; j += 2) {
        const b = chunk.buffer;
        half.push(
          Array.from(b.pos.subarray(j * 3, j * 3 + 3)),
          Array.from(b.scale.subarray(j * 3, j * 3 + 3), (v) => v * 1.4),
          Array.from(b.rot.subarray(j * 4, j * 4 + 4)),
          Array.from(b.color.subarray(j * 4, j * 4 + 4)),
        );
      }
      const low = this.entity(`walk-${i}-far`, half);
      low.enabled = false;
      this.entities.push(full, low);
      return { center: chunk.center, full, low, count: chunk.buffer.count, lowCount: half.count };
    });
    this.edge = this.makeEdge(grid);
    this.entities.push(this.edge);
  }
  makeEdge(grid) {
    const b = new SplatBuffer(12000),
      c = grid.cell;
    const [nx, , nz] = grid.dims;
    for (let z = 1; z < nz - 1; z += 2)
      for (let x = 1; x < nx - 1; x += 2) {
        const px = grid.min[0] + (x + 0.5) * c,
          pz = grid.min[2] + (z + 0.5) * c;
        const s = grid.support(px, pz, 0.3, 0.6);
        if (!s) continue;
        let edge = false;
        for (const [dx, dz] of [
          [0.24, 0],
          [-0.24, 0],
          [0, 0.24],
          [0, -0.24],
        ])
          if (!grid.support(px + dx, pz + dz, s.height + 0.26, 0.6)) edge = true;
        if (edge)
          for (const h of [0.025, 0.12, 0.22])
            b.push(
              [px, s.height + h, pz],
              [0.14, 0.08, 0.14],
              [0, 0, 0, 1],
              [0.96, 0.65, 0.28, h < 0.1 ? 0.4 : 0.12],
            );
      }
    return this.entity("capture-edge", b);
  }
  async buildCharacter() {
    if (this.joints) return;
    if (!this.characterParts) {
      if (!this.characterJob) {
        const worker = new Worker(new URL("./character-worker.js", import.meta.url), {
          type: "module",
        });
        this.characterWorker = worker;
        this.characterJob = new Promise((resolve, reject) => {
          this.characterReject = reject;
          worker.onmessage = ({ data }) =>
            data.error ? reject(new Error(data.error)) : resolve(data.parts);
          worker.onerror = (e) =>
            reject(new Error(e.message || "Could not prepare the character."));
          worker.postMessage({ count: this.profile === "low" ? 7500 : 14000 });
        })
          .then((parts) => {
            this.characterParts = parts;
          })
          .finally(() => {
            worker.terminate();
            this.characterWorker = null;
            this.characterReject = null;
            this.characterJob = null;
          });
      }
      await this.characterJob;
    }
    if (this.dead || this.joints) return;
    const parts = this.characterParts;
    const root = this.world.group("walk-character");
    root.enabled = false;
    this.entities.push(root);
    const joints = { root };
    for (const j of JOINTS) {
      const g = this.world.group(j.name, j.parent ? joints[j.parent] : root);
      g.setLocalPosition(...j.at);
      joints[j.name] = g;
      if (parts[j.name]) this.entity(`walk-character-${j.name}`, parts[j.name], { parent: g });
    }
    this.joints = joints;
  }
  update(walk, dt) {
    const { body, yaw, pitch, thirdPerson, grid } = walk;
    const pos = body.pos,
      cp = Math.cos(pitch);
    const forward = [Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp];
    const eye = [pos[0], pos[1] + 1.58, pos[2]];
    let camera = eye;
    if (thirdPerson && !this.joints)
      this.buildCharacter().catch(() => {
        walk.thirdPerson = false;
      });
    if (thirdPerson && this.joints) {
      this.joints.root.enabled = true;
      const focus = [pos[0], pos[1] + 1.25, pos[2]];
      let distance = 0;
      // Keep the camera in front of walls, including at corners. No sway/bob.
      for (let d = 0.1; d <= 2.7; d += 0.1) {
        const at = [
          focus[0] - forward[0] * d,
          focus[1] - forward[1] * d + d * 0.12,
          focus[2] - forward[2] * d,
        ];
        if (!grid.clear([at[0], at[1] - 0.1, at[2]], 0.12, 0.24)) break;
        distance = d;
      }
      camera = [
        focus[0] - forward[0] * distance,
        focus[1] - forward[1] * distance + distance * 0.12,
        focus[2] - forward[2] * distance,
      ];
      this.joints.root.setPosition(...pos);
      this.joints.root.setEulerAngles(0, (walk.facing * 180) / Math.PI, 0);
      stepGait(this.gait, walk.speed, dt);
      this.time += dt;
      const p = pose(this.gait, this.time);
      this.joints.hips.setLocalPosition(0, BODY.hip + p.bob, 0);
      for (const [name, angles] of Object.entries(p.joints))
        this.joints[name].setLocalEulerAngles(...angles);
      this.world.setCameraPose(camera, focus);
    } else {
      if (this.joints) this.joints.root.enabled = false;
      this.world.setCameraPose(
        camera,
        eye.map((v, a) => v + forward[a]),
      );
    }
    let shown = 0;
    for (const c of this.chunks || []) {
      const dx = c.center[0] - camera[0],
        dz = c.center[2] - camera[2],
        distance = Math.hypot(dx, dz);
      const front =
        distance < 3.6 ||
        (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / Math.max(distance, 0.1) > -0.2;
      const low = distance > 7;
      c.full.enabled = front && !low;
      c.low.enabled = front && low;
      if (front) shown += low ? c.lowCount : c.count;
    }
    this.shown = shown;
    if (this.autoResolution && ++this.resolutionFrames >= 18) {
      this.resolutionFrames = 0;
      const times = this.world.frameMs.slice(-16).sort((a, b) => a - b);
      const ms = times[Math.floor(times.length / 2)];
      const minimum = this.profile === "low" ? 0.35 : 0.65;
      if (ms > 32 && this.pixelRatio > minimum) {
        this.pixelRatio = Math.max(
          minimum,
          Math.min(this.pixelRatio - 0.05, this.pixelRatio * Math.sqrt(26 / ms) * 0.94),
        );
        this.world.setPixelRatio(this.pixelRatio);
        this.world.frameMs.length = 0;
      }
    }
  }
  ray(x, y) {
    const cc = this.camera.camera;
    const near = cc.screenToWorld(x, y, 0.1),
      far = cc.screenToWorld(x, y, 100);
    const dir = far.clone().sub(near).normalize();
    return { origin: [near.x, near.y, near.z], dir: [dir.x, dir.y, dir.z] };
  }
  destroy() {
    this.dead = true;
    this.characterReject?.(new DOMException("Walking view closed.", "AbortError"));
    this.characterWorker?.terminate();
    this.characterParts = null;
    this.clear();
    this.world.destroy();
  }
}
