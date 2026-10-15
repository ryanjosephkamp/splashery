// A flat first view while the worker refines the relief. Encoding stays in the
// decode worker; even the first large canvas paint must not block the page.
import { previewBytes } from "./decode.js";
let current;
export function photoPreview(photo, canceled = () => {}, ready = null) {
  const stage = document.getElementById("stage");
  if (!stage) return () => {};
  current?.();
  const picture = document.createElement("img");
  picture.width = photo.w;
  picture.height = photo.h;
  picture.alt = "Photo preview";
  picture.setAttribute("aria-label", "Photo preview");
  picture.style.cssText =
    "position:fixed;object-fit:contain;padding:12%;box-sizing:border-box;pointer-events:none;background:var(--stage-bg,#fff);z-index:1";
  let finished = false,
    removed = false,
    url,
    resume,
    rendered;
  const stageRenderer = window.__splashery?.player?.stage;
  const align = () => {
    const r = stage.getBoundingClientRect();
    Object.assign(picture.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  };
  const layout = new ResizeObserver(align);
  layout.observe(stage);
  Promise.resolve()
    .then(() => photo.preview || previewBytes(photo))
    .then((blob) => {
      if (removed) return;
      url = URL.createObjectURL(blob);
      picture.src = url;
      // #stage is a canvas: its descendants are hidden fallback content.
      // A sibling follows its actual viewport rectangle, including the phone dock.
      stage.after(picture);
      align();
      resume = stageRenderer?.holdRendering?.();
    })
    .catch(() => {
      remove();
    });
  const watch = setInterval(() => {
    if (window.__splashery?.player?.scene?.toy?.id !== "photo-3d") {
      remove();
      canceled();
    } else if (finished && ready?.() && !rendered) {
      // Draw the new relief before lifting its cover. The picture and camera
      // stay at their original resolution and pose throughout the handoff.
      resume?.();
      resume = null;
      if (stageRenderer) {
        let frames = 0;
        rendered = () => {
          frames++;
          // Sharp is complete on its first draw. Splats need the worker's
          // asynchronous sort handoff before their cover can be lifted.
          if (window.__psv?.state().on || frames >= 3) remove();
        };
        stageRenderer.app.on("postrender", rendered);
        stageRenderer.requestRender();
      } else remove();
    }
  }, 50);
  const remove = () => {
    removed = true;
    clearInterval(watch);
    layout.disconnect();
    if (rendered) stageRenderer?.app.off("postrender", rendered);
    resume?.();
    resume = null;
    picture.remove();
    if (url) URL.revokeObjectURL(url);
    if (current === remove) current = null;
  };
  current = remove;
  return (immediate = false) => {
    if (immediate || !ready) remove();
    else finished = true;
  };
}
