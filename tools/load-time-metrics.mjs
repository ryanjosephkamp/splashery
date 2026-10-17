// Match task 06's completed-body convention, including independent worker
// transfers. CDP timestamps and Resource Timing share navigation's cutoff.
export function openingNetwork(
  requests,
  resources,
  workers,
  { navigationStart, timeOrigin, cutoffMs },
) {
  const used = new Set();
  const network = [];
  for (const r of requests) {
    const index = resources.findIndex((s, i) => !used.has(i) && s.url === r.url);
    const rt = resources[index];
    if (index >= 0) used.add(index);
    const length =
      Number(
        Object.entries(r.headers || {}).find(([k]) => k.toLowerCase() === "content-length")?.[1],
      ) || 0;
    const startMs = (r.startTimestamp - navigationStart) * 1000;
    const finishMs =
      r.finishTimestamp == null ? rt?.end : (r.finishTimestamp - navigationStart) * 1000;
    const completed = finishMs != null && finishMs <= cutoffMs;
    const body = !completed
      ? 0
      : r.finishTimestamp != null
        ? length || rt?.body || 0
        : rt?.transfer > 0
          ? rt.body
          : 0;
    network.push({
      url: r.url,
      status: r.status,
      type: r.type,
      body,
      startMs,
      finishMs,
      completedAtCutoff: completed,
      bodySource:
        r.finishTimestamp != null
          ? "CDP completion with Content-Length or Resource Timing"
          : "Parent Resource Timing",
      error: r.error || null,
    });
  }
  resources.forEach((r, i) => {
    if (!used.has(i))
      network.push({
        url: r.url,
        startMs: r.start,
        finishMs: r.end,
        body: r.end <= cutoffMs && r.transfer > 0 ? r.body : 0,
        bodySource: "Parent Resource Timing",
      });
  });
  for (const w of workers)
    for (const r of w.resources) {
      if (r.url === w.url && network.some((s) => s.url === r.url)) continue;
      const startMs = w.origin - timeOrigin + r.start;
      const finishMs = w.origin - timeOrigin + r.end;
      network.push({
        url: r.url,
        type: "worker",
        startMs,
        finishMs,
        body: finishMs <= cutoffMs && r.transfer > 0 ? r.body : 0,
        bodySource: "Worker Resource Timing",
      });
    }
  return network;
}
