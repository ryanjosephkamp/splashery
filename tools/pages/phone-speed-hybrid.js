// The photo toys default to a relief mesh with their splats disabled. The
// app's splat-only startup signal never fires for that normal view.
// Made by Ryan with Codex (GPT-6), under Splashery's MIT license.
import { measureReadyToy } from "./phone-speed-metrics.js";

export async function measurePhoneToy(win, options) {
  if (!win.__phoneSpeedFirstView) throw new Error("Record first view before forcing draws.");
  const player = win.__splashery.player;
  const hybrid =
    ["photo-3d", "moving-photo-3d"].includes(player.toyInfo?.id) && win.__psv?.state().on;
  const app = player.stage.app;
  // The clip's duplicate-picture veto runs after update. Override it only
  // after first view, while measuring forced completed draws, including pause.
  const force = () => {
    app.renderNextFrame = true;
  };
  if (hybrid) app.on("framerender", force);
  try {
    return { ...(await measureReadyToy(win, options)), forcedHybridMesh: !!hybrid };
  } finally {
    if (hybrid) app.off("framerender", force);
  }
}

export function installHybridFirstFrameProbe() {
  const id = new URLSearchParams(location.search).get("first-toy");
  if (!["photo-3d", "moving-photo-3d"].includes(id)) return;
  const attach = () => {
    if (window.__phoneSpeedFirstView) return;
    const player = window.__splashery?.player;
    const stage = player?.stage;
    if (!stage?.app) {
      requestAnimationFrame(attach);
      return;
    }
    const app = stage.app;
    const meshDrawn = () =>
      app.scene.layers
        .getLayerByName("World")
        ?.meshInstances.some(
          (mi) => mi.node?.name === "psv-relief" && mi.visible && mi.visibleThisFrame,
        );
    if (meshDrawn()) {
      window.__phoneSpeedFirstViewError = "The relief's first draw was missed. Retry.";
      return;
    }
    let rendered = false;
    const stop = () => {
      app.off("postrender", postrender);
      app.off("frameend", frameend);
    };
    const postrender = () => {
      rendered =
        player.toyInfo?.id === id &&
        !player.loading &&
        window.__psv?.state().on &&
        meshDrawn() &&
        stage.device._drawCallsPerFrame > 0;
    };
    const frameend = () => {
      if (window.__phoneSpeedFirstView) return stop();
      if (!rendered || stage.device.contextLost) return;
      const submittedMs = performance.now();
      try {
        window.__phoneSpeedCompleteDraw(stage.device.gl);
      } catch (error) {
        window.__phoneSpeedFirstViewError = error.message;
        stop();
        return;
      }
      window.__phoneSpeedFirstView = {
        submittedMs,
        completedMs: performance.now(),
        path: "default-relief-mesh",
        gpuReadback: true,
      };
      stop();
    };
    app.on("postrender", postrender);
    app.on("frameend", frameend);
  };
  // Queue ahead of the app's render loop, including a fully cached load.
  requestAnimationFrame(attach);
}
