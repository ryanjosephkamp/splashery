// Lane Any pose: a toy's tap measured upright, on its side and upside down
// (in the page; tools/pose-sweep.mjs and tests/pose.spec.mjs load it). See
// tools/pose-sweep.mjs for what the numbers mean.

export async function measure({ id, size, kitfix }) {
  const { app, player } = window.__splashery;
  const stage = player.stage;
  const TIMES = [0.35, 0.9, 1.8];
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const quatAxis = (a, t) => [a[0] * Math.sin(t / 2), a[1] * Math.sin(t / 2), a[2] * Math.sin(t / 2), Math.cos(t / 2)]; // prettier-ignore
  const fieldsMod = kitfix ? await import("/src/physics/fields.js") : null;
  const out = { frames: {} };
  const shots = {};
  for (const which of ["up", "side", "down"]) {
    await app.chooseToy(id);
    await wait(300);
    const info = player.toyInfo;
    if (which === "up") {
      out.canPlay = !!player.handsOn && (await import("/src/physics/hands-on.js")).canPlay(info);
      out.mode = info.recipe?.hands && (info.recipe.hands.pieces || info.recipe.hands.joints || info.recipe.hands.ropes || info.recipe.hands.cloth || info.recipe.hands.stretch) ? "pieces" : "toy"; // prettier-ignore
    }
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    app.setLook({ background: "#000000" });
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    stage.setFixedSize([size, size]);
    const home = () => {
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
    };
    home();
    const cam = player.camera.pose();
    const target = cam.position.map((v, k) => v + cam.forward[k] * cam.distance);
    const angle = which === "side" ? Math.PI / 2 : which === "down" ? Math.PI : 0;
    if (angle) {
      const pose = { pivot: target, q: quatAxis(cam.forward, angle), t: [0, 0, 0] };
      stage.setToyPose(pose);
      if (fieldsMod && player.motion.ctx?.kit) player.motion.handsFix = (u) => fieldsMod.poseKitUniforms(u, pose); // prettier-ignore
    }
    const snap = async () => {
      home();
      pending = 0;
      const c = await stage.captureFrame();
      return c.getContext("2d").getImageData(0, 0, size, size);
    };
    // The clock moves on without drawing (only the measured frames are drawn).
    const advance = async (secs) => {
      const step = 1 / 30;
      for (let t = 0; t < secs - 1e-6; t += step) {
        home();
        for (const h of handlers) h(step);
      }
    };
    // The same clock in every pose (some effects run on the page's clock).
    player.time = 100;
    player.scene.seed = 12345;
    player.motion.kitClock = { t: 0, last: null, rate: 1 };
    player.motion.moveClock = { t: 0, last: null, rate: 1 };
    await advance(0.4);
    const frames = [await snap()];
    player.act(null);
    let at = 0;
    for (const T of TIMES) {
      await advance(T - at);
      at = T;
      frames.push(await snap());
    }
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    stage.setToyPose(null);
    player.motion.handsFix = null;
    shots[which] = { frames, angle };
  }
  // Compares two frames where either shows the toy: mean |difference| (0..255).
  const diff = (a, b) => {
    let s = 0;
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const la = a.data[i] + a.data[i + 1] + a.data[i + 2];
      const lb = b.data[i] + b.data[i + 1] + b.data[i + 2];
      if (la < 12 && lb < 12) continue;
      s += (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3; // prettier-ignore
      n++;
    }
    return n ? s / n : 0;
  };
  // A frame turned on the screen about its middle.
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const src = document.createElement("canvas");
  src.width = src.height = size;
  const sg = src.getContext("2d");
  const turn = (img, a) => {
    sg.putImageData(img, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    g.translate(size / 2, size / 2);
    g.rotate(a);
    g.translate(-size / 2, -size / 2);
    g.drawImage(src, 0, 0);
    return g.getImageData(0, 0, size, size);
  };
  const up = shots.up.frames;
  const moves = up.slice(1).map((f) => diff(f, up[0]));
  out.move = Math.max(...moves);
  for (const which of ["side", "down"]) {
    const { frames, angle } = shots[which];
    // Which way the screen turns: whichever undoes the pose before the tap.
    const sign = diff(turn(frames[0], angle), up[0]) <= diff(turn(frames[0], -angle), up[0]) ? 1 : -1; // prettier-ignore
    const floor = diff(turn(frames[0], sign * angle), up[0]);
    const errs = frames.slice(1).map((f, i) => Math.max(0, diff(turn(f, sign * angle), up[i + 1]) - floor)); // prettier-ignore
    const err = Math.max(...errs);
    out[which] = { err, floor, errs, rel: err / Math.max(out.move, 1) };
  }
  delete out.frames;
  return out;
}
