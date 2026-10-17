const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
async function watchPictures(page) {
  await page.evaluate(async () => {
    window.__r4Moving = await import("/src/packs/moving-photo.js");
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const color = ReliefMesh.prototype.setColor,
      draw = CanvasRenderingContext2D.prototype.drawImage;
    window.__r4Videos = new WeakMap();
    ReliefMesh.prototype.setColor = function (...args) {
      const r = color.apply(this, args);
      window.__r4Mesh = this;
      return r;
    };
    CanvasRenderingContext2D.prototype.drawImage = function (src, ...args) {
      const r = draw.call(this, src, ...args);
      if (src instanceof HTMLVideoElement) window.__r4Videos.set(this.canvas, src);
      return r;
    };
    await window.__splashery.app.chooseToy("moving-photo-3d");
    window.__splashery.app.setControl("play", 0);
  });
}
async function chosenPicture(page) {
  await page.waitForFunction(() => !window.__splashery.player.loading);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.evaluate(() => {
    const moving = window.__r4Moving.MOVING,
      clip = moving.clip,
      mesh = window.__r4Mesh;
    const source = mesh.colorSrc,
      level = mesh.color.getSource();
    let own = false,
      pixels;
    if (ArrayBuffer.isView(level)) {
      pixels = level;
      own =
        pixels.length === clip.colors[moving.frame].length &&
        pixels.every((v, i) => v === clip.colors[moving.frame][i]);
    } else if (source instanceof HTMLVideoElement) {
      own = source === clip.video || source.currentSrc === clip.audio?.url;
    } else if (source instanceof HTMLCanvasElement) {
      pixels = source.getContext("2d").getImageData(0, 0, source.width, source.height).data;
      const video = window.__r4Videos.get(source);
      if (video && (video === clip.video || video.currentSrc === clip.audio?.url)) {
        for (const cpu of [false, true]) {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const g = canvas.getContext("2d", { willReadFrequently: cpu });
          g.drawImage(video, 0, 0);
          const expected = g.getImageData(0, 0, canvas.width, canvas.height).data;
          own ||= pixels.length === expected.length && pixels.every((v, i) => v === expected[i]);
        }
      }
    }
    let hash = 2166136261;
    if (pixels) for (const v of pixels) hash = Math.imul(hash ^ v, 16777619) >>> 0;
    return {
      name: clip.name,
      sample: clip.sample,
      own,
      hash,
      sharp: window.__psv.state().on,
      bound: mesh.matS.getParameter("uColor")?.data === mesh.color,
      shared: !clip.video || clip.audio?.track.el === clip.video,
    };
  });
}

export { android, watchPictures, chosenPicture };
