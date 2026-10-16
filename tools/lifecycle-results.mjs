#!/usr/bin/env node
// Keep reviewable checkpoints in the audit; full probe observations stay in .cache/.
import fs from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export function summarizeResults(source) {
  const sites = [];
  const counterColumns = ["calls", "hiddenCalls", "mutations", "hiddenMutations", "created"];
  const site = (name) => {
    let index = sites.indexOf(name);
    if (index < 0) {
      index = sites.length;
      sites.push(name);
    }
    return index;
  };
  const visit = (value, path = []) => {
    if (Array.isArray(value)) return value.map((v) => visit(v, path));
    if (!value || typeof value !== "object") return value;
    if (/hidden/i.test(path.at(-1)) && value.before?.totals && value.after?.totals) {
      const deltas = Object.entries(value.after.totals).flatMap(([name, totals]) => {
        const row = counterColumns.map(
          (key) => totals[key] - (value.before.totals[name]?.[key] || 0),
        );
        return row.some(Boolean) ? [[site(name), ...row]] : [];
      });
      return {
        before: visit({ ...value.before, totals: {} }, path),
        after: visit({ ...value.after, totals: {} }, path),
        counterDeltas: deltas,
      };
    }
    if (value.intervals && value.timeouts && value.totals) {
      const relevant = (name) =>
        path.some((key) => /hidden/i.test(key)) ||
        ((path.includes("emptyRecording") || path.includes("recording")) &&
          name.includes("/exports.js")) ||
        (path.includes("stageRecording") && name.includes("/live/record.js")) ||
        (path.includes("retries") && /\/packs\/qr(?:-lab)?\.js/.test(name));
      const counts = (map) =>
        Object.fromEntries(Object.entries(map).map(([name, count]) => [site(name), count]));
      const counters = Object.entries(value.totals)
        .filter(([name]) => relevant(name))
        .map(([name, totals]) => [site(name), ...counterColumns.map((key) => totals[key])]);
      const extra = Object.entries(value).filter(
        ([key]) => !["intervals", "timeouts", "totals", "scrubPending", "scrubCalls"].includes(key),
      );
      return {
        ...(Object.keys(value.intervals).length ? { intervals: counts(value.intervals) } : {}),
        ...(Object.keys(value.timeouts).length ? { timeouts: counts(value.timeouts) } : {}),
        ...(counters.length ? { counters } : {}),
        ...(value.scrubPending || value.scrubCalls
          ? { scrub: [value.scrubPending, value.scrubCalls] }
          : {}),
        ...Object.fromEntries(extra.map(([key, v]) => [key, visit(v, [...path, key])])),
      };
    }
    if (Array.isArray(value.frames) && value.generator && value.values) {
      const first = value.frames.find((frame) => frame.visible.every(Boolean));
      const expected = value.values.map((input) => input.value);
      const correct = value.frames.find(
        (frame) =>
          first &&
          frame.t >= first.t &&
          frame.visible.every(Boolean) &&
          JSON.stringify(frame.values) === JSON.stringify(expected),
      );
      const checkpoint = (frame) => (frame ? { t: frame.t, values: frame.values } : null);
      return {
        ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== "frames")),
        firstVisible: checkpoint(first),
        firstCorrect: checkpoint(correct),
        incorrectValueWindowMs: correct ? correct.t - first.t : null,
      };
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, visit(v, [...path, key])]),
    );
  };
  const measurements = visit(source);
  return {
    schema: "lifecycle-checkpoints-v1",
    notes: [
      "The audit document is the source of truth. All runs and per-run checkpoints are retained.",
      "Timer maps use indexes into sites. Omitted timer maps and scrub counters are zero.",
      "Callback totals cover hidden samples and relevant recording/retry sites; unrelated cumulative totals are omitted.",
      "Hidden counterDeltas use counterColumns; omitted sites have zero activity during the sample.",
      "Raw slider-frame arrays are replaced by first-visible and first-correct checkpoints.",
    ],
    counterColumns: ["site", ...counterColumns],
    scrubColumns: ["pending", "calls"],
    sites,
    measurements,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2] || ".cache/lifecycle/full.json";
  const output = process.argv[3] || ".cache/lifecycle/summary.json";
  const source = JSON.parse(await fs.readFile(input, "utf8"));
  if (source.schema === "lifecycle-checkpoints-v1") throw new Error("Use the full probe output.");
  await fs.mkdir(dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(summarizeResults(source), null, 2) + "\n");
}
