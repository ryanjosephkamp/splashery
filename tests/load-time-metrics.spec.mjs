import { test, expect } from "@playwright/test";
import { openingNetwork } from "../tools/load-time-metrics.mjs";

const clock = { navigationStart: 10, timeOrigin: 100000, cutoffMs: 1500 };

test("a response that completes during worker inspection stays outside opening bytes", () => {
  const network = openingNetwork(
    [
      {
        url: "http://local/first",
        startTimestamp: 10.1,
        finishTimestamp: 11,
        headers: { "Content-Length": "100" },
      },
      {
        url: "http://local/late",
        startTimestamp: 10.2,
        finishTimestamp: 11.6,
        headers: { "Content-Length": "9000" },
      },
    ],
    [],
    [],
    clock,
  );
  expect(network.map((r) => r.body)).toEqual([100, 0]);
  expect(network[1].completedAtCutoff).toBe(false);
});

test("a worker's imports count separately from identical parent modules", () => {
  const script = "http://local/worker.js";
  const shared = "http://local/shared.js";
  const rt = (url, body) => ({ url, start: 100, end: 200, transfer: body + 300, body });
  const network = openingNetwork(
    [],
    [rt(script, 40), rt(shared, 120)],
    [{ url: script, origin: clock.timeOrigin, resources: [rt(script, 40), rt(shared, 120)] }],
    clock,
  );
  expect(network.reduce((sum, r) => sum + r.body, 0)).toBe(280);
  expect(network.filter((r) => r.url === shared)).toHaveLength(2);
});
