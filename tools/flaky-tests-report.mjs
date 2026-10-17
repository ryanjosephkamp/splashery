#!/usr/bin/env node
// A compact, exact failure receipt for Task 100's stress runs. The raw JSON,
// stdout, trace, and source recipe remain in the Actions artifact/clips branch.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const dir = path.resolve(process.argv[2]);
const report = JSON.parse(fs.readFileSync(path.join(dir, "report.json"), "utf8"));
const recipe = JSON.parse(fs.readFileSync(path.join(dir, "recipe.json"), "utf8"));
const cases = [];
function walk(suite, titles = []) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests)
      for (const result of test.results)
        cases.push({
          title: [...titles, spec.title].join(" › "),
          repeat: test.repeatEachIndex,
          ...result,
        });
  for (const child of suite.suites || []) walk(child, [...titles, child.title]);
}
walk(report);
const groups = new Map();
for (const test of cases) {
  if (!groups.has(test.title)) groups.set(test.title, []);
  groups.get(test.title).push(test);
}
const env = process.env;
const phase = env.FLAKY_PHASE || "local";
const marker = `<!-- splashery-flaky-${recipe.only.join("-")}-${phase} -->`;
const lines = [marker, `### ${recipe.only.join(", ")}: ${phase} stress receipt`, ""];
const url = env.GITHUB_RUN_ID
  ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
  : null;
lines.push(
  `Source: \`${recipe.commit}\`; ${recipe.repeat} repetitions, ${recipe.workers} workers, ${recipe.burners || 0} CPU burners, ${recipe.renderer}, ${recipe.node}, ${recipe.browserVersion}.${url ? ` [Run](${url}).` : ""}`,
  "",
);
lines.push("| Variant | Passed | Failed | Skipped/interrupted |", "| --- | ---: | ---: | ---: |");
for (const [title, tests] of groups) {
  const passed = tests.filter((t) => t.status === "passed").length;
  const other = tests.filter((t) => ["skipped", "interrupted"].includes(t.status)).length;
  lines.push(
    `| ${title.replaceAll("|", "\\|")} | ${passed} | ${tests.length - passed - other} | ${other} |`,
  );
}
const failed = cases.filter((t) => !["passed", "skipped"].includes(t.status));
if (failed.length) {
  lines.push("", "<details><summary>Exact failure evidence</summary>", "");
  for (const test of failed) {
    const error = (
      test.errors?.map((e) => e.message).join("\n") ||
      test.error?.message ||
      test.status
    ).replace(/\x1b\[[0-9;]*m/g, "");
    lines.push(
      `**${test.title}, repetition ${test.repeat} (${test.status})**`,
      "",
      "```text",
      error.slice(0, 2500),
      "```",
      "",
    );
  }
  lines.push("</details>");
}
let body = lines.join("\n") + "\n";
if (body.length > 60000)
  body = body.slice(0, 60000) + "\n\nFurther failures are in the raw report.\n";
fs.writeFileSync(path.join(dir, "receipt.md"), body);
process.stdout.write(body);
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, body);
if (process.argv.includes("--comment")) {
  const base = `repos/${env.GITHUB_REPOSITORY}`;
  const comments = JSON.parse(
    execFileSync(
      "gh",
      ["api", `${base}/issues/${env.FLAKY_PR}/comments`, "--paginate", "--slurp"],
      {
        encoding: "utf8",
      },
    ),
  ).flat();
  const previous = comments.find((c) => c.body.startsWith(marker));
  const endpoint = previous
    ? `${base}/issues/comments/${previous.id}`
    : `${base}/issues/${env.FLAKY_PR}/comments`;
  const input = path.join(dir, "comment.json");
  fs.writeFileSync(input, JSON.stringify({ body }));
  execFileSync("gh", ["api", "--method", previous ? "PATCH" : "POST", endpoint, "--input", input], {
    stdio: "ignore",
  });
}
