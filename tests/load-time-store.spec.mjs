import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAuditStore } from "../tools/load-time-store.mjs";

const row = (id, device = "phone", sample = 0, bytes = 1) => ({ id, device, sample, bytes });
let directory;
test.beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "load-time-store-"));
});
test.afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

test("completed journal observations resume and replace the same sample", () => {
  const file = path.join(directory, "after.json");
  fs.writeFileSync(file, JSON.stringify([row("original")]));
  const store = createAuditStore(file);
  store.put(row("new", "phone", 0, 2));
  store.put(row("new", "phone", 0, 3));
  expect(JSON.parse(fs.readFileSync(file))).toEqual([row("original")]);
  expect(createAuditStore(file).rows).toEqual([row("original"), row("new", "phone", 0, 3)]);
});

test("checkpoint and final output retain distinct settings and samples", () => {
  const file = path.join(directory, "after.json");
  const store = createAuditStore(file, { checkpointEvery: 2 });
  const observations = [row("toy"), row("toy", "phone", 1), row("toy", "desktop")];
  for (const r of observations) store.put(r);
  expect(JSON.parse(fs.readFileSync(file))).toEqual(observations.slice(0, 2));
  expect(createAuditStore(file).rows).toEqual(observations);
  store.finish();
  expect(JSON.parse(fs.readFileSync(file))).toEqual(observations);
  expect(fs.existsSync(`${file}.pending.jsonl`)).toBe(false);
  expect(fs.existsSync(`${file}.tmp`)).toBe(false);
});

test("only an incomplete final journal record may be discarded", () => {
  const file = path.join(directory, "after.json");
  const pending = `${file}.pending.jsonl`;
  fs.writeFileSync(pending, `${JSON.stringify(row("saved"))}\n{"id":"unfinished`);
  const warnings = [];
  const store = createAuditStore(file, { onIncompleteRecord: (message) => warnings.push(message) });
  expect(store.rows).toEqual([row("saved")]);
  expect(warnings).toHaveLength(1);
  store.put(row("later"));
  store.finish();
  expect(createAuditStore(file).rows).toEqual([row("saved"), row("later")]);
  fs.writeFileSync(pending, "{broken}\n");
  expect(() => createAuditStore(file)).toThrow();
});
