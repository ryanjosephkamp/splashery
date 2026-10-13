// Repeat focused cold openings with alternating phase order. The collector
// resumes earlier samples, so each pass adds one observation per setting.
import { execFileSync } from "node:child_process";

const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const only = option("only", "");
if (!only) throw new Error("Specify --only=ID,ID for the focused timing check.");
const samples = Number(option("samples", "5"));
if (!Number.isInteger(samples) || samples < 1)
  throw new Error("Specify a positive integer for --samples.");
const out = option("out", "docs/audits/load-time-2026-10/paired");
const device = option("device", "");
const navigationTimeout = option("navigation-timeout", "60000");
const readinessTimeout = option("readiness-timeout", "120000");
const cellTimeout = option("cell-timeout", "600000");
for (let sample = 0; sample < samples; sample++) {
  const phases = sample % 2 ? ["after", "before"] : ["before", "after"];
  for (const phase of phases) {
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync(
          process.execPath,
          [
            "tools/load-time-audit.mjs",
            `--phase=${phase}`,
            `--base=http://127.0.0.1:${phase === "before" ? 4174 : 4173}`,
            `--only=${only}`,
            `--samples=${sample + 1}`,
            `--out=${out}`,
            `--navigation-timeout=${navigationTimeout}`,
            `--readiness-timeout=${readinessTimeout}`,
            `--cell-timeout=${cellTimeout}`,
            ...(device ? [`--device=${device}`] : []),
          ],
          { stdio: "inherit" },
        );
        break;
      } catch (error) {
        if (attempt >= 2) throw error;
        console.error(
          `Restarting ${phase} pass ${sample + 1} from saved observations after collector failure.`,
        );
      }
    }
  }
}
