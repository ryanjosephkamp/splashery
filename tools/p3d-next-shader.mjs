// MIT. Offline WebGL2 candidate overlay; never edits the classic source on disk.
export function softBoundaryShader(source, pixels = 3) {
  if (![2, 3, 4].includes(pixels)) throw new Error("The boundary band must be 2–4 source pixels");
  const before = "smoothstep(-0.5 * aa[axis], 0.5 * aa[axis], distance)";
  const after = `smoothstep(-max(0.5 * aa[axis], ${pixels / 2}.0 / float(textureSize(uColor, 0)[axis])), max(0.5 * aa[axis], ${pixels / 2}.0 / float(textureSize(uColor, 0)[axis])), distance)`;
  // GLSL decimal literals must not contain two decimal points.
  const replacement = after.replaceAll(`${pixels / 2}.0`, (pixels / 2).toFixed(1));
  if (!source.includes(before)) throw new Error("Classic shader identity changed");
  return source.replace(before, replacement);
}
