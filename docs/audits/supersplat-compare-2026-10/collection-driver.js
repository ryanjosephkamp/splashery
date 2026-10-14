// Run within the documented CUA session with tab, cdp, vp, auditFs, auditDir, rows, methods, and initCode.
async (pair, site, size) => {
  await vp.set(size);
  var url =
    site === "supersplat"
      ? "https://superspl.at/s?id=" + pair.scene
      : "https://ryanjosephkamp.github.io/splashery/embed/?toy=" +
        pair.id +
        "&profile=" +
        (size.width === 390 ? "weak" : "high") +
        "&adapt=off";
  var cursor = (await cdp.readEvents({ methods })).cursor;
  await tab.goto(url);
  await cdp.send("Runtime.evaluate", { expression: initCode });
  var r = await cdp.send(
    "Runtime.evaluate",
    {
      expression:
        "new Promise(resolve=>{const t=setInterval(()=>{if(window.__compare?.done){clearInterval(t);resolve(window.__compare)}},100);setTimeout(()=>{clearInterval(t);resolve(window.__compare)},25000)})",
      awaitPromise: true,
      returnByValue: true,
    },
    { timeoutMs: 28000 },
  );
  var data = r.result?.value;
  if (!data) throw Error(JSON.stringify(r));
  var network = [],
    ev;
  do {
    ev = await cdp.readEvents({ afterSequence: cursor, methods, limit: 1000 });
    cursor = ev.cursor;
    network.push(
      ...ev.events.map((e) => ({
        method: e.method,
        requestId: e.params?.requestId,
        url: e.params?.request?.url || e.params?.response?.url,
        status: e.params?.response?.status,
        encodedDataLength: e.params?.encodedDataLength,
        timestamp: e.params?.timestamp,
        errorText: e.params?.errorText,
        canceled: e.params?.canceled,
        fromDiskCache: e.params?.response?.fromDiskCache,
      })),
    );
  } while (ev.hasMore);
  var row = {
    id: pair.id,
    scene: pair.scene,
    site,
    url,
    at: new Date().toISOString(),
    size,
    data,
    network,
    networkEventsTruncated: ev.truncated,
  };
  rows.push(row);
  await auditFs.writeFile(auditDir + "/measurements.json", JSON.stringify(rows, null, 2) + "\n");
  nodeRepl.write({
    id: pair.id,
    site,
    size,
    done: data.done,
    firstFrame: Math.round(data.firstFrameMs),
    hookLoaded: data.alreadyLoadedAtHook,
    splats: data.splats,
    drawn: data.drawnSplats,
    renderer: data.renderer,
    profile: data.profile,
    frames: data.frameends.length,
  });
};
