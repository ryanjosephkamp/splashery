// A deterministic image-to-ASCII converter. No engine, DOM, model, or service dependency.
// The default palette runs from dark to light on a dark background.
export function pixelsToText(image, options = {}) {
  const { data, width, height } = image ?? {};
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096 ||
    !(data instanceof Uint8Array || data instanceof Uint8ClampedArray) ||
    data.length !== width * height * 4
  ) {
    throw new TypeError("Expected an RGBA byte image, at most 4096 by 4096 pixels");
  }
  if (!options || typeof options !== "object") throw new TypeError("Expected ASCII options");
  const columns = Math.round(options.columns ?? 96);
  const aspect = options.characterAspect ?? 0.5; // Measured glyph advance / line height.
  const rowCount = Math.round(options.rows ?? (columns * height * aspect) / width);
  const palette = options.palette ?? " .:-=+*#%@";
  const contrast = options.contrast ?? 1.3;
  const gamma = options.gamma ?? 0.7;
  const background = options.background ?? [17, 17, 17];
  const blackPoint = options.blackPoint ?? 17;
  if (
    !Number.isFinite(options.columns ?? 96) ||
    !Number.isFinite(options.rows ?? rowCount) ||
    columns < 8 ||
    columns > 200 ||
    rowCount < 4 ||
    rowCount > 200 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    typeof palette !== "string" ||
    !/^[\x20-\x7e]{2,64}$/.test(palette) ||
    !Number.isFinite(contrast) ||
    contrast <= 0 ||
    !Number.isFinite(gamma) ||
    gamma <= 0 ||
    !Number.isFinite(blackPoint) ||
    blackPoint < 0 ||
    blackPoint >= 255 ||
    !Array.isArray(background) ||
    background.length !== 3 ||
    !background.every((value) => Number.isFinite(value) && value >= 0 && value <= 255)
  ) {
    throw new RangeError("Expected a bounded grid and printable ASCII palette");
  }
  const rows = [];
  const colors = [];
  // Exact area averaging, including fractional pixel edges. This does not use
  // browser image scaling, so identical RGBA bytes and options give identical rows.
  for (let y = 0; y < rowCount; y++) {
    let line = "";
    const colorRow = [];
    const y0 = (y * height) / rowCount;
    const y1 = ((y + 1) * height) / rowCount;
    for (let x = 0; x < columns; x++) {
      const x0 = (x * width) / columns;
      const x1 = ((x + 1) * width) / columns;
      let red = 0,
        green = 0,
        blue = 0,
        total = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const weight =
            (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0));
          const i = (sy * width + sx) * 4;
          const alpha = data[i + 3] / 255;
          red += weight * (data[i] * alpha + background[0] * (1 - alpha));
          green += weight * (data[i + 1] * alpha + background[1] * (1 - alpha));
          blue += weight * (data[i + 2] * alpha + background[2] * (1 - alpha));
          total += weight;
        }
      }
      red /= total;
      green /= total;
      blue /= total;
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const level = Math.pow(
        Math.max(0, Math.min(1, ((luminance - blackPoint) / (255 - blackPoint)) * contrast)),
        gamma,
      );
      line += palette[Math.min(palette.length - 1, Math.floor(level * palette.length))];
      colorRow.push((Math.round(red) << 16) | (Math.round(green) << 8) | Math.round(blue));
    }
    rows.push(line);
    colors.push(colorRow);
  }
  return { rows, colors, columns, rowCount, characterAspect: aspect, palette };
}

// Optional browser presentation. The rows remain plain ASCII even in color mode.
// Use this renderer's returned characterAspect when converting matching frames.
export function renderTextCanvas(canvas, frame, options = {}) {
  const { fontSize = 10, lineHeight = 12, color = false, footer = [] } = options;
  if (
    !frame ||
    !Number.isInteger(frame.columns) ||
    !Number.isInteger(frame.rowCount) ||
    frame.columns < 8 ||
    frame.columns > 200 ||
    frame.rowCount < 4 ||
    frame.rowCount > 200 ||
    !Array.isArray(frame.rows) ||
    frame.rows.length !== frame.rowCount ||
    !frame.rows.every(
      (row) =>
        typeof row === "string" && row.length === frame.columns && /^[\x20-\x7e]+$/.test(row),
    ) ||
    !Number.isFinite(fontSize) ||
    fontSize < 6 ||
    fontSize > 64 ||
    !Number.isFinite(lineHeight) ||
    lineHeight < fontSize ||
    lineHeight > 80 ||
    !Array.isArray(footer) ||
    footer.length > 8 ||
    !footer.every((line) => typeof line === "string" && line.length <= 200) ||
    (color &&
      (!Array.isArray(frame.colors) ||
        frame.colors.length !== frame.rowCount ||
        !frame.colors.every(
          (row) =>
            Array.isArray(row) &&
            row.length === frame.columns &&
            row.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffffff),
        )))
  )
    throw new RangeError("Expected a bounded ASCII frame and canvas style");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A 2D canvas context is required");
  const font = `bold ${fontSize}px "Courier New", monospace`;
  ctx.font = font;
  const advance = ctx.measureText("M").width;
  ctx.font = '11px "Courier New", monospace';
  const footerWidth = Math.max(0, ...footer.map((line) => ctx.measureText(line).width));
  const width = Math.ceil(Math.max(advance * frame.columns, footerWidth)) + 16;
  const height = Math.ceil(lineHeight * frame.rowCount) + 16 + footer.length * 14;
  if (width * height > 4096 * 4096) throw new RangeError("Canvas exceeds the pixel limit");
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, width, height);
  ctx.font = font;
  ctx.textBaseline = "top";
  for (let y = 0; y < frame.rowCount; y++) {
    if (!color) {
      ctx.fillStyle = "#eeeeee";
      ctx.fillText(frame.rows[y], 8, 8 + y * lineHeight);
    } else {
      for (let x = 0; x < frame.columns; x++) {
        ctx.fillStyle = "#" + frame.colors[y][x].toString(16).padStart(6, "0");
        ctx.fillText(frame.rows[y][x], 8 + x * advance, 8 + y * lineHeight);
      }
    }
  }
  ctx.font = '11px "Courier New", monospace';
  ctx.fillStyle = "#dddddd";
  footer.forEach((line, i) => ctx.fillText(line, 8, height - footer.length * 14 + i * 14));
  return { advance, lineHeight, characterAspect: advance / lineHeight };
}
