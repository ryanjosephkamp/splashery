// Resources owned by a suite run. Binding port zero reserves an independent
// server port before it is handed to Playwright; there is no probe/bind race.
import { spawn } from "node:child_process";

const SERVER = `
import functools, http.server, sys
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), functools.partial(Handler, directory=sys.argv[1]))
print(server.server_port, flush=True)
server.serve_forever()
`;

// Attach ownership before awaiting startup. A canceled process gets a bounded
// grace period, then SIGKILL; detached workers also lose their descendants.
export function ownProcess(child, { signal, group = false, graceMs = 2000 } = {}) {
  let ended = false;
  let shutdown;
  const closed = new Promise((resolve) =>
    child.once("close", () => {
      ended = true;
      resolve();
    }),
  );
  // A spawn failure still emits close. Readiness checks report the error;
  // ownership must also be safe for a missing executable during startup.
  child.on("error", () => {});
  const send = (name) => {
    if (!child.pid || (ended && !group)) return;
    try {
      if (group) process.kill(-child.pid, name);
      else child.kill(name);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const wait = async () => {
    if (ended) return;
    let timer;
    try {
      await Promise.race([closed, new Promise((resolve) => { timer = setTimeout(resolve, graceMs); })]); // prettier-ignore
    } finally {
      clearTimeout(timer);
    }
  };
  const close = () =>
    (shutdown ||= (async () => {
      send("SIGTERM");
      await wait();
      // The leader can exit while descendants ignore SIGTERM. Kill the group
      // even when close has already fired for its leader.
      if (group || !ended) send("SIGKILL");
      await wait();
      if (!ended) throw new Error(`Suite process ${child.pid} did not stop`);
    })());
  const abort = () => {
    void close().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  closed.then(() => signal?.removeEventListener("abort", abort));
  if (signal?.aborted) abort();
  return { child, closed, close };
}

export async function startServer({ root, port = 0, signal, onSpawn }) {
  signal?.throwIfAborted();
  const child = spawn("python3", ["-u", "-c", SERVER, root, String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const owned = ownProcess(child, { signal });
  onSpawn?.(owned);
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr = (stderr + data).slice(-8000);
  });
  try {
    const assigned = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Suite server did not become ready")),
        30_000,
      );
      let stdout = "";
      const finish = (fn, value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        fn(value);
      };
      const abort = () => finish(reject, signal.reason);
      signal?.addEventListener("abort", abort, { once: true });
      child.once("error", (error) => finish(reject, error));
      child.once("close", (code) =>
        finish(reject, new Error(`Suite server exited (${code}): ${stderr}`)),
      );
      child.stdout.on("data", (data) => {
        stdout += data;
        if (!stdout.includes("\n")) return;
        const selected = Number(stdout.trim());
        if (Number.isInteger(selected) && selected > 0 && selected <= 65535)
          finish(resolve, selected);
        else finish(reject, new Error(`Invalid suite server port: ${stdout}`));
      });
      if (signal?.aborted) abort();
    });
    signal?.throwIfAborted();
    return {
      port: assigned,
      url: `http://127.0.0.1:${assigned}/`,
      close: owned.close,
    };
  } catch (error) {
    await owned.close();
    throw error;
  }
}

export function reportProblems(report, code) {
  if (!report) return ["No JSON report"];
  const errors = (report.errors || []).map((e) => e.message || String(e));
  if (code !== 0) errors.push(`Playwright exited with code ${code}`);
  const stats = report.stats || {};
  if (!(stats.expected + stats.unexpected + stats.flaky + stats.skipped > 0))
    errors.push("No tests executed");
  return errors;
}
