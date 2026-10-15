// Task 66 review: persist each result before a long comparison run finishes.
// Add this reporter beside list/json, with a fresh SPLASHERY_CHECKPOINT_FILE.
// Made by Ryan with Codex (GPT-6); MIT.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export default class CheckpointReporter {
  describe(test) {
    const file = path.basename(test.location.file);
    const titles = test.titlePath();
    const at = titles.indexOf(file);
    return {
      id: test.id,
      file,
      title: titles
        .slice(at + 1)
        .filter(Boolean)
        .join(" > "),
      project: test.parent.project()?.name || "",
      expectedStatus: test.expectedStatus,
    };
  }

  write(record) {
    fs.writeSync(this.fd, JSON.stringify(record) + "\n");
    fs.fsyncSync(this.fd);
  }

  onBegin(config, suite) {
    const out = process.env.SPLASHERY_CHECKPOINT_FILE;
    if (!out) throw new Error("Supply a fresh SPLASHERY_CHECKPOINT_FILE path.");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    // Never overwrite a prior run's evidence, even after an interruption.
    this.fd = fs.openSync(out, "ax");
    this.write({
      event: "begin",
      source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      workers: config.workers,
      maxFailures: config.maxFailures,
      tests: suite.allTests().map((test) => this.describe(test)),
    });
  }

  onTestBegin(test) {
    this.write({ event: "testBegin", ...this.describe(test) });
  }

  onTestEnd(test, result) {
    this.write({
      event: "testEnd",
      ...this.describe(test),
      status: result.status,
      durationMs: result.duration,
      errors: result.errors.map((error) => error.message || error.value || ""),
      attachments: result.attachments
        .filter((attachment) => attachment.path)
        .map(({ name, contentType, path: file }) => ({ name, contentType, path: file })),
    });
  }

  onEnd(result) {
    this.write({ event: "end", status: result.status, durationMs: result.duration });
    fs.closeSync(this.fd);
  }
}
