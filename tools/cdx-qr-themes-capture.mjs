// Same production camera, two rendered frames, sort wait, and PNG encoder as
// task 54. Transfer PNG as base64: Playwright's per-number array serialization
// dominates screening time for a 900px image. No pixels or render steps change.
export async function capturePicture(page, size = 900) {
  const { png, ...shot } = await page.evaluate(async (size) => {
    const { app: a, qrCraft: q } = window.__splashery;
    const w = q.picture().woven,
      p = a.player,
      kit = p.proc.ctx.kit;
    const half = w.code.size / 2 + 4;
    const pose = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      distance:
        (half * kit.transform.scale) / Math.tan((19 * Math.PI) / 180) / (p.camera.radius || 1),
    };
    const base = { cam: p.camera.getState(), time: p.time, idle: p.idle.weight };
    p.idle.weight = 0;
    p.stage.setFixedSize([size, size]);
    let canvas;
    try {
      await p.renderAt(p.time, pose);
      await new Promise((r) => setTimeout(r, 80));
      const frame = await p.renderAt(p.time, pose);
      canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(frame, 0, 0, size, size);
    } finally {
      p.stage.setFixedSize(null);
      p.camera.setState(base.cam, { snap: true });
      p.time = base.time;
      p.idle.weight = base.idle;
      p.applyLook();
      p.resume();
    }
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw Error("No picture capture");
    const png = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return {
      png,
      codeSize: w.code.size,
      text: w.code.text,
      margin: w.margin,
      options: q.picture().options,
    };
  }, size);
  return { ...shot, bytes: Buffer.from(png.split(",")[1], "base64") };
}
