// Pair each toy/setting immediately, with one fresh browser per opening.
// Alternate phase order on every pass to avoid order and shared-browser cache bias.
import { execFileSync } from "node:child_process";
const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const ids = option("only", "").split(",").filter(Boolean);
if (!ids.length) throw new Error("Specify --only=ID,ID for the focused timing check.");
const samples = Number(option("samples", "5"));
if (!Number.isInteger(samples) || samples < 1)
  throw new Error("Specify a positive integer for --samples.");
const devices = option("device", "") ? [option("device")] : ["phone", "desktop"];
const out = option("out", "../load-time-runs/paired");
for (let sample = 0; sample < samples; sample++) {
  for (const device of devices)
    for (const id of ids) {
      for (const phase of sample % 2 ? ["after", "before"] : ["before", "after"]) {
        for (let attempt = 0; ; attempt++) {
          try {
            execFileSync(
              process.execPath,
              [
                "tools/load-time-audit.mjs",
                `--phase=${phase}`,
                `--base=http://127.0.0.1:${phase === "before" ? 4174 : 4173}`,
                `--only=${id}`,
                `--device=${device}`,
                `--samples=${sample + 1}`,
                `--out=${out}`,
                `--navigation-timeout=${option("navigation-timeout", "180000")}`,
                `--readiness-timeout=${option("readiness-timeout", "300000")}`,
                `--cell-timeout=${option("cell-timeout", "180000")}`,
                `--frozen-main=${option("frozen-main", "origin/main")}`,
                `--candidate-source=${option("candidate-source", "HEAD")}`,
              ],
              { stdio: "inherit" },
            );
            break;
          } catch (error) {
            if (attempt >= 2) throw error;
            console.error(`Restarting ${phase}:${device}:${id}:${sample} from saved observations.`);
          }
        }
      }
    }
}
