import { test, expect } from "@playwright/test";
import { EventEmitter } from "node:events";
import vm from "node:vm";
import { waitForCamera, waitForRenderedToy } from "./render-ready.mjs";

function renderModel({ outstanding = false } = {}) {
  const app = new EventEmitter();
  const camera = {};
  const layer = {};
  const sorter = Object.assign(new EventEmitter(), {
    jobsInFlight: outstanding ? 1 : 0,
    pendingSorted: null,
  });
  const world = {
    currentVersion: 1,
    lastWorldStateVersion: 1,
    pendingLoadCount: 0,
    awaitingLodUpdate: false,
    getState: () => ({ sortedBefore: true }),
  };
  const manager = { world, cpuSorter: sorter, sortNeeded: false };
  app.scene = { layers: { getLayerByName: () => layer } };
  app.renderer = {
    gsplatDirector: {
      camerasMap: new Map([
        [
          camera,
          {
            layersMap: new Map([[layer, { gsplatManager: manager }]]),
          },
        ],
      ]),
    },
  };
  const stage = {
    app,
    frames: 10,
    cameraEntity: { camera: { camera } },
    requestRender() {
      setImmediate(() => {
        stage.frames++;
        if (outstanding) {
          // A completed sort for an older version cannot release the waiter.
          if (stage.frames === 11) sorter.emit("sorted", 10, 0);
          else {
            sorter.jobsInFlight = 0;
            sorter.emit("sorted", 10, 1);
          }
        }
        app.emit("frameend");
      });
    },
  };
  const page = {
    evaluate: (fn) =>
      vm.runInNewContext(`(${fn.toString()})()`, {
        window: { __splashery: { player: { stage, loading: 0 } } },
        setTimeout: (fn) => setTimeout(fn, 100),
        clearTimeout,
      }),
  };
  return { page, stage, app, sorter };
}

test("an already sorted stationary scene needs a completed frame, not a new sort", async () => {
  const { page, stage, app, sorter } = renderModel();
  await waitForRenderedToy(page);
  expect(stage.frames).toBeGreaterThan(10);
  expect(app.listenerCount("frameend")).toBe(0);
  expect(sorter.listenerCount("sorted")).toBe(0);
});

test("an outstanding sort for the current scene cannot be replaced by an older result", async () => {
  const { page, stage } = renderModel({ outstanding: true });
  await waitForRenderedToy(page);
  expect(stage.frames).toBeGreaterThanOrEqual(12);
});

test("a toy's camera and sorted GPU frame finish before a pick", async ({ page }) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("basketball");
    player.camera.setTurntable(false);
    player.camera.tgt.yaw += 0.4;
  });
  await waitForCamera(page);
  await waitForRenderedToy(page);
  const result = await page.evaluate(async () => {
    const { player } = window.__splashery;
    const point = player.stage.toScreen(player.toyInfo.center);
    player.pickDirty = true;
    return {
      error: Math.abs(player.camera.cur.yaw - player.camera.tgt.yaw),
      hit: await player.pickAt(...point),
    };
  });
  expect(result.error).toBeLessThan(1e-3);
  expect(result.hit).not.toBeNull();
});
