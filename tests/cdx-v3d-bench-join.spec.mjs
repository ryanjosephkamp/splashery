// MIT. CPU-only evidence-copy and provenance checks; no browser or trainer is launched.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { joinRuns } from "../tools/v3d-bench-join.mjs";
import { fingerprint, benchmarkCohort, rowKey } from "../tools/v3d-bench-metrics.mjs";
import { referenceEvidence, assertReferenceEvidence } from "../tools/v3d-bench.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const readJson = (file) => JSON.parse(fs.readFileSync(file));
const png = PNG.sync.write({
  width: 2,
  height: 2,
  data: Buffer.from([40, 80, 120, 255].flatMap((v) => [v, v, v, v])),
});

function fixture({ partial = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-bench-join-")),
    manifest = path.join(root, "manifest.json"),
    phone = path.join(root, "phone"),
    desktop = path.join(root, "desktop"),
    output = path.join(root, "joined"),
    clips = ["a", "b"].map((id) => ({
      id,
      sha256: hash(`input-${id}`),
      duration: 6,
      file: `${id}.mp4`,
    }));
  writeJson(manifest, { clips });
  const files = [{ file: "index.html", status: 200, sha256: hash("served source") }],
    provenance = {
      protocolSha256: hash("frozen protocol"),
      reference: null,
      servedSource: { sha256: fingerprint(files), files },
      url: "http://127.0.0.1:4174/",
      environment: { browserVersion: "151.0.7922.173", launchArgs: ["swiftshader"] },
      options: { gpuMode: "swiftshader", timeout: 1800000 },
      manifestSha256: hash(fs.readFileSync(manifest)),
      inputs: clips,
    },
    provenanceSha256 = fingerprint(provenance);
  const writeCase = (directory, id, profile, status = "finished") => {
    const folder = path.join(directory, `${id}-${profile}`);
    fs.mkdirSync(path.join(folder, "logs"), { recursive: true });
    fs.mkdirSync(path.join(folder, "empty"));
    fs.writeFileSync(path.join(folder, "outcome.png"), png);
    fs.writeFileSync(path.join(folder, "raw.bin"), Buffer.from([0, 1, 255, 3]));
    fs.writeFileSync(path.join(folder, "logs", "notes.txt"), "Raw diagnostic\n");
    const row = {
      id,
      profile,
      sha256: clips.find((clip) => clip.id === id).sha256,
      provenanceSha256,
      status,
      consoleErrors: [],
      firstViewMs: 20,
      bakeMs: 50,
      browser: provenance.environment.browserVersion,
    };
    if (status === "finished") {
      const model = Buffer.from("ply\nformat ascii 1.0\nelement vertex 0\nend_header\n"),
        evaluation = Buffer.from(JSON.stringify({ sha256: row.sha256, times: [1] }) + "\n");
      fs.writeFileSync(path.join(folder, "model.ply"), model);
      fs.writeFileSync(path.join(folder, "model.json"), '{"raw": true}\n');
      fs.writeFileSync(path.join(folder, "evaluation.json"), evaluation);
      fs.writeFileSync(path.join(folder, "render-0.png"), png);
      fs.writeFileSync(path.join(folder, "reference-0.png"), png);
      Object.assign(row, {
        modelSha256: hash(model),
        evaluationSha256: hash(evaluation),
        mean: { ssim: 0.4, laplacian: 0.01 },
        heldoutEvidence: { complete: true },
        frames: [{ time: 1, renderSha256: hash(png), referenceSha256: hash(png) }],
      });
    } else {
      row.mean = null;
      row.reason = "Actual retained failure. Try another stretch.";
      if (status === "explained")
        row.explanation = {
          visible: true,
          diagnostic: "Too little translation.",
          advice: "Walk sideways.",
        };
    }
    writeJson(path.join(folder, "result.json"), row);
    return row;
  };
  for (const [index, [directory, profile]] of [
    [phone, "phone"],
    [desktop, "desktop"],
  ].entries()) {
    fs.mkdirSync(directory);
    const results = [writeCase(directory, "a", profile)];
    if (!partial)
      results.push(
        writeCase(directory, "b", profile, profile === "phone" ? "explained" : "harness-error"),
      );
    writeJson(path.join(directory, "run.json"), {
      created: new Date(index * 1000).toISOString(),
      url: provenance.url,
      manifestSha256: provenance.manifestSha256,
      cohort: benchmarkCohort(clips),
      provenance,
      provenanceSha256,
      reference: null,
      selection: { ids: clips.map(({ id }) => id), profiles: [profile] },
      renderer: "Production renderer; emulator timings, not physical-phone measurements.",
      results,
    });
  }
  return {
    root,
    manifest,
    phone,
    desktop,
    output,
    writeCase,
    join: (inputs = [phone, desktop], destination = output) =>
      joinRuns({ manifest, output: destination, inputs }),
    dispose: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function rewriteRun(directory, change, { resign = false } = {}) {
  const file = path.join(directory, "run.json"),
    run = readJson(file);
  change(run);
  if (resign) {
    run.provenanceSha256 = fingerprint(run.provenance);
    for (const row of run.results) {
      row.provenanceSha256 = run.provenanceSha256;
      writeJson(path.join(directory, `${row.id}-${row.profile}`, "result.json"), row);
    }
  }
  writeJson(file, run);
}

function allBytes(directory, relative = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const name = path.join(relative, item.name),
      file = path.join(directory, item.name);
    return item.isDirectory() ? allBytes(file, name) : [[name, fs.readFileSync(file)]];
  });
}

test("joining preserves raw case bytes, source runs, failure rows, and existing reference bindings", () => {
  const f = fixture();
  try {
    fs.mkdirSync(path.join(f.root, ".git")); // An unrelated workspace marker is not product code.
    const phoneRun = readJson(path.join(f.phone, "run.json")),
      candidate = {
        id: "a",
        profile: "phone",
        referenceEvidence: referenceEvidence(f.phone, phoneRun, "a", "phone"),
      },
      joined = f.join();
    expect(joined.run.provenance).toEqual(phoneRun.provenance);
    expect(joined.run.provenanceSha256).toBe(phoneRun.provenanceSha256);
    expect(joined.run.results).toHaveLength(4);
    for (const [index, directory] of [f.phone, f.desktop].entries()) {
      const original = readJson(path.join(directory, "run.json"));
      expect(
        fs.readFileSync(
          path.join(f.output, "join-inputs", String(index + 1).padStart(3, "0"), "run.json"),
        ),
      ).toEqual(fs.readFileSync(path.join(directory, "run.json")));
      for (const row of original.results) {
        expect(joined.run.results.find((value) => rowKey(value) === rowKey(row))).toEqual(row);
        const folder = `${row.id}-${row.profile}`;
        for (const [file, bytes] of allBytes(path.join(directory, folder)))
          expect(fs.readFileSync(path.join(f.output, folder, file))).toEqual(bytes);
        expect(fs.statSync(path.join(f.output, folder, "empty")).isDirectory()).toBe(true);
      }
    }
    expect(
      assertReferenceEvidence(f.output, joined.run, candidate, phoneRun.provenanceSha256),
    ).toEqual(candidate.referenceEvidence);
    expect(joined.receipt.coverage).toEqual({
      expectedRows: 4,
      recordedRows: 4,
      pending: [],
      unaccounted: ["b/desktop"],
      allOutcomesAccounted: false,
    });
    expect(hash(fs.readFileSync(path.join(f.output, "run.json")))).toBe(joined.receipt.runSha256);
    expect(fs.readFileSync(path.join(f.output, "manifest.json"))).toEqual(
      fs.readFileSync(f.manifest),
    );
  } finally {
    f.dispose();
  }
});

test("validly rehashed source, protocol, browser, and options mismatches cannot be joined", () => {
  const changes = [
    (run) => {
      run.provenance.servedSource.files[0].sha256 = hash("changed source");
      run.provenance.servedSource.sha256 = fingerprint(run.provenance.servedSource.files);
    },
    (run) => {
      run.provenance.protocolSha256 = hash("changed protocol");
    },
    (run) => {
      run.provenance.environment.browserVersion = "other";
    },
    (run) => {
      run.provenance.options.timeout++;
    },
  ];
  for (const change of changes) {
    const f = fixture();
    try {
      rewriteRun(f.desktop, change, { resign: true });
      expect(() => f.join()).toThrow(/provenance differs/i);
      expect(fs.existsSync(f.output)).toBe(false);
    } finally {
      f.dispose();
    }
  }
});

test("changed cohort, input hash, invalid provenance digest, and duplicate rows are rejected", () => {
  for (const change of [
    (run) => run.cohort.inputs.pop(),
    (run) => {
      run.results[0].sha256 = hash("changed input");
    },
    (run) => {
      run.provenanceSha256 = hash("unbound provenance");
    },
    (run) => run.results.push(run.results[0]),
  ]) {
    const f = fixture();
    try {
      rewriteRun(f.desktop, change);
      expect(() => f.join()).toThrow(/invalid|duplicate/i);
    } finally {
      f.dispose();
    }
  }
});

test("identical duplicate cases are retained once, while conflicting rows or unscored raw bytes fail", () => {
  for (const mutation of [null, "row", "raw"]) {
    const f = fixture();
    try {
      const duplicate = path.join(f.root, "duplicate");
      fs.cpSync(f.phone, duplicate, { recursive: true });
      if (mutation === "row")
        rewriteRun(duplicate, (run) => {
          run.results[0].firstViewMs++;
          writeJson(path.join(duplicate, "a-phone", "result.json"), run.results[0]);
        });
      if (mutation === "raw")
        fs.appendFileSync(path.join(duplicate, "a-phone", "raw.bin"), "changed");
      const join = () => f.join([f.phone, f.desktop, duplicate]);
      if (mutation) expect(join).toThrow(/conflicting duplicate/i);
      else {
        const result = join();
        expect(result.run.results).toHaveLength(4);
        expect(result.receipt.sources).toHaveLength(3);
      }
    } finally {
      f.dispose();
    }
  }
});

test("corrupted or missing model, PNG, evaluation, and result files are rejected", () => {
  for (const [file, remove] of [
    ["model.ply", false],
    ["render-0.png", false],
    ["reference-0.png", true],
    ["evaluation.json", true],
    ["result.json", true],
  ]) {
    const f = fixture();
    try {
      const artifact = path.join(f.phone, "a-phone", file);
      if (remove) fs.unlinkSync(artifact);
      else fs.appendFileSync(artifact, "corruption");
      expect(() => f.join()).toThrow();
      expect(fs.existsSync(f.output)).toBe(false);
    } finally {
      f.dispose();
    }
  }
});

test("destinations must be fresh, outside checkouts, and disjoint from every source", () => {
  const f = fixture();
  try {
    fs.mkdirSync(f.output);
    expect(() => f.join()).toThrow(/fresh/i);
    fs.rmdirSync(f.output);
    expect(() => f.join([f.phone, f.desktop], path.join(f.phone, "nested"))).toThrow(/overlap/i);
    expect(() => f.join([f.phone, path.join(f.phone, "a-phone")])).toThrow(/overlap/i);
    expect(() => f.join([f.phone, f.phone])).toThrow(/distinct/i);
    expect(() =>
      f.join([f.phone, f.desktop], path.resolve(import.meta.dirname, "../.join-test-output")),
    ).toThrow(/outside/i);
    fs.symlinkSync(path.resolve(import.meta.dirname, ".."), path.join(f.root, "checkout-link"));
    expect(() =>
      f.join([f.phone, f.desktop], path.join(f.root, "checkout-link", ".join-test-output")),
    ).toThrow(/outside/i);
    fs.symlinkSync(path.join(f.phone, "run.json"), path.join(f.phone, "a-phone", "linked.json"));
    expect(() => f.join()).toThrow(/symlink/i);
  } finally {
    f.dispose();
  }
});

test("appended rows and unrelated active-case writes do not change a captured immutable snapshot", () => {
  const f = fixture({ partial: true }),
    originalCopy = fs.cpSync;
  let appended = false;
  try {
    fs.mkdirSync(path.join(f.desktop, "b-desktop"));
    fs.writeFileSync(path.join(f.desktop, "b-desktop", "in-progress.txt"), "training");
    const capturedRun = fs.readFileSync(path.join(f.phone, "run.json"));
    fs.cpSync = (from, to, options) => {
      const result = originalCopy(from, to, options);
      if (!appended && from === path.join(f.phone, "a-phone")) {
        appended = true;
        const row = f.writeCase(f.phone, "b", "phone");
        rewriteRun(f.phone, (run) => run.results.push(row));
        fs.appendFileSync(path.join(f.desktop, "b-desktop", "in-progress.txt"), " still training");
      }
      return result;
    };
    const result = f.join();
    expect(appended).toBe(true);
    expect(result.run.results.map(rowKey)).toEqual(["a/phone", "a/desktop"]);
    expect(result.receipt.coverage.pending).toEqual(["b/phone", "b/desktop"]);
    expect(fs.readFileSync(path.join(f.output, "join-inputs", "001", "run.json"))).toEqual(
      capturedRun,
    );
    expect(fs.existsSync(path.join(f.output, "b-phone"))).toBe(false);
    expect(fs.existsSync(path.join(f.output, "join-inputs", "002", "b-desktop"))).toBe(false);
  } finally {
    fs.cpSync = originalCopy;
    f.dispose();
  }
});

test("removed or altered captured rows and late changes to unscored case bytes reject the transaction", () => {
  const originalCopy = fs.cpSync;
  for (const mutation of ["remove", "row", "raw", "provenance"]) {
    const f = fixture();
    let changed = false;
    try {
      fs.cpSync = (from, to, options) => {
        const result = originalCopy(from, to, options);
        if (!changed && from.endsWith(path.join("join-inputs", "001", "a-phone"))) {
          changed = true;
          if (mutation === "raw")
            fs.appendFileSync(path.join(f.phone, "a-phone", "raw.bin"), "later");
          else
            rewriteRun(
              f.phone,
              (run) => {
                if (mutation === "remove") run.results.shift();
                else if (mutation === "row") run.results[0].bakeMs++;
                else run.provenance.options.timeout++;
              },
              { resign: mutation === "provenance" },
            );
        }
        return result;
      };
      expect(() => f.join()).toThrow(/changed during the join/i);
      expect(changed).toBe(true);
      expect(fs.existsSync(f.output)).toBe(false);
      const staging = fs.readdirSync(f.root).find((name) => name.startsWith(".joined-joining-"));
      expect(fs.existsSync(path.join(f.root, staging, "join-failure.json"))).toBe(true);
    } finally {
      fs.cpSync = originalCopy;
      f.dispose();
    }
  }
});

test("a damaged destination copy is retained as failed evidence and never published as a run", () => {
  const f = fixture(),
    originalCopy = fs.cpSync;
  let damaged = false;
  try {
    fs.cpSync = (from, to, options) => {
      const result = originalCopy(from, to, options);
      if (!damaged && from === path.join(f.phone, "a-phone")) {
        damaged = true;
        fs.truncateSync(path.join(to, "render-0.png"), 8);
      }
      return result;
    };
    expect(() => f.join()).toThrow(/copied source inventory differs/i);
    expect(damaged).toBe(true);
    expect(fs.existsSync(f.output)).toBe(false);
  } finally {
    fs.cpSync = originalCopy;
    f.dispose();
  }
});
