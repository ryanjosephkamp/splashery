// Paintable shape abstraction. The paint system only talks to a shape through
// this interface, so a torus or rounded cube can be added later by
// implementing the same methods and GLSL snippets.
//
//   createGeometry(detail)            -> THREE.BufferGeometry with a uv attribute
//   uvToPosition(u, v, out)           -> object-space point on the surface
//   positionToUV(p, out)              -> uv for an object-space surface point
//   project(p, out)                   -> nearest surface point to p (object space)
//   raycast(origin, dir, out)         -> nearest hit point or null (object space)
//   glsl                              -> { position: 'vec3 shapePosition(vec2 uv)',
//                                          frame: 'void shapeFrame(vec2 uv, out vec3 dPdu, out vec3 dPdv)' }
//
// UV convention matches THREE.SphereGeometry so raycasts against the mesh and
// analytic hits agree: u wraps around the equator, v = 1 at the north pole.

import { SphereGeometry, Vector3 } from "three";

const TWO_PI = Math.PI * 2;

export class SphereShape {
  constructor(radius = 1) {
    this.name = "sphere";
    this.radius = radius;
    // Surface-space distance (radians) covered by one texel column at the equator.
    this.circumference = TWO_PI * radius;
    this.glsl = {
      position: /* glsl */ `
        vec3 shapePosition(vec2 uv) {
          float phi = uv.x * 6.283185307179586;
          float theta = (1.0 - uv.y) * 3.141592653589793;
          float st = sin(theta);
          return vec3(-cos(phi) * st, cos(theta), sin(phi) * st);
        }
      `,
      frame: /* glsl */ `
        void shapeFrame(vec2 uv, out vec3 dPdu, out vec3 dPdv) {
          float phi = uv.x * 6.283185307179586;
          float theta = (1.0 - uv.y) * 3.141592653589793;
          float st = sin(theta);
          float ct = cos(theta);
          dPdu = 6.283185307179586 * vec3(sin(phi) * st, 0.0, cos(phi) * st);
          dPdv = 3.141592653589793 * vec3(cos(phi) * ct, st, -sin(phi) * ct);
        }
      `,
    };
  }

  createGeometry(detail = "high") {
    const w = detail === "high" ? 512 : 256;
    const h = detail === "high" ? 256 : 128;
    return new SphereGeometry(this.radius, w, h);
  }

  uvToPosition(u, v, out = new Vector3()) {
    const phi = u * TWO_PI;
    const theta = (1 - v) * Math.PI;
    const st = Math.sin(theta);
    return out
      .set(-Math.cos(phi) * st, Math.cos(theta), Math.sin(phi) * st)
      .multiplyScalar(this.radius);
  }

  positionToUV(p, out = { u: 0, v: 0 }) {
    const r = p.length() || 1;
    const y = Math.min(1, Math.max(-1, p.y / r));
    let phi = Math.atan2(p.z, -p.x);
    if (phi < 0) phi += TWO_PI;
    out.u = phi / TWO_PI;
    out.v = 1 - Math.acos(y) / Math.PI;
    if (out.u >= 1) out.u -= 1;
    return out;
  }

  project(p, out = new Vector3()) {
    return out.copy(p).normalize().multiplyScalar(this.radius);
  }

  // Ray/sphere intersection in object space. Returns the nearest point in front of the origin.
  raycast(origin, dir, out = new Vector3()) {
    const r = this.radius;
    const b = origin.dot(dir);
    const c = origin.dot(origin) - r * r;
    const disc = b * b - c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    let t = -b - s;
    if (t < 0) t = -b + s;
    if (t < 0) return null;
    return out.copy(dir).multiplyScalar(t).add(origin);
  }

  // Geodesic distance between two surface points (radians on the unit sphere).
  geodesic(a, b) {
    const d = Math.min(1, Math.max(-1, a.dot(b) / (this.radius * this.radius)));
    return Math.acos(d);
  }

  // Orthonormal tangent frame at a surface point (world-agnostic, object space).
  tangentFrame(p, outT = new Vector3(), outB = new Vector3()) {
    const n = _n.copy(p).normalize();
    const ref = Math.abs(n.y) < 0.99 ? _up : _right;
    outT.crossVectors(ref, n).normalize();
    outB.crossVectors(n, outT).normalize();
    return { tangent: outT, bitangent: outB, normal: n };
  }

  // Bounding box in UV space for a geodesic disk. Handles the seam by
  // expanding to the full width when the disk crosses it or touches a pole.
  uvBounds(u, v, radius) {
    const theta = (1 - v) * Math.PI;
    const dv = radius / Math.PI;
    let v0 = v - dv;
    let v1 = v + dv;
    const st = Math.sin(theta);
    const du = st > 1e-4 ? radius / (TWO_PI * st) : 1;
    let u0 = u - du;
    let u1 = u + du;
    let full = false;
    if (v0 < 0 || v1 > 1 || du >= 0.5 || u0 < 0 || u1 > 1) {
      full = true;
      u0 = 0;
      u1 = 1;
      v0 = Math.max(0, v0);
      v1 = Math.min(1, v1);
    }
    return { u0, u1, v0, v1, full };
  }
}

const _n = new Vector3();
const _up = new Vector3(0, 1, 0);
const _right = new Vector3(1, 0, 0);

export function createShape(name = "sphere") {
  if (name !== "sphere") throw new Error(`Shape "${name}" is not available in this version.`);
  return new SphereShape(1);
}
