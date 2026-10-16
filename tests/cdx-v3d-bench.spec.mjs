import { test, expect } from "@playwright/test";

test("benchmark cannot earn a quality gain by dropping failed or changed inputs", async () => {
  const { compareRuns, benchmarkCohort } = await import("../tools/v3d-bench-metrics.mjs");
  const row = (id, values = {}) => ({
    id,
    profile: "phone",
    sha256: "a".repeat(64),
    status: "finished",
    firstViewMs: 100,
    bakeMs: 200,
    mean: { ssim: 0.4, laplacian: 0.01 },
    ...values,
  });
  const main = [row("a"), row("b")];
  const candidate = main.map((r) => row(r.id, { mean: { ssim: 0.44, laplacian: 0.016 } }));
  const compare = (a, b) => compareRuns(a, b, { cohort: benchmarkCohort(main, ["phone"]) });
  expect(compare(main, candidate).profiles.phone.quality).toBe(true);
  expect(compare(main, candidate.slice(1)).profiles.phone.quality).toBe(false);
  expect(
    compare(main, [candidate[0], row("b", { status: "failed", mean: null })]).profiles.phone
      .quality,
  ).toBe(false);
  expect(() => compare(main, [candidate[0], row("b", { sha256: "b".repeat(64) })])).toThrow(
    /input/i,
  );
});

test("benchmark checks phone median and worst timing separately", async () => {
  const { compareRuns, benchmarkCohort } = await import("../tools/v3d-bench-metrics.mjs");
  const rows = (times) =>
    times.map((time, i) => ({
      id: String(i),
      profile: "phone",
      sha256: "a".repeat(64),
      status: "finished",
      firstViewMs: time,
      bakeMs: time * 2,
      mean: { ssim: 0.5, laplacian: 0.01 },
    }));
  const compare = (a, b) =>
    compareRuns(a, b, { cohort: benchmarkCohort(rows([10, 20, 30]), ["phone"]) });
  expect(compare(rows([10, 20, 30]), rows([9, 19, 31])).profiles.phone.noSlower).toBe(false);
  expect(compare(rows([10, 20, 30]), rows([9, 21, 29])).profiles.phone.noSlower).toBe(false);
  expect(compare(rows([10, 20, 30]), rows([9, 19, 29])).profiles.phone.noSlower).toBe(true);
});

const inputHash = "a".repeat(64);
const fixtureRow = (id = "a", profile = "phone", overrides = {}) => ({
  id,
  profile,
  sha256: inputHash,
  status: "finished",
  firstViewMs: 100,
  bakeMs: 200,
  mean: { ssim: 0.4, laplacian: 0.01 },
  consoleErrors: [],
  evaluationSha256: "e".repeat(64),
  heldoutEvidence: { complete: true },
  frames: [{ time: 1, referenceSha256: "f".repeat(64) }],
  ...overrides,
});
const baseProvenance = () => ({
  protocolSha256: "protocol",
  servedSource: { sha256: "source" },
  environment: { browserVersion: "151" },
  options: { timeout: 1000 },
  manifestSha256: "manifest",
  reference: null,
});
const explained = {
  status: "explained",
  reason: "Too little camera translation. Try walking sideways.",
  mean: null,
  explanation: {
    visible: true,
    diagnostic: "Too little camera translation.",
    advice: "Try walking sideways.",
  },
};

test("undeclared, partial, missing-profile, and empty comparisons cannot pass", async () => {
  const { compareRuns, benchmarkCohort } = await import("../tools/v3d-bench-metrics.mjs");
  const before = [fixtureRow(), fixtureRow("a", "desktop")];
  const after = before.map((r) => ({ ...r, mean: { ssim: 0.45, laplacian: 0.02 } }));
  const cohort = benchmarkCohort(before.slice(0, 1));
  expect(compareRuns(before, after).complete).toBe(false);
  for (const [a, b] of [
    [[], []],
    [before.slice(0, 1), after.slice(0, 1)],
    [before, after.slice(0, 1)],
  ]) {
    const result = compareRuns(a, b, { cohort });
    expect(result.complete).toBe(false);
    expect(result.profiles.phone.quality).toBe(false);
    expect(result.profiles.phone.noSlower).toBe(false);
    expect(result.neverFails).toBe(false);
  }
});

test("a failure on an unscored clip blocks all cohort passes", async () => {
  const { compareRuns, benchmarkCohort } = await import("../tools/v3d-bench-metrics.mjs");
  const main = [fixtureRow(), fixtureRow("dark", "phone", explained)];
  const cohort = benchmarkCohort(main, ["phone"]);
  for (const status of ["timeout", "harness-error", "unexplained", "failed"]) {
    const candidate = [
      { ...main[0], mean: { ssim: 0.45, laplacian: 0.02 } },
      fixtureRow("dark", "phone", { status, mean: null }),
    ];
    const result = compareRuns(main, candidate, { cohort });
    expect(result.complete).toBe(false);
    expect(result.profiles.phone.quality).toBe(false);
    expect(result.profiles.phone.noSlower).toBe(false);
  }
  expect(
    compareRuns(
      main,
      [main[0], fixtureRow("dark", "phone", { status: "explained", reason: "Error" })],
      { cohort },
    ).complete,
  ).toBe(false);
});

test("duplicate baseline rows and changed baseline inputs are rejected", async () => {
  const { compareRuns, benchmarkCohort } = await import("../tools/v3d-bench-metrics.mjs");
  const r = fixtureRow(),
    cohort = benchmarkCohort([r], ["phone"]);
  expect(() => compareRuns([r, r], [r], { cohort })).toThrow(/duplicate/i);
  expect(() => compareRuns([{ ...r, sha256: "b".repeat(64) }], [r], { cohort })).toThrow(/input/i);
});

test("full run comparison binds protocol, browser, options, and exact reference inventory", async () => {
  const { compareRuns, benchmarkCohort, fingerprint } =
    await import("../tools/v3d-bench-metrics.mjs");
  const rows = [fixtureRow(), fixtureRow("a", "desktop")],
    cohort = benchmarkCohort(rows.slice(0, 1));
  const make = (rows, provenance) => {
    const provenanceSha256 = fingerprint(provenance);
    return {
      cohort,
      provenance,
      provenanceSha256,
      results: rows.map((r) => ({ ...r, provenanceSha256 })),
    };
  };
  const main = make(rows, baseProvenance());
  const provenance = {
    ...baseProvenance(),
    servedSource: { sha256: "candidate" },
    reference: { provenanceSha256: main.provenanceSha256 },
  };
  const candidateRows = rows.map((r, i) => ({
    ...r,
    mean: { ssim: 0.45, laplacian: 0.02 },
    referenceEvidence: {
      provenanceSha256: main.provenanceSha256,
      resultFingerprint: fingerprint(main.results[i]),
      evaluationSha256: main.results[i].evaluationSha256,
    },
  }));
  expect(compareRuns(main, make(candidateRows, provenance)).profiles.phone.quality).toBe(true);
  for (const change of [
    { protocolSha256: "different" },
    { environment: { browserVersion: "different" } },
    { options: { timeout: 2000 } },
    { reference: null },
  ])
    expect(compareRuns(main, make(candidateRows, { ...provenance, ...change })).complete).toBe(
      false,
    );
  const unverified = candidateRows.map((r) => ({ ...r, heldoutEvidence: { complete: false } }));
  const incompleteEvidence = compareRuns(main, make(unverified, provenance));
  expect(incompleteEvidence.complete).toBe(true);
  expect(incompleteEvidence.profiles.phone.noSlower).toBe(true);
  expect(incompleteEvidence.profiles.phone.qualityEvidenceComplete).toBe(false);
  expect(incompleteEvidence.profiles.phone.quality).toBe(false);
  const changedMain = {
    ...main,
    results: main.results.map((r, i) => (i ? r : { ...r, bakeMs: 201 })),
  };
  expect(compareRuns(changedMain, make(candidateRows, provenance)).provenanceCompatible).toBe(
    false,
  );
  const changedFrames = candidateRows.map((r) => ({
    ...r,
    frames: [{ time: 2, referenceSha256: "f".repeat(64) }],
  }));
  expect(compareRuns(main, make(changedFrames, provenance)).profiles.phone.quality).toBe(false);
  const changedHashes = candidateRows.map((r) => ({
    ...r,
    frames: [{ time: 1, referenceSha256: "e".repeat(64) }],
  }));
  expect(compareRuns(main, make(changedHashes, provenance)).profiles.phone.quality).toBe(false);
});

test("resume refuses stale or missing provenance and preserves legacy evidence for explicit retry", async () => {
  const { resumeDecision, benchmarkCohort, fingerprint } =
    await import("../tools/v3d-bench-metrics.mjs");
  const r = fixtureRow(),
    cohort = benchmarkCohort([r]),
    provenance = baseProvenance();
  const previous = {
    cohort,
    provenance,
    provenanceSha256: fingerprint(provenance),
    results: [{ ...r, provenanceSha256: fingerprint(provenance) }],
  };
  expect(resumeDecision(previous, provenance, cohort).results).toHaveLength(1);
  for (const change of [
    { protocolSha256: "new" },
    { servedSource: { sha256: "new" } },
    { environment: { browserVersion: "new" } },
    { options: { timeout: 2000 } },
    { manifestSha256: "new" },
    { reference: { path: "new" } },
  ])
    expect(() => resumeDecision(previous, { ...provenance, ...change }, cohort)).toThrow(
      /provenance/i,
    );
  const legacy = { results: [] },
    original = structuredClone(legacy);
  expect(() => resumeDecision(legacy, provenance, cohort)).toThrow(/retry=all/);
  expect(resumeDecision(legacy, provenance, cohort, "all").archiveAll).toBe(true);
  expect(legacy).toEqual(original);
  expect(() =>
    resumeDecision(
      { ...previous, results: [{ ...previous.results[0], sha256: "b".repeat(64) }] },
      provenance,
      cohort,
    ),
  ).toThrow(/input/i);
});

test("retry of harness errors is explicit and does not discard finished rows", async () => {
  const { resumeDecision, benchmarkCohort, fingerprint } =
    await import("../tools/v3d-bench-metrics.mjs");
  const a = fixtureRow(),
    b = fixtureRow("b", "phone", { status: "harness-error" }),
    provenance = baseProvenance();
  const cohort = benchmarkCohort([a, b]);
  const previous = {
    cohort,
    provenance,
    provenanceSha256: fingerprint(provenance),
    results: [a, b].map((r) => ({ ...r, provenanceSha256: fingerprint(provenance) })),
  };
  expect(() => resumeDecision(previous, provenance, cohort)).toThrow(/retry=incomplete/);
  const next = resumeDecision(previous, provenance, cohort, "harness-error");
  expect(next.results.map((r) => r.id)).toEqual(["a"]);
  expect(next.retryKeys).toEqual(["b/phone"]);
  expect(previous.results).toHaveLength(2);
  expect(resumeDecision({ ...previous, results: [] }, provenance, cohort).results).toEqual([]);
});

test("held-out timestamps cannot reuse a selected source frame", async () => {
  const { assertHeldoutTimes } = await import("../tools/v3d-bench-metrics.mjs");
  expect(() => assertHeldoutTimes([0.5], [0, 1], 24)).not.toThrow();
  expect(() => assertHeldoutTimes([0.5], [0, 0.5, 1], 24)).toThrow(/overlaps/);
  expect(() => assertHeldoutTimes([0.501], [0.5], 24)).toThrow(/overlaps/);
  expect(() => assertHeldoutTimes([], [0, 1], 24)).toThrow(/evidence/);
  expect(() => assertHeldoutTimes([0.5], [], 24)).toThrow(/evidence/);
});

function sampleRecords() {
  return ["liberty", "edinburgh", "adjara", "lihula", "toolse", "poltsamaa"].flatMap((id) =>
    ["phone", "desktop"].map((profile) => ({
      id,
      profile,
      cams: [{ time: 0 }, { time: 1 }],
      heldOut: [1],
      tier: { role: profile, splats: profile === "phone" ? 10 : 20 },
      info: { uid: id, splats: 5, stats: { exportedSplats: profile === "phone" ? 10 : 20 } },
      frames: [{ index: 1, time: 1, sha256: inputHash }],
      errors: [],
    })),
  );
}

test("sample preservation requires all six IDs, both profiles, and nonempty frozen views", async () => {
  const { assertSampleInventory, assertSampleCase } =
    await import("../tools/v3d-bench-samples.mjs");
  const records = sampleRecords();
  expect(assertSampleInventory(records).size).toBe(12);
  expect(() => assertSampleInventory([])).toThrow(/six/);
  expect(() => assertSampleInventory(records.slice(1))).toThrow(/six/);
  expect(() => assertSampleInventory([...records.slice(1), records[1]])).toThrow(/six/);
  expect(() => assertSampleCase({ ...records[0], heldOut: [] }, records[0])).toThrow(/inventory/);
  expect(() =>
    assertSampleCase({ ...records[0], cams: [{ time: 0 }, { time: 2 }] }, records[0]),
  ).toThrow(/times/);
  expect(() => assertSampleCase({ ...records[0], heldOut: [0] }, records[0])).toThrow(/inventory/);
  expect(() =>
    assertSampleCase({
      ...records[0],
      info: { ...records[0].info, stats: { exportedSplats: 20 } },
    }),
  ).toThrow(/tier/);
  expect(() =>
    assertSampleInventory(records.map((r, i) => (i ? r : { ...r, frames: [] }))),
  ).toThrow(/frame evidence/);
});

test("uniform blank sample images cannot certify preservation", async () => {
  const { identicalPixels } = await import("../tools/v3d-bench-samples.mjs");
  const image = { width: 2, height: 1, data: Buffer.from([0, 0, 0, 255, 200, 100, 0, 255]) };
  expect(identicalPixels(image, image)).toBe(true);
  const blank = { ...image, data: Buffer.alloc(8) };
  expect(identicalPixels(blank, blank)).toBe(false);
  expect(identicalPixels(image, blank)).toBe(false);
});

test("served-source fingerprint records absent main modules and detects changed server bytes", async () => {
  const { createServer } = await import("node:http");
  const { servedSourceFingerprint } = await import("../tools/v3d-bench.mjs");
  let body = "export const revision = 1;";
  const server = createServer((request, response) => {
    response.statusCode = request.url === "/src/new-candidate-only.js" ? 404 : 200;
    response.end(response.statusCode === 404 ? "missing" : body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`,
      paths = ["src/run.js", "src/new-candidate-only.js"];
    const a = await servedSourceFingerprint(url, paths);
    expect(a.files.find((r) => r.status === 404)?.sha256).toBeNull();
    body = "export const revision = 2;";
    const b = await servedSourceFingerprint(url, paths);
    expect(b.sha256).not.toBe(a.sha256);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("host watchdog bounds stuck protocol work and teardown without censoring successful work", async () => {
  const { withHostDeadline, closeBrowserBounded } = await import("../tools/v3d-bench.mjs");
  let emergency = 0;
  const never = () => new Promise(() => {});
  const started = performance.now();
  await expect(
    withHostDeadline(never, { timeoutMs: 25, onTimeout: () => emergency++ }),
  ).rejects.toMatchObject({ code: "V3D_HOST_TIMEOUT" });
  expect(emergency).toBe(1);
  expect(performance.now() - started).toBeLessThan(1000);
  expect(await withHostDeadline(() => 42, { timeoutMs: 25, onTimeout: () => emergency++ })).toBe(
    42,
  );
  expect(emergency).toBe(1);
  const signals = [];
  await closeBrowserBounded(
    { close: never },
    {
      close: never,
      process: () => ({ exitCode: null, signalCode: null, kill: (s) => signals.push(s) }),
    },
    10,
  );
  expect(signals).toEqual(["SIGKILL"]);
});

test("reference binding accepts appended rows and rejects changed, removed, or damaged evidence", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { referenceEvidence, assertReferenceEvidence } = await import("../tools/v3d-bench.mjs");
  const { benchmarkCohort, fingerprint } = await import("../tools/v3d-bench-metrics.mjs");
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-reference-"));
  const folder = path.join(root, "a-phone");
  fs.mkdirSync(folder);
  const artifacts = {
    "model.ply": Buffer.from("real model bytes fixture"),
    "evaluation.json": Buffer.from(
      JSON.stringify({
        sha256: inputHash,
        times: [1],
        width: 64,
        height: 32,
        crop: { sw: 64, sx: 0 },
      }),
    ),
    "render-0.png": Buffer.from("render fixture"),
    "reference-0.png": Buffer.from("source pixels fixture"),
  };
  for (const [name, bytes] of Object.entries(artifacts))
    fs.writeFileSync(path.join(folder, name), bytes);
  const provenance = baseProvenance(),
    provenanceSha256 = fingerprint(provenance);
  const row = fixtureRow("a", "phone", {
    provenanceSha256,
    modelSha256: hash(artifacts["model.ply"]),
    evaluationSha256: hash(artifacts["evaluation.json"]),
    frames: [
      {
        time: 1,
        renderSha256: hash(artifacts["render-0.png"]),
        referenceSha256: hash(artifacts["reference-0.png"]),
      },
    ],
  });
  const main = {
    provenance,
    provenanceSha256,
    cohort: benchmarkCohort([row, fixtureRow("b")]),
    results: [row],
  };
  try {
    const candidate = {
      id: "a",
      profile: "phone",
      referenceEvidence: referenceEvidence(root, main, "a", "phone"),
    };
    const appended = {
      ...main,
      results: [...main.results, fixtureRow("b", "phone", { ...explained, provenanceSha256 })],
    };
    expect(() =>
      assertReferenceEvidence(root, appended, candidate, provenanceSha256),
    ).not.toThrow();
    const changed = { ...main, results: [{ ...row, bakeMs: 201 }] };
    expect(() => assertReferenceEvidence(root, changed, candidate, provenanceSha256)).toThrow(
      /changed/i,
    );
    expect(() =>
      assertReferenceEvidence(root, { ...main, results: [] }, candidate, provenanceSha256),
    ).toThrow(/missing/i);
    expect(() =>
      assertReferenceEvidence(root, { ...main, results: [row, row] }, candidate, provenanceSha256),
    ).toThrow(/duplicate/i);
    for (const [name, bytes] of Object.entries(artifacts)) {
      fs.writeFileSync(path.join(folder, name), Buffer.from("altered"));
      expect(() => assertReferenceEvidence(root, main, candidate, provenanceSha256)).toThrow();
      fs.writeFileSync(path.join(folder, name), bytes);
      fs.unlinkSync(path.join(folder, name));
      expect(() => assertReferenceEvidence(root, main, candidate, provenanceSha256)).toThrow();
      fs.writeFileSync(path.join(folder, name), bytes);
    }
    expect(() => assertReferenceEvidence(root, main, candidate, "changed-root")).toThrow(
      /provenance/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("frame observer hashes actual selected JPEGs and distinguishes requested from presented times", async () => {
  const { FRAME_REPLACEMENT } = await import("../tools/v3d-bench.mjs");
  const { createHash } = await import("node:crypto");
  const { windowTimes } = await import("../src/video3d/frames.js");
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const runObserver = new AsyncFunction(
    "out",
    "globalThis",
    "plan",
    "tries",
    "windowTimes",
    FRAME_REPLACEMENT,
  );
  const observe = (out, scope) =>
    runObserver(out, scope, { windows: [{ t: 0.5, from: 0, to: 1 }] }, 3, windowTimes);
  const mainFrames = [
    { time: 0.5, width: 480, height: 270, blob: new Blob(["selected JPEG fixture"]) },
  ];
  const scope = { __v3dBench: {} };
  expect(await observe(mainFrames, scope)).toBe(mainFrames);
  expect(scope.__v3dBench.timestampEvidence).toBe("requested-time-only");
  expect(scope.__v3dBench.attemptedTimes).toEqual([0.167, 0.5, 0.833]);
  expect(scope.__v3dBench.trainingFrames[0]).toEqual({
    time: 0.5,
    width: 480,
    height: 270,
    requestedTime: 0.5,
    presentedTime: null,
    timestampEvidence: "requested-time-only",
    sha256: createHash("sha256").update("selected JPEG fixture").digest("hex"),
  });
  await observe([{ ...mainFrames[0], time: 0.52, requestedTime: 0.5, presentedTime: 0.52 }], scope);
  expect(scope.__v3dBench.timestampEvidence).toBe("presented-media-time");
  expect(scope.__v3dBench.trainingTimes).toEqual([0.52]);
  expect(scope.__v3dBench.trainingFrames[0].requestedTime).toBe(0.5);
});

test("held-out pixel receipts reject stale-frame overlap and missing decoder calibration", async () => {
  const { assertPixelDisjointness } = await import("../tools/v3d-bench-pixels.mjs");
  const training = [{ sha256: "a".repeat(64) }];
  const receipt = {
    matchedTraining: [
      {
        sha256: training[0].sha256,
        repeatedSha256: training[0].sha256,
        sourceIndex: 0,
        sourceTime: 0,
      },
    ],
    views: [{ time: 1, mediaTime: 1, sha256: "b".repeat(64), repeatedSha256: "b".repeat(64) }],
  };
  expect(assertPixelDisjointness(training, receipt, [1])).toBe(true);
  expect(() => assertPixelDisjointness(training, { ...receipt, matchedTraining: [] }, [1])).toThrow(
    /receipts/,
  );
  expect(() =>
    assertPixelDisjointness(
      training,
      {
        ...receipt,
        views: [
          { ...receipt.views[0], sha256: training[0].sha256, repeatedSha256: training[0].sha256 },
        ],
      },
      [1],
    ),
  ).toThrow(/also used for training/);
  expect(() =>
    assertPixelDisjointness(
      training,
      { ...receipt, views: [{ ...receipt.views[0], mediaTime: 0.95 }] },
      [1],
    ),
  ).toThrow(/not verified/);
});

test("the independent decoder matches selected JPEGs and detects an actually repeated frame", async ({
  page,
}) => {
  const fs = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const { sourceFrameReceipts, assertPixelDisjointness } =
    await import("../tools/v3d-bench-pixels.mjs");
  const file = new URL("./fixtures/v3d/tiny.webm", import.meta.url);
  const sourceTimes = JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=best_effort_timestamp_time",
      "-of",
      "json",
      file.pathname,
    ]),
  ).frames.map((f) => Number(f.best_effort_timestamp_time));
  const base64 = fs.readFileSync(file).toString("base64");
  await page.goto("/tests/fixtures/v3d/");
  const selected = await page.evaluate(async (base64) => {
    const { openVideo, grabFrames, closeVideo } = await import("/src/video3d/extract.js");
    const opened = await openVideo(
      new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], "tiny.webm"),
    );
    try {
      const picks = await grabFrames(
        opened,
        {
          windows: [
            { t: 0.333, from: 0.333, to: 0.333 },
            { t: 1.333, from: 1.333, to: 1.333 },
          ],
        },
        { side: 192, tries: 1 },
      );
      return Promise.all(
        picks.map(async (p) => ({
          ...p,
          blob: undefined,
          requestedTime: p.requestedTime,
          sha256: Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", await p.blob.arrayBuffer())),
            (b) => b.toString(16).padStart(2, "0"),
          ).join(""),
        })),
      );
    } finally {
      closeVideo(opened);
    }
  }, base64);
  const times = [sourceTimes[10], sourceTimes[25]];
  const proof = await page.evaluate(sourceFrameReceipts, {
    base64,
    sourceTimes,
    times,
    trainingFrames: selected,
    crop: { sx: 0, sw: 192 },
  });
  expect(assertPixelDisjointness(selected, proof, times)).toBe(true);
  expect(proof.matchedTraining).toHaveLength(2);
  for (const [index, frame] of proof.matchedTraining.entries()) {
    expect(Number.isFinite(selected[index].presentedTime)).toBe(true);
    expect(Math.abs(selected[index].presentedTime - frame.sourceTime)).toBeLessThan(0.0001);
  }
  // The independent JPEG match identifies the actual picture even if extraction's timestamp
  // was stale. Deliberately repeat that source frame, rather than trusting the requested time.
  const matched = proof.matchedTraining[0];
  expect(matched.sha256).toBe(selected[0].sha256);
  expect(matched.repeatedSha256).toBe(selected[0].sha256);
  expect(Number.isInteger(matched.sourceIndex)).toBe(true);
  expect(matched.sourceIndex).toBeGreaterThanOrEqual(0);
  expect(matched.sourceIndex).toBeLessThan(sourceTimes.length);
  const repeatedTime = sourceTimes[matched.sourceIndex];
  expect(Math.abs(repeatedTime - matched.sourceTime)).toBeLessThan(0.0001);
  const overlap = await page.evaluate(sourceFrameReceipts, {
    base64,
    sourceTimes,
    times: [repeatedTime],
    trainingFrames: selected,
    crop: { sx: 0, sw: 192 },
  });
  expect(overlap.views[0].sha256).toBe(selected[0].sha256);
  expect(() => assertPixelDisjointness(selected, overlap, [repeatedTime])).toThrow(
    /also used for training/,
  );
});
