// Renderer, camera, lighting, environment and the planet mesh whose material
// composites template + dry paint + wet paint (with clearcoat and a bump).

import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  DirectionalLight,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShaderChunk,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { DEFAULT_LIGHTING } from "./state.js";

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSun;
  void main() {
    vec3 d = normalize(vDir);
    vec3 zenith = vec3(0.42, 0.56, 0.82);
    vec3 horizon = vec3(0.86, 0.87, 0.9);
    vec3 ground = vec3(0.24, 0.22, 0.2);
    float h = d.y;
    vec3 col = h >= 0.0 ? mix(horizon, zenith, pow(h, 0.6)) : mix(horizon, ground, pow(-h, 0.5));
    float s = dot(d, uSun);
    col += vec3(1.0, 0.96, 0.9) * (smoothstep(0.93, 0.995, s) * 6.0 + smoothstep(0.996, 0.9995, s) * 40.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function probeWebGL2() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) return { ok: false };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const halfFloat =
      !!gl.getExtension("EXT_color_buffer_half_float") ||
      !!gl.getExtension("EXT_color_buffer_float");
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    const name = String(renderer || "");
    const software = /SwiftShader|llvmpipe|Software|Basic Render/i.test(name);
    return { ok: true, renderer: name, maxTexture, halfFloat, software };
  } catch {
    return { ok: false };
  }
}

// Heuristic used to choose the automatic 1024 fallback and lower mesh detail.
export function isWeakDevice(info) {
  const ua = navigator.userAgent || "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || navigator.maxTouchPoints > 2;
  const coarseOnly =
    matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
  const software = !!info.software;
  const lowMem = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
  const smallTex = (info.maxTexture || 0) < 4096;
  return mobile || coarseOnly || software || lowMem || smallTex;
}

export class PlanetScene {
  constructor(canvas, shape, { weak = false, alpha = true } = {}) {
    this.shape = shape;
    this.weak = weak;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !weak,
      alpha,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
    const r = this.renderer;
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.outputColorSpace = SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(38, 1, 0.05, 100);
    this.camera.position.set(0, 0, 3.2);
    this.camera.lookAt(0, 0, 0);

    this.key = new DirectionalLight(0xffffff, DEFAULT_LIGHTING.keyIntensity);
    this.scene.add(this.key);
    this.scene.add(this.key.target);

    this.uniforms = {
      uTemplate: { value: null },
      uWet: { value: null },
      uDry: { value: null },
      uWetBump: { value: 0.028 },
    };
    this.material = this._createMaterial();
    this.mesh = new Mesh(shape.createGeometry(weak ? "low" : "high"), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.sunDir = new Vector3(0, 1, 0);
    this._buildEnvironment();
    this.setLighting(DEFAULT_LIGHTING);
    this.size = new Vector2(1, 1);
  }

  _createMaterial() {
    const uniforms = this.uniforms;
    const mat = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      specularIntensity: 0.6,
    });
    mat.defines = { ...(mat.defines || {}), USE_UV: "" };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <clipping_planes_pars_fragment>",
          /* glsl */ `#include <clipping_planes_pars_fragment>
          uniform sampler2D uTemplate;
          uniform sampler2D uWet;
          uniform sampler2D uDry;
          uniform float uWetBump;
          float splWetA = 0.0;
          float splDryA = 0.0;
          float splRough = 1.0;
          vec2 splDdx = vec2(0.0);
          vec2 splDdy = vec2(0.0);
          float splWetHeight(vec2 uv) {
            return textureGrad(uWet, uv, splDdx, splDdy).a;
          }
          vec3 splPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
            vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
            vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
            vec3 vN = surf_norm;
            vec3 R1 = cross(vSigmaY, vN);
            vec3 R2 = cross(vN, vSigmaX);
            float fDet = dot(vSigmaX, R1) * faceDirection;
            vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
            return normalize(abs(fDet) * surf_norm - vGrad);
          }`,
        )
        .replace(
          "#include <map_fragment>",
          /* glsl */ `
          {
            vec2 ddx = dFdx(vUv);
            vec2 ddy = dFdy(vUv);
            // Correct the derivative jump at the UV seam so mip selection stays smooth.
            ddx.x -= round(ddx.x);
            ddy.x -= round(ddy.x);
            splDdx = ddx;
            splDdy = ddy;
            vec4 tpl = textureGrad(uTemplate, vUv, ddx, ddy);
            vec3 base = sRGBTransferEOTF(tpl).rgb;
            splRough = tpl.a;
            vec4 dry = textureGrad(uDry, vUv, ddx, ddy);
            vec4 wet = textureGrad(uWet, vUv, ddx, ddy);
            vec3 c = base * (1.0 - dry.a) + dry.rgb;
            c = c * (1.0 - wet.a) + wet.rgb;
            splWetA = clamp(wet.a, 0.0, 1.0);
            splDryA = clamp(dry.a, 0.0, 1.0);
            diffuseColor.rgb *= c;
          }`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          /* glsl */ `
          float roughnessFactor = roughness * splRough;
          roughnessFactor = mix(roughnessFactor, 0.5, splDryA);
          roughnessFactor = mix(roughnessFactor, 0.18, splWetA);`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          /* glsl */ `#include <normal_fragment_maps>
          {
            float Hll = uWetBump * splWetHeight(vUv);
            float dBx = uWetBump * splWetHeight(vUv + splDdx) - Hll;
            float dBy = uWetBump * splWetHeight(vUv + splDdy) - Hll;
            normal = splPerturb(-vViewPosition, normal, vec2(dBx, dBy), faceDirection);
          }`,
        )
        .replace(
          "#include <clearcoat_normal_fragment_begin>",
          /* glsl */ `#ifdef USE_CLEARCOAT
            vec3 clearcoatNormal = normal;
          #endif`,
        )
        .replace(
          "#include <lights_physical_fragment>",
          ShaderChunk.lights_physical_fragment.replace(
            "material.clearcoat = clearcoat;",
            "material.clearcoat = clearcoat * splWetA;",
          ),
        );
    };
    mat.customProgramCacheKey = () => "splashery-planet-v1";
    return mat;
  }

  _buildEnvironment() {
    const pmrem = new PMREMGenerator(this.renderer);
    const skyScene = new Scene();
    const skyMat = new ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uSun: { value: new Vector3(0, 1, 0) } },
      side: BackSide,
      depthWrite: false,
    });
    const sky = new Mesh(new SphereGeometry(10, 32, 16), skyMat);
    skyScene.add(sky);
    this._sky = { pmrem, skyScene, skyMat, sky };
    this._envTarget = null;
  }

  _updateEnvironment() {
    const { pmrem, skyScene, skyMat } = this._sky;
    skyMat.uniforms.uSun.value.copy(this.sunDir);
    const old = this._envTarget;
    this._envTarget = pmrem.fromScene(skyScene, 0.02);
    this.scene.environment = this._envTarget.texture;
    if (old) old.dispose();
  }

  setLighting(lighting) {
    const l = { ...DEFAULT_LIGHTING, ...lighting };
    this.lighting = l;
    this.renderer.toneMappingExposure = l.exposure;
    const dir = new Vector3(
      Math.cos(l.keyElevation) * Math.sin(l.keyAzimuth),
      Math.sin(l.keyElevation),
      Math.cos(l.keyElevation) * Math.cos(l.keyAzimuth),
    ).normalize();
    this.key.position.copy(dir).multiplyScalar(10);
    this.key.target.position.set(0, 0, 0);
    this.key.intensity = l.keyIntensity;
    this.scene.environmentIntensity = l.envIntensity;
    if (!this.sunDir.equals(dir) || !this._envTarget) {
      this.sunDir.copy(dir);
      this._updateEnvironment();
    }
  }

  setTemplateTexture(tex) {
    this.uniforms.uTemplate.value = tex;
  }

  setPaintTextures(wet, dry) {
    this.uniforms.uWet.value = wet;
    this.uniforms.uDry.value = dry;
  }

  setSize(width, height, pixelRatio) {
    this.size.set(width, height);
    if (pixelRatio) this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  // Ball orientation + camera distance come from the controls each frame.
  applyView(rotation, distance) {
    this.mesh.quaternion.copy(rotation);
    const R = this.shape.radius;
    // On portrait screens the controls live in a bottom sheet, so lift the
    // planet toward the upper part of the view.
    const halfV = (this.camera.fov * Math.PI) / 360;
    const lift = this.camera.aspect < 0.8 ? 0.16 * distance * Math.tan(halfV) : 0;
    this.camera.position.set(0, -lift, distance);
    this.camera.lookAt(0, -lift, 0);
    const gap = Math.max(1e-4, distance - R);
    const near = Math.max(0.0005, gap * 0.25);
    const far = distance + R * 4 + 20;
    if (Math.abs(this.camera.near - near) > near * 0.2 || Math.abs(this.camera.far - far) > 1) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  // World gravity (-Y) expressed in the ball's object space.
  gravityObject(out = new Vector3()) {
    _invQ.copy(this.mesh.quaternion).invert();
    return out.set(0, -1, 0).applyQuaternion(_invQ);
  }

  // Casts a ray through normalized device coords. Returns the object-space
  // surface point (unit sphere) and uv, or null.
  raycast(ndcX, ndcY, out = {}) {
    const cam = this.camera;
    _origin.setFromMatrixPosition(cam.matrixWorld);
    _dir.set(ndcX, ndcY, 0.5).unproject(cam).sub(_origin).normalize();
    _invQ.copy(this.mesh.quaternion).invert();
    _origin.applyQuaternion(_invQ);
    _dir.applyQuaternion(_invQ);
    const hit = this.shape.raycast(_origin, _dir, _hit);
    if (!hit) return null;
    out.point = (out.point || new Vector3()).copy(hit).normalize();
    out.uv = this.shape.positionToUV(out.point, out.uv || { u: 0, v: 0 });
    return out;
  }

  // Camera distance at which the sphere spans about 72% of the smaller
  // viewport dimension.
  fitDistance(aspect = this.camera.aspect) {
    const halfV = (this.camera.fov * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * Math.max(0.1, aspect));
    const a = Math.min(halfV, halfH) * 0.72;
    return this.shape.radius / Math.sin(a);
  }

  // Projected pixel radius of a surface disk of the given angular radius at
  // the point of the sphere nearest the camera.
  projectedBrushPixels(radiusRad, distance, viewportHeight) {
    const gap = Math.max(1e-4, distance - this.shape.radius);
    const halfFov = (this.camera.fov * Math.PI) / 360;
    return ((radiusRad * this.shape.radius) / (gap * Math.tan(halfFov))) * (viewportHeight / 2);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this._envTarget) this._envTarget.dispose();
    this._sky.pmrem.dispose();
    this._sky.skyMat.dispose();
    this._sky.sky.geometry.dispose();
    this.renderer.dispose();
  }
}

const _origin = new Vector3();
const _dir = new Vector3();
const _hit = new Vector3();
const _invQ = new Quaternion();

export { Color };
