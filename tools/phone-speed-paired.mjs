#!/usr/bin/env node
// Sequential alternating AB/BA runs. Never run this alongside another GPU job.
// --targets=.cache/phone-speed/targets.json --out=.cache/phone-speed/paired --runs=5
// --before=http://127.0.0.1:4174/ --before-source=<SHA> --after-source=<SHA>
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (k, d = "") => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const out = path.resolve(opt("out", ".cache/phone-speed/paired"));
const targets = JSON.parse(await fs.readFile(opt("targets"), "utf8"));
const runs = Number(opt("runs", 5));
const duration = Number(opt("duration", 2500));
const sources = { before: opt("before-source"), after: opt("after-source") };
const urls = {
  before: opt("before", "http://127.0.0.1:4174/"),
  after: opt("after", "http://127.0.0.1:4173/"),
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const versionOutput = execFileSync(
  process.env.SPLASHERY_CHROMIUM || chromium.executablePath(),
  ["--version"],
  { encoding: "utf8" },
);
const browserVersion = versionOutput.match(/\b\d+\.\d+\.\d+\.\d+\b/)?.[0];
if (!browserVersion) throw new Error("Could not read Chromium's version.");
const protocol = {
  order: "Alternate by stable toy-ID character parity plus pair index",
  sources,
  urls,
  duration,
  browser: browserVersion,
  measurementSHA256: sha256(
    await fs.readFile(new URL("./pages/phone-speed-metrics.js", import.meta.url)),
  ),
  hybridSHA256: sha256(
    await fs.readFile(new URL("./pages/phone-speed-hybrid.js", import.meta.url)),
  ),
  runnerSHA256: sha256(await fs.readFile(new URL("./phone-speed.mjs", import.meta.url))),
};
if (
  !targets.length ||
  !Number.isInteger(runs) ||
  runs < 1 ||
  !Number.isFinite(duration) ||
  duration < 250 ||
  !sources.before ||
  !sources.after
)
  throw new Error("Targets and both served source pins are required.");
await fs.mkdir(out, { recursive: true });
await fs.rm(path.join(out, "paused.json"), { force: true });
const protocolFile = path.join(out, "protocol.json");
if (args.includes("--resume")) {
  if (
    JSON.stringify(JSON.parse(await fs.readFile(protocolFile, "utf8"))) !== JSON.stringify(protocol)
  )
    throw new Error(
      "Paired resume requires identical sources, URLs, browser, duration, and protocol.",
    );
  const archivedAt = Date.now();
  for (const phase of ["before", "after"]) {
    const file = path.join(out, `${phase}.json`);
    if (
      await fs.access(file).then(
        () => true,
        () => false,
      )
    ) {
      await fs.mkdir(path.join(out, "history"), { recursive: true });
      await fs.copyFile(file, path.join(out, "history", `${archivedAt}-${phase}.json`));
    }
  }
} else await fs.writeFile(protocolFile, JSON.stringify(protocol, null, 2));
await fs.writeFile(
  path.join(out, `invocation-${Date.now()}.json`),
  JSON.stringify(
    { at: new Date().toISOString(), runs, resume: args.includes("--resume"), targets },
    null,
    2,
  ),
);
const rows = { before: [], after: [] };
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
screening: for (const { id } of targets) {
  for (let pair = 0; pair < runs; pair++) {
    const parity = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 2;
    const order = (pair + parity) % 2 ? ["after", "before"] : ["before", "after"];
    for (const phase of order) {
      if (stopping) break screening;
      let paused = false;
      while (
        await fs.access(path.join(out, "pause")).then(
          () => true,
          () => false,
        )
      ) {
        if (!paused) {
          await fs.writeFile(
            path.join(out, "paused.json"),
            JSON.stringify(
              { next: id, pair, phase, at: new Date().toISOString(), contextOpen: false },
              null,
              2,
            ),
          );
          paused = true;
        }
        if (stopping) break screening;
        await new Promise((r) => setTimeout(r, 1000));
      }
      await fs.rm(path.join(out, "paused.json"), { force: true });
      const dir = path.join(out, id, `${pair}-${phase}`);
      const sample = path.join(dir, `${id}-0.json`);
      let row;
      if (args.includes("--resume")) {
        try {
          row = JSON.parse(await fs.readFile(sample, "utf8"));
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        if (row) {
          const method = JSON.parse(await fs.readFile(path.join(dir, "method.json"), "utf8"));
          if (
            row.source !== sources[phase] ||
            method.source !== sources[phase] ||
            method.url !== urls[phase] ||
            method.runs !== 1 ||
            method.durationMs !== duration ||
            method.browser !== browserVersion ||
            method.measurementSHA256 !== protocol.measurementSHA256 ||
            method.hybridSHA256 !== protocol.hybridSHA256 ||
            method.runnerSHA256 !== protocol.runnerSHA256
          )
            throw new Error(`Cached sample ${id}/${pair}/${phase} has a different protocol.`);
        }
      }
      if (!row) {
        const command = [
          "tools/phone-speed.mjs",
          `--ids=${id}`,
          `--out=${dir}`,
          `--duration=${duration}`,
          `--url=${urls[phase]}`,
          `--source=${sources[phase]}`,
        ];
        const code = await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, command, { stdio: "inherit" });
          child.on("error", reject);
          child.on("exit", resolve);
        });
        row = JSON.parse(
          await fs
            .readFile(sample, "utf8")
            .catch(() => JSON.stringify({ id, error: `Runner exited ${code} without a sample.` })),
        );
      }
      rows[phase].push({ ...row, pair, phase, order: order.join("/") });
      await fs.writeFile(path.join(out, `${phase}.json`), JSON.stringify(rows[phase], null, 2));
    }
  }
}
