#!/usr/bin/env node
// Task 100's reproducible load recipe. Four concurrent software-rendered browsers
// compete for the runner's CPUs; the tests, assertions, and deadlines stay intact.
// Use --root=/path/to/untouched/checkout for the before measurement.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = path.resolve(option("root", here));
const out = path.resolve(option("out", path.join(here, ".cache/flaky-tests/stress")));
const repeat = Number(option("repeat", "30"));
const workers = Number(option("workers", "4"));
if (![repeat, workers].every((n) => Number.isInteger(n) && n > 0))
  throw new Error("--repeat and --workers must be positive integers");
const cases = {
  "cdx-mir": "measured drift stays below the baseline",
  fl: "nothing fluid loads on the shelf",
  "hh1-toys": "teddy bear:",
  shr: "the preview sheet after Stop",
  "hh5-gems": "quartz cluster:",
  "fx4-engine": "without the rim kind draw as before.*\\(webgpu\\)",
  "img-engine": "without the volume kind draw as before.*\\(webgl2\\)",
  "sndc-engine": "first tap.s sample starts with the motion",
  live2: "the click track: each click",
  phy: "Pebbles: stones pick up",
};
const only = option("only", Object.keys(cases).join(",")).split(",");
for (const name of only) if (!cases[name]) throw new Error(`Unknown case: ${name}`);
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync(path.join(out, "report.json")))
  throw new Error(`Refusing to overwrite evidence in ${out}`);
const args = [
  path.join(root, "node_modules/playwright/cli.js"),
  "test",
  ...only.map((name) => `${name}.spec.mjs`),
  "--grep",
  only.map((name) => cases[name]).join("|"),
  `--repeat-each=${repeat}`,
  `--workers=${workers}`,
  "--fully-parallel",
  "--reporter=list,json",
  `--output=${path.join(out, "results")}`,
];
const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout.trim();
fs.writeFileSync(
  path.join(out, "recipe.json"),
  JSON.stringify(
    {
      started: new Date().toISOString(),
      root,
      commit: git("rev-parse", "HEAD"),
      diff: git("diff", "--", "tests", "src", "playwright.config.mjs"),
      node: process.version,
      executable: process.execPath,
      browser: process.env.SPLASHERY_CHROMIUM || "Playwright default",
      browserVersion: process.env.SPLASHERY_CHROMIUM
        ? spawnSync(process.env.SPLASHERY_CHROMIUM, ["--version"], {
            encoding: "utf8",
          }).stdout.trim()
        : null,
      cpuQuota: fs.existsSync("/sys/fs/cgroup/cpu.max")
        ? fs.readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim()
        : null,
      renderer: process.env.SPLASHERY_GL || "swiftshader",
      repeat,
      workers,
      only,
      args,
    },
    null,
    2,
  ) + "\n",
);
const log = fs.openSync(path.join(out, "run.log"), "wx");
console.log(
  `Stress recipe: ${repeat} repeats, ${workers} workers, ${only.join(", ")}. Logs: ${out}`,
);
const child = spawn(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    PLAYWRIGHT_NODEJS_PATH: process.execPath,
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(out, "report.json"),
  },
  stdio: ["ignore", log, log],
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  fs.closeSync(log);
  fs.writeFileSync(path.join(out, "exit.json"), JSON.stringify({ code, signal }) + "\n");
  console.log(`Stress recipe finished: ${code ?? signal}. See ${path.join(out, "report.json")}`);
  process.exitCode = code ?? 1;
});
