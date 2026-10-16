import { test, expect } from "@playwright/test";

// These controls exercise adapter discovery only; no graphics device is created.
async function withGpu(gpu, work) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { gpu } });
  try {
    return await work();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
}

test("an unresponsive graphics adapter gives bounded, actionable feedback", async () => {
  const { webgpuStatus } = await import("../src/video3d/run.js");
  await withGpu({ requestAdapter: () => new Promise(() => {}) }, async () => {
    const result = await Promise.race([
      webgpuStatus({ timeoutMs: 20 }),
      new Promise((resolve) => setTimeout(() => resolve({ pending: true }), 200)),
    ]);
    expect(result.pending).toBeUndefined();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/graphics card.*time/i);
    expect(result.reason).toMatch(/try|reopen/i);
  });
});

test("canceling adapter discovery releases its caller and does not start a canceled request", async () => {
  const { webgpuStatus } = await import("../src/video3d/run.js");
  let calls = 0;
  await withGpu(
    {
      requestAdapter: () => {
        calls++;
        return new Promise(() => {});
      },
    },
    async () => {
      const canceled = new AbortController();
      canceled.abort();
      await expect(webgpuStatus({ signal: canceled.signal })).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(calls).toBe(0);
      const active = new AbortController();
      const pending = webgpuStatus({ signal: active.signal, timeoutMs: 200 });
      await Promise.resolve();
      active.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(calls).toBe(1);
    },
  );
});

test("a late adapter response cannot replace the timeout or another discovery", async () => {
  const { webgpuStatus } = await import("../src/video3d/run.js");
  let resolveAdapter;
  let calls = 0;
  await withGpu(
    {
      requestAdapter: () =>
        ++calls === 1
          ? new Promise((resolve) => {
              resolveAdapter = resolve;
            })
          : Promise.resolve({ info: { vendor: "test", description: "available adapter" } }),
    },
    async () => {
      const first = await Promise.race([
        webgpuStatus({ timeoutMs: 20 }),
        new Promise((resolve) => setTimeout(() => resolve({ pending: true }), 200)),
      ]);
      expect(first.ok).toBe(false);
      const second = await webgpuStatus();
      expect(second).toEqual({ ok: true, adapter: "test available adapter", reason: "" });
      resolveAdapter({ info: { description: "late adapter" } });
      await Promise.resolve();
      expect(first.ok).toBe(false);
      expect(second.adapter).toBe("test available adapter");
    },
  );
});
