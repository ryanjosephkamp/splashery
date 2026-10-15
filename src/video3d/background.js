// Match a fitted video's training composite while its view owns the stage.
// Host/background controls remain authoritative, and late disposal cannot repaint a newer view.
const owners = new WeakMap();
export function trainingBackground(value) {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    ? value.slice()
    : null;
}
const rgba = (color) => [color?.r, color?.g, color?.b, color?.a];
export function holdTrainingBackground(stage, value) {
  const rgb = trainingBackground(value),
    camera = stage?.cameraEntity?.camera;
  if (!rgb || !camera || typeof stage.setClearColor !== "function") return () => {};
  const previous = rgba(camera.clearColor);
  if (!previous.every(Number.isFinite)) return () => {};
  owners.get(stage)?.release();
  // A previous owner can restore the host's color before this owner captures it.
  const wanted = rgba(camera.clearColor),
    original = stage.setClearColor;
  let released = false,
    hostChanged = false;
  const wrapper = function (...args) {
    hostChanged = true;
    return original.apply(this, args);
  };
  stage.setClearColor = wrapper;
  original.call(stage, rgb, 1);
  const applied = rgba(camera.clearColor);
  const release = () => {
    if (released) return;
    released = true;
    if (owners.get(stage)?.release !== release) return;
    owners.delete(stage);
    if (stage.setClearColor !== wrapper) return;
    stage.setClearColor = original;
    if (
      !hostChanged &&
      stage.cameraEntity?.camera === camera &&
      rgba(camera.clearColor).every((v, i) => v === applied[i])
    )
      original.call(stage, wanted.slice(0, 3), wanted[3]);
  };
  owners.set(stage, { release });
  return release;
}
