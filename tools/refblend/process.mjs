import fs from "node:fs";
import { spawn } from "node:child_process";
export function runCommand(
  command,
  args,
  { deadline, log, cwd, env = process.env, detached = true } = {},
) {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (!(remaining > 0)) return reject(new Error("Build budget deadline reached"));
    const fd = fs.openSync(log, "a");
    const child = spawn(command, args, {
      cwd,
      env,
      detached: detached && process.platform !== "win32",
      stdio: ["ignore", fd, fd],
    });
    fs.closeSync(fd);
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        try {
          process.kill(
            !detached || process.platform === "win32" ? child.pid : -child.pid,
            "SIGKILL",
          );
        } catch {
          /* already exited */
        }
      },
      Math.min(remaining, 2147483647),
    );
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start ${command}: ${e.message}`));
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut)
        reject(new Error("Build budget deadline reached; child process group terminated"));
      else if (code !== 0) reject(new Error(`${command} failed (${signal || code}); see ${log}`));
      else resolve();
    });
  });
}
