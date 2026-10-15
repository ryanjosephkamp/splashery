// MIT. Process accounting, separate from JS heap; unavailable values stay null.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
export function processMemory(pid) {
  if (process.platform === "linux") {
    const parents = new Map();
    for (const name of fs.readdirSync("/proc"))
      if (/^\d+$/.test(name))
        try {
          const stat = fs.readFileSync(`/proc/${name}/stat`, "utf8");
          parents.set(Number(name), Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]));
        } catch (e) {
          if (!["ENOENT", "ESRCH"].includes(e.code)) throw e;
        }
    const selected = new Set([pid]);
    for (let again = true; again; ) {
      again = false;
      for (const [child, parent] of parents)
        if (selected.has(parent) && !selected.has(child)) {
          selected.add(child);
          again = true;
        }
    }
    let pss = 0,
      rss = 0,
      processes = 0;
    const unavailable = [];
    for (const child of selected)
      try {
        const s = fs.readFileSync(`/proc/${child}/smaps_rollup`, "utf8");
        const p = s.match(/^Pss:\s+(\d+)/m),
          r = s.match(/^Rss:\s+(\d+)/m);
        if (!p || !r) throw new Error("Missing process accounting fields");
        pss += Number(p[1]) * 1024;
        rss += Number(r[1]) * 1024;
        processes++;
      } catch (e) {
        if (!["ENOENT", "ESRCH"].includes(e.code))
          unavailable.push({ pid: child, error: e.code || e.message });
      }
    return {
      pssBytes: processes && !unavailable.length ? pss : null,
      rssBytes: processes && !unavailable.length ? rss : null,
      processes,
      unavailable,
      method: "Linux Chromium process-tree PSS; RSS also shown (shared pages counted repeatedly)",
    };
  }
  if (process.platform === "darwin") {
    try {
      const records = execFileSync("ps", ["-axo", "pid=,ppid=,rss="], { encoding: "utf8" })
        .trim()
        .split("\n")
        .map((l) => l.trim().split(/\s+/).map(Number));
      const selected = new Set([pid]);
      for (let again = true; again; ) {
        again = false;
        for (const [child, parent] of records)
          if (selected.has(parent) && !selected.has(child)) {
            selected.add(child);
            again = true;
          }
      }
      const rows = records.filter(([child]) => selected.has(child));
      return {
        pssBytes: null,
        rssBytes: rows.length ? rows.reduce((a, r) => a + r[2] * 1024, 0) : null,
        processes: rows.length,
        unavailable: [],
        method: "macOS Chromium process-tree RSS; shared pages counted repeatedly; PSS unavailable",
      };
    } catch (e) {
      return {
        pssBytes: null,
        rssBytes: null,
        unavailable: [{ error: e.message }],
        method: "Process accounting unavailable",
      };
    }
  }
  return {
    pssBytes: null,
    rssBytes: null,
    unavailable: [],
    method: "Process accounting unsupported on this OS",
  };
}
