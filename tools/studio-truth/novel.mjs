// MIT. Known camera motion, calibrated once to the source image's median plane.
// This evaluates a stylized relief at real held-out cameras; it does not turn
// the relief into metric geometry or fit a transform to held-out pixels.
function calibration(base, median, imageHeight) {
  const distance = (base.K[1][1] * imageHeight) / base.height;
  if (!Number.isFinite(median) || median <= 0 || !Number.isFinite(distance) || distance <= 0)
    throw new Error("Invalid source-plane calibration");
  return { distance, scale: distance / median };
}

export function worldToRecipePoint(point, base, median, imageHeight) {
  const { distance, scale } = calibration(base, median, imageHeight);
  const m = base.camera_to_world;
  const delta = point.map((v, i) => v - m[i][3]);
  const local = [0, 1, 2].map((c) => delta.reduce((sum, v, r) => sum + m[r][c] * v, 0));
  return [local[0] * scale, -local[1] * scale, distance - local[2] * scale].map((v) =>
    v === 0 ? 0 : v,
  );
}

export function calibratedCamera(base, target, median, imageHeight) {
  calibration(base, median, imageHeight);
  const position = worldToRecipePoint(
    target.camera_to_world.slice(0, 3).map((row) => row[3]),
    base,
    median,
    imageHeight,
  );
  const signs = [1, -1, -1];
  const rotation = [0, 1, 2].map((r) =>
    [0, 1, 2].map((c) => {
      let sum = 0;
      for (let i = 0; i < 3; i++) sum += base.camera_to_world[i][r] * target.camera_to_world[i][c];
      const value = signs[r] * signs[c] * sum;
      return value === 0 ? 0 : value;
    }),
  );
  return {
    position,
    rotation,
    fov: (2 * Math.atan(target.height / (2 * target.K[1][1])) * 180) / Math.PI,
    convention: "source median-plane calibration, no held-out pixel fitting",
  };
}
