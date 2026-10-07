import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

// Lane AsciiCapture: ten jobs in a row, then repeated Cancel mid-capture,
// show no growth in documents, frames, listeners or the lab's own handles.
// Memory is measured (Chromium's JS heap after a forced garbage collection),
// not promised; GPU memory is not visible here. The numbers go to
// test-results/asc-repeat.json and the test's attachments.

const LAB = "/ascii-lab.html?deadline=180&profile=high";
const JOB = 200_000;

function handles() {
  if (window !== window.top) return;
  const timers = new Set();
  const setT = window.setTimeout;
  const clearT = window.clearTimeout;
  window.setTimeout = (fn, ms, ...rest) => {
    const id = setT((...a) => (timers.delete(id), typeof fn === "function" && fn(...a)), ms, ...rest); // prettier-ignore
    timers.add(id);
    return id;
  };
  window.clearTimeout = (id) => (timers.delete(id), clearT(id));
  const urls = new Set();
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  URL.createObjectURL = (b) => {
    const u = create(b);
    urls.add(u);
    return u;
  };
  URL.revokeObjectURL = (u) => (urls.delete(u), revoke(u));
  window.__ascHandles = () => ({
    iframes: document.querySelectorAll("iframe").length,
    timers: timers.size,
    urls: urls.size,
  });
}

// Starts a capture and taps Cancel from inside the page the moment the status
// shows frame `from` or later (a MutationObserver sees every status change).
function captureAndCancelAt(page, from) {
  return page.evaluate(
    (from) =>
      new Promise((resolve) => {
        const status = document.getElementById("status");
        const observer = new MutationObserver(() => {
          const m = /^Capturing frame (\d+) of 40/.exec(status.textContent);
          if (m && +m[1] >= from) {
            observer.disconnect();
            document.getElementById("cancel").click();
            resolve(+m[1]);
          } else if (!m && !/^Starting/.test(status.textContent)) {
            observer.disconnect();
            resolve(null);
          }
        });
        observer.observe(status, { childList: true, characterData: true, subtree: true });
        document.getElementById("capture").click();
      }),
    from,
  );
}

test("ten jobs in a row and repeated Cancel leave no growing documents or handles", async ({
  page,
}) => {
  test.setTimeout(10 * JOB + 6 * 60_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(handles);
  await page.goto(LAB);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const measure = async () => {
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    return {
      documents: m.Documents,
      frames: m.Frames,
      listeners: m.JSEventListeners,
      nodes: m.Nodes,
      heapMB: Math.round((m.JSHeapUsedSize / 2 ** 20) * 10) / 10,
      ...(await page.evaluate(() => window.__ascHandles())),
    };
  };
  await page.selectOption("#preset", "grapes");
  await page.selectOption("#columns", "48");
  const baseline = await measure();
  const jobs = [];
  for (let i = 0; i < 10; i++) {
    const t = Date.now();
    await page.click("#capture");
    await expect(page.locator("body")).toHaveAttribute("data-state", "done", { timeout: JOB });
    jobs.push({ ms: Date.now() - t, ...(await measure()) });
  }
  const cancels = [];
  for (let i = 0; i < 5; i++) {
    // Cancel at a different point mid-capture each time: frames 2, 9, 16, 23, 30.
    const frame = await captureAndCancelAt(page, 2 + 7 * i);
    expect(frame).toBeGreaterThanOrEqual(2 + 7 * i);
    expect(frame).toBeLessThan(40);
    await expect(page.locator("body")).toHaveAttribute("data-state", "failed");
    cancels.push(await measure());
  }
  const report = {
    browser: page.context().browser().version(),
    note: "Chromium JS heap after forced GC; Documents, Frames and JSEventListeners from CDP Performance.getMetrics. GPU memory is not measured.", // prettier-ignore
    baseline,
    jobs,
    cancels,
  };
  await fs.mkdir("test-results", { recursive: true });
  await fs.writeFile("test-results/asc-repeat.json", JSON.stringify(report, null, 2) + "\n");
  await test.info().attach("asc-repeat.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" }); // prettier-ignore
  // Each finished job holds one GIF (its URL replaces the last); a canceled one holds none.
  for (const j of jobs) expect(j).toMatchObject({ iframes: 0, timers: 0, urls: 1 });
  for (const c of cancels) expect(c).toMatchObject({ iframes: 0, timers: 0, urls: 0 });
  // No growth from the first job to the last, nor through the cancels.
  const first = jobs[0];
  for (const m of [...jobs, ...cancels]) {
    expect(m.documents).toBeLessThanOrEqual(first.documents);
    expect(m.frames).toBeLessThanOrEqual(first.frames);
    expect(m.listeners).toBeLessThanOrEqual(first.listeners + 4);
  }
  expect(jobs.at(-1).heapMB).toBeLessThan(first.heapMB + 8);
  expect(cancels.at(-1).heapMB).toBeLessThan(first.heapMB + 8);
  expect(errors).toEqual([]);
});
