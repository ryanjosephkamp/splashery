#!/usr/bin/env node
// Lane G: turns one photo into a 3D Gaussian splat with the public TRELLIS
// Space on Hugging Face (https://huggingface.co/spaces/trellis-community/TRELLIS,
// MIT; model microsoft/TRELLIS-image-large, MIT). It talks to the Space's
// Gradio queue API with plain fetch, so it needs no extra packages.
//
//   HF_TOKEN=… node tools/image-to-3d.mjs <image> [--name=soda-can] [--seed=1]
//     [--steps=12] [--guide=7.5] [--slat-guide=3] [--glb] [--space=owner/name]
//
// Writes .cache/g/out/<name>/: input.png (the Space's cut-out), preview.mp4
// (the Space's turntable), <name>.ply (the Gaussians), <name>.glb (with --glb)
// and run.json (settings, timings, the Space's messages). The ZeroGPU quota of a
// free account is a few minutes a day: each run uses about a minute of it.
//
// HF_TOKEN is sent only to the Space as an Authorization header. The script
// never prints or writes it.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const flag = (name) => args.includes(`--${name}`);
const [image] = args.filter((a) => !a.startsWith("--"));
if (!image) throw new Error("Usage: node tools/image-to-3d.mjs <image> [--name=…]");
const name = opt("name", path.basename(image).replace(/\.[^.]+$/, ""));
const space = opt("space", "trellis-community/TRELLIS");
const host = `https://${space.toLowerCase().replace(/[/_.]/g, "-")}.hf.space`;
const api = `${host}/gradio_api`;
const token = process.env.HF_TOKEN;
if (!token) throw new Error("HF_TOKEN is not set");
const auth = { Authorization: `Bearer ${token}` };
const outDir = path.join(root, ".cache/g/out", name);
fs.mkdirSync(outDir, { recursive: true });

const log = [];
const t0 = Date.now();
const say = (...m) => {
  const line = `[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m.join(" ")}`;
  log.push(line);
  console.log(line);
};

const config = await (await fetch(`${host}/config`, { headers: auth })).json();
const fnIndex = (apiName) => {
  const i = config.dependencies.findIndex((d) => d.api_name === apiName);
  if (i < 0) throw new Error(`The Space has no endpoint /${apiName}`);
  return config.dependencies[i].id ?? i;
};
const session = Math.random().toString(36).slice(2, 13);

// One SSE stream per session carries every event's messages (protocol sse_v3).
const waiting = new Map();
let stream = null;
function openStream() {
  if (stream) return;
  stream = (async () => {
    const res = await fetch(`${api}/queue/data?session_hash=${session}`, {
      headers: { ...auth, Accept: "text/event-stream" },
    });
    if (!res.ok) throw new Error(`queue/data ${res.status}: ${await res.text()}`);
    const dec = new TextDecoder();
    let buf = "";
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let k;
      while ((k = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, k);
        buf = buf.slice(k + 2);
        const data = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (!data) continue;
        const msg = JSON.parse(data);
        if (msg.msg === "close_stream") return;
        const w = waiting.get(msg.event_id);
        if (!w) continue;
        if (msg.msg === "estimation" && msg.rank != null) say(`  queue position ${msg.rank}`);
        if (msg.msg === "process_starts") say("  started");
        if (msg.msg === "log" && msg.log) say(`  space: ${msg.log}`);
        if (msg.msg === "process_completed") {
          waiting.delete(msg.event_id);
          if (msg.success) w.resolve(msg.output.data);
          else w.reject(new Error(msg.output?.error || JSON.stringify(msg.output)));
        }
      }
    }
  })().finally(() => {
    stream = null;
    for (const w of waiting.values()) w.reject(new Error("The stream closed early"));
    waiting.clear();
  });
  stream.catch(() => {});
}

async function call(apiName, data) {
  say(`/${apiName}`);
  const res = await fetch(`${api}/queue/join`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      data,
      event_data: null,
      fn_index: fnIndex(apiName),
      trigger_id: null,
      session_hash: session,
    }),
  });
  if (!res.ok) throw new Error(`queue/join ${res.status}: ${await res.text()}`);
  const { event_id } = await res.json();
  const done = new Promise((resolve, reject) => waiting.set(event_id, { resolve, reject }));
  openStream();
  return done;
}

async function upload(file) {
  const form = new FormData();
  const bytes = fs.readFileSync(file);
  form.append("files", new Blob([bytes]), path.basename(file));
  const res = await fetch(`${api}/upload`, { method: "POST", headers: auth, body: form });
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text()}`);
  const [p] = await res.json();
  return {
    path: p,
    orig_name: path.basename(file),
    size: bytes.length,
    mime_type: file.endsWith(".png") ? "image/png" : "image/jpeg",
    meta: { _type: "gradio.FileData" },
  };
}

async function save(fileData, to) {
  if (!fileData) return null;
  const url = fileData.url || `${api}/file=${fileData.path}`;
  const res = await fetch(url, { headers: auth });
  if (!res.ok) throw new Error(`download ${res.status} for ${to}`);
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
  say(`  saved ${path.relative(root, to)} (${(fs.statSync(to).size / 1e6).toFixed(1)} MB)`);
  return path.relative(root, to);
}

const settings = {
  seed: Number(opt("seed", 1)),
  ssGuidance: Number(opt("guide", 7.5)),
  ssSteps: Number(opt("steps", 12)),
  slatGuidance: Number(opt("slat-guide", 3)),
  slatSteps: Number(opt("steps", 12)),
  simplify: 0.95,
  textureSize: 1024,
};
const run = { space, image, name, settings, started: new Date().toISOString(), files: {} };
try {
  await call("start_session", []);
  const up = await upload(image);
  const [cut] = await call("preprocess_image", [up]);
  run.files.input = await save(cut, path.join(outDir, "input.png"));
  const out = await call("generate_and_extract_glb", [
    cut,
    [],
    false,
    settings.seed,
    settings.ssGuidance,
    settings.ssSteps,
    settings.slatGuidance,
    settings.slatSteps,
    "stochastic",
    settings.simplify,
    settings.textureSize,
  ]);
  const [, video, , glb] = out;
  run.files.preview = await save(video?.video ?? video, path.join(outDir, "preview.mp4"));
  if (flag("glb")) run.files.glb = await save(glb, path.join(outDir, `${name}.glb`));
  const [, ply] = await call("extract_gaussian", [null]);
  run.files.ply = await save(ply, path.join(outDir, `${name}.ply`));
  run.ok = true;
} catch (e) {
  run.ok = false;
  run.error = String(e.message || e);
  say(`FAILED: ${run.error}`);
  process.exitCode = 1;
} finally {
  run.seconds = Math.round((Date.now() - t0) / 1000);
  run.log = log;
  fs.writeFileSync(path.join(outDir, "run.json"), JSON.stringify(run, null, 2) + "\n");
  // Frees the Space's copy of this session's files.
  await call("end_session", []).catch(() => {});
}
