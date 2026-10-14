// The production savePNG front camera and renderer, without its download/UI busy wait.
// The original reference has byte-identical RGBA to savePNG(900); final tests call savePNG too.
export async function capturePicture(page, size = 900, skipCover = false) {
  return page.evaluate(
    async ({ size, skipCover }) => {
      const { app: a, qrCraft: q } = window.__splashery;
      const w = q.picture().woven,
        kit = a.player.proc.ctx.kit;
      const half = w.code.size / 2 + 4;
      const pose = {
        yaw: 0,
        pitch: 0,
        roll: 0,
        distance:
          (half * kit.transform.scale) /
          Math.tan((19 * Math.PI) / 180) /
          (a.player.camera.radius || 1),
      };
      const draw = async () => {
        await a.player.renderAt(a.player.time, pose);
        await new Promise((r) => setTimeout(r, 80));
        const shot = await a.player.renderAt(a.player.time, pose);
        const c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(shot, 0, 0, size, size);
        return c;
      };
      let canvas;
      if (skipCover) {
        // The measurement page is private. Skip only the visible cover screenshot;
        // fixed resolution, frozen time/camera, renderer, and sort wait are identical.
        const p = a.player,
          base = { cam: p.camera.getState(), time: p.time, idle: p.idle.weight };
        p.idle.weight = 0;
        p.stage.setFixedSize([size, size]);
        try {
          canvas = await draw();
        } finally {
          p.stage.setFixedSize(null);
          p.camera.setState(base.cam, { snap: true });
          p.time = base.time;
          p.idle.weight = base.idle;
          p.applyLook();
          p.resume();
        }
      } else canvas = await a.withCapture([size, size], draw);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw Error("No picture capture");
      return {
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        codeSize: w.code.size,
        text: w.code.text,
        margin: w.margin,
        options: q.picture().options,
      };
    },
    { size, skipCover },
  );
}
