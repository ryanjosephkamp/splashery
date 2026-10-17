#!/usr/bin/env node
// Task 100's reproducible load recipe. Four concurrent software-rendered browsers
// compete for the runner's CPUs; the tests, assertions, and deadlines stay intact.
// Use --root=/path/to/untouched/checkout for the before measurement.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = path.resolve(option("root", here));
const { chromium } = await import(
  pathToFileURL(path.join(root, "node_modules/playwright/index.mjs"))
);
const browserPath = process.env.SPLASHERY_CHROMIUM || chromium.executablePath();
const out = path.resolve(option("out", path.join(here, ".cache/flaky-tests/stress")));
const repeat = Number(option("repeat", "30"));
const workers = Number(option("workers", "4"));
const burners = Number(option("burners", "0"));
if (![repeat, workers].every((n) => Number.isInteger(n) && n > 0))
  throw new Error("--repeat and --workers must be positive integers");
if (!Number.isInteger(burners) || burners < 0) throw new Error("--burners must be nonnegative");
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
  "--retries=0",
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
      browser: browserPath,
      browserVersion: spawnSync(browserPath, ["--version"], { encoding: "utf8" }).stdout?.trim(),
      cpuQuota: fs.existsSync("/sys/fs/cgroup/cpu.max")
        ? fs.readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim()
        : null,
      renderer: process.env.SPLASHERY_GL || "swiftshader",
      repeat,
      workers,
      burners,
      only,
      sourceHashes: Object.fromEntries(
        git("ls-files", "--cached", "--others", "--exclude-standard", "tests", "src")
          .split("\n")
          .filter((f) => f && fs.existsSync(path.join(root, f)))
          .map((f) => [
            f,
            createHash("sha256")
              .update(fs.readFileSync(path.join(root, f)))
              .digest("hex"),
          ]),
      ),
      args,
    },
    null,
    2,
  ) + "\n",
);
const log = fs.openSync(path.join(out, "run.log"), "wx");
// Keep the same competing load alive for the entire run, including browser
// startup and teardown. No sleeps, retries, or test-clock substitutions.
const load = Array.from({ length: burners }, () => new Worker("while (true) Math.sqrt(Math.random());", { eval: true })); // prettier-ignore
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
  for (const worker of load) worker.terminate();
  fs.closeSync(log);
  fs.writeFileSync(path.join(out, "exit.json"), JSON.stringify({ code, signal }) + "\n");
  console.log(`Stress recipe finished: ${code ?? signal}. See ${path.join(out, "report.json")}`);
  process.exitCode = code ?? 1;
});
