import { defineConfig } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

// Deliberately independent of the repository's graphics-override configuration.
// Use normal Chromium capability detection with its sandbox enabled.
const port = Number(process.env.SPLASHERY_PORT) || 4173;
// Playwright is pinned in package.json. Inspect its shipped defaults so its
// implicit security overrides are removed along with explicit graphics flags.
const require = createRequire(import.meta.url);
const { chromiumSwitches } = require(
  path.join(
    path.dirname(require.resolve("playwright-core/package.json")),
    "lib/server/chromium/chromiumSwitches.js",
  ),
);
const securityOverrides = new Set([
  "--disable-client-side-phishing-detection",
  "--disable-ipc-flooding-protection",
  "--disable-popup-blocking",
  "--disable-hang-monitor",
  "--disable-prompt-on-repost",
  "--unsafely-disable-devtools-self-xss-warnings",
]);
const ignoreDefaultArgs = chromiumSwitches(false).filter(
  (arg) => securityOverrides.has(arg) || arg.startsWith("--disable-features="),
);
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs$/,
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../test-results/renderer-diagnostics",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
      chromiumSandbox: true,
      ignoreDefaultArgs,
      args: [],
    },
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "ignore",
    stderr: "ignore",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
