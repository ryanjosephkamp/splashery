#!/usr/bin/env node
// MIT. Join immutable baseline snapshots without changing benchmark rows or artifact bytes.
// node tools/v3d-bench-join.mjs <manifest.json> <fresh-output> <run-directory> <run-directory> [...]
// No browser is launched. A partial cohort remains partial; joining does not establish acceptance.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { assertReferenceEvidence, verifyArtifacts } from "./v3d-bench.mjs";
import { accountedOutcome, benchmarkCohort, fingerprint, rowKey } from "./v3d-bench-metrics.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const validHash = (value) => /^[a-f0-9]{64}$/.test(value || "");
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const productRoot = fs.realpathSync(path.resolve(import.meta.dirname, ".."));

function prospectivePath(file) {
  const absolute = path.resolve(file);
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute);
  const parent = path.dirname(absolute);
  if (parent === absolute) return absolute;
  return path.join(prospectivePath(parent), path.basename(absolute));
}

function inProductCheckout(directory) {
  if (inside(directory, productRoot)) return true;
  for (let at = directory; ; at = path.dirname(at)) {
    // The managed workspace itself can have an unrelated .git directory. Also recognize
    // Splashery's other worktrees without treating that workspace marker as product code.
    if (
      fs.existsSync(path.join(at, ".git")) &&
      fs.existsSync(path.join(at, "package.json")) &&
      readJson(path.join(at, "package.json")).name === "splashery"
    )
      return true;
    if (path.dirname(at) === at) return false;
  }
}

// Include every raw file in a captured case, even artifacts the benchmark does not score
// (for example, outcome.png and model.json). Reject links rather than following them.
function inventory(directory) {
  const entries = [];
  const visit = (at, relative = "") => {
    for (const item of fs
      .readdirSync(at, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const file = path.join(at, item.name),
        name = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) {
        entries.push({ path: name, type: "directory" });
        visit(file, name);
      } else if (item.isFile()) {
        const bytes = fs.readFileSync(file);
        entries.push({ path: name, type: "file", bytes: bytes.length, sha256: hash(bytes) });
      } else throw new Error(`Symlink or special file is not snapshot evidence: ${file}.`);
    }
  };
  visit(directory);
  return entries.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

function caseInventory(entries, folder) {
  return entries
    .filter((entry) => entry.path.startsWith(folder + "/"))
    .map((entry) => ({ ...entry, path: entry.path.slice(folder.length + 1) }));
}

function validateCase(directory, row) {
  const folder = path.join(directory, `${row.id}-${row.profile}`);
  const result = readJson(path.join(folder, "result.json"));
  if (fingerprint(result) !== fingerprint(row))
    throw new Error(`Case result.json differs from its recorded row: ${rowKey(row)}.`);
  verifyArtifacts(directory, row);
  // Failed attempts can still retain a model or partial evaluation. Check every hash that
  // they recorded without changing their failure status or inventing missing evidence.
  const check = (file, expected) => {
    if (
      expected !== undefined &&
      (!validHash(expected) || hash(fs.readFileSync(file)) !== expected)
    )
      throw new Error(
        `Missing or changed recorded artifact: ${rowKey(row)} / ${path.basename(file)}.`,
      );
  };
  check(path.join(folder, "model.ply"), row.modelSha256);
  check(path.join(folder, "evaluation.json"), row.evaluationSha256);
  for (const [index, frame] of (row.frames || []).entries())
    for (const kind of ["render", "reference"])
      check(path.join(folder, `${kind}-${index}.png`), frame[`${kind}Sha256`]);
}

function validateRun(directory, runBytes, cohort, manifestSha256, clips, reference) {
  const run = JSON.parse(runBytes);
  if (
    !run.provenance ||
    !validHash(run.provenanceSha256) ||
    fingerprint(run.provenance) !== run.provenanceSha256 ||
    !validHash(run.provenance.protocolSha256) ||
    run.provenance.manifestSha256 !== manifestSha256 ||
    run.manifestSha256 !== manifestSha256 ||
    fingerprint(run.cohort) !== fingerprint(cohort) ||
    fingerprint(run.provenance.inputs) !==
      fingerprint(clips.map(({ id, sha256, duration, file }) => ({ id, sha256, duration, file })))
  )
    throw new Error(`Invalid cohort, manifest, or provenance: ${directory}.`);
  if (reference) {
    const baseline = reference.run;
    if (
      run.provenance.reference?.provenanceSha256 !== baseline.provenanceSha256 ||
      fingerprint(run.reference) !== fingerprint(run.provenance.reference) ||
      run.provenance.protocolSha256 !== baseline.provenance.protocolSha256 ||
      fingerprint(run.provenance.environment) !== fingerprint(baseline.provenance.environment) ||
      fingerprint(run.provenance.options) !== fingerprint(baseline.provenance.options)
    )
      throw new Error("Candidate reference, protocol, browser, or options differ from the baseline.");
  } else if (run.provenance.reference !== null || run.reference !== null)
    throw new Error("Only baseline runs without candidate references can be joined; candidates require --reference."); // prettier-ignore
  const served = run.provenance.servedSource;
  if (
    !served?.files?.length ||
    !validHash(served.sha256) ||
    fingerprint(served.files) !== served.sha256 ||
    !run.provenance.environment ||
    !run.provenance.options ||
    run.url !== run.provenance.url ||
    !Array.isArray(run.results)
  )
    throw new Error(`Invalid served-source or run metadata: ${directory}.`);
  if (
    !run.selection?.ids?.length ||
    !run.selection?.profiles?.length ||
    new Set(run.selection.ids).size !== run.selection.ids.length ||
    new Set(run.selection.profiles).size !== run.selection.profiles.length ||
    run.selection.ids.some((id) => !cohort.inputs.some((input) => input.id === id)) ||
    run.selection.profiles.some((profile) => !cohort.profiles.includes(profile))
  )
    throw new Error(`Invalid run selection: ${directory}.`);
  const inputs = new Map(cohort.inputs.map((input) => [input.id, input.sha256])),
    seen = new Set();
  for (const row of run.results) {
    const key = rowKey(row);
    if (
      seen.has(key) ||
      !inputs.has(row.id) ||
      !cohort.profiles.includes(row.profile) ||
      row.sha256 !== inputs.get(row.id) ||
      row.provenanceSha256 !== run.provenanceSha256 ||
      typeof row.status !== "string" ||
      !row.status
    )
      throw new Error(`Invalid or duplicate result row: ${key}.`);
    seen.add(key);
    if (reference)
      assertReferenceEvidence(reference.directory, reference.run, row, reference.run.provenanceSha256); // prettier-ignore
  }
  return run;
}

function sourceSnapshot(directory, cohort, manifestSha256, clips, reference) {
  const runBytes = fs.readFileSync(path.join(directory, "run.json")),
    run = validateRun(directory, runBytes, cohort, manifestSha256, clips, reference),
    files = [{ path: "run.json", type: "file", bytes: runBytes.length, sha256: hash(runBytes) }];
  for (const row of run.results) {
    validateCase(directory, row);
    const folder = `${row.id}-${row.profile}`;
    files.push({ path: folder, type: "directory" });
    files.push(
      ...inventory(path.join(directory, folder)).map((entry) => ({
        ...entry,
        path: `${folder}/${entry.path}`,
      })),
    );
  }
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { directory, run, runBytes, runSha256: hash(runBytes), files };
}

function assertSourceUnchanged(snapshot, cohort, manifestSha256, clips, reference) {
  const current = validateRun(
    snapshot.directory,
    fs.readFileSync(path.join(snapshot.directory, "run.json")),
    cohort,
    manifestSha256,
    clips,
    reference,
  );
  if (current.provenanceSha256 !== snapshot.run.provenanceSha256)
    throw new Error(`Source provenance changed during the join: ${snapshot.directory}.`);
  const rows = new Map(current.results.map((row) => [rowKey(row), row]));
  for (const row of snapshot.run.results) {
    const folder = `${row.id}-${row.profile}`;
    if (
      !rows.has(rowKey(row)) ||
      fingerprint(rows.get(rowKey(row))) !== fingerprint(row) ||
      fingerprint(inventory(path.join(snapshot.directory, folder))) !==
        fingerprint(caseInventory(snapshot.files, folder))
    )
      throw new Error(`Captured row or case changed during the join: ${rowKey(row)}.`);
    validateCase(snapshot.directory, row);
  }
}

export function joinRuns({ manifest, output, inputs, reference = null }) {
  if (!Array.isArray(inputs) || inputs.length < 2)
    throw new Error("Provide at least two source run directories.");
  const destination = prospectivePath(output),
    sources = inputs.map((input) => fs.realpathSync(input)),
    referenceDirectory = reference ? fs.realpathSync(reference) : null,
    allInputs = [...sources, ...(referenceDirectory ? [referenceDirectory] : [])];
  if (fs.existsSync(destination))
    throw new Error("Join destination must be fresh and nonexistent.");
  if (inProductCheckout(destination))
    throw new Error("Keep joined media outside product checkouts.");
  for (const [index, source] of allInputs.entries()) {
    if (inside(destination, source) || inside(source, destination))
      throw new Error("Source and destination directories must not overlap.");
    if (allInputs.slice(0, index).some((other) => inside(source, other) || inside(other, source)))
      throw new Error("Source directories must be distinct and must not overlap.");
  }
  const manifestBytes = fs.readFileSync(manifest),
    manifestSha256 = hash(manifestBytes),
    parsed = JSON.parse(manifestBytes),
    clips = Array.isArray(parsed) ? parsed : parsed.clips;
  if (
    !Array.isArray(clips) ||
    clips.some(({ id }) => typeof id !== "string" || !/^[a-z0-9][a-z0-9_-]*$/i.test(id))
  )
    throw new Error("Invalid manifest input IDs.");
  const cohort = benchmarkCohort(clips),
    baseline = referenceDirectory
      ? sourceSnapshot(referenceDirectory, cohort, manifestSha256, clips)
      : null,
    snapshots = sources.map((directory) =>
      sourceSnapshot(directory, cohort, manifestSha256, clips, baseline),
    );
  const base = snapshots[0].run,
    rows = new Map();
  for (const snapshot of snapshots) {
    if (
      snapshot.run.provenanceSha256 !== base.provenanceSha256 ||
      fingerprint(snapshot.run.provenance) !== fingerprint(base.provenance) ||
      snapshot.run.renderer !== base.renderer
    )
      throw new Error("Source/protocol/browser/options provenance differs between input runs.");
    for (const row of snapshot.run.results) {
      const key = rowKey(row),
        folder = `${row.id}-${row.profile}`,
        files = caseInventory(snapshot.files, folder),
        previous = rows.get(key);
      if (
        previous &&
        (fingerprint(previous.row) !== fingerprint(row) ||
          fingerprint(previous.files) !== fingerprint(files))
      )
        throw new Error(`Conflicting duplicate result or artifact bytes: ${key}.`);
      if (!previous) rows.set(key, { row, folder, files, snapshot });
    }
  }
  if (!rows.size) throw new Error("There are no recorded cases to join.");
  const expected = cohort.inputs.flatMap(({ id }) =>
      cohort.profiles.map((profile) => `${id}/${profile}`),
    ),
    results = expected.filter((key) => rows.has(key)).map((key) => rows.get(key).row),
    coverage = {
      expectedRows: expected.length,
      recordedRows: results.length,
      pending: expected.filter((key) => !rows.has(key)),
      unaccounted: results.filter((row) => !accountedOutcome(row)).map(rowKey),
    };
  coverage.allOutcomesAccounted = !coverage.pending.length && !coverage.unaccounted.length;
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  const sourceBytes = [...snapshots, ...(baseline ? [baseline] : [])].reduce(
    (total, snapshot) =>
      total + snapshot.files.reduce((bytes, file) => bytes + (file.bytes || 0), 0),
    0,
  );
  const space = fs.statfsSync(parent);
  if (space.bavail * space.bsize < sourceBytes * 2 + 1024 * 1024)
    throw new Error(
      "Insufficient free disk space to preserve the input snapshots and joined cases.",
    );
  const staging = fs.mkdtempSync(path.join(parent, `.${path.basename(destination)}-joining-`));
  const copy = (from, to) =>
    fs.cpSync(from, to, {
      recursive: true,
      force: false,
      errorOnExist: true,
      mode: fs.constants.COPYFILE_FICLONE,
    });
  try {
    if (baseline) {
      const target = path.join(staging, "join-reference");
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "run.json"), baseline.runBytes, { flag: "wx" });
      for (const row of baseline.run.results) {
        const folder = `${row.id}-${row.profile}`;
        copy(path.join(baseline.directory, folder), path.join(target, folder));
      }
      if (fingerprint(inventory(target)) !== fingerprint(baseline.files))
        throw new Error("Copied baseline reference inventory differs.");
      for (const row of baseline.run.results) validateCase(target, row);
    }
    for (const [index, snapshot] of snapshots.entries()) {
      snapshot.copy = `join-inputs/${String(index + 1).padStart(3, "0")}`;
      const target = path.join(staging, snapshot.copy);
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "run.json"), snapshot.runBytes, { flag: "wx" });
      for (const row of snapshot.run.results) {
        const folder = `${row.id}-${row.profile}`;
        copy(path.join(snapshot.directory, folder), path.join(target, folder));
      }
      if (fingerprint(inventory(target)) !== fingerprint(snapshot.files))
        throw new Error(`Copied source inventory differs: ${snapshot.directory}.`);
      for (const row of snapshot.run.results) validateCase(target, row);
    }
    for (const item of rows.values()) {
      copy(path.join(staging, item.snapshot.copy, item.folder), path.join(staging, item.folder));
      if (fingerprint(inventory(path.join(staging, item.folder))) !== fingerprint(item.files))
        throw new Error(`Copied case inventory differs: ${rowKey(item.row)}.`);
      validateCase(staging, item.row);
    }
    const run = {
      ...base,
      created: new Date().toISOString(),
      selection: { ids: cohort.inputs.map(({ id }) => id), profiles: cohort.profiles },
      results,
      join: { receipt: "join.json", coverage },
    };
    const runBytes = Buffer.from(JSON.stringify(run, null, 2) + "\n");
    fs.writeFileSync(path.join(staging, "run.json"), runBytes, { flag: "wx" });
    fs.writeFileSync(path.join(staging, "manifest.json"), manifestBytes, { flag: "wx" });
    const receipt = {
      version: baseline ? 2 : 1,
      created: run.created,
      toolSha256: hash(fs.readFileSync(import.meta.filename)),
      manifestSha256,
      manifestSnapshot: "manifest.json",
      provenanceSha256: base.provenanceSha256,
      runSha256: hash(runBytes),
      coverage,
      ...(baseline
        ? {
            reference: {
              directory: baseline.directory,
              snapshot: "join-reference",
              runSha256: baseline.runSha256,
              provenanceSha256: baseline.run.provenanceSha256,
              inventory: baseline.files,
            },
          }
        : {}),
      sources: snapshots.map((snapshot) => ({
        directory: snapshot.directory,
        snapshot: snapshot.copy,
        runSha256: snapshot.runSha256,
        inventory: snapshot.files,
      })),
      rows: results.map((row) => ({
        key: rowKey(row),
        fingerprint: fingerprint(row),
        artifactInventory: rows.get(rowKey(row)).files,
      })),
      note: "Captured run.json bytes and their listed case directories only; unlisted/in-progress cases and unrelated archived attempts are excluded. Later row appends are allowed. Partial or failed outcomes remain visible; no acceptance or isolated timing claim is inferred.",
    };
    fs.writeFileSync(path.join(staging, "join.json"), JSON.stringify(receipt, null, 2) + "\n", {
      flag: "wx",
    });
    // Permit appends without changing this captured selection. Every captured row and artifact
    // must remain immutable, including files outside the benchmark's scored/hash-bound subset.
    for (const snapshot of snapshots)
      assertSourceUnchanged(snapshot, cohort, manifestSha256, clips, baseline);
    if (baseline) assertSourceUnchanged(baseline, cohort, manifestSha256, clips);
    if (hash(fs.readFileSync(manifest)) !== manifestSha256)
      throw new Error("Manifest changed during the join.");
    if (fs.existsSync(destination)) throw new Error("Join destination appeared during copying.");
    fs.renameSync(staging, destination);
    return { output: destination, run, receipt };
  } catch (error) {
    // Preserve an interrupted copy as explicitly incomplete evidence, never as the requested run.
    fs.writeFileSync(
      path.join(staging, "join-failure.json"),
      JSON.stringify(
        { error: String(error.stack || error), intendedOutput: destination },
        null,
        2,
      ) + "\n",
    );
    throw new Error(`Join rejected; incomplete copy retained at ${staging}: ${error.message}`, {
      cause: error,
    });
  }
}

export function main(argv = process.argv.slice(2)) {
  const options = argv.filter((argument) => argument.startsWith("--")),
    reference = options.find((argument) => argument.startsWith("--reference="))?.slice(12),
    [manifest, output, ...inputs] = argv.filter((argument) => !argument.startsWith("--"));
  if (!manifest || !output || inputs.length < 2 || options.length > (reference ? 1 : 0))
    throw new Error(
      "Usage: node tools/v3d-bench-join.mjs <manifest.json> <fresh-output> <run-directory> <run-directory> [...] [--reference=<baseline>]",
    );
  const joined = joinRuns({ manifest, output, inputs, reference });
  console.log(JSON.stringify({ output: joined.output, ...joined.receipt.coverage }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main();
