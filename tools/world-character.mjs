#!/usr/bin/env node
// Builds hybrid mode's mesh character (docs/WORLDS.md, "The mesh
// character"): Kenney's "Animated Characters: Protagonists" (CC0,
// kenney.nl/assets/animated-characters-protagonists) turned from FBX into one
// GLB with its skin and three clips, idle, walk and run:
//
//   assets/worlds/character/character.glb
//
// The pack has idle, run and jump. The walk is made from the run: every
// joint's turn is brought half way back toward the idle's pose and the bounce
// is lowered, so the legs and arms swing less, and the world plays it slower.
//
//   node tools/world-character.mjs [--skin=skaterMaleA]
//
// The FBX loader and the glTF exporter are three.js's (a pinned
// devDependency, run in Chromium through Playwright; nothing of three.js
// ships in the page). The pack's zip is cached in .cache/worlds/.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const skin = opt("skin", "skaterMaleA");
const PAGE = "https://kenney.nl/assets/animated-characters-protagonists";
const CACHE = ".cache/worlds/kenney-protagonists";
const OUT = "assets/worlds/character";

// The pack: its page names the current zip.
if (!fs.existsSync(`${CACHE}/Model/characterMedium.fbx`)) {
  const html = await (await fetch(PAGE)).text();
  const zip = html.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/animated-characters-protagonists\/[^'" ]+\.zip/)?.[0]; // prettier-ignore
  if (!zip) throw new Error("The pack's download link wasn't found on its page.");
  fs.mkdirSync(CACHE, { recursive: true });
  const buf = Buffer.from(await (await fetch(zip)).arrayBuffer());
  fs.writeFileSync(`${CACHE}/pack.zip`, buf);
  execFileSync("unzip", ["-o", "-q", "pack.zip"], { cwd: CACHE });
}
const license = fs.readFileSync(`${CACHE}/License.txt`, "utf8");
if (!/Creative Commons Zero, CC0/.test(license)) throw new Error("The pack's license isn't CC0.");

const three = path.dirname(path.dirname(createRequire(import.meta.url).resolve("three")));
const files = {
  "/three.module.js": path.join(three, "build/three.module.js"),
  "/three.core.js": path.join(three, "build/three.core.js"),
  "/model.fbx": `${CACHE}/Model/characterMedium.fbx`,
  "/idle.fbx": `${CACHE}/Animations/idle.fbx`,
  "/run.fbx": `${CACHE}/Animations/run.fbx`,
  "/skin.png": `${CACHE}/Skins/${skin}.png`,
};
const html = `<!doctype html><meta charset="utf-8"><script type="importmap">
{ "imports": { "three": "/three.module.js", "three/addons/": "/addons/" } }
</script>`;

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error(m.text()));
await page.route("http://tool.local/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  if (p === "/") return route.fulfill({ contentType: "text/html", body: html });
  const file = p.startsWith("/addons/") ? path.join(three, "examples/jsm", p.slice(8)) : files[p];
  if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
  const type = p.endsWith(".js") ? "text/javascript" : p.endsWith(".png") ? "image/png" : "application/octet-stream"; // prettier-ignore
  route.fulfill({ contentType: type, body: fs.readFileSync(file) });
});
await page.goto("http://tool.local/");
const out = await page.evaluate(async () => {
  const THREE = await import("three");
  const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const loader = new FBXLoader();
  const model = await loader.loadAsync("/model.fbx");
  // Each animation file's longest take.
  const longest = (o) => o.animations.slice().sort((a, b) => b.duration - a.duration)[0];
  const idleFile = await loader.loadAsync("/idle.fbx");
  const runFile = await loader.loadAsync("/run.fbx");
  const takes = [...idleFile.animations, ...runFile.animations].map((a) => [a.name, +a.duration.toFixed(2)]); // prettier-ignore
  const idle = longest(idleFile);
  const run = longest(runFile);
  const tex = await new THREE.TextureLoader().loadAsync("/skin.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  const info = { meshes: 0, bones: 0 };
  model.traverse((o) => {
    if (o.isSkinnedMesh || o.isMesh) {
      info.meshes++;
      // The FBX's own UVs expect the image the right way up.
      const t = tex.clone();
      t.flipY = true;
      t.needsUpdate = true;
      o.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0 });
    }
    if (o.isBone) info.bones++;
  });
  // The walk: the run with each joint half way back to the idle's pose, and a
  // lower bounce.
  // The idle's first frame is the pose the walk swings around (the model's
  // rest pose is a T-pose).
  const rest = new Map();
  model.traverse((o) => o.isBone && rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone() })); // prettier-ignore
  for (const t of idle.tracks) {
    const [bone, prop] = t.name.split(".");
    const b = rest.get(bone);
    if (!b) continue;
    if (prop === "quaternion") b.q.fromArray(t.values, 0);
    if (prop === "position") b.p.fromArray(t.values, 0);
  }
  const q = new THREE.Quaternion();
  const r = new THREE.Quaternion();
  const tracks = run.tracks.map((t) => {
    const c = t.clone();
    const [bone, prop] = c.name.split(".");
    const base = rest.get(bone);
    if (!base) return c;
    const v = c.values;
    if (prop === "quaternion") {
      for (let i = 0; i < v.length; i += 4) {
        r.fromArray(v, i);
        q.copy(base.q).slerp(r, 0.5);
        q.toArray(v, i);
      }
    } else if (prop === "position") {
      for (let i = 0; i < v.length; i += 3) v[i + 1] = base.p.y + (v[i + 1] - base.p.y) * 0.35;
    }
    return c;
  });
  const walk = new THREE.AnimationClip("walk", run.duration, tracks);
  idle.name = "idle";
  run.name = "run";
  const box = new THREE.Box3().setFromObject(model);
  info.height = box.max.y - box.min.y;
  info.takes = takes;
  info.clips = [idle, walk, run].map((c) => [c.name, +c.duration.toFixed(2), c.tracks.length]);
  const glb = await new GLTFExporter().parseAsync(model, { binary: true, animations: [idle, walk, run], onlyVisible: false }); // prettier-ignore
  const bytes = new Uint8Array(glb);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); // prettier-ignore
  return { info, b64: btoa(s) };
});
await browser.close();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/character.glb`, Buffer.from(out.b64, "base64"));
const meta = {
  about: "Hybrid mode's mesh character (tools/world-character.mjs): the model, one skin and three clips (idle, walk made from the run, run) in one GLB.", // prettier-ignore
  name: "Animated Characters: Protagonists",
  skin,
  authors: ["Kenney"],
  page: PAGE,
  license: "CC0 1.0",
  height: +out.info.height.toFixed(3),
  clips: out.info.clips,
};
fs.writeFileSync(`${OUT}/character.json`, JSON.stringify(meta, null, 2) + "\n");
console.log(`${OUT}/character.glb: ${(fs.statSync(`${OUT}/character.glb`).size / 1e3).toFixed(0)} kB`, out.info); // prettier-ignore
