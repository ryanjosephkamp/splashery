import { pixelsToText, renderTextCanvas } from "../../../src/export/ascii.js";

const byId = (id) => document.getElementById(id);
const preview = byId("preview");
const status = byId("status");
const sourceCanvas = document.createElement("canvas");
const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
let samples;
let clip;
let sequence = [];
let index = 0;
let generation = 0;
let animation = 0;
let playing = false;
let started = 0;
let startFrame = 0;
const settings = () => ({
  columns: Number(byId("columns").value),
  contrast: Number(byId("contrast").value),
  characterAspect: measureAspect(),
});
const sampleURL = (toy, file) =>
  window.__asciiEmbedded?.[`${toy}/${file}`] ?? `./samples/${toy}/${file}`;
const imageURL = (i) => sampleURL(clip.toy, `frame-${String(i).padStart(3, "0")}.jpg`);
const controls = [
  "columns",
  "contrast",
  "color",
  "timeline",
  "play",
  "reset",
  "text-download",
  "json-download",
  "png-download",
];

function measureAspect() {
  const ctx = sourceContext;
  ctx.font = 'bold 10px "Courier New", monospace';
  return ctx.measureText("M").width / 12;
}

function pause() {
  playing = false;
  cancelAnimationFrame(animation);
  byId("play").textContent = "Play";
}

function draw() {
  const frame = sequence[index];
  if (!frame) return;
  renderTextCanvas(preview, frame, { color: byId("color").checked, footer: clip.credits });
  preview.dataset.frame = String(index);
  byId("timeline").value = String(index);
  byId("position").textContent =
    `${index + 1} / ${sequence.length} · ${(index / clip.fps).toFixed(2)} seconds`;
  byId("text").value = frame.rows.join("\n");
  byId("source").src = imageURL(index);
}

function tick(now) {
  if (!playing) return;
  const next = (startFrame + Math.floor(((now - started) * clip.fps) / 1000)) % sequence.length;
  if (next !== index) {
    index = next;
    draw();
  }
  animation = requestAnimationFrame(tick);
}

function link(parent, label, url) {
  const a = document.createElement("a");
  a.textContent = label;
  a.href = url;
  parent.append(a);
}

function showCredit() {
  const element = byId("credit");
  element.replaceChildren();
  const credit = clip.metadata.credit;
  if (credit) {
    element.append(`${credit.title} by ${credit.author}. `);
    link(element, "Source", credit.source);
    element.append(" · ");
    link(element, credit.license, credit.licenseUrl);
    element.append(`. ${credit.changes} `);
  } else
    element.append(
      `Splashery ${clip.toy}; procedural source. Fixed-view capture converted to characters. `,
    );
  element.append(
    `Capture revision ${clip.metadata.baseline.slice(0, 8)}; ${clip.frameCount} frames at ${clip.fps} fps. JPEG decoding and font rasterization can vary between devices. The core is deterministic for identical RGBA bytes and options.`,
  );
}

async function convert() {
  const token = ++generation;
  pause();
  document.body.dataset.ready = "false";
  controls.forEach((id) => {
    byId(id).disabled = true;
  });
  // Clear references to the previous sequence; only one clip is retained.
  sequence = [];
  byId("text").value = "";
  clip = samples.find((sample) => sample.toy === byId("toy").value);
  const options = settings();
  showCredit();
  byId("gif").href = sampleURL(clip.toy, "animation.gif");
  byId("gif").download = `${clip.toy}-ascii-original.gif`;
  byId("mp4").href = sampleURL(clip.toy, "animation.mp4");
  byId("mp4").download = `${clip.toy}-ascii-original.mp4`;
  try {
    const frames = [];
    for (let i = 0; i < clip.frameCount; i++) {
      status.textContent = `Converting ${clip.toy} on this device: ${i + 1} / ${clip.frameCount}…`;
      const image = new Image();
      image.src = imageURL(i);
      try {
        await image.decode();
        if (token !== generation) return;
        sourceCanvas.width = image.width;
        sourceCanvas.height = image.height;
        sourceContext.drawImage(image, 0, 0);
        frames.push(
          pixelsToText(sourceContext.getImageData(0, 0, image.width, image.height), options),
        );
      } finally {
        image.src = "";
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (token !== generation) return;
    }
    sequence = frames;
    index = 0;
    byId("timeline").max = String(sequence.length - 1);
    controls.forEach((id) => {
      byId(id).disabled = false;
    });
    const frame = sequence[0];
    status.textContent = `${clip.toy} · ${frame.columns} × ${frame.rowCount} characters · ${clip.fps} fps · ${(sequence.length / clip.fps).toFixed(1)} seconds. Ready to play.`;
    document.body.dataset.ready = "true";
    draw();
  } catch (error) {
    if (token !== generation) return;
    status.textContent = `Could not convert this example: ${error.message}. Serve the repository over local HTTP, or open the standalone HTML handback.`;
    document.body.dataset.ready = "error";
  }
}

function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

byId("play").addEventListener("click", () => {
  if (playing) {
    pause();
    return;
  }
  playing = true;
  started = performance.now();
  startFrame = index;
  byId("play").textContent = "Pause";
  animation = requestAnimationFrame(tick);
});
byId("reset").addEventListener("click", () => {
  pause();
  index = 0;
  draw();
});
byId("timeline").addEventListener("input", () => {
  pause();
  index = Number(byId("timeline").value);
  draw();
});
byId("color").addEventListener("change", draw);
for (const id of ["toy", "columns", "contrast"]) byId(id).addEventListener("change", convert);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", pause);
byId("text-download").addEventListener("click", () => {
  const attribution = clip.metadata.credit
    ? JSON.stringify(clip.metadata.credit, null, 2)
    : clip.credits.join("\n");
  save(
    new Blob([sequence[index].rows.join("\n") + "\n\n" + attribution + "\n"], {
      type: "text/plain",
    }),
    `${clip.toy}-ascii-frame.txt`,
  );
});
byId("json-download").addEventListener("click", () =>
  save(
    new Blob([JSON.stringify({ ...clip, options: settings(), frames: sequence }) + "\n"], {
      type: "application/json",
    }),
    `${clip.toy}-ascii-sequence.json`,
  ),
);
byId("png-download").addEventListener("click", () =>
  preview.toBlob((blob) => {
    if (blob) save(blob, `${clip.toy}-ascii-frame.png`);
  }),
);

try {
  samples = window.__asciiSamples ?? (await (await fetch("./samples.json")).json());
  await convert();
} catch (error) {
  status.textContent = `Could not load local examples: ${error.message}. Use local HTTP or the standalone HTML handback.`;
  document.body.dataset.ready = "error";
}
