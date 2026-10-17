import { TOYS } from "../../src/toys.js";
import { installFirstFrameProbe } from "./phone-speed-metrics.js";
import { installHybridFirstFrameProbe, measurePhoneToy } from "./phone-speed-hybrid.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const durationMs = Math.max(250, Number(params.get("duration")) || 2500);
const root = new URL("../../", import.meta.url);
let controller;
let rows = [];
let metadata;
const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "Unavailable");
const mib = (n) => (Number.isFinite(n) ? fmt(n / 1048576, 2) : "Unavailable");
const columns = (r) =>
  r.error || r.errors?.length
    ? [r.label, `Error: ${r.error || r.errors.join("; ")}`, "", "", "", "", ""]
    : [
        r.label,
        fmt(r.firstViewMs),
        `${fmt(r.idle.median)} / ${fmt(r.idle.p95)}`,
        `${fmt(r.tap.median)} / ${fmt(r.tap.p95)}`,
        mib(r.heapBytes),
        mib(r.transferBytes),
        r.cachedRequests,
      ];

// Match a fresh CLI context without changing the owner's saved site data.
function installTemporaryStorage() {
  if (window.__splashery) throw new Error("Benchmark setup arrived after the app started. Retry.");
  const makeStorage = () => {
    const values = new Map();
    return {
      getItem(key) {
        return values.get(String(key)) ?? null;
      },
      setItem(key, value) {
        values.set(String(key), String(value));
      },
      removeItem(key) {
        values.delete(String(key));
      },
      clear() {
        values.clear();
      },
      key(index) {
        return [...values.keys()][index] ?? null;
      },
      get length() {
        return values.size;
      },
    };
  };
  for (const key of ["localStorage", "sessionStorage"])
    Object.defineProperty(window, key, { configurable: true, value: makeStorage() });
  window.__phoneSpeedTemporaryStorage = true;
}

function render() {
  $("tbody").replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement("tr");
      for (const value of columns(r)) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }),
  );
  $("#results").value = [
    [
      "Toy",
      "First view ms",
      "Idle median / p95 ms",
      "Tap median / p95 ms",
      "JS heap MiB",
      "Transfer MiB",
      "Cache hits",
    ],
    ...rows.map(columns),
  ]
    .map((r) => r.join("\t"))
    .join("\n");
  $("#json").value = JSON.stringify({ ...metadata, rows }, null, 2);
  $("#copy").disabled = $("#save").disabled = !rows.length;
}

function openToy(toy, signal) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.title = toy.label;
    const url = new URL(root);
    url.search = new URLSearchParams({
      renderer: "webgl2",
      profile: "weak",
      labs: "1",
      adapt: "off",
      "first-toy": toy.id,
    });
    const cleanup = () => {
      clearInterval(poll);
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      iframe.remove();
      reject(new DOMException("Stopped", "AbortError"));
    };
    // Install in the same-origin document while its modules are still loading,
    // before the first draw. A missed signal is an error, never a fabricated time.
    let installed = false;
    const errors = [];
    const browserNotifications = [];
    const poll = setInterval(() => {
      try {
        const w = iframe.contentWindow;
        if (w.location.href !== url.href || !w.document.documentElement) return;
        if (!installed) {
          if (w.document.body?.dataset.firstToyFrame === "true")
            throw new Error("First draw was missed. Please retry.");
          w.addEventListener("error", (event) => {
            // Chromium can report deferred resize delivery without an exception.
            // Retain that notification separately; actual exceptions still fail.
            if (
              !event.error &&
              event.message === "ResizeObserver loop completed with undelivered notifications."
            )
              browserNotifications.push(event.message);
            else errors.push(event.message);
          });
          w.addEventListener("unhandledrejection", (event) => errors.push(String(event.reason)));
          const script = w.document.createElement("script");
          script.textContent = `(${installTemporaryStorage.toString()})(); (${installFirstFrameProbe.toString()})(); (${installHybridFirstFrameProbe.toString()})();`;
          w.document.documentElement.append(script);
          if (!w.__phoneSpeedTemporaryStorage)
            throw new Error("Fresh preferences could not be installed. Retry.");
          installed = true;
        }
        if (w.__phoneSpeedFirstViewError) throw new Error(w.__phoneSpeedFirstViewError);
        if (w.__splashery?.ready && w.__phoneSpeedFirstView) {
          if (w.__splashery.player.toyInfo?.id !== toy.id)
            throw new Error("The requested toy did not open.");
          cleanup();
          resolve({ iframe, win: w, errors, browserNotifications });
        }
        if (w.document.querySelector("#fallback:not([hidden])"))
          throw new Error("WebGL2 could not start on this device.");
      } catch (e) {
        cleanup();
        iframe.remove();
        reject(e);
      }
    }, 8);
    const timeout = setTimeout(() => {
      cleanup();
      iframe.remove();
      reject(new Error("Toy did not draw within two minutes."));
    }, 120000);
    signal.addEventListener("abort", abort, { once: true });
    iframe.src = url.href;
    $("#preview").replaceChildren(iframe);
    if (signal.aborted) abort();
  });
}

$("#start").addEventListener("click", async () => {
  controller = new AbortController();
  const { signal } = controller;
  rows = [];
  metadata = {
    started: new Date().toISOString(),
    userAgent: navigator.userAgent,
    page: location.href,
    deviceScaleFactor: devicePixelRatio,
    durationMs,
    cache: "Browser-managed; not forced cold",
    heap: "Live JS heap where supported; may include the parent page, excludes GPU memory",
    preferences: "Temporary empty preferences per toy; saved settings preserved",
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  };
  $("#environment").textContent = `${metadata.userAgent}; device scale ${devicePixelRatio}.`;
  $("#start").disabled = true;
  $("#stop").disabled = false;
  $("#preview").classList.add("running");
  const stopOnHide = () => {
    if (document.hidden) controller.abort();
  };
  document.addEventListener("visibilitychange", stopOnHide);
  render();
  try {
    const ids =
      params.get("ids")?.split(",") ||
      (await (await fetch("./phone-speed-slowest.json")).json()).ids;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 30 ||
      ids.some((id) => !TOYS.some((t) => t.id === id))
    )
      throw new Error("The benchmark list is invalid.");
    for (const id of ids) {
      if (signal.aborted) break;
      const toy = TOYS.find((t) => t.id === id);
      $("[role=status]").textContent =
        `${rows.length + 1} of ${ids.length}: ${toy.label}. Keep this tab visible.`;
      let opened;
      try {
        opened = await openToy(toy, signal);
        const row = await measurePhoneToy(opened.win, { durationMs, signal });
        rows.push({
          ...row,
          firstViewProbe: opened.win.__phoneSpeedFirstView.path || "loaded-splat-signal",
          label: toy.label,
          errors: opened.errors,
          browserNotifications: opened.browserNotifications,
          measuredAt: new Date().toISOString(),
        });
      } catch (e) {
        if (e.name === "AbortError") break;
        rows.push({ id, label: toy.label, error: e.message });
      } finally {
        opened?.iframe.remove();
      }
      render();
    }
    $("[role=status]").textContent = signal.aborted
      ? `Stopped. ${rows.length} results retained. Hidden tabs stop the run.`
      : `Complete. ${rows.length} toys checked; ${rows.filter((r) => r.error || r.errors?.length).length} errors. ${rows.reduce((sum, r) => sum + (r.browserNotifications?.length || 0), 0)} browser notifications retained in JSON. Copy the table or save the local JSON.`;
  } catch (e) {
    $("[role=status]").textContent = `Could not run: ${e.message}`;
  } finally {
    document.removeEventListener("visibilitychange", stopOnHide);
    $("#preview").replaceChildren();
    $("#preview").classList.remove("running");
    $("#start").disabled = false;
    $("#stop").disabled = true;
    render();
  }
});
$("#stop").addEventListener("click", () => controller?.abort());
$("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#results").value);
    $("[role=status]").textContent = "Table copied.";
  } catch {
    $("#results").focus();
    $("#results").select();
    $("[role=status]").textContent = "Select and copy the table below.";
  }
});
$("#save").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([$("#json").value], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "splashery-phone-speed.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
