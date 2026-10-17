// A local Canvas 2D triangle preview; no second 3D engine or network dependency.
export function meshPreview(canvas, mesh) {
  const ctx = canvas.getContext("2d"),
    p = mesh.positions,
    idx = mesh.indices,
    n = mesh.normals;
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], p[i]);
    hi[i % 3] = Math.max(hi[i % 3], p[i]);
  }
  const center = lo.map((v, k) => (v + hi[k]) / 2),
    radius = Math.hypot(...hi.map((v, k) => v - lo[k])) / 2;
  let yaw = 0.5,
    pitch = 0.25,
    drag = null;
  function draw() {
    const w = canvas.width,
      h = canvas.height,
      cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cx = Math.cos(pitch),
      sx = Math.sin(pitch);
    ctx.fillStyle = "#131b22";
    ctx.fillRect(0, 0, w, h);
    const points = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      const x = (p[i] - center[0]) / radius,
        y = (p[i + 1] - center[1]) / radius,
        z = (p[i + 2] - center[2]) / radius;
      const rx = cy * x + sy * z,
        rz = -sy * x + cy * z;
      points[i] = w / 2 + rx * h * 0.43;
      points[i + 1] = h / 2 - (cx * y - sx * rz) * h * 0.43;
      points[i + 2] = sx * y + cx * rz;
    }
    const order = Array.from({ length: idx.length / 3 }, (_, i) => i).sort((a, b) => {
      const depth = (i) =>
        points[idx[i * 3] * 3 + 2] +
        points[idx[i * 3 + 1] * 3 + 2] +
        points[idx[i * 3 + 2] * 3 + 2];
      return depth(a) - depth(b);
    });
    for (const tri of order) {
      const a = idx[tri * 3] * 3,
        b = idx[tri * 3 + 1] * 3,
        c = idx[tri * 3 + 2] * 3;
      const light = 0.5 + 0.5 * Math.abs(n[a] * 0.3 + n[a + 1] * 0.7 + n[a + 2] * 0.6);
      const rgb = [0, 1, 2].map((k) => Math.round(255 * Math.min(1, mesh.colors[a + k] * light)));
      ctx.fillStyle = `rgb(${rgb.join(",")})`;
      ctx.beginPath();
      ctx.moveTo(points[a], points[a + 1]);
      ctx.lineTo(points[b], points[b + 1]);
      ctx.lineTo(points[c], points[c + 1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  const down = (e) => {
    drag = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag) return;
    yaw += (e.clientX - drag[0]) * 0.012;
    pitch += (e.clientY - drag[1]) * 0.012;
    drag = [e.clientX, e.clientY];
    draw();
  };
  const up = () => {
    drag = null;
  };
  canvas.onpointerdown = down;
  canvas.onpointermove = move;
  canvas.onpointerup = up;
  canvas.onpointercancel = up;
  draw();
  return () => {
    canvas.onpointerdown =
      canvas.onpointermove =
      canvas.onpointerup =
      canvas.onpointercancel =
        null;
  };
}
