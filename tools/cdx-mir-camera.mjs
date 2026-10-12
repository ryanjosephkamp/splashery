#!/usr/bin/env node
// Task 41: deterministic fake-camera stress clips, derived from the CC0
// procedural mannequin. No camera, downloaded asset, or real likeness.
// node tools/cdx-mir-camera.mjs .cache/cdx-mir [--frames=120]
import fs from "node:fs";
import path from "node:path";

export const CLIPS = ["still", "turn", "wave", "low-light"];
export function cameras(dir, frames = 120, clips = CLIPS) {
  fs.mkdirSync(dir, { recursive: true });
  const original = fs.readFileSync(new URL("./lv7-mannequin.mjs", import.meta.url), "utf8");
  for (const name of clips) {
    const out = path.resolve(dir, `${name}.y4m`);
    const header = "YUV4MPEG2 W320 H240 F15:1 Ip A1:1 C420jpeg\n";
    const expected = Buffer.byteLength(header) + frames * (320 * 240 * 1.5 + 6);
    if (fs.existsSync(out) && fs.statSync(out).size === expected) continue;
    let source = original.replace(/^#!.*\n/, "").replace('import fs from "node:fs";', "");
    if (name === "turn") {
      source = source.replace(
        /function pose\(s\) \{[\s\S]*?\n\}/,
        `function pose(s) {
        return { yaw: 0.45 * Math.sin(TAU * s), nod: 0, jaw: 0, sway: 0 };
      }`,
      );
    }
    if (name === "wave") {
      source = source.replace(
        "let d = Math.min(skin, body, hair, eyes);",
        `
        // A solid mitten-shaped dummy hand crosses the face twice per loop.
        const hand = ell(px - 0.35 * Math.sin(TAU * 2 * P.time), py + 0.08,
          pz + 0.38, 0.095, 0.16, 0.055);
        let d = Math.min(skin, body, hair, eyes, hand);`,
      );
      source = source.replace("yaw: 0.2 *", "time: s, yaw: 0 *");
      source = source.replace(/nod: .*?,\n/, "nod: 0,\n");
      source = source.replace(/jaw: .*?,\n/, "jaw: 0,\n");
      source = source.replace(/sway: .*?,\n/, "sway: 0,\n");
    }
    if (name === "low-light")
      source = source.replace("rgb[o] = r;", "r *= 0.22; g *= 0.22; b *= 0.22; rgb[o] = r;");
    const args = [
      out,
      "--w=320",
      "--h=240",
      `--frames=${frames}`,
      "--fps=15",
      name === "low-light" ? "--noise=7" : "--noise=5",
    ];
    if (name === "still" || name === "low-light") args.push("--still");
    // Only execute this repository's generator, with a local argument list.
    // Keeping the native Math intrinsics here also makes CPU ray tracing fast.
    new Function("fs", "Buffer", "process", source)(fs, Buffer, {
      argv: ["node", "lv7-mannequin.mjs", ...args],
      stderr: { write() {} },
    });
    console.log(`Generated ${name}: ${out}`);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  cameras(
    process.argv[2] || ".cache/cdx-mir",
    Number(process.argv.find((s) => s.startsWith("--frames="))?.split("=")[1]) || 120,
  );
}
