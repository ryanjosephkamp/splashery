import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("the CPU fitter's position, covariance, color, and opacity gradients match finite differences", () => {
  const root = mkdtempSync(join(tmpdir(), "v3d-cpu-gradient-"));
  try {
    const executable = join(root, "trainer");
    execFileSync("g++", [
      "-O3",
      "-ffp-contract=off",
      "-std=c++17",
      "-fopenmp",
      resolve("tools/cdx-v3d-cpu-train.cpp"),
      "-o",
      executable,
    ]);
    const result = execFileSync(executable, ["--gradcheck"], { encoding: "utf8" });
    expect(result.match(/gradient /g)).toHaveLength(28);
    expect(Number(result.match(/worst ([\d.e+-]+)/)[1])).toBeLessThan(0.05);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
