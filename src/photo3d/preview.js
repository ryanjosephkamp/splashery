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
    "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:12%;box-sizing:border-box;pointer-events:none;background:var(--stage-bg,#fff);z-index:1";
  let finished = false,
    removed = false,
    url;
  Promise.resolve()
    .then(() => photo.preview || previewBytes(photo))
    .then((blob) => {
      if (removed) return;
      url = URL.createObjectURL(blob);
      picture.src = url;
      stage.append(picture);
    })
    .catch(() => {
      remove();
    });
  const watch = setInterval(() => {
    if (window.__splashery?.player?.scene?.toy?.id !== "photo-3d") {
      remove();
      canceled();
    } else if (finished && ready?.()) remove();
  }, 50);
  const remove = () => {
    removed = true;
    clearInterval(watch);
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
