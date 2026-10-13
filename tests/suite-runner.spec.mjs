import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { startServer, reportProblems } from "../tools/suite-runtime.mjs";

async function processRunning(pid) {
  try {
    process.kill(pid, 0);
    // Linux retains an orphan's PID while it is waiting to be reaped, even
    // though the process has already stopped executing.
    if (process.platform === "linux") {
      const stat = await fs.readFile(`/proc/${pid}/stat`, "utf8");
      if (/\) Z /.test(stat)) return false;
    }
    return true;
  } catch (error) {
    if (["ESRCH", "ENOENT"].includes(error.code)) return false;
    throw error;
  }
}

async function pidFrom(file) {
  await expect.poll(() => fs.readFile(file, "utf8").then(Number).catch(() => null), { timeout: 10_000 }).toBeGreaterThan(0); // prettier-ignore
  return Number(await fs.readFile(file, "utf8"));
}

function exited(child) {
  let timer;
  let ended = false;
  let rejectExit;
  const completion = new Promise((resolve, reject) => {
    rejectExit = reject;
    child.once("error", (error) => {
      ended = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      ended = true;
      clearTimeout(timer);
      resolve(code);
    });
  });
  // Readiness has its own timeout. Observe early spawn failures without an
  // unhandled rejection while the test is waiting for the process's marker.
  void completion.catch(() => {});
  return {
    completion,
    cancel() {
      if (!ended && !timer) {
        timer = setTimeout(() => {
          child.kill("SIGKILL");
          rejectExit(new Error("Canceled suite did not exit within eight seconds"));
        }, 8000);
        child.kill("SIGTERM");
      }
      return completion;
    },
  };
}

async function runnerCheckout() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "suite-cancel-"));
  await Promise.all(["tools", "tests", "bin", "node_modules/@playwright/test"].map((name) => fs.mkdir(path.join(dir, name), { recursive: true }))); // prettier-ignore
  await Promise.all(["suite.mjs", "suite-runtime.mjs"].map((name) => fs.copyFile(new URL(`../tools/${name}`, import.meta.url), path.join(dir, "tools", name)))); // prettier-ignore
  await Promise.all(["first", "second"].map((name) => fs.writeFile(path.join(dir, "tests", `${name}.spec.mjs`), "// Inventory for the browser-free runner harness.\n"))); // prettier-ignore
  return dir;
}

const holdProcess = `
const fs = require("node:fs");
process.on("SIGTERM", () => {});
fs.writeFileSync(process.env.SUITE_TEST_PID, String(process.pid));
setInterval(() => {}, 1000);
`;

for (const [phase, command, gl] of [
  ["server", "python3", "swiftshader"],
  ["display", "Xvfb", "llvmpipe"],
]) {
  test(`canceling during ${phase} startup stops the starting process`, async () => {
    const dir = await runnerCheckout();
    let child;
    let completion;
    let cancel;
    let pid;
    try {
      await fs.writeFile(path.join(dir, "bin", command), `#!${process.execPath}\n${holdProcess}`, { mode: 0o755 }); // prettier-ignore
      const marker = path.join(dir, "startup.pid");
      child = spawn(process.execPath, [path.join(dir, "tools/suite.mjs"), `--gl=${gl}`], {
        cwd: dir,
        env: { ...process.env, PATH: `${path.join(dir, "bin")}:${process.env.PATH}`, DISPLAY: "", SUITE_TEST_PID: marker }, // prettier-ignore
        stdio: "ignore",
      });
      ({ completion, cancel } = exited(child));
      pid = await pidFrom(marker);
      expect(await cancel()).toBe(143);
      expect(await processRunning(pid)).toBe(false);
    } finally {
      child?.kill("SIGKILL");
      if (pid && (await processRunning(pid))) process.kill(pid, "SIGKILL");
      await completion?.catch(() => {});
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

for (const ignoresTerm of [true, false]) {
  test(`canceling an active lane stops its process group without starting the next file (${ignoresTerm ? "forced" : "graceful"} leader)`, async () => {
    const dir = await runnerCheckout();
    let child;
    let completion;
    let cancel;
    let pid;
    let descendant;
    try {
      const marker = path.join(dir, "worker.pid");
      const descendantMarker = path.join(dir, "descendant.pid");
      const starts = path.join(dir, "starts.txt");
      await fs.writeFile(
        path.join(dir, "node_modules/@playwright/test/cli.js"),
        `
const fs = require("node:fs");
const { spawn } = require("node:child_process");
process.on("SIGTERM", () => { ${ignoresTerm ? "" : "process.exit(0);"} });
fs.appendFileSync(process.env.SUITE_TEST_STARTS, process.argv[3].includes("first") ? "first\\n" : "second\\n");
fs.writeFileSync(process.env.SUITE_TEST_PID, String(process.pid));
spawn(process.execPath, ["-e", ${JSON.stringify(holdProcess)}], {
  env: { ...process.env, SUITE_TEST_PID: process.env.SUITE_TEST_DESCENDANT_PID },
  stdio: "ignore",
});
setInterval(() => {}, 1000);
`,
      );
      child = spawn(process.execPath, [path.join(dir, "tools/suite.mjs")], {
        cwd: dir,
        env: { ...process.env, SPLASHERY_PORT: "0", SPLASHERY_GL: "swiftshader", SUITE_TEST_PID: marker, SUITE_TEST_DESCENDANT_PID: descendantMarker, SUITE_TEST_STARTS: starts }, // prettier-ignore
        stdio: "ignore",
      });
      ({ completion, cancel } = exited(child));
      pid = await pidFrom(marker);
      descendant = await pidFrom(descendantMarker);
      expect(await cancel()).toBe(143);
      expect(await processRunning(pid)).toBe(false);
      expect(await processRunning(descendant)).toBe(false);
      expect(await fs.readFile(starts, "utf8")).toBe("first\n");
    } finally {
      child?.kill("SIGKILL");
      if (pid && (await processRunning(pid))) process.kill(-pid, "SIGKILL");
      if (descendant && (await processRunning(descendant))) process.kill(descendant, "SIGKILL");
      await completion?.catch(() => {});
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

test("concurrent suite servers reserve different ports and serve their own checkout", async () => {
  const dirs = await Promise.all(["before", "after"].map((name) => fs.mkdtemp(path.join(os.tmpdir(), `suite-${name}-`)))); // prettier-ignore
  const servers = [];
  try {
    await Promise.all(dirs.map((dir, i) => fs.writeFile(path.join(dir, "index.html"), String(i))));
    servers.push(...(await Promise.all(dirs.map((root) => startServer({ root })))));
    expect(servers[0].port).not.toBe(servers[1].port);
    expect(servers.every((s) => s.port !== 4173)).toBe(true);
    expect(await Promise.all(servers.map(async (s) => (await fetch(s.url)).text()))).toEqual(["0", "1"]); // prettier-ignore
    // A second run may not silently reuse an explicitly requested port.
    await expect(startServer({ root: dirs[1], port: servers[0].port })).rejects.toThrow(/address already in use/i); // prettier-ignore
  } finally {
    await Promise.all(servers.map((s) => s.close()));
    await Promise.all(dirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  }
});

test("a suite process error or a report with no executed tests cannot count as a pass", () => {
  const passed = { stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, errors: [] };
  expect(reportProblems(passed, 0)).toEqual([]);
  expect(reportProblems(passed, 1)).toContain("Playwright exited with code 1");
  expect(reportProblems(passed, null)).toContain("Playwright exited with code null");
  expect(reportProblems({ ...passed, errors: [{ message: "Server failed to start" }] }, 0)).toContain("Server failed to start"); // prettier-ignore
  expect(reportProblems({ ...passed, stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 } }, 0)).toContain("No tests executed"); // prettier-ignore
  expect(reportProblems(null, 0)).toContain("No JSON report");
});

function timingReceipt(status = "passed") {
  return {
    stats: { startTime: "2026-10-13T00:00:00.000Z", duration: 1000, expected: status === "passed" ? 1 : 0, unexpected: status === "failed" ? 1 : 0, skipped: status === "skipped" ? 1 : 0, flaky: 0 }, // prettier-ignore
    suiteRun: { wall: 1, code: status === "failed" ? 1 : 0 },
    errors: [],
    suites: [{ title: "hl1.spec.mjs", specs: [{ title: "the same original sample", tests: [{ expectedStatus: "passed", projectName: "chromium", results: [{ status, duration: 950, retry: 0 }] }] }] }], // prettier-ignore
  };
}

async function timingProfile(before, after, { afterJobs = 1 } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "suite-profile-"));
  try {
    for (const name of ["original", "before", "after"]) await fs.mkdir(path.join(dir, name));
    await fs.writeFile(path.join(dir, "original/hl1.spec.mjs"), "// Original file inventory.\n");
    for (const [name, receipt] of [
      ["before", before],
      ["after", after],
    ]) {
      await fs.writeFile(path.join(dir, name, "hl1.json"), JSON.stringify(receipt));
      await fs.writeFile(path.join(dir, name, "run.json"), JSON.stringify({ started: "2026-10-12T23:59:59.000Z", finished: "2026-10-13T00:00:02.000Z", elapsed: name === "before" ? 2 : 1, jobs: name === "before" ? 1 : afterJobs, files: ["hl1"], gl: "swiftshader", browser: "/same/chromium" })); // prettier-ignore
    }
    const { stdout } = await promisify(execFile)(process.execPath, [
      new URL("../tools/suite-profile.mjs", import.meta.url).pathname,
      `--original-specs-dir=${path.join(dir, "original")}`,
      `--before-jobs1=${path.join(dir, "before")}`,
      `--after-jobs${afterJobs}=${path.join(dir, "after")}`,
    ]);
    return stdout;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("a complete failing baseline can measure a passing repair without hiding the failure", async () => {
  const profile = await timingProfile(timingReceipt("failed"), timingReceipt());
  expect(profile).toContain("Before failures: 1; after failures: 0.");
  expect(profile).toContain("Measured whole-run ratio: 2.000×");
  expect(profile).toContain("includes the cost of baseline failures");
  const parallel = await timingProfile(timingReceipt("failed"), timingReceipt(), { afterJobs: 2 });
  expect(parallel).toContain("Before jobs=1 → after jobs=2: all 1 original files");
  expect(parallel).toContain("Measured whole-run ratio: 2.000×");
});

test("incomplete, retried, failed, or newly skipped final runs cannot produce a suite speedup", async () => {
  for (const kind of [
    "interrupted",
    "missing",
    "retried",
    "failed",
    "skipped",
    "changed sample",
    "repeated",
    "CPU load",
  ]) {
    const after = timingReceipt(kind === "failed" || kind === "skipped" ? kind : "passed");
    const result = after.suites[0].specs[0].tests[0];
    if (kind === "interrupted") {
      result.results[0].status = "interrupted";
      after.suiteRun.code = 143;
    } else if (kind === "missing") result.results = [];
    else if (kind === "retried")
      result.results.unshift({ status: "failed", duration: 950, retry: 0 });
    else if (kind === "changed sample") after.suites[0].specs[0].title = "a different sample";
    else if (kind === "repeated") after.config = { projects: [{ repeatEach: 20 }] };
    else if (kind === "CPU load")
      result.annotations = [{ type: "cpu-throttle-requested", description: "2×" }];
    const profile = await timingProfile(timingReceipt(), after);
    expect(profile, kind).toContain("Jobs=1: no complete-coverage speedup claim.");
    expect(profile, kind).not.toContain("Measured whole-run ratio:");
  }
  const before = timingReceipt("failed");
  before.suiteRun.code = 143;
  expect(await timingProfile(before, timingReceipt())).not.toContain("Measured whole-run ratio:");
  const inconsistent = timingReceipt("failed");
  inconsistent.suiteRun.code = 0;
  expect(await timingProfile(inconsistent, timingReceipt())).not.toContain(
    "Measured whole-run ratio:",
  );
  expect(await timingProfile(timingReceipt("skipped"), timingReceipt("skipped"))).toContain(
    "Measured whole-run ratio:",
  );
});
