// MIT. Made by Ryan with Codex (GPT-6).
// A finite worker queue owns every worker until success, error, or cancellation. Aborting an
// operation must stop queued work as well as reject the caller's wait.
export async function runWorkerPool({
  url, size, jobs, message, onResult, signal, label = 'worker',
  createWorker = (source) => new Worker(source, { type: 'module' }),
}) {
  if (!Number.isInteger(size) || size < 1) throw new Error('worker pool size must be a positive integer');
  const workers = [];
  let settled = false;
  let cancel;
  try {
    await new Promise((resolve, reject) => {
      let next = 0, done = 0;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error); else resolve();
      };
      cancel = () => finish(new DOMException('SfM aborted', 'AbortError'));
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      if (!jobs.length) { finish(); return; }
      const feed = (worker) => {
        if (settled || next >= jobs.length) return;
        const index = next++, job = jobs[index];
        worker.onmessage = (event) => {
          if (settled) return;
          try {
            onResult(event.data, job, index);
            if (settled) return;
            if (++done === jobs.length) finish(); else feed(worker);
          } catch (error) { finish(error); }
        };
        worker.onerror = (event) => {
          event.preventDefault?.();
          finish(new Error(`${label}: ${event.message || event}`));
        };
        worker.postMessage(message(job, index));
      };
      for (let i = 0; i < Math.min(size, jobs.length) && !settled; i++) {
        const worker = createWorker(url);
        workers.push(worker);
        feed(worker);
      }
    });
  } finally {
    settled = true;
    signal?.removeEventListener('abort', cancel);
    for (const worker of workers) {
      worker.onmessage = worker.onerror = null;
      try { worker.terminate(); } catch { /* keep releasing the rest */ }
    }
  }
}
