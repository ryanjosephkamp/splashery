// The page tools/chr-view.mjs and tools/chr-clip.mjs load: the Worlds
// character on its own (lane Character), on a patch of ground, with hooks
// to build figures, pose them and move the camera. `module` is the
// character module's URL; `old` another one (the character on main) for
// before-and-after.

export const PAGE = (module, old = module) => `<!doctype html><html><head><style>
html,body{margin:0;height:100%;background:#cfe2f3}canvas{width:100%;height:100%;display:block}
</style></head><body><canvas id="c"></canvas><script type="module">
import { WorldView } from "/src/worlds/render.js";
import { SplatBuffer } from "/src/generators.js";
import * as C from "${module}";
import * as OLD from "${old}";
const view = await WorldView.create(document.getElementById("c"), { prefer: "webgl2" });
view.setClearColor([0.8, 0.87, 0.93]);
const figs = [];
const DEF = { shirt: "#e0533d", trousers: "#35507a", skin: "#c98e6a", hair: "#3a2a1e", shoes: "#2e2e33" };
window.__chr = {
  view, C, figs,
  build(look, count, { seed = 7, old = false } = {}) {
    const M = old ? OLD : C;
    const parts = M.buildCharacter(Object.assign({}, DEF, look), { count, seed });
    const root = view.group("character");
    const joints = { root };
    let n = 0;
    for (const j of M.JOINTS) {
      const g = view.group("joint-" + j.name, j.parent ? joints[j.parent] : root);
      g.setLocalPosition(j.at[0], j.at[1], j.at[2]);
      joints[j.name] = g;
      if (parts[j.name]) { const ct = view.container(parts[j.name]); view.entity("part-" + j.name, ct, { parent: g }); n += ct.splatCount; }
    }
    figs.push({ M, joints, n, gait: { speed: 0, phase: 0 } });
    window.__chr.joints = figs[0].joints;
    return n;
  },
  // state "gait" poses a figure by its own gait (see advance()).
  pose(state, t, at = [0, 0, 0], facing = 0, i = 0) {
    const { M, joints } = figs[i];
    const p = M.pose(state === "gait" ? figs[i].gait : state, t);
    joints.root.setPosition(at[0], at[1], at[2]);
    joints.root.setEulerAngles(0, facing, 0);
    const h = p.hips || [0, 0, 0];
    joints.hips.setLocalPosition(h[0], M.BODY.hip + p.bob, h[2]);
    for (const name in p.joints) { const a = p.joints[name]; joints[name]?.setLocalEulerAngles(a[0], a[1], a[2]); }
  },
  // A patch of ground: soft grass-green tiles, so steps read against it.
  ground(R = 7, step = 0.045) {
    const n = Math.ceil((2 * R) / step);
    const buf = new SplatBuffer(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = -R + (i + 0.5) * step, z = -R + (j + 0.5) * step;
      if (x * x + z * z > R * R) continue;
      const tile = (Math.floor(x / 0.5) + Math.floor(z / 0.5)) & 1;
      const k = tile ? 0.96 : 1.04;
      buf.push([x, 0, z], [step * 0.75, step * 0.75, step * 0.05], [0.7071068, 0, 0, 0.7071068], [0.44 * k, 0.6 * k, 0.33 * k, 1]);
    }
    view.entity("ground", view.container(buf));
  },
  // Steps each figure's gait with its own module's stepGait.
  advance(dt, speeds) {
    figs.forEach((f, i) => f.M.stepGait(f.gait, speeds[i] ?? 0, dt));
  },
  cam(pos, target) { view.setCameraPose(pos, target); },
  frame() { return view.nextFrame(); },
};
document.body.dataset.ready = "true";
</script></body></html>`;
