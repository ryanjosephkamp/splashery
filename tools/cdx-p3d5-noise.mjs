// MIT; made by Ryan with Codex (GPT-6). Measured repeat noise never grants
// tolerance to an input, profile, or metric that was not actually repeated.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qualityValues } from "./cdx-p3d5-compare.mjs";
import { POSES } from "./p3df/scoring.mjs";
import { hash } from "./p3df/inputs.mjs";

export function boundedNoise(baseline, repeats, { expectedInputs = 118 } = {}) {
  if (!baseline.complete || baseline.inputs.length !== expectedInputs)
    throw new Error("A complete baseline is required.");
  if (!repeats.length) throw new Error("Supply at least one actual repeat study.");
  if (baseline.private || repeats.some((r) => r.private))
    throw new Error("This tool records public-corpus repeat evidence only.");
  const originals = new Map(baseline.inputs.map((r) => [r.id, r]));
  if (originals.size !== baseline.inputs.length) throw new Error("Duplicate baseline input.");
  const settings = (atlas) => {
    const { inputHashes, ...rest } = atlas.settings;
    return JSON.stringify(rest);
  };
  const tolerance = {},
    counts = new Map(),
    maximumByMetric = {};
  let pairedObservations = 0;
  for (const repeat of repeats) {
    if (repeat.source.sha256 !== baseline.source.sha256)
      throw new Error("Noise requires the identical source fingerprint.");
    if (settings(repeat) !== settings(baseline))
      throw new Error("Noise requires identical poses, profiles, and view settings.");
    const ids = new Set();
    for (const row of repeat.inputs) {
      const before = originals.get(row.id);
      if (!before || ids.has(row.id)) throw new Error("Unknown or duplicate repeat input.");
      ids.add(row.id);
      for (const key of ["sha256", "depthSha256", "truthSha256"])
        if (row[key] !== before[key]) throw new Error("Repeat input bytes changed: " + row.id);
      const declared = repeat.settings.inputHashes.find((r) => r.id === row.id),
        originalDeclaration = baseline.settings.inputHashes.find((r) => r.id === row.id);
      if (!declared || JSON.stringify(declared) !== JSON.stringify(originalDeclaration))
        throw new Error("Declared repeat input hashes changed: " + row.id);
      for (const [profile, after] of Object.entries(row.profiles)) {
        const original = before.profiles[profile];
        if (
          !original ||
          original.renderer !== after.renderer ||
          original.browser !== after.browser ||
          JSON.stringify(original.native) !== JSON.stringify(after.native) ||
          original.ratio !== after.ratio
        )
          throw new Error("Repeat browser, renderer, or native resolution changed.");
        for (const p of [original, after])
          if (!p.sharp?.on || p.errors.length || p.externalRequests.length || p.rows.length !== 9)
            throw new Error("A repeat profile lacks a complete, clean Sharp capture.");
        for (const [yaw, pitch] of POSES) {
          const a = original.rows.find((r) => r.yaw === yaw && r.pitch === pitch),
            b = after.rows.find((r) => r.yaw === yaw && r.pitch === pitch);
          if (!a || !b) throw new Error("A repeat pose is missing.");
          for (const [kind, key] of [
            ["halo", "anchoredProfiles"],
            ["fringe", "evaluated"],
          ])
            if (Number.isFinite(a[kind]?.[key]) && !(b[kind]?.[key] >= a[kind][key]))
              throw new Error("A repeat lost source probe support.");
        }
        const a = qualityValues(original),
          b = qualityValues(after);
        if (
          b.badProjectionFits > a.badProjectionFits ||
          b.lostProjectedThinSupport > a.lostProjectedThinSupport
        )
          throw new Error("A repeat lost projection confidence.");
        for (const [metric, value] of Object.entries(a)) {
          if (Number.isFinite(value) !== Number.isFinite(b[metric]))
            throw new Error("Repeat metric support changed.");
          if (!Number.isFinite(value)) continue;
          const key = JSON.stringify([row.id, profile, metric]),
            difference = Math.abs(value - b[metric]);
          tolerance[key] = Math.max(tolerance[key] || 0, difference);
          maximumByMetric[metric] = Math.max(maximumByMetric[metric] || 0, difference);
        }
        const key = JSON.stringify([row.id, profile]);
        counts.set(key, (counts.get(key) || 0) + 1);
        pairedObservations++;
      }
    }
  }
  if (!counts.size) throw new Error("No complete paired repeat profiles were captured.");
  const coverage = [];
  for (const input of baseline.inputs)
    for (const profile of baseline.settings.profiles)
      coverage.push({
        id: input.id,
        profile,
        repeats: counts.get(JSON.stringify([input.id, profile])) || 0,
      });
  return {
    schema: 1,
    sourceSha256: baseline.source.sha256,
    policy:
      "Only actual paired observations grant tolerance; every unmeasured case has zero tolerance.",
    repetitions: Math.min(...counts.values()),
    repeatStudies: repeats.length,
    incompleteRepeatStudies: repeats.filter((r) => !r.complete).length,
    pairedObservations,
    coveredProfiles: counts.size,
    requiredProfiles: coverage.length,
    completeCorpus: coverage.every((r) => r.repeats > 0),
    maximumByMetric,
    tolerance,
    coverage,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    if (!["--baseline", "--repeat", "--out"].includes(process.argv[i]) || !process.argv[i + 1])
      throw new Error("Use --baseline ATLAS --repeat ATLAS,ATLAS --out FILE");
    args[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  if (!args.baseline || !args.repeat || !args.out)
    throw new Error("Baseline, actual repeat captures, and output file are required.");
  const bytes = [args.baseline, ...args.repeat.split(",")].map((file) => fs.readFileSync(file)),
    [baseline, ...repeats] = bytes.map((b) => JSON.parse(b)),
    result = {
      ...boundedNoise(baseline, repeats),
      atlasHashes: bytes.map(hash),
      methodSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    };
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      coveredProfiles: result.coveredProfiles,
      requiredProfiles: result.requiredProfiles,
      completeCorpus: result.completeCorpus,
      maximumByMetric: result.maximumByMetric,
    }),
  );
}
