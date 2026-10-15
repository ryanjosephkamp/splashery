// GPU sorting measures its depth range from the resource's model-space bounds.
// Keep that range around kit tokens moved by the work-buffer shader, too.
import * as pc from "./pc.js";

const states = new WeakMap();

export function updateTokenBounds(resource, tokens, component) {
  if (!tokens || !resource?.aabb || typeof resource.update !== "function") return false;
  const active = [];
  for (let o = 0; o + 7 < tokens.length; o += 8) {
    if (!(tokens[o + 3] > 0)) continue;
    if (
      tokens[o] ||
      tokens[o + 1] ||
      tokens[o + 2] ||
      tokens[o + 4] ||
      tokens[o + 5] ||
      tokens[o + 6] ||
      (tokens[o + 7] !== 0 && tokens[o + 7] !== 1) ||
      tokens[o + 3] > 1
    )
      active.push(o);
  }
  if (!active.length) return false;
  let state = states.get(resource);
  // A geometry upload may have replaced the bounds since the last frame.
  if (!state || resource.aabb !== state.expanded) {
    state = { base: resource.aabb.clone(), expanded: resource.aabb };
    states.set(resource, state);
  }
  const next = state.expanded.clone();
  const moved = new pc.BoundingBox();
  const matrix = new pc.Mat4();
  const offset = new pc.Vec3();
  const rotation = new pc.Quat();
  const scale = new pc.Vec3(1, 1, 1);
  for (const o of active) {
    const visible = tokens[o + 3];
    const [x, y, z] = [tokens[o], tokens[o + 1], tokens[o + 2]];
    const [qx, qy, qz, qw] = [tokens[o + 4], tokens[o + 5], tokens[o + 6], tokens[o + 7]];
    offset.set(x, y, z);
    // The kit shader treats an all-zero quaternion as the identity.
    rotation.set(qx, qy, qz, qw || (!qx && !qy && !qz ? 1 : 0));
    matrix.setTRS(offset, rotation, scale);
    moved.setFromTransformedAabb(state.base, matrix);
    moved.halfExtents.mulScalar(Math.max(1, visible));
    next.add(moved);
  }
  const oldMin = state.expanded.getMin();
  const oldMax = state.expanded.getMax();
  const min = next.getMin();
  const max = next.getMax();
  if (
    min.x >= oldMin.x &&
    min.y >= oldMin.y &&
    min.z >= oldMin.z &&
    max.x <= oldMax.x &&
    max.y <= oldMax.y &&
    max.z <= oldMax.z
  )
    return false;
  // Grow an envelope for this resource's lifetime, rather than rebuilding the
  // unified world on every frame as settled tokens return to their rest pose.
  resource.aabb = state.expanded = next;
  if (component) component.customAabb = next;
  resource.update();
  return true;
}
