// Pixel oracles shared by the real-browser goal sweep and its regression specs.
// A reference render supplies the complete projected picture, including its rim.
export function pictureMetrics(
  plain,
  reference,
  width,
  height,
  band = 12,
  sourceMaxAt = null,
  collectCandidates = false,
  pictureMask = null,
) {
  let pixels = 0;
  let holes = 0;
  let specks = 0;
  const candidates = [];
  const lum = (p, i) => p[i] * 0.2126 + p[i + 1] * 0.7152 + p[i + 2] * 0.0722;
  const shown = (p, i) => lum(p, i) * (p[i + 3] / 255) + 255 * (1 - p[i + 3] / 255);
  const inside = (pixel) => (pictureMask ? !!pictureMask[pixel] : reference[pixel * 4 + 3] >= 128);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (reference[i + 3] >= 128) {
        pixels++;
        holes += plain[i + 3] < 128;
      }
      if (!inside(i / 4)) continue;
      const value = shown(plain, i);
      if (value < 160) continue;
      const rim =
        x < band ||
        x + band >= width ||
        y < band ||
        y + band >= height ||
        !inside(i / 4 - band) ||
        !inside(i / 4 + band) ||
        !inside(i / 4 - band * width) ||
        !inside(i / 4 + band * width);
      if (!rim) continue;
      const neighbors = [];
      let sourceMax = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
          const q = (yy * width + xx) * 4;
          if (!inside(q / 4)) continue;
          neighbors.push(shown(plain, q));
          sourceMax = Math.max(sourceMax, lum(reference, q));
        }
      }
      neighbors.sort((a, b) => a - b);
      if (neighbors.length >= 9 && value > neighbors[Math.floor(neighbors.length / 2)] + 60) {
        if (collectCandidates) candidates.push({ pixel: i / 4, x, y, alpha: plain[i + 3] });
        // A transparent tear is introduced even over a bright source pixel.
        // Opaque source details use independently mapped native source support.
        const supported = sourceMaxAt?.[i / 4] ?? sourceMax;
        if ((sourceMaxAt !== null && plain[i + 3] < 128) || value > supported + 60) specks++;
      }
    }
  }
  return {
    pixels,
    holes,
    holeShare: holes / Math.max(1, pixels),
    edgeSpecks: specks,
    ...(collectCandidates ? { candidates } : {}),
  };
}
