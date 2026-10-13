// Wait for the camera and the splat sort that GPU picking/screenshots actually
// use. These are test utilities; no timing or rendering behavior in the app changes.
export async function waitForCamera(page, { timeout = 60_000 } = {}) {
  try {
    await page.waitForFunction(
      () => {
        const player = window.__splashery?.player;
        const camera = player?.camera;
        if (!camera || player.loading) return false;
        return (
          Math.abs(camera.cur.yaw - camera.tgt.yaw) +
            Math.abs(camera.cur.pitch - camera.tgt.pitch) +
            Math.abs(camera.cur.roll - camera.tgt.roll) +
            Math.abs(camera.cur.distance - camera.tgt.distance) / (camera.tgt.distance || 1) <
          1e-3
        );
      },
      null,
      { timeout },
    );
  } catch (error) {
    const state = await page.evaluate(() => {
      const p = window.__splashery?.player;
      return {
        loading: p?.loading,
        paused: p?.paused,
        frozen: p?.frozen,
        frames: p?.stage?.frames,
        cur: p?.camera?.cur,
        tgt: p?.camera?.tgt,
      };
    });
    error.message += `\nCamera readiness: ${JSON.stringify(state)}`;
    throw error;
  }
}

export async function waitForRenderedToy(page) {
  await page.evaluate(async () => {
    const { player } = window.__splashery;
    const stage = player.stage;
    const app = stage.app;
    const data = player.proc?.ctx?.kit?.data;
    const sharpState =
      data?.photo || data?.moving ? (await import("/src/packs/photo-sharp.js")).sharpState : null;
    return new Promise((resolve, reject) => {
      let state;
      let sorter;
      let sortedVersion = -1;
      const before = stage.frames;
      const sorted = (_count, version) => {
        sortedVersion = version;
      };
      const finish = () => {
        clearTimeout(timer);
        app.off("frameend", check);
        sorter?.off("sorted", sorted);
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Render readiness: ${JSON.stringify(state)}`));
      }, 60_000);
      const check = () => {
        const camera = stage.cameraEntity.camera.camera;
        const layer = app.scene.layers.getLayerByName("World");
        const manager = app.renderer.gsplatDirector.camerasMap
          .get(camera)
          ?.layersMap.get(layer)?.gsplatManager;
        const world = manager?.world;
        // Sharp view intentionally disables the splat entity. Its textured
        // relief has no splat-sort manager; wait for that visible, uploaded
        // mesh and a completed frame instead of waiting for nonexistent splats.
        const sharp = sharpState?.();
        if (
          !player.loading &&
          stage.frames > before &&
          stage.toy?.entity.gsplat.enabled === false &&
          sharp?.on &&
          sharp.splatsOff &&
          sharp.color &&
          sharp.depth
        ) {
          finish();
          resolve();
          return;
        }
        if (sorter !== manager?.cpuSorter) {
          sorter?.off("sorted", sorted);
          sorter = manager?.cpuSorter;
          sortedVersion = -1;
          sorter?.on("sorted", sorted);
        }
        state = {
          toy: player.toyInfo?.id,
          loading: player.loading,
          current: world?.currentVersion,
          last: world?.lastWorldStateVersion,
          loads: world?.pendingLoadCount,
          sorted: world?.getState(world.currentVersion)?.sortedBefore,
          lod: world?.awaitingLodUpdate,
          jobs: manager?.cpuSorter?.jobsInFlight,
          pending: !!manager?.cpuSorter?.pendingSorted,
          needed: !!manager?.sortNeeded,
        };
        if (
          !state.loading &&
          world &&
          state.current === state.last &&
          !state.loads &&
          state.sorted &&
          !state.lod &&
          stage.frames > before &&
          (!sorter ||
            sortedVersion === state.last ||
            (!state.jobs && !state.pending && !state.needed))
        ) {
          finish();
          resolve();
        } else stage.requestRender();
      };
      // Check after the engine uploads its sort result, not in a rAF callback
      // that can run before the engine's own callback on every frame.
      // Kit modifiers can queue another sort each frame. Require an applied
      // result for this world version, rather than waiting for an empty queue.
      // A stationary scene may already have its final sort uploaded and never
      // emit another result. Accept that state only with no outstanding sort.
      app.on("frameend", check);
      check();
      stage.requestRender();
    });
  });
}
