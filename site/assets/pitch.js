// The one-link page (lane Pitch): site/about/splashery/. Each live toy is the site's own player
// in an iframe. It starts only near the viewport and is unloaded again once it is well off it,
// so one or two toys run at a time and a phone never draws a toy nobody sees. Where 3D cannot
// start, the toy's still stays with a note. The first section's single splat is drawn here.

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const can3D = (() => {
  if ("gpu" in navigator) return true;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
})();

const theme = () => {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

function frameState(frame) {
  try {
    const doc = frame.contentDocument;
    if (doc?.body?.dataset.ready !== "true") return "loading";
    return doc.getElementById("fallback")?.hidden === false ? "failed" : "ready";
  } catch {
    return "loading";
  }
}

const stages = [...document.querySelectorAll("[data-pit-demo]")];

function load(stage) {
  const frame = stage.querySelector("iframe");
  if (stage.dataset.state) return;
  stage.dataset.state = "loading";
  let src = `${frame.dataset.src}&theme=${theme()}`;
  // Reduced motion: the toys hold still until someone turns them.
  if (reduced.matches && !/turntable=off/.test(src)) src += "&turntable=off";
  // The page's own ?renderer= (webgl2 or webgpu) passes on to each toy, as the player takes it.
  const renderer = new URLSearchParams(location.search).get("renderer");
  if (/^(webgl2|webgpu)$/.test(renderer || "")) src += `&renderer=${renderer}`;
  frame.src = src;
  frame.hidden = false;
  const started = performance.now();
  const check = () => {
    if (stage.dataset.state !== "loading" || frame.getAttribute("src") !== src) return;
    const s = frameState(frame);
    if (s === "ready") {
      stage.dataset.state = "ready";
      if (!stage.dataset.keep) stage.querySelector(".pit-note").textContent = "";
      // The player's own "Open in Splashery" opens a new tab, as every link to the app does here.
      const open = frame.contentDocument?.getElementById("open-link");
      if (open) open.target = "_blank";
    } else if (s === "failed" || performance.now() - started > 90_000) {
      fail(stage, "This toy could not start here, so this is a still of it.");
    } else setTimeout(check, 200);
  };
  check();
}

function unload(stage) {
  // A toy showing someone's own photo stays, so the photo isn't lost on the way back.
  if (!stage.dataset.state || stage.dataset.state === "failed" || stage.dataset.keep) return;
  const frame = stage.querySelector("iframe");
  delete stage.dataset.state;
  // about:blank, so the player's page (and its WebGL context) is let go in every browser.
  frame.src = "about:blank";
  frame.hidden = true;
}

function fail(stage, text) {
  stage.dataset.state = "failed";
  const frame = stage.querySelector("iframe");
  frame.src = "about:blank";
  frame.hidden = true;
  stage.querySelector(".pit-note").textContent = text;
}

if (!can3D) {
  for (const s of stages) fail(s, "This browser cannot start WebGL2 or WebGPU, so this is a still.");
} else if ("IntersectionObserver" in window) {
  // Start a little before a toy scrolls in; unload it once it is a screen away.
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) load(e.target);
    },
    { rootMargin: "25% 0px" },
  );
  const far = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (!e.isIntersecting) unload(e.target);
    },
    { rootMargin: "100% 0px" },
  );
  for (const s of stages) {
    near.observe(s);
    far.observe(s);
  }
} else {
  // An old browser: a button per toy, so nothing starts on its own.
  for (const s of stages) {
    const b = s.querySelector(".pit-start");
    b.hidden = false;
    b.addEventListener("click", () => {
      b.hidden = true;
      load(s);
    });
  }
}

// ---- Your own photo ------------------------------------------------------------------------
// The photo goes to the Photo to 3D toy inside its own player (the same origin), through the toy's
// own reader: the photo is decoded and its depth worked out in that page, as the Playground's Toy
// tab does it. Nothing leaves the device.

const ready = (stage) =>
  new Promise((resolve, reject) => {
    load(stage);
    const tick = () => {
      if (stage.dataset.state === "ready") resolve();
      else if (stage.dataset.state === "failed") reject(new Error("The toy could not start here."));
      else setTimeout(tick, 200);
    };
    tick();
  });

async function ownPhoto(stage, file) {
  const note = stage.querySelector(".pit-note");
  if (!file || !/^image\//.test(file.type || "image/")) {
    note.textContent = "That file isn't a photo. Open a JPEG, PNG, or WebP.";
    return;
  }
  stage.dataset.keep = "1";
  note.textContent = "Working out the depth on this device…";
  try {
    await ready(stage);
    const w = stage.querySelector("iframe").contentWindow;
    // import() in the player's own page, so it is the same module the toy runs on.
    const mod = await w.Function('return import("../../src/packs/photo-3d.js")')();
    const options = await mod.RECIPES["photo-3d"].input.read("", file.name, file);
    const player = w.__splashery.player;
    const toy = player.scene.toy;
    toy.options = { ...(toy.options || {}), ...options };
    const cam = player.camera.getState();
    await player.loadToy(toy);
    player.camera.setState(cam, { snap: true });
    note.textContent = "Your photo, on this device. Tap it to lift the depth.";
  } catch (err) {
    note.textContent = err?.message || "That photo could not be opened.";
  }
}

for (const box of document.querySelectorAll(".pit-own")) {
  const stage = document.querySelector('[data-pit-demo="photo-3d"]');
  if (!stage || stage.dataset.state === "failed") continue;
  const input = box.querySelector("[data-pit-own-file]");
  box.querySelector("[data-pit-own]").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    if (input.files?.[0]) ownPhoto(stage, input.files[0]);
    input.value = "";
  });
  // Dropped on the picture: the stage takes the file (the iframe would otherwise get it).
  const over = (on) => stage.classList.toggle("pit-drop", on);
  stage.addEventListener("dragenter", (e) => {
    if ([...(e.dataTransfer?.types || [])].includes("Files")) over(true);
  });
  stage.addEventListener("dragover", (e) => {
    e.preventDefault();
    over(true);
  });
  stage.addEventListener("dragleave", () => over(false));
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    over(false);
    ownPhoto(stage, e.dataTransfer?.files?.[0]);
  });
  box.hidden = false;
}
// While a file is dragged over the page, the players let it through to their stage.
let drags = 0;
addEventListener("dragenter", () => document.body.classList.toggle("pit-dragging", ++drags > 0));
addEventListener("dragleave", () => document.body.classList.toggle("pit-dragging", --drags > 0));
// A file dropped beside the picture is ignored, rather than opened in place of the page.
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => {
  e.preventDefault();
  drags = 0;
  document.body.classList.remove("pit-dragging");
});

// ---- One splat ------------------------------------------------------------------------------
// A 2D Gaussian: color times opacity times exp(-½ dᵀΣ⁻¹d), over the page's own background.
for (const box of document.querySelectorAll("[data-pit-one]")) {
  const canvas = box.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const inputs = [...box.querySelectorAll("input")];
  const W = canvas.width;
  const H = canvas.height;
  const img = ctx.createImageData(W, H);
  const draw = () => {
    const v = Object.fromEntries(inputs.map((i) => [i.dataset.k, Number(i.value)]));
    const dark = theme() === "dark";
    const bg = dark ? [24, 24, 24] : [246, 246, 244];
    const col = [255, 95, 162];
    const a = (v.rot * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const sx = v.sx * W;
    const sy = v.sy * H;
    const ix = 1 / (sx * sx);
    const iy = 1 / (sy * sy);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - W / 2;
        const dy = y - H / 2;
        const u = c * dx + s * dy;
        const w = -s * dx + c * dy;
        const g = v.a * Math.exp(-0.5 * (u * u * ix + w * w * iy) * 9);
        const o = (y * W + x) * 4;
        d[o] = bg[0] + (col[0] - bg[0]) * g;
        d[o + 1] = bg[1] + (col[1] - bg[1]) * g;
        d[o + 2] = bg[2] + (col[2] - bg[2]) * g;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  let queued = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  };
  for (const i of inputs) i.addEventListener("input", redraw);
  new MutationObserver(redraw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  draw();
}
