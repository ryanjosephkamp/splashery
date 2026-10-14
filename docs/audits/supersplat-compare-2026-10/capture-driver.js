// Run within the documented CUA session with tab, cdp, vp, auditFs, auditDir, and pairs.
async (pair, site) => {
  await vp.set({ width: 390, height: 844 });
  var url =
    site === "supersplat"
      ? "https://superspl.at/s?id=" + pair.scene + "&noanim&noui"
      : "https://ryanjosephkamp.github.io/splashery/embed/?toy=" +
        pair.id +
        "&turntable=off&controls=0&bg=black&profile=weak&adapt=off";
  await tab.goto(url);
  await cdp.send(
    "Runtime.evaluate",
    {
      expression:
        "new Promise(resolve=>{const t=setInterval(()=>{const a=window.app||window.__splashery?.player?.stage?.app;if(a?.stats.frame.gsplats>0){clearInterval(t);resolve(true)}},100);setTimeout(()=>{clearInterval(t);resolve(false)},18000)})",
      awaitPromise: true,
      returnByValue: true,
    },
    { timeoutMs: 21000 },
  );
  if (site === "supersplat") await tab.scroll([195, 420], "down", 0.5);
  await tab.getAXState({ emit: false });
  await auditFs.writeFile(
    auditDir + "/screenshots/" + site + "-" + pair.id + "-390x844.jpg",
    await tab.screenshot({ fullPage: false }),
  );
  await vp.set({ width: 1440, height: 900 });
  if (site === "splashery") {
    await tab.goto(url.replace("profile=weak", "profile=high"));
    await cdp.send(
      "Runtime.evaluate",
      {
        expression:
          "new Promise(resolve=>{const t=setInterval(()=>{if(window.__splashery?.ready){clearInterval(t);resolve(true)}},100);setTimeout(()=>{clearInterval(t);resolve(false)},18000)})",
        awaitPromise: true,
        returnByValue: true,
      },
      { timeoutMs: 21000 },
    );
  }
  await tab.getAXState({ emit: false });
  await auditFs.writeFile(
    auditDir + "/screenshots/" + site + "-" + pair.id + "-1440x900.jpg",
    await tab.screenshot({ fullPage: false }),
  );
  shots.push({
    id: pair.id,
    site,
    url,
    desktopURL: await tab.url(),
    zoomWheelPages: site === "supersplat" ? 0.5 : 0,
  });
  await auditFs.writeFile(auditDir + "/screenshots.json", JSON.stringify(shots, null, 2) + "\n");
  nodeRepl.write({ captured: pair.id, site, url: await tab.url() });
};
