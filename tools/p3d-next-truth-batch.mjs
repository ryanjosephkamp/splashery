// MIT. Stream independent scene/profile truth jobs as frozen cameras arrive.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const [captureRoot, outputRoot, raster = "native", reuseRoot] = process.argv.slice(2),
  out = path.resolve(outputRoot);
if (!captureRoot || !outputRoot) throw new Error("Use <capture folder> <truth folder>");
fs.mkdirSync(out, { recursive: true });
const scenes = JSON.parse(fs.readFileSync("tests/fixtures/truth/manifest.json")).scenes;
const jobs = [],
  deadline = Date.now() + 110 * 60000;
for (const scene of scenes)
  for (const profile of ["phone", "desktop"]) {
    const id = `truth-${scene.id}-${profile}`,
      file = path.join(captureRoot, id + ".json");
    while (!fs.existsSync(file)) {
      if (Date.now() > deadline) throw new Error("True-target budget exhausted waiting for " + id);
      await new Promise((r) => setTimeout(r, 1000));
    }
    const row = JSON.parse(fs.readFileSync(file));
    row.appProfile = row.appProfile || row.profile;
    row.profile = profile;
    // Boundary paths remain relative to the original capture folder.
    const cameraFile = path.resolve(captureRoot, id + "-camera.json");
    fs.writeFileSync(cameraFile, JSON.stringify({ complete: true, rows: [row] }));
    const job = path.join(out, id);
    fs.mkdirSync(job, { recursive: true });
    if (
      !fs.existsSync(path.join(job, "targets.json")) ||
      !JSON.parse(fs.readFileSync(path.join(job, "targets.json"))).complete
    ) {
      const fd = fs.openSync(path.join(job, "render.log"), "a");
      try {
        const code = await new Promise((resolve, reject) => {
          const child = spawn(
            "blender",
            [
              "-b",
              "--factory-startup",
              "--threads",
              "2",
              "--python-exit-code",
              "1",
              "--python",
              "tools/p3d-next-truth.py",
              "--",
              "--capture",
              cameraFile,
              "--out",
              job,
              "--raster",
              raster,
              ...(reuseRoot ? ["--reuse-from", path.resolve(reuseRoot, id)] : []),
            ],
            { stdio: ["ignore", fd, fd] },
          );
          const timer = setTimeout(
            () => child.kill("SIGTERM"),
            Math.max(1000, deadline - Date.now()),
          );
          child.on("error", reject);
          child.on("exit", (code) => {
            clearTimeout(timer);
            resolve(code);
          });
        });
        if (code !== 0) throw new Error("Truth job failed: " + id + " (" + code + ")");
      } finally {
        fs.closeSync(fd);
      }
    }
    const result = JSON.parse(fs.readFileSync(path.join(job, "targets.json")));
    if (result.records.length !== 9) throw new Error("Incomplete nine-pose truth job: " + id);
    jobs.push({
      id,
      settings: JSON.parse(fs.readFileSync(path.join(job, "settings.json"))),
      records: result.records.map((r) => ({ ...r, folder: path.join(id, r.folder) })),
    });
    fs.writeFileSync(
      path.join(out, "targets.json"),
      JSON.stringify({
        complete: jobs.length === 24,
        jobs: jobs.map(({ records, ...j }) => j),
        records: jobs.flatMap((j) => j.records),
      }),
    );
    console.log(id, "9 true target views", new Date().toISOString());
  }
