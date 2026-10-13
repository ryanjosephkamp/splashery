// A real-browser calibration: known solid colors on opposite sides of a known
// depth cut. Any third-color band beyond the one-pixel raster edge is a halo.
export async function calibration(page, { soft = false } = {}) {
  return page.evaluate(async (soft) => {
    const { player: pl } = window.__splashery;
    const { buildPhotoSplats } = await import("/src/packs/photo-3d-core.js");
    const { surfaceGrid } = await import("/src/photo3d/surface.js");
    const { backingField, depthBytes } = await import("/src/live/relief-height.js");
    const sharp = await import("/src/packs/photo-sharp.js");
    pl.motion.setControl("flat", 0, { snap: true });
    pl.motion.setControl("layers", 0, { snap: true });
    pl.setPaused(true);
    const w = 512,
      h = 384;
    const data = new Uint8Array(w * h * 4);
    const dw = 64,
      dh = 48,
      d = new Float32Array(dw * dh);
    const near = [224, 48, 24],
      far = [24, 72, 184];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        data.set(
          [...(x >= 152 && x < 360 && y >= 104 && y < 280 ? near : far), 255],
          (y * w + x) * 4,
        );
    for (let y = 0; y < dh; y++)
      for (let x = 0; x < dw; x++) {
        const distance = Math.min(x + 0.5 - 19, 45 - x - 0.5, y + 0.5 - 13, 35 - y - 0.5);
        d[y * dw + x] =
          1 + 4 * (soft ? Math.max(0, Math.min(1, 0.5 + distance / 3)) : distance > 0 ? 1 : 0);
      }
    const photo = { w, h, data };
    const cells = sharp.SHARP_CELLS[pl.profile];
    const s = buildPhotoSplats(
      photo,
      { w: dw, h: dh, d },
      { count: 32000, depth: 1, sharpCells: cells },
    );
    const f = Math.min(1, Math.sqrt(cells / (s.gx * s.gy)));
    const cols = Math.max(8, Math.round(s.gx * f)),
      rows = Math.max(8, Math.round(s.gy * f));
    s.background.surface = surfaceGrid(cols, rows);
    s.background.field = backingField(depthBytes(s.depth), s.cellBand, s.gx, s.gy, {
      cols: 96,
      rows: Math.max(8, Math.round((96 * rows) / cols)),
      reach: s.background.reach,
      inset: 0.998,
      base: 0.5,
      rim: Math.max(6 / rows, 0.03 * Math.max(1, cols / rows)),
    });
    sharp.sharpPhoto({
      photo,
      depth: s.depth,
      band: s.cellBand,
      gx: s.gx,
      gy: s.gy,
      aspect: w / h,
      relief: 0.78,
      uid: performance.now(),
      background: s.background,
    });
    sharp.setSharpView("photo-3d", "sharp");
    pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
    const edges = [];
    for (let y = 1; y < s.gy - 1; y++)
      for (let x = 1; x < s.gx - 1; x++) {
        const i = y * s.gx + x;
        if (
          s.depth[i] > 0.9 &&
          (s.depth[i - 1] < 0.8 ||
            s.depth[i + 1] < 0.8 ||
            s.depth[i - s.gx] < 0.8 ||
            s.depth[i + s.gx] < 0.8)
        )
          edges.push([x, y, s.depth[i]]);
      }
    return { near, far, grid: [cols, rows], depthGrid: [s.gx, s.gy], edges: edges.length };
  }, soft);
}

export async function calibrationShot(page, yaw, pitch) {
  return page.evaluate(
    async ([yaw, pitch]) => {
      const pl = window.__splashery.player;
      const { Vec3 } = await import("/src/pc.js");
      pl.camera.cur = {
        ...pl.camera.home,
        yaw: (yaw * Math.PI) / 180,
        pitch: (pitch * Math.PI) / 180,
      };
      pl.camera.tgt = { ...pl.camera.cur };
      pl.stage.setCameraPose(pl.camera.pose());
      pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
      await pl.stage.captureFrame();
      const f = await pl.stage.captureFrame();
      const corners = [
        [152 / 512, 104 / 384],
        [360 / 512, 104 / 384],
        [360 / 512, 280 / 384],
        [152 / 512, 280 / 384],
      ].map(([u, v]) => {
        const p = pl.stage.cameraEntity.camera.camera.worldToScreen(
          new Vec3(...pl.fromRecipe([((u - 0.5) * 512) / 384, 0.5 - v, 0.78 * 0.5])),
          f.width,
          f.height,
        );
        return [p.x, p.y];
      });
      return { image: f.toDataURL(), corners };
    },
    [yaw, pitch],
  );
}

export function calibrationMetric(png, corners, colors) {
  const { width: w, height: h, data } = png;
  let count = 0,
    holes = 0,
    area = 0,
    band = 0,
    sum = 0,
    maximum = 0;
  const distance = (x, y) =>
    Math.min(
      ...corners.map((a, i) => {
        const b = corners[(i + 1) % corners.length];
        const vx = b[0] - a[0],
          vy = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)),
        );
        return Math.hypot(x - a[0] - t * vx, y - a[1] - t * vy);
      }),
    );
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dist = distance(x + 0.5, y + 0.5);
      if (dist <= 1.5 || dist > 10) continue;
      const p = (y * w + x) * 4;
      let inside = false;
      for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const a = corners[i],
          b = corners[j];
        if (
          a[1] > y + 0.5 !== b[1] > y + 0.5 &&
          x + 0.5 < ((b[0] - a[0]) * (y + 0.5 - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
      if (inside) area++;
      if (data[p] < 5 && data[p + 1] > 250 && data[p + 2] < 5) {
        if (inside) holes++;
        continue;
      }
      const expected = colors[inside ? 0 : 1];
      const error = Math.max(...expected.map((v, k) => Math.abs(data[p + k] - v)));
      count++;
      sum += error;
      maximum = Math.max(maximum, error);
      if (error > 8) band++;
    }
  return {
    edgePixels: count,
    holes,
    holeFraction: holes / area,
    haloPixels: band,
    haloFraction: band / count,
    meanError: sum / count,
    maxError: maximum,
  };
}
