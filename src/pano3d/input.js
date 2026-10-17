import { decodeBytes } from "../photo3d/decode.js";

export function readGPano(text) {
  const names = {
    FullPanoWidthPixels: "fullWidth",
    FullPanoHeightPixels: "fullHeight",
    CroppedAreaImageWidthPixels: "cropWidth",
    CroppedAreaImageHeightPixels: "cropHeight",
    CroppedAreaLeftPixels: "left",
    CroppedAreaTopPixels: "top",
    PoseHeadingDegrees: "poseHeading",
    InitialViewHeadingDegrees: "initialHeading",
  };
  const out = {};
  for (const [name, key] of Object.entries(names)) {
    const m = text.match(
      new RegExp(`GPano:${name}\\s*=\\s*["']([^"']+)["']|<GPano:${name}[^>]*>([^<]+)<`),
    );
    if (m) {
      const value = Number(m[1] ?? m[2]);
      if (
        !Number.isFinite(value) ||
        (key !== "poseHeading" &&
          key !== "initialHeading" &&
          (!Number.isInteger(value) || value < 0))
      )
        throw new Error("The panorama metadata contains invalid dimensions.");
      out[key] = value;
    }
  }
  for (const key of ["fullWidth", "fullHeight", "cropWidth", "cropHeight"])
    if (out[key] !== undefined && out[key] <= 0)
      throw new Error("The panorama metadata contains invalid dimensions.");
  const projection = text.match(
    /GPano:ProjectionType\s*=\s*["']([^"']+)["']|<GPano:ProjectionType[^>]*>([^<]+)</,
  );
  if (projection && (projection[1] ?? projection[2]).trim().toLowerCase() !== "equirectangular")
    throw new Error("Open an equirectangular panorama, rather than a cylindrical projection.");
  return out;
}
export function validatePanorama(w, h, meta = {}) {
  if (!(w > 0 && h > 0) || Math.abs(w / h - 2) > 0.02)
    throw new Error("Open a complete 2:1 equirectangular panorama (twice as wide as it is tall).");
  if (
    (meta.fullWidth && meta.fullHeight && Math.abs(meta.fullWidth / meta.fullHeight - 2) > 0.02) ||
    (meta.cropWidth && meta.fullWidth && meta.cropWidth !== meta.fullWidth) ||
    (meta.cropHeight && meta.fullHeight && meta.cropHeight !== meta.fullHeight) ||
    meta.left > 0 ||
    meta.top > 0
  )
    throw new Error(
      "This panorama is cropped. Open the complete sphere, including the ceiling and floor.",
    );
  const heading = (meta.initialHeading ?? meta.poseHeading ?? 0) - (meta.poseHeading ?? 0);
  return { ...meta, heading: ((((heading + 180) % 360) + 360) % 360) - 180 };
}
export async function openPanorama(file, maxSide = 2048) {
  if (!file || file.size > 40 * 1024 * 1024) throw new Error("Open a panorama smaller than 40 MB.");
  const metadata = readGPano(
    new TextDecoder("latin1").decode(await file.slice(0, 1024 * 1024).arrayBuffer()),
  );
  const photo = await decodeBytes(file, maxSide);
  return { photo, metadata: validatePanorama(photo.w, photo.h, metadata) };
}
