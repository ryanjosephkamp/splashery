import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const port = Number(process.env.SPLASHERY_PORT) || 47846;
export default defineConfig({
  testDir: fileURLToPath(new URL("./", import.meta.url)),
  testMatch: "verify.spec.mjs",
  outputDir: `${root}/test-results/ascii-capture-encoding-prototype`,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}/docs/audits/ascii-capture-encoding-prototype/`,
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      args:
        process.platform === "darwin"
          ? ["--use-angle=metal"]
          : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    cwd: root,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
  },
});
