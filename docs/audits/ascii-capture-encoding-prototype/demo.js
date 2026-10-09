import { pixelsToText, renderTextCanvas } from "./ascii.js";
import { encodeGif, encodeVideo, videoSupport } from "./encoders.js";

const el = (id) => document.getElementById(id);
const canvas = el("preview");
const status = el("status");
const sourceCanvas = document.createElement("canvas");
const sourceContext = sourceCanvas.getContext("2d", {
  willReadFrequently: true,
});
let samples;
let sample;
let frames = [];
let index = 0;
let playing = false;
let animation = 0;
let generation = 0;
let activeJob;
let resultURL;
let settings;
const support = videoSupport();

for (const [name, url] of Object.entries(
  window.__asciiLicenses ?? {
    "splashery-MIT.txt": "./licenses/splashery-MIT.txt",
    "gifenc-MIT.txt": "./licenses/gifenc-MIT.txt",
  },
)) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.textContent = name;
  el("license-notices").append(link, " ");
}

export function validateSample(value) {
  if (
    !value ||
    !/^[a-z0-9-]{1,40}$/.test(value.toy) ||
    ![8, 10, 12].includes(value.fps) ||
    !Array.isArray(value.frames) ||
    value.frames.length < 1 ||
    value.frames.length > 64 ||
    !value.frames.every(
      (frame) =>
        typeof frame === "string" &&
        frame.length < 1_000_000 &&
        /^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(frame),
    ) ||
    JSON.stringify(value).length > 12_000_000
  )
    throw new Error(
      "Use a capture JSON with 1–64 PNG frames, a toy id, and fps 8, 10, or 12 (under 12 MB).",
    );
  // Check IHDR dimensions before an image decoder allocates the bitmap.
  for (const frame of value.frames) {
    const header = Uint8Array.from(atob(frame.slice(22, 66)), (character) =>
      character.charCodeAt(0),
    );
    const view = new DataView(header.buffer);
    if (
      header.length < 24 ||
      header[0] !== 137 ||
      String.fromCharCode(...header.slice(1, 4)) !== "PNG" ||
      String.fromCharCode(...header.slice(12, 16)) !== "IHDR" ||
      view.getUint32(16) < 1 ||
      view.getUint32(16) > 512 ||
      view.getUint32(20) < 1 ||
      view.getUint32(20) > 512
    )
      throw new Error("PNG source dimensions must be 1–512 pixels.");
  }
  const credit = value.credit;
  if (credit) {
    for (const key of ["title", "author", "source", "license", "licenseUrl", "changes"]) {
      if (typeof credit[key] !== "string" || credit[key].length > 500)
        throw new Error("The source credit is incomplete or too long.");
    }
    if (
      `${credit.title} - ${credit.author} - ${credit.license}`.length > 200 ||
      credit.source.length > 200 ||
      credit.licenseUrl.length > 200
    )
      throw new Error("Visible attribution lines must be under 200 characters.");
    for (const key of ["source", "licenseUrl"])
      if (!/^https?:\/\//.test(credit[key]))
        throw new Error("Source and license links must use HTTP or HTTPS.");
  }
  return value;
}

function footer() {
  const credit = sample.credit;
  const wrap = (value) => {
    const words = value.split(" "),
      lines = [];
    let line = "";
    const limit = Math.max(42, Math.min(80, settings.columns));
    for (const word of words) {
      if (line && line.length + word.length + 1 > limit) {
        lines.push(line);
        line = "";
      }
      line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines;
  };
  return credit
    ? [
        `${credit.title} - ${credit.author} - ${credit.license}`,
        credit.source,
        credit.licenseUrl,
        ...wrap("Splashery: " + credit.changes.replace(/recentred/g, "recentered")),
        "Prototype: fixed-view capture converted to ASCII.",
      ].slice(0, 8)
    : [
        ["grapes", "orange"].includes(sample.toy)
          ? `Splashery ${sample.toy} | procedural source`
          : `Captured ${sample.toy} | source credit not supplied`,
        "Fresh fixed-view capture converted to ASCII.",
      ];
}

function pause() {
  playing = false;
  cancelAnimationFrame(animation);
  el("play").textContent = "Play";
}
function draw() {
  if (!frames[index]) return;
  renderTextCanvas(canvas, frames[index], {
    color: settings.color,
    footer: footer(),
  });
  canvas.dataset.frame = index;
  el("timeline").value = index;
  el("position").textContent =
    `${index + 1} / ${frames.length} · ${(index / sample.fps).toFixed(1)} seconds`;
  el("text").value = frames[index].rows.join("\n");
}

function setBusy(value) {
  for (const id of [
    "toy",
    "columns",
    "contrast",
    "color",
    "play",
    "reset",
    "timeline",
    "make-gif",
    "make-video",
    "save-source",
    "save-ascii",
    "import",
  ])
    el(id).disabled = value;
  if (!support.ok) el("make-video").disabled = true;
  el("cancel").disabled = !value;
  el("progress").hidden = !value;
}

function clearResult() {
  if (resultURL) URL.revokeObjectURL(resultURL);
  resultURL = null;
  el("result").hidden = true;
  el("gif-result").removeAttribute("src");
  el("video-result").pause();
  el("video-result").removeAttribute("src");
  el("video-result").load();
}

function credit() {
  el("credit").textContent = sample.credit
    ? `${sample.credit.title} by ${sample.credit.author}; ${sample.credit.license}. ${sample.credit.changes.replace(/recentred/g, "recentered")} Fixed-view capture and ASCII conversion added in this prototype.`
    : ["grapes", "orange"].includes(sample.toy)
      ? `Splashery ${sample.toy}; procedural source. Fresh capture and ASCII conversion.`
      : `Captured ${sample.toy}; source credit not supplied. Imported metadata is provided by the file.`;
  el("source-link").hidden = !sample.credit;
  el("license-link").hidden = !sample.credit;
  if (sample.credit) {
    el("source-link").href = sample.credit.source;
    el("license-link").href = sample.credit.licenseUrl;
  }
  el("revision").textContent = sample.revision
    ? `Source checkout ${sample.revision.slice(0, 8)} · ${sample.frames.length} lossless PNG frames · ${sample.fps} fps`
    : "Imported capture · source metadata is supplied by the file.";
  for (const mode of ["mono", "color"]) {
    const key = `${sample.toy}/96-${mode}/animation.mp4`;
    const link = el(`verified-${mode}`);
    link.hidden = window.__asciiVerified
      ? !window.__asciiVerified[key]
      : !["grapes", "orange", "strawberry"].includes(sample.toy);
    if (!link.hidden) {
      link.href = window.__asciiVerified?.[key] ?? `./exports/${key}`;
      link.download = `${sample.toy}-96-${mode}-verified.mp4`;
    }
  }
}

async function convert() {
  const token = ++generation;
  pause();
  clearResult();
  frames = [];
  document.body.dataset.ready = "false";
  setBusy(true);
  const job = new AbortController();
  activeJob = job;
  sample = samples.find((item) => item.toy === el("toy").value);
  sourceContext.font = 'bold 10px "Courier New", monospace';
  settings = {
    columns: Number(el("columns").value),
    contrast: Number(el("contrast").value),
    characterAspect: sourceContext.measureText("M").width / 12,
    color: el("color").checked,
  };
  credit();
  try {
    const converted = [];
    for (const [i, data] of sample.frames.entries()) {
      if (job.signal.aborted) throw new DOMException("Conversion canceled", "AbortError");
      status.textContent = `Converting ${sample.toy}: ${i + 1} / ${sample.frames.length}…`;
      const image = new Image();
      image.src = data;
      try {
        await image.decode();
        if (image.width > 512 || image.height > 512 || image.width < 1 || image.height < 1)
          throw new Error("Source images must be at most 512 × 512 pixels.");
        sourceCanvas.width = image.width;
        sourceCanvas.height = image.height;
        sourceContext.drawImage(image, 0, 0);
        converted.push(
          pixelsToText(sourceContext.getImageData(0, 0, image.width, image.height), settings),
        );
      } finally {
        image.src = "";
      }
      el("progress").value = (i + 1) / sample.frames.length;
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (token !== generation) return;
    }
    if (job.signal.aborted) throw new DOMException("Conversion canceled", "AbortError");
    frames = converted;
    index = 0;
    el("timeline").max = frames.length - 1;
    document.body.dataset.ready = "true";
    status.textContent = `${sample.toy} · ${frames[0].columns} × ${frames[0].rowCount} characters · ${(frames.length / sample.fps).toFixed(1)} seconds. Ready to export.`;
    draw();
  } catch (error) {
    status.textContent =
      error.name === "AbortError"
        ? "Canceled. Change a setting or choose an example to start again."
        : error.message;
    document.body.dataset.ready = "error";
  } finally {
    if (token === generation) {
      activeJob = null;
      setBusy(false);
    }
  }
}

async function createMedia(type) {
  if (!frames.length || activeJob) return;
  pause();
  clearResult();
  setBusy(true);
  activeJob = new AbortController();
  const metadata = {
    toy: sample.toy,
    credit: sample.credit ?? null,
    sourceRevision: sample.revision ?? null,
    settings,
    fps: sample.fps,
    frameCount: frames.length,
    changes: "Fresh fixed-view capture, converted to ASCII, encoded from the selected settings.",
  };
  try {
    const opts = {
      fps: sample.fps,
      color: settings.color,
      footer: footer(),
      metadata,
      signal: activeJob.signal,
      onProgress: (amount) => {
        el("progress").value = amount;
        status.textContent = `Creating ${type}: ${Math.round(amount * 100)}%…`;
      },
    };
    const result = type === "GIF" ? await encodeGif(frames, opts) : await encodeVideo(frames, opts);
    const extension = type === "GIF" ? "gif" : result.ext;
    resultURL = URL.createObjectURL(result.blob);
    const link = el("download");
    link.href = resultURL;
    link.download = `${sample.toy}-${settings.columns}-${settings.color ? "color" : "mono"}.${extension}`;
    link.textContent = `Download ${extension.toUpperCase()} (${(result.blob.size / 1024).toFixed(0)} KB)`;
    el("gif-result").hidden = type !== "GIF";
    el("video-result").hidden = type === "GIF";
    if (type === "GIF") el("gif-result").src = resultURL;
    else el("video-result").src = resultURL;
    el("result").hidden = false;
    status.textContent = `${extension.toUpperCase()} ready. It uses the ${settings.columns}-column ${settings.color ? "color" : "monochrome"} settings shown above.`;
    window.__asciiLastExport = {
      ...result,
      blob: undefined,
      metadata,
      type: extension,
      bytes: result.blob.size,
    };
    return result;
  } catch (error) {
    status.textContent =
      error.name === "AbortError"
        ? "Export canceled. Nothing was saved."
        : `Export stopped: ${error.message}`;
    window.__asciiLastExport = {
      canceled: error.name === "AbortError",
      error: error.message,
    };
  } finally {
    activeJob = null;
    setBusy(false);
  }
}

function saveJSON(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value) + "\n"], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

el("play").addEventListener("click", () => {
  if (playing) return pause();
  if (!frames.length) return;
  playing = true;
  el("play").textContent = "Pause";
  const start = performance.now(),
    first = index;
  const tick = (now) => {
    if (!playing) return;
    const next = (first + Math.floor(((now - start) * sample.fps) / 1000)) % frames.length;
    if (next !== index) {
      index = next;
      draw();
    }
    animation = requestAnimationFrame(tick);
  };
  animation = requestAnimationFrame(tick);
});
el("reset").addEventListener("click", () => {
  pause();
  index = 0;
  draw();
});
el("timeline").addEventListener("input", () => {
  pause();
  index = Number(el("timeline").value);
  draw();
});
for (const id of ["toy", "columns", "contrast"]) el(id).addEventListener("change", convert);
el("color").addEventListener("change", () => {
  settings.color = el("color").checked;
  clearResult();
  draw();
});
el("make-gif").addEventListener("click", () => createMedia("GIF"));
el("make-video").addEventListener("click", () => createMedia("video"));
el("cancel").addEventListener("click", () => activeJob?.abort());
el("save-source").addEventListener("click", () => saveJSON(sample, `${sample.toy}-capture.json`));
el("save-ascii").addEventListener("click", () =>
  saveJSON(
    { ...sample, sourceFrames: undefined, frames, settings, footer: footer() },
    `${sample.toy}-ascii.json`,
  ),
);
el("import").addEventListener("change", async () => {
  const file = el("import").files[0];
  if (!file) return;
  try {
    if (file.size > 12_000_000) throw new Error("The capture JSON must be under 12 MB.");
    const imported = validateSample(JSON.parse(await file.text()));
    const id = samples.findIndex((item) => item.toy === imported.toy);
    if (id >= 0) samples[id] = imported;
    else {
      if (samples.length >= 4) samples.pop();
      samples.push(imported);
    }
    el("toy").replaceChildren(
      ...samples.map((item) => {
        const option = document.createElement("option");
        option.value = item.toy;
        option.textContent = item.toy;
        return option;
      }),
    );
    el("toy").value = imported.toy;
    await convert();
  } catch (error) {
    status.textContent = `Could not open this capture: ${error.message}`;
  } finally {
    el("import").value = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pause();
    activeJob?.abort();
  }
});
window.addEventListener("pagehide", () => {
  pause();
  activeJob?.abort();
  if (resultURL) URL.revokeObjectURL(resultURL);
});
el("make-video").textContent = support.ok
  ? `Create ${support.ext.toUpperCase()}`
  : "Video unavailable";
el("video-support").textContent = support.ok
  ? `Video on this browser: ${support.ext.toUpperCase()}. Keep the page visible while recording; GIF does not need real-time playback.`
  : support.reason;
window.__asciiLab = {
  get frames() {
    return frames;
  },
  get sample() {
    return sample;
  },
  get settings() {
    return settings;
  },
  footer,
  convert,
  createMedia,
  support,
};

try {
  samples = (window.__asciiSources ?? (await (await fetch("./sources.json")).json())).map(
    validateSample,
  );
  el("toy").replaceChildren(
    ...samples.map((item) => {
      const option = document.createElement("option");
      option.value = item.toy;
      option.textContent = item.toy;
      return option;
    }),
  );
  await convert();
} catch (error) {
  status.textContent = `Could not load this prototype: ${error.message}`;
  document.body.dataset.ready = "error";
}
