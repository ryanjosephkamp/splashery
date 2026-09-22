// Procedural planet templates, generated on the GPU from a seed into one
// RGBA8 texture: rgb = sRGB-encoded base color, a = roughness.
// No image assets are involved; the same seed always yields the same planet.

import {
  Color,
  GLSL3,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { mulberry32, TEMPLATE_NAMES } from "./state.js";

const MAX_CRATERS = 64;

export const NOISE_GLSL = /* glsl */ `
  uvec3 pcg3d(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
  }
  vec3 grad3(vec3 i) {
    uvec3 u = pcg3d(uvec3(ivec3(i) + ivec3(4096)) ^ uvec3(uSeed, uSeed * 747796405u, uSeed * 2891336453u));
    return vec3(u) * (2.0 / 4294967295.0) - 1.0;
  }
  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = p - i;
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float n000 = dot(grad3(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0));
    float n100 = dot(grad3(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
    float n010 = dot(grad3(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
    float n110 = dot(grad3(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
    float n001 = dot(grad3(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
    float n101 = dot(grad3(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
    float n011 = dot(grad3(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
    float n111 = dot(grad3(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
      mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
      u.z
    ) * 1.4;
  }
  float fbm(vec3 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      sum += amp * gnoise(p);
      norm += amp;
      p = p * 2.03 + vec3(11.7, 5.3, 7.9);
      amp *= 0.5;
    }
    return sum / norm;
  }
  float ridged(vec3 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      sum += amp * (1.0 - abs(gnoise(p)));
      norm += amp;
      p = p * 2.11 + vec3(3.1, 9.2, 4.4);
      amp *= 0.5;
    }
    return sum / norm;
  }
`;

const VERT = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform int uTemplate;
  uniform uint uSeed;
  uniform vec3 uOffset;
  uniform vec3 uPalette[6];
  uniform vec4 uParams;
  uniform vec4 uStorm;
  uniform vec4 uCraters[${MAX_CRATERS}];
  uniform int uCraterCount;
  in vec2 vUv;
  out vec4 outColor;

  __SHAPE__
  __NOISE__

  vec3 srgbEncode(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  vec3 cosPalette(float t) {
    return uPalette[0] + uPalette[1] * cos(6.283185 * (uPalette[2] * t + uPalette[3]));
  }

  void rocky(vec3 P, out vec3 col, out float rough) {
    vec3 p = P + uOffset;
    float n = fbm(p * 2.4, 6) * 0.5 + 0.5;
    float detail = fbm(p * 9.0 + 3.0, 4) * 0.5 + 0.5;
    float veins = ridged(p * 5.0 + 7.0, 3);
    col = mix(uPalette[0], uPalette[1], smoothstep(0.25, 0.75, n));
    col = mix(col, uPalette[2], smoothstep(0.55, 0.95, detail) * 0.55);
    col = mix(col, uPalette[3], smoothstep(0.7, 0.95, veins) * 0.35);
    float rim = 0.0;
    float floorM = 0.0;
    for (int i = 0; i < ${MAX_CRATERS}; i++) {
      if (i >= uCraterCount) break;
      vec4 c = uCraters[i];
      float d = acos(clamp(dot(P, c.xyz), -1.0, 1.0)) / c.w;
      if (d < 1.35) {
        float f = 1.0 - smoothstep(0.55, 0.9, d);
        float r = smoothstep(0.55, 0.9, d) * (1.0 - smoothstep(0.95, 1.35, d));
        floorM = max(floorM, f);
        rim = max(rim, r);
      }
    }
    col *= 1.0 - 0.32 * floorM;
    col += 0.16 * rim;
    col *= 0.85 + 0.3 * detail;
    rough = clamp(0.84 + 0.12 * (detail - 0.5) - 0.12 * floorM + 0.05 * rim, 0.4, 1.0);
  }

  void icy(vec3 P, out vec3 col, out float rough) {
    vec3 p = P + uOffset;
    float n = fbm(p * 2.8, 5) * 0.5 + 0.5;
    col = mix(uPalette[0], uPalette[1], n);
    float cracksA = pow(ridged(p * 4.5 + 2.0, 2), 9.0);
    float cracksB = pow(ridged(p * 11.0 + 5.0, 2), 14.0);
    float cracks = clamp(cracksA * 0.9 + cracksB * 0.6, 0.0, 1.0);
    col = mix(col, uPalette[2], cracks * 0.75);
    float frost = smoothstep(0.5, 0.85, fbm(p * 5.5 + 9.0, 4) * 0.5 + 0.5);
    col = mix(col, uPalette[3], frost * 0.7);
    float polar = smoothstep(0.55, 0.9, abs(P.y));
    col = mix(col, vec3(0.97, 0.98, 1.0), polar * 0.5);
    rough = clamp(mix(0.22, 0.6, frost) + 0.25 * cracks + 0.1 * polar, 0.1, 1.0);
  }

  void gas(vec3 P, out vec3 col, out float rough) {
    vec3 p = P + uOffset;
    float warp = fbm(p * 2.5, 4) * 0.14 + fbm(p * 7.0 + 4.0, 3) * 0.045;
    float lat = P.y + warp;
    float bands = sin(lat * uParams.x + fbm(vec3(lat * 6.0, 1.3, 2.1) + uOffset, 3) * 2.2);
    float t = lat * 0.5 + 0.5 + 0.07 * bands + 0.06 * warp;
    col = cosPalette(t);
    float streaks = fbm(vec3(p.x, p.y * 14.0, p.z) * 3.0 + 8.0, 3);
    col *= 0.78 + 0.2 * streaks + 0.16 * bands;
    float lon = atan(P.z, -P.x);
    float dl = lon - uStorm.x;
    dl = dl - 6.283185 * floor((dl + 3.141593) / 6.283185);
    vec2 d = vec2(dl * cos(uStorm.y), asin(clamp(P.y, -1.0, 1.0)) - uStorm.y) / uStorm.zw;
    float ang = atan(d.y, d.x) + length(d) * 3.0 + warp * 8.0;
    float sd = length(d) + 0.08 * sin(ang * 3.0);
    float storm = 1.0 - smoothstep(0.55, 1.0, sd);
    float eye = 1.0 - smoothstep(0.0, 0.35, sd);
    col = mix(col, uPalette[4], storm * 0.85);
    col = mix(col, uPalette[5], eye * 0.6);
    rough = clamp(0.72 + 0.1 * bands - 0.1 * storm, 0.3, 1.0);
  }

  void main() {
    vec3 P = normalize(shapePosition(vUv));
    vec3 col;
    float rough;
    if (uTemplate == 0) rocky(P, col, rough);
    else if (uTemplate == 1) icy(P, col, rough);
    else if (uTemplate == 2) gas(P, col, rough);
    else { col = uPalette[0]; rough = uParams.y; }
    outColor = vec4(srgbEncode(col), clamp(rough, 0.02, 1.0));
  }
`;

function hsl(h, s, l) {
  const c = new Color();
  c.setHSL(((h % 1) + 1) % 1, s, l);
  return c;
}

// Builds the seed-dependent uniform values (palettes, craters, storm) in JS
// so both the GPU pass and any future CPU fallback agree on them.
export function templateParams(name, seed) {
  const rng = mulberry32(seed >>> 0);
  const params = {
    offset: new Vector3(rng() * 200 - 100, rng() * 200 - 100, rng() * 200 - 100),
    palette: [],
    craters: [],
    params: new Vector4(12, 0.55, 0, 0),
    storm: new Vector4(0, 0, 0.3, 0.15),
  };
  if (name === "rocky") {
    const hue = rng() < 0.7 ? 0.02 + rng() * 0.07 : 0.55 + rng() * 0.08;
    params.palette = [
      hsl(hue, 0.3 + rng() * 0.3, 0.16 + rng() * 0.1),
      hsl(hue + 0.03, 0.28 + rng() * 0.3, 0.34 + rng() * 0.12),
      hsl(hue - 0.04, 0.2 + rng() * 0.25, 0.5 + rng() * 0.12),
      hsl(hue + 0.5, 0.15, 0.12 + rng() * 0.08),
      new Color(0, 0, 0),
      new Color(0, 0, 0),
    ];
    const count = 22 + Math.floor(rng() * (MAX_CRATERS - 22));
    for (let i = 0; i < count; i++) {
      const z = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      const radius = 0.03 + Math.pow(rng(), 2.2) * 0.22;
      params.craters.push(new Vector4(r * Math.cos(a), z, r * Math.sin(a), radius));
    }
  } else if (name === "icy") {
    const hue = 0.52 + rng() * 0.1;
    params.palette = [
      hsl(hue, 0.35, 0.8 + rng() * 0.08),
      hsl(hue + 0.02, 0.5, 0.58 + rng() * 0.12),
      hsl(hue + 0.06, 0.45 + rng() * 0.2, 0.22 + rng() * 0.12),
      new Color(0.98, 0.99, 1),
      new Color(0, 0, 0),
      new Color(0, 0, 0),
    ];
  } else if (name === "gas") {
    const base = rng();
    const a = new Color(0.42 + rng() * 0.18, 0.38 + rng() * 0.18, 0.34 + rng() * 0.2);
    const b = new Color(0.3 + rng() * 0.22, 0.3 + rng() * 0.22, 0.3 + rng() * 0.22);
    const c = new Color(0.8 + rng() * 1.2, 0.8 + rng() * 1.2, 0.8 + rng() * 1.2);
    const d = new Color(base, base + 0.15 + rng() * 0.2, base + 0.35 + rng() * 0.3);
    params.palette = [a, b, c, d, hsl(base + 0.45, 0.6, 0.32), hsl(base + 0.5, 0.4, 0.75)];
    params.params.set(9 + rng() * 9, 0, 0, 0);
    params.storm.set(
      rng() * Math.PI * 2,
      (rng() * 0.6 - 0.3) * Math.PI * 0.5,
      0.18 + rng() * 0.22,
      0.08 + rng() * 0.1,
    );
  } else {
    params.palette = [
      hsl(rng(), 0.45 + rng() * 0.35, 0.36 + rng() * 0.2),
      new Color(0, 0, 0),
      new Color(0, 0, 0),
      new Color(0, 0, 0),
      new Color(0, 0, 0),
      new Color(0, 0, 0),
    ];
    params.params.set(0, 0.45 + rng() * 0.3, 0, 0);
  }
  while (params.craters.length < MAX_CRATERS) params.craters.push(new Vector4(0, 1, 0, 0.001));
  return params;
}

export class TemplateGenerator {
  constructor(renderer, shape) {
    this.renderer = renderer;
    this.shape = shape;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG.replace("__SHAPE__", shape.glsl.position).replace(
        "__NOISE__",
        NOISE_GLSL,
      ),
      uniforms: {
        uTemplate: { value: 0 },
        uSeed: { value: 1 },
        uOffset: { value: new Vector3() },
        uPalette: { value: Array.from({ length: 6 }, () => new Color()) },
        uParams: { value: new Vector4() },
        uStorm: { value: new Vector4() },
        uCraters: { value: Array.from({ length: MAX_CRATERS }, () => new Vector4()) },
        uCraterCount: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.target = null;
  }

  // Renders the template into an RGBA8 texture of width x height and returns the texture.
  generate(name, seed, width = 1024, height = 512) {
    const index = Math.max(0, TEMPLATE_NAMES.indexOf(name));
    const p = templateParams(name, seed);
    const u = this.material.uniforms;
    u.uTemplate.value = index;
    u.uSeed.value = seed >>> 0;
    u.uOffset.value.copy(p.offset);
    p.palette.forEach((c, i) => u.uPalette.value[i].copy(c));
    u.uParams.value.copy(p.params);
    u.uStorm.value.copy(p.storm);
    p.craters.forEach((c, i) => u.uCraters.value[i].copy(c));
    u.uCraterCount.value = name === "rocky" ? p.craters.filter((c) => c.w > 0.01).length : 0;

    if (!this.target || this.target.width !== width || this.target.height !== height) {
      if (this.target) this.target.dispose();
      this.target = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        type: UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: true,
        minFilter: LinearMipmapLinearFilter,
        magFilter: LinearFilter,
        wrapS: RepeatWrapping,
      });
      this.target.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
    return this.target.texture;
  }

  dispose() {
    if (this.target) this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
    this.target = null;
  }
}
