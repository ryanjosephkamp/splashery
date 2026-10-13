import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("the task 51 audit stays below 3 MB and retains no raw runs", () => {
  const root = "docs/audits";
  const files = [];
  const walk = (entry) => {
    if (fs.statSync(entry).isDirectory())
      for (const child of fs.readdirSync(entry)) walk(path.join(entry, child));
    else files.push(entry);
  };
  for (const name of fs.readdirSync(root))
    if (name === "load-time-2026-10" || name === "load-time-2026-10.md")
      walk(path.join(root, name));
  expect(files.length).toBeGreaterThan(0);
  expect(files.reduce((bytes, file) => bytes + fs.statSync(file).size, 0)).toBeLessThan(3_000_000);
  expect(files.filter((file) => /\/(before|after)\.json$/.test(file))).toEqual([]);
  const attributes = fs.existsSync(".gitattributes")
    ? fs.readFileSync(".gitattributes", "utf8")
    : "";
  expect(
    attributes
      .split("\n")
      .filter((line) => line.includes("load-time") && /(^|\s)-diff(\s|$)/.test(line)),
  ).toEqual([]);
});
