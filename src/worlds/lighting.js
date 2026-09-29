// Light for a world, in both render modes (docs/WORLDS.md, "Rendering"):
// one sun for everything, soft shadows cast by the props and the
// character, haze that splats and models share, and a tone-mapped grade.
//
// Splats aren't lit by the engine (their colors carry their own light), so
// they only cast shadows. In hybrid mode the lit ground model receives
// them; in splats mode an invisible shadow catcher, laid over the ground
// and drawn between the ground's splats and the props', darkens the ground
// where the shadows fall. Splats mode also draws the ground's depth (a
// model that writes depth and no color, a little below the surface), so a
// hill hides the props behind it now that the ground's splats draw first.

import * as pc from "../pc.js";
import { groundTiles } from "./hybrid.js";

const DEG = Math.PI / 180;

// A unit vector toward the sun from its azimuth (degrees clockwise from
// north, which is -z) and elevation.
export function sunVector(sun) {
  const az = sun.azimuth * DEG;
  const el = sun.elevation * DEG;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

export class Lighting {
  // view: the WorldView; def: the world; budget: the tier's WORLD_BUDGETS
  // row; mode: "splats" or "hybrid".
  constructor(view, def, budget, mode) {
    this.view = view;
    this.def = def;
    this.budget = budget;
    this.mode = mode;
    const app = view.app;
    const L = def.light;
    this.sunDir = sunVector(L.sun);

    // The sun. A directional light shines down its entity's -y, so the
    // entity's +y points at the sun.
    const sun = new pc.Entity("sun");
    sun.addComponent("light", {
      type: "directional",
      color: new pc.Color(...L.sunColor),
      intensity: L.sunIntensity,
      castShadows: budget.shadows > 0,
      shadowResolution: budget.shadows || 1024,
      shadowDistance: budget.shadowDistance,
      numCascades: budget.shadowDistance > 30 ? 2 : 1,
      cascadeDistribution: 0.55,
      shadowType: pc.SHADOW_PCF5_16F,
      shadowBias: 0.25,
      normalOffsetBias: 0.06,
      shadowIntensity: L.shadow,
      layers: [view.worldLayer.id, view.surfaceLayer.id],
    });
    sun.setRotation(fromUp(this.sunDir));
    app.root.addChild(sun);
    this.sun = sun;

    // Haze, shared: the engine fogs splats (by their centers' depth) and
    // models alike.
    const fog = app.scene.fog;
    fog.type = pc.FOG_EXP2;
    fog.color = new pc.Color(...L.hazeColor);
    fog.density = L.haze;

    // The grade: a neutral tone map (it leaves colors below about 0.8 as
    // they are, so the splats keep their colors, and rolls off highlights),
    // with an exposure. (Engine colors are given in sRGB.)
    const cam = view.camera.camera;
    cam.toneMapping = pc.TONEMAP_NEUTRAL;
    cam.gammaCorrection = pc.GAMMA_SRGB;
    app.scene.exposure = L.exposure;
    app.scene.ambientLight = new pc.Color(...L.ambient);
  }

  // Splats mode: the depth of the ground and the shadow catcher over it.
  buildCatcher(terrain) {
    const view = this.view;
    const depth = new pc.StandardMaterial();
    depth.redWrite = depth.greenWrite = depth.blueWrite = depth.alphaWrite = false;
    depth.useLighting = false;
    depth.useFog = false;
    depth.useSkybox = false;
    depth.update();
    const catcher = new pc.StandardMaterial();
    catcher.shadowCatcher = true;
    catcher.blendType = pc.BLEND_MULTIPLICATIVE;
    catcher.depthWrite = false;
    catcher.useSkybox = false;
    catcher.useFog = false;
    catcher.diffuse = new pc.Color(0, 0, 0);
    catcher.update();
    const tiles = groundTiles(view.device, terrain, { step: 1, above: terrain.water - 0.1 });
    this.catchers = [];
    for (const t of tiles) {
      // The depth, 12 cm under the surface (the ground's splats lie on it).
      const d = new pc.Entity("ground-depth");
      d.addComponent("render", { meshInstances: [new pc.MeshInstance(t.mesh, depth)], castShadows: false, receiveShadows: false, layers: [view.worldLayer.id] }); // prettier-ignore
      d.setLocalPosition(0, -0.12, 0);
      view.app.root.addChild(d);
      const c = new pc.Entity("shadow-catcher");
      c.addComponent("render", { meshInstances: [new pc.MeshInstance(t.mesh, catcher)], castShadows: false, receiveShadows: true, layers: [view.surfaceLayer.id] }); // prettier-ignore
      c.setLocalPosition(0, 0.02, 0);
      view.app.root.addChild(c);
      this.catchers.push(c);
    }
  }
}

// The rotation that turns +y toward a direction.
function fromUp(d) {
  const q = new pc.Quat();
  const up = new pc.Vec3(0, 1, 0);
  const v = new pc.Vec3(d[0], d[1], d[2]).normalize();
  const axis = new pc.Vec3().cross(up, v);
  const s = axis.length();
  if (s < 1e-6) return q;
  axis.mulScalar(1 / s);
  q.setFromAxisAngle(axis, Math.atan2(s, up.dot(v)) / DEG);
  return q;
}
