// MIT; made by Ryan with Codex (GPT-6). Acceptance accounting only.
// The atlas's scoring, thresholds, and captures are not changed here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THRESHOLDS, POSES } from "./p3df/scoring.mjs";

export const TARGETS = ["halos", "streaks", "textureLoss"];
const average = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const finite = Number.isFinite;
const keyOf = (id, profile, metric) => JSON.stringify([id, profile, metric]);

export function rankClasses(atlas) {
  return Object.entries(THRESHOLDS)
    .map(([metric, threshold]) => {
      const supported = atlas.inputs.flatMap((input) =>
        Object.entries(input.profiles).flatMap(([profile, row]) =>
          finite(row.values[metric]) ? [{ id: input.id, profile, value: row.values[metric] }] : [],
        ),
      );
      const flagged = supported.filter((r) => r.value >= threshold);
      return {
        metric,
        threshold,
        supported: supported.length,
        count: flagged.length,
        mean: average(flagged.map((r) => r.value)),
        cost: flagged.reduce((s, r) => s + r.value / threshold, 0),
        inputs: flagged,
      };
    })
    .sort((a, b) => b.cost - a.cost);
}

function index(atlas) {
  const rows = new Map();
  for (const input of atlas.inputs) {
    if (rows.has(input.id)) throw new Error("Duplicate input: " + input.id);
    rows.set(input.id, input);
  }
  return rows;
}

export function repeatNoise(baseline, repeats) {
  const noise = {};
  for (const repeat of repeats) {
    if (baseline.source.sha256 !== repeat.source.sha256)
      throw new Error("Noise requires the identical source fingerprint.");
    if (JSON.stringify(baseline.settings) !== JSON.stringify(repeat.settings))
      throw new Error("Noise requires identical settings and input hashes.");
    const rows = index(repeat);
    for (const before of baseline.inputs) {
      const after = rows.get(before.id);
      if (!after) throw new Error("Missing repeat input: " + before.id);
      for (const [profile, a] of Object.entries(before.profiles)) {
        const b = after.profiles[profile];
        if (!b || a.renderer !== b.renderer || a.browser !== b.browser)
          throw new Error("Noise requires identical browser and renderer.");
        for (const metric of Object.keys(THRESHOLDS)) {
          const x = a.values[metric],
            y = b.values[metric];
          if (finite(x) !== finite(y)) throw new Error("Repeat support changed.");
          if (!finite(x)) continue;
          const k = keyOf(before.id, profile, metric);
          noise[k] = Math.max(noise[k] || 0, Math.abs(x - y));
        }
      }
    }
  }
  return { repetitions: repeats.length, tolerance: noise };
}

export function compareAtlases(baseline, candidate, { noise, expectedInputs = 118 } = {}) {
  const before = index(baseline),
    after = index(candidate),
    errors = [],
    regressions = [],
    observations = [];
  if (!baseline.complete || !candidate.complete) errors.push("An atlas is incomplete.");
  if (before.size !== expectedInputs || after.size !== expectedInputs)
    errors.push("The required input count is not complete.");
  if (JSON.stringify(baseline.settings) !== JSON.stringify(candidate.settings))
    errors.push("Input hashes, poses, profiles, or settings changed.");
  if (JSON.stringify(baseline.settings.poses) !== JSON.stringify(POSES))
    errors.push("The nine required poses are missing.");
  for (const [id, a] of before) {
    const b = after.get(id);
    if (!b) {
      errors.push("Missing input: " + id);
      continue;
    }
    for (const prop of ["sha256", "depthSha256", "truthSha256"])
      if (a[prop] !== b[prop]) errors.push("Changed " + prop + ": " + id);
    for (const profile of ["phone", "desktop"]) {
      const x = a.profiles[profile],
        y = b.profiles[profile];
      if (!x || !y) {
        errors.push("Missing profile: " + id + "/" + profile);
        continue;
      }
      if (x.renderer !== y.renderer || x.browser !== y.browser)
        errors.push("Browser or renderer changed: " + id + "/" + profile);
      if (JSON.stringify(x.native) !== JSON.stringify(y.native) || x.ratio !== y.ratio)
        errors.push("Native render size changed: " + id + "/" + profile);
      if (
        x.errors.length ||
        y.errors.length ||
        x.externalRequests.length ||
        y.externalRequests.length
      )
        errors.push("Browser errors or external requests: " + id + "/" + profile);
      if (x.rows.length !== 9 || y.rows.length !== 9)
        errors.push("Incomplete poses: " + id + "/" + profile);
      for (const p of x.rows) {
        const q = y.rows.find((r) => r.yaw === p.yaw && r.pitch === p.pitch);
        if (!q) {
          errors.push("Missing pose: " + JSON.stringify([id, profile, p.yaw, p.pitch]));
          continue;
        }
        for (const [group, count] of [
          ["halo", "anchoredProfiles"],
          ["fringe", "evaluated"],
        ])
          if (finite(p[group]?.[count]) && !(q[group]?.[count] >= p[group][count]))
            errors.push(
              "Lost probe support: " + JSON.stringify([id, profile, group, p.yaw, p.pitch]),
            );
      }
      for (const metric of Object.keys(THRESHOLDS)) {
        const oldValue = x.values[metric],
          newValue = y.values[metric],
          tolerance = noise?.tolerance[keyOf(id, profile, metric)] || 0;
        if (finite(oldValue) && !finite(newValue)) {
          errors.push("Lost metric support: " + JSON.stringify([id, profile, metric]));
          continue;
        }
        if (!finite(oldValue)) continue;
        const row = { id, profile, metric, before: oldValue, after: newValue, tolerance };
        observations.push(row);
        if (newValue - oldValue > tolerance) regressions.push(row);
      }
    }
  }
  const targets = TARGETS.map((metric) => {
    // Freeze membership from the baseline. A missing candidate is a failure,
    // never a smaller denominator that makes the class average look better.
    const members = observations.filter(
      (r) => r.metric === metric && r.before >= THRESHOLDS[metric],
    );
    const required = baseline.inputs.reduce(
      (sum, r) =>
        sum +
        Object.values(r.profiles).filter((p) => p.values[metric] >= THRESHOLDS[metric]).length,
      0,
    );
    const oldMean = average(members.map((r) => r.before)),
      newMean = average(members.map((r) => r.after)),
      reduction = oldMean > 0 ? 1 - newMean / oldMean : null;
    return {
      metric,
      required,
      measured: members.length,
      beforeMean: oldMean,
      afterMean: newMean,
      reduction,
      passed:
        members.length === required &&
        required > 0 &&
        reduction >= 0.25 &&
        !regressions.some((r) => r.metric === metric),
    };
  });
  return {
    qualityPassed: !errors.length && !regressions.length && targets.every((t) => t.passed),
    errors,
    regressions,
    targets,
    noiseRepetitions: noise?.repetitions || 0,
    observedNoiseMaximum: noise ? Math.max(0, ...Object.values(noise.tolerance)) : null,
    observations,
    unverified: [
      "Repeated isolated phone costs",
      "Checkpoint motion review",
      "Every existing spec",
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const name = process.argv[i];
    if (!["--baseline", "--candidate", "--repeat", "--out"].includes(name) || !process.argv[i + 1])
      throw new Error("Use --baseline FILE [--candidate FILE] [--repeat FILE,FILE] --out FILE");
    args[name.slice(2)] = process.argv[i + 1];
  }
  const read = (f) => JSON.parse(fs.readFileSync(f)),
    baseline = read(args.baseline),
    result = args.candidate
      ? compareAtlases(baseline, read(args.candidate), {
          noise: args.repeat ? repeatNoise(baseline, args.repeat.split(",").map(read)) : undefined,
        })
      : rankClasses(baseline);
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      args.candidate
        ? {
            qualityPassed: result.qualityPassed,
            errors: result.errors.length,
            regressions: result.regressions.length,
            targets: result.targets,
          }
        : result.map(({ inputs, ...r }) => r),
      null,
      2,
    ),
  );
  if (args.candidate && !result.qualityPassed) process.exitCode = 1;
}
