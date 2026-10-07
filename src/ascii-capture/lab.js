// Lane AsciiCapture: the ASCII GIF lab page (ascii-lab.html). It owns the
// settings, progress, Cancel, the one finished GIF and its download, and the
// device check the owner screenshots on a phone. Labs only; nothing links here.

import { startCapture, isRunning, COLUMNS, JOB_MS, JOB_MS_RANGE } from "./job.js";
import { CAPTURE, profileParam } from "./protocol.js";

const $ = (id) => document.getElementById(id);
const ui = {
  preset: $("preset"),
  columns: $("columns"),
  color: $("color"),
  capture: $("capture"),
  cancel: $("cancel"),
  progress: $("progress"),
  status: $("status"),
  mount: $("mount"),
  result: $("result"),
  empty: $("empty"),
  gif: $("gif"),
  download: $("download"),
};
// The job's time limit: 30 seconds, or ?deadline= seconds (30 to 180) on a slow test machine.
const asked = Number(new URLSearchParams(location.search).get("deadline")) * 1000;
const jobMs = asked >= JOB_MS_RANGE[0] && asked <= JOB_MS_RANGE[1] ? asked : JOB_MS;
// A forced detail profile (?profile=), for tests and diagnosis only.
const profile = profileParam(location.search);
let current = null; // { cancel, done } while a job runs
let outputURL = null; // the one finished GIF

function setState(state) {
  document.body.dataset.state = state;
  const busy = state === "running";
  ui.capture.disabled = busy;
  ui.cancel.disabled = !busy;
  for (const el of [ui.preset, ui.columns, ui.color]) el.disabled = busy;
}

function say(text, bad = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("bad", bad);
}

function clearOutput() {
  if (outputURL) URL.revokeObjectURL(outputURL);
  outputURL = null;
  ui.gif.removeAttribute("src");
  $("credit").textContent = "";
  ui.download.removeAttribute("href");
  ui.result.hidden = true;
  ui.empty.hidden = false;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// Decodes the finished GIF with the vendored reader, as a phone check.
async function decodeCheck(blob, expected) {
  const { GifReader } = await import("../../vendor/omggif/omggif.js");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const reader = new GifReader(bytes);
  const delays = [];
  for (let i = 0; i < reader.numFrames(); i++) delays.push(reader.frameInfo(i).delay);
  const comment = new TextDecoder().decode(bytes).includes('"app":"Splashery"');
  const ok =
    reader.numFrames() === expected.frames &&
    reader.width === expected.width &&
    reader.height === expected.height &&
    delays.every((d, i) => d * 10 === expected.delays[i]) &&
    comment;
  return {
    ok,
    text: `${ok ? "Pass" : "Fail"}: ${reader.numFrames()} frames, ${reader.width} by ${reader.height}, ${delays.reduce((a, b) => a + b, 0) / 100} seconds, credit comment ${comment ? "found" : "missing"}`, // prettier-ignore
  };
}

async function browserName() {
  try {
    const data = await navigator.userAgentData?.getHighEntropyValues?.(["fullVersionList", "platformVersion", "model"]); // prettier-ignore
    if (data?.fullVersionList?.length) {
      const brands = data.fullVersionList
        .filter((b) => !/not.?a.?brand/i.test(b.brand))
        .map((b) => `${b.brand} ${b.version}`)
        .join(", ");
      return `${brands} on ${data.platform} ${data.platformVersion || ""}${data.model ? ` (${data.model})` : ""}`.trim(); // prettier-ignore
    }
  } catch {
    // Fall back to the user agent string.
  }
  return navigator.userAgent;
}

async function capture() {
  if (isRunning()) {
    say("A capture is already running.", true);
    return;
  }
  clearOutput();
  const preset = ui.preset.value;
  const columns = Number(ui.columns.value);
  const color = ui.color.checked;
  if (!COLUMNS.includes(columns)) return;
  setState("running");
  ui.progress.value = 0;
  say("Starting a fresh toy animation…");
  let job;
  try {
    job = startCapture({
      preset,
      columns,
      color,
      mount: ui.mount,
      jobMs,
      profile,
      onProgress: ({ stage, done, total }) => {
        if (stage === "capture") {
          ui.progress.value = (0.8 * done) / total;
          say(`Capturing frame ${done} of ${total}…`);
        } else {
          ui.progress.value = 0.8 + 0.2 * done;
          say("Making the GIF…");
        }
      },
    });
  } catch (err) {
    setState("failed");
    say(err.message, true);
    return;
  }
  current = job;
  try {
    const out = await job.done;
    if (current !== job) return;
    outputURL = URL.createObjectURL(out.blob);
    ui.gif.src = outputURL;
    ui.gif.alt = `${out.label} as ASCII art, a ${CAPTURE.frames / CAPTURE.fps} second fresh toy animation`; // prettier-ignore
    ui.download.href = outputURL;
    $("credit").textContent = out.footer.join("\n");
    ui.download.download = `splashery-${out.preset}-ascii-${out.settings.columns}${out.settings.color ? "-color" : ""}.gif`; // prettier-ignore
    ui.result.hidden = false;
    ui.empty.hidden = true;
    ui.progress.value = 1;
    say(`Done: ${out.label}, ${out.settings.columns} by ${out.settings.rows} characters, ${out.settings.color ? "color" : "mono"}. ${kb(out.blob.size)}.`); // prettier-ignore
    $("dev-renderer").textContent = out.renderer;
    $("dev-profile").textContent = out.profile;
    $("dev-time").textContent = `${(out.ms / 1000).toFixed(1)} seconds`;
    $("dev-output").textContent = `${out.width} by ${out.height} pixels, ${CAPTURE.frames} frames, ${kb(out.blob.size)}`; // prettier-ignore
    $("dev-decode").textContent = "Checking…";
    const check = await decodeCheck(out.blob, {
      frames: CAPTURE.frames,
      width: out.width,
      height: out.height,
      delays: out.delays,
    }).catch((err) => ({ ok: false, text: `Fail: ${err.message}` }));
    $("dev-decode").textContent = check.text;
    document.body.dataset.decode = check.ok ? "pass" : "fail";
    setState("done");
  } catch (err) {
    if (current !== job) return;
    ui.progress.value = 0;
    setState("failed");
    say(err.message || "The capture failed. Nothing was saved.", true);
  } finally {
    if (current === job) current = null;
  }
}

ui.capture.addEventListener("click", capture);
ui.cancel.addEventListener("click", () => current?.cancel());
setState("idle");
browserName().then((name) => ($("dev-browser").textContent = name));
document.body.dataset.ready = "true";
