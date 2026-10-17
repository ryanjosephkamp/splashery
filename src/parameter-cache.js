// GPU work-buffer parameters. PlayCanvas marks a placement dirty even when
// setParameter receives the same value. Snapshot numeric arrays because the
// motion driver reuses and mutates its typed arrays in place.
// Made by Ryan with Codex (GPT-6), under Splashery's MIT license.
export class ParameterCache {
  constructor() {
    this.components = new WeakMap();
  }

  forget(component) {
    this.components.delete(component);
  }

  assign(component, uniforms, { ignoreCamera = false } = {}) {
    let previous = this.components.get(component);
    if (!previous) this.components.set(component, (previous = new Map()));
    for (const key in uniforms) {
      // The plain and rig modifiers have no camera uniform. View changes
      // still reach the renderer and any view-dependent recipe outputs.
      if (ignoreCamera && key === "uSpCam") continue;
      const value = uniforms[key];
      const array = Array.isArray(value) || ArrayBuffer.isView(value);
      const old = previous.get(key);
      const clock = key === "uSpClock" || key === "uSpKit";
      const changed = array
        ? !old ||
          old.length !== value.length ||
          value.some((v, i) => !(clock && i === 0) && !Object.is(v, old[i]))
        : !previous.has(key) || !Object.is(value, old);
      if (!changed) continue;
      component.setParameter(key, value);
      previous.set(key, array ? value.slice() : value);
    }
  }
}

// These built-in splat behaviors read the shader clock independently of the
// recipe's drive(). Other behaviors depend on the uniform values themselves.
export function shaderUsesClock(buf) {
  if (!buf.anim) return false;
  for (let i = 0; i < buf.count; i++) {
    const kind = buf.anim[i * 4 + 1];
    if (!STATIC_KINDS.has(kind)) return true;
  }
  return false;
}

// Unknown future behaviors stay on the conservative update path too.
const STATIC_KINDS = new Set([0, 14, 16, 17, 18, 19, 20, 21, 23, 25, 26]);
