// A local stage must end even if a worker or graphics driver stops answering. The child signal
// also cancels cooperative work. A late resolution or rejection cannot replace the visible result.
export function runWithDeadline(work, { signal, timeoutMs, message }) {
  const controller = new AbortController();
  const expiresAt = performance.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      (error ? reject : resolve)(value);
    };
    const cancel = () => {
      finish(new DOMException("Stopped", "AbortError"), true);
      controller.abort();
    };
    const expire = () => {
      finish(new Error(message), true);
      controller.abort();
    };
    const timer = setTimeout(expire, timeoutMs);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    else
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw new DOMException("Stopped", "AbortError");
          if (performance.now() >= expiresAt) {
            expire();
            return;
          }
          return work(controller.signal);
        })
        .then(
          (value) => {
            if (performance.now() >= expiresAt) expire();
            else finish(value);
          },
          (error) => {
            if (performance.now() >= expiresAt) expire();
            else finish(error, true);
          },
        );
  });
}
