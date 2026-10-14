// MIT. Retrieve the unpublished fixture archive through the authenticated gh CLI.
// Never publish a release, alter account settings, or fetch user media.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

const options = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
if (options.help) {
  console.log(
    "node tools/studio-truth-fetch.mjs [--out=.cache/studio-truth/download] [--archive=/path/to/studio-truth-2026-10.tar.gz] [--sha256=<expected hash>]\nDefault: gh release download studio-truth-2026-10 from ryanjosephkamp/splashery. A draft archive requires collaborator access.",
  );
  process.exit(0);
}
const out = path.resolve(options.out || ".cache/studio-truth/download");
await fs.mkdir(out, { recursive: true });
let archive = options.archive && path.resolve(options.archive);
if (!archive) {
  execFileSync(
    "gh",
    [
      "release",
      "download",
      "studio-truth-2026-10",
      "--repo",
      "ryanjosephkamp/splashery",
      "--pattern",
      "studio-truth-2026-10.tar.gz*",
      "--dir",
      out,
    ],
    { stdio: "inherit" },
  );
  archive = path.join(out, "studio-truth-2026-10.tar.gz");
}
const expected =
  options.sha256 || (await fs.readFile(archive + ".sha256", "utf8")).trim().split(/\s+/)[0];
if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error("A SHA-256 digest is required");
const hash = createHash("sha256");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== expected)
  throw new Error("Archive checksum mismatch; nothing extracted");
const target = path.join(out, "extracted");
try {
  await fs.access(target);
  throw new Error("Extraction folder exists; choose a new --out folder");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
// Python's data filter plus explicit file-type/path checks prohibit links and traversal.
const python = `import pathlib, sys, tarfile
archive, target = sys.argv[1:]
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    for member in members:
        p = pathlib.PurePosixPath(member.name)
        if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0] != 'truth':
            raise ValueError('Unsafe archive path')
        if not (member.isfile() or member.isdir()):
            raise ValueError('Unsafe archive entry')
    tar.extractall(target, members=members, filter='data')
`;
execFileSync("python3", ["-c", python, archive, target], { stdio: "inherit" });
execFileSync(
  "python3",
  ["tools/studio-truth-assets.py", "--input", path.join(target, "truth"), "--full"],
  { stdio: "inherit" },
);
console.log(`Validated fixture set: ${path.join(target, "truth")}`);
