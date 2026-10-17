// Build-time only harness: the site's Stage and vendored GSplat renderer.
import { Stage } from "../stage.js";
import { loadNative } from "../loaders.js";
import { OrbitCamera } from "../camera.js";
import * as pc from "../pc.js";

const stage = await Stage.create(document.querySelector("canvas"), {
  prefer: "webgl2",
  pixelRatio: 1,
  adaptive: false,
});
let entity, asset;
const camera = new OrbitCamera({ reducedMotion: true });
window.refRender = {
  async load(url) {
    entity?.destroy();
    if (asset) {
      stage.app.assets.remove(asset);
      asset.unload();
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Model load failed: ${response.status}`);
    asset = await loadNative(stage, new Uint8Array(await response.arrayBuffer()), "result.ply");
    entity = new pc.Entity("reference-result");
    entity.addComponent("gsplat", { asset });
    stage.app.root.addChild(entity);
    stage.setCameraPose({ position: [0, 0, 4], rotation: [0, 0, 0, 1] });
    // The unified sorter works asynchronously; allow its first upload to settle.
    for (let i = 0; i < 8; i++) await stage.captureFrame();
  },
  async render(pose, width, height, background = [1, 1, 1], alpha = 0) {
    stage.setFixedSize([width, height]);
    stage.setClearColor(background, alpha);
    camera.cur = { yaw: 0, pitch: 0, roll: 0, distance: 4, ...pose };
    camera.target = pose.target || [0, 0, 0];
    stage.setCameraPose({ ...camera.pose(), fov: pose.fov || 38 });
    for (let i = 0; i < 8; i++) await stage.captureFrame();
    return (await stage.captureFrame()).toDataURL("image/png");
  },
};
