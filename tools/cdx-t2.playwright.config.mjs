// Task-local configuration: use the installed browser with its sandbox.
// No unsafe graphics flags or GPU blocklist overrides from the shared config.
import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SPLASHERY_PORT) || 4173;
export default defineConfig({
  testDir: "../tests",
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../test-results/cdx-t2",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
      chromiumSandbox: true,
      args: [],
    },
  },
  webServer: {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
