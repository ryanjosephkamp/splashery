import { defineConfig } from "@playwright/test";
import { safeLaunchOptions } from "./cdx-three-browser.mjs";

const port = Number(process.env.SPLASHERY_PORT) || 4272;
process.env.QR72_SAFE = "1";

// Standalone config: never inherit the repository's software-GPU overrides.
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: safeLaunchOptions(),
  },
});
