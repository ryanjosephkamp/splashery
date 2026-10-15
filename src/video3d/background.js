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
export function modelBackground(stats) {
  return (
    trainingBackground(stats?.renderBackground) || trainingBackground(stats?.trainingBackground)
  );
}
const rgba = (color) => [color?.r, color?.g, color?.b, color?.a];
export function holdTrainingBackground(stage, value, { readBackground } = {}) {
  const rgb = trainingBackground(value),
    camera = stage?.cameraEntity?.camera;
  if (!rgb || !camera || typeof stage.setClearColor !== "function") return () => {};
  const previous = rgba(camera.clearColor);
  if (!previous.every(Number.isFinite)) return () => {};
  owners.get(stage)?.release();
  // A previous owner can restore the host's color before this owner captures it.
  const wanted = rgba(camera.clearColor),
    original = stage.setClearColor;
  let backgroundChoice,
    followsBackground = false;
  if (typeof readBackground === "function") {
    try {
      backgroundChoice = readBackground();
      followsBackground = true;
    } catch {
      // Without a current host option, preserve the original setter's authority.
    }
  }
  let released = false,
    hostChanged = false;
  const wrapper = function (...args) {
    let sameChoice = false;
    if (followsBackground) {
      try {
        sameChoice = readBackground() === backgroundChoice;
      } catch {
        // A stale owner cannot suppress the host's color update.
      }
    }
    const requested = [args[0]?.[0], args[0]?.[1], args[0]?.[2], args[1]];
    if (
      !released &&
      !hostChanged &&
      sameChoice &&
      owners.get(stage)?.release === release &&
      stage.setClearColor === wrapper &&
      stage.cameraEntity?.camera === camera &&
      requested.every((v, i) => v === wanted[i]) &&
      rgba(camera.clearColor).every((v, i) => v === applied[i])
    ) {
      // applyLook also refreshes this unchanged host clear for exposure/accent/settings.
      // Keep the fitted composite while retaining the setter's normal render request.
      return original.call(this, applied.slice(0, 3), applied[3]);
    }
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
