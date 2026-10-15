// Run an existing review tool with a sandboxed browser and no added flags.
// node tools/cdx-t2-browser-tool.mjs <effect-clip|make-thumbs|contact-sheet> <tool args...>
// Effect clips are forced to Low; thumbnails keep the standard High tier.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const [tool, ...args] = process.argv.slice(2);
if (!["effect-clip", "make-thumbs", "contact-sheet"].includes(tool))
  throw new Error("Choose effect-clip, make-thumbs, or contact-sheet.");
const original = fs.readFileSync(new URL(`tools/${tool}.mjs`, root), "utf8");
const launch = /const browser = await chromium\.launch\(\{[\s\S]*?\n\}\);/;
if (!launch.test(original) || (tool === "effect-clip" && !original.includes("profile=high")))
  throw new Error("Review the browser tool adapter: its source changed.");
let source = original.replace(
  launch,
  `const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  chromiumSandbox: true,
  args: [],
});`,
);
if (tool === "effect-clip")
  source = source
    .replace("profile=high", "profile=low")
    .replace("width: 1000, height: 700", "width: 390, height: 844");
if (/--(?:no-sandbox|enable-unsafe|ignore-gpu-blocklist|disable-web-security)/.test(source))
  throw new Error("Unexpected unsafe flag in the adapted capture tool.");
fs.mkdirSync(new URL(".cache/", root), { recursive: true });
const temp = new URL(`.cache/cdx-t2-${tool}.mjs`, root);
fs.writeFileSync(temp, source);
try {
  const result = spawnSync(process.execPath, [fileURLToPath(temp), ...args], {
    stdio: "inherit",
    cwd: root,
    timeout: 900_000,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.unlinkSync(temp);
}
