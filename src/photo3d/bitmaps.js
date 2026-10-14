// At most one uploaded source and one prepared replacement are retained.
// A replaced source is closed only after the texture has switched away.
const retired = new WeakMap();
export function discardSurface(surface, active) {
  if (surface?.bitmap && surface.bitmap !== active) {
    surface.bitmap.close();
    surface.bitmap = null;
  }
}
export function retireBitmap(bitmap, stage) {
  if (typeof bitmap?.close !== "function") return;
  if (!stage) {
    bitmap.close();
    return;
  }
  let pending = retired.get(stage);
  if (!pending) {
    pending = new Map();
    retired.set(stage, pending);
    stage.onUpdate(() => {
      const source = stage.photo ? stage.photoTex?.getSource() : null;
      for (const [old, frames] of pending) {
        if (source === old) {
          pending.set(old, 0);
          continue;
        }
        if (frames < 1) {
          pending.set(old, frames + 1);
          continue;
        }
        old.close();
        pending.delete(old);
      }
    });
    stage.app?.once?.("destroy", () => {
      for (const old of pending.keys()) old.close();
      pending.clear();
    });
  }
  pending.set(bitmap, 0);
}
