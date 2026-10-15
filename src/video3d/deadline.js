// A local stage must end even if a worker or graphics driver stops answering. The child signal
// also cancels cooperative work. A late resolution or rejection cannot replace the visible result.
export function runWithDeadline(work, { signal, timeoutMs, message }) {
  const controller = new AbortController();
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
    const timer = setTimeout(() => {
      finish(new Error(message), true);
      controller.abort();
    }, timeoutMs);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    else
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw new DOMException("Stopped", "AbortError");
          return work(controller.signal);
        })
        .then(
          (value) => finish(value),
          (error) => finish(error, true),
        );
  });
}
