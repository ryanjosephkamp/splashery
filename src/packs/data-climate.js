// Lane Data and climate (docs/handoff/DataClimate.md): two labs toys.
//
// - Data in 3D (Studio): open a CSV or TSV from this device (nothing is
//   uploaded), pick the columns for X, Y, Z, color and size, and see a 3D
//   scatter, bars or a surface with axes, ticks and labels that turn to face
//   you. Three small sample tables ship with it. A tap drops the marks to the
//   floor and lets them rise back into place. The panel saves a picture (PNG)
//   or a turning video (WebM) to a file you choose.
// - Climate records (Science): dated snapshots of NOAA's Mauna Loa CO2 record
//   as a rising spiral, one turn a year, and NASA's GISTEMP temperature
//   anomalies as a field of monthly bars or a wall of yearly stripes. A tap
//   draws the CO2 record again from May 1974, or lets the bars rise again.
//   Nothing is fetched live; the source and the date show beside each chart.

import { readTable, describeColumn } from "../datavis/csv.js";
import { buildPlot, resolvePicks, CHARTS, COUNT, NONE, maxPoints } from "../datavis/plot.js";
import { faceLabels } from "../datavis/text.js";
import { readCO2, readGistemp, co2Spiral, temperatureBars, temperatureWall } from "../datavis/climate.js"; // prettier-ignore

const exportsJS = () => import("../exports.js");

async function readAsset(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return (await fs.readFile(url)).toString("utf8");
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return r.text();
}

// ---- Snapshots ---------------------------------------------------------------------------
// The dates the snapshots were taken (tools/dcl-snapshots.mjs), and what each
// one covers; they show beside the charts and in the Toy tab.
export const SNAPSHOTS = {
  co2: {
    file: "../../assets/toys/climate-records/co2-mlo-monthly.csv",
    taken: "October 5, 2026",
    source: "NOAA Global Monitoring Laboratory, Mauna Loa monthly mean CO2 (file of September 5, 2026)", // prettier-ignore
    caption: "NOAA GML · SNAPSHOT OCT 5, 2026",
  },
  gistemp: {
    file: "../../assets/toys/climate-records/gistemp-v4-global.csv",
    taken: "October 5, 2026",
    source: "NASA GISS, GISTEMP v4 Land-Ocean Temperature Index (accessed October 5, 2026)",
    caption: "NASA GISS GISTEMP V4 · SNAPSHOT OCT 5, 2026",
  },
};

// ---- Data in 3D --------------------------------------------------------------------------

export const SAMPLES = [
  {
    id: "earthquakes",
    label: "Earthquakes, past 30 days (USGS)",
    file: "../../assets/toys/data-in-3d/earthquakes-usgs.csv",
    chart: "scatter",
    picks: { x: "longitude", y: "depth", z: "latitude", color: "mag", size: "mag" },
    flipY: true,
    title: "EARTHQUAKES, MAGNITUDE 4.5+",
    caption: "USGS · SEP 5 – OCT 5, 2026",
  },
  {
    id: "iris",
    label: "Iris flowers (Fisher, UCI)",
    file: "../../assets/toys/data-in-3d/iris-uci.csv",
    chart: "scatter",
    picks: { x: "petal length (cm)", y: "petal width (cm)", z: "sepal length (cm)", color: "species", size: "sepal width (cm)" }, // prettier-ignore
    title: "150 IRIS FLOWERS",
    caption: "FISHER 1936 · UCI REPOSITORY",
  },
  {
    id: "co2",
    label: "CO2 at Mauna Loa by month (NOAA)",
    file: SNAPSHOTS.co2.file,
    chart: "bars",
    picks: { x: "year", y: "average", z: "month", color: NONE, size: NONE },
    title: "CO₂ AT MAUNA LOA, PPM",
    caption: "NOAA GML · MAY 1974 – AUG 2026",
  },
];

// The open table: a sample (cached) or the person's own file, kept only in
// this page's memory. A #s= link to "custom" falls back to the first sample.
const DATA = { cache: new Map(), custom: null, shown: null, report: null, options: null, error: "" }; // prettier-ignore

export async function loadSample(id) {
  const def = SAMPLES.find((s) => s.id === id) || SAMPLES[0];
  if (!DATA.cache.has(def.id)) {
    const text = await readAsset(def.file);
    DATA.cache.set(def.id, readTable(text, def.file.split("/").pop()));
  }
  return { def, table: DATA.cache.get(def.id) };
}

// The person's own file: read here, never sent anywhere.
export function openTable(text, fileName) {
  const table = readTable(text, fileName);
  DATA.custom = { table, name: fileName };
  return table;
}

function tableFor(o) {
  if (o.table === "custom" && DATA.custom) return { def: null, table: DATA.custom.table, custom: true }; // prettier-ignore
  const def = SAMPLES.find((s) => s.id === o.table) || SAMPLES[0];
  return { def, table: DATA.cache.get(def.id), custom: false };
}

const dropCurve = (c) => {
  // c.rise is the pulse (1 at the tap, easing to 0). The marks fall to the
  // floor in the first quarter, wait, and rise back with a small overshoot.
  if (!(c > 0 && c < 1)) return 0;
  const p = 1 - c;
  if (p < 0.22) return (p / 0.22) ** 2;
  if (p < 0.34) return 1;
  const s = Math.min(1, (p - 0.34) / 0.6);
  return (1 - s) ** 3 - 0.06 * Math.sin(Math.PI * s) * s;
};

let lastResortView = null;
function faceAndResort(out, info) {
  const labels = info.data?.labels;
  if (!labels?.length) return;
  out.tokens = faceLabels(labels, info.view);
  // The labels' splats were sorted facing the front; sort them again as the
  // view goes round, so each label's letters stay in front of its rim.
  if (info.view !== null && info.view !== undefined) {
    const d = lastResortView === null ? Infinity : Math.abs(Math.atan2(Math.sin(info.view - lastResortView), Math.cos(info.view - lastResortView))); // prettier-ignore
    if (d > 0.35) {
      out.resort = true;
      lastResortView = info.view;
    }
  }
}

// ---- The Data in 3D panel ----------------------------------------------------------------

let panel = null;

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) if (k !== null && k !== undefined) e.append(k);
  return e;
}

const app = () => globalThis.__splashery?.app;

function renderPanel() {
  const box = el("div", { className: "dcl-panel", id: "dcl-panel" });
  const tableRow = el("label", { className: "row" }, el("span", { textContent: "Table" }));
  const tableSel = el("select", { id: "dcl-table" });
  tableRow.append(tableSel);
  tableSel.addEventListener("change", () => app()?.setToyOptions({ table: tableSel.value, x: "", y: "", z: "", color: "", size: "", chart: "", flip: "" })); // prettier-ignore
  const chartRow = el("div", { className: "button-row", id: "dcl-chart" });
  const chartButtons = CHARTS.map((c) => {
    const b = el("button", { type: "button", textContent: c.label, id: `dcl-chart-${c.id}` });
    b.addEventListener("click", () => app()?.setToyOptions({ chart: c.id }));
    chartRow.append(b);
    return [c.id, b];
  });
  const picks = {};
  const pickRows = el("div", { className: "dcl-picks" });
  for (const [key, label] of [
    ["x", "X (across)"],
    ["y", "Y (up)"],
    ["z", "Z (depth)"],
    ["color", "Color"],
    ["size", "Size"],
  ]) {
    // prettier-ignore
    const sel = el("select", { id: `dcl-${key}` });
    sel.addEventListener("change", () => app()?.setToyOptions({ [key]: sel.value }));
    pickRows.append(el("label", { className: "row" }, el("span", { textContent: label }), sel));
    picks[key] = sel;
  }
  const flip = el("input", { type: "checkbox", className: "switch", id: "dcl-flip" });
  flip.setAttribute("role", "switch");
  flip.addEventListener("change", () => app()?.setToyOptions({ flip: flip.checked ? "1" : "0" }));
  const flipRow = el("label", { className: "check-row" }, flip, el("span", { textContent: "Flip Y (bigger values lower, like depth)" })); // prettier-ignore
  const info = el("p", { className: "note", id: "dcl-info" });
  info.setAttribute("role", "status");
  const cols = el("details", { className: "dcl-columns" }, el("summary", { textContent: "Columns in this table" })); // prettier-ignore
  const colList = el("ul", { id: "dcl-columns" });
  cols.append(colList);
  const saveRow = el("div", { className: "button-row" });
  const png = el("button", {
    type: "button",
    id: "dcl-save-png",
    textContent: "Save a picture (PNG)",
  });
  const webm = el("button", { type: "button", id: "dcl-save-webm", textContent: "Save a turning video (WebM)" }); // prettier-ignore
  png.addEventListener("click", () => savePicture());
  webm.addEventListener("click", () => saveVideo());
  saveRow.append(png, webm);
  box.append(tableRow, chartRow, pickRows, flipRow, info, cols, saveRow);
  panel = {
    refresh() {
      const o = DATA.options || {};
      const { table } = tableFor(o);
      tableSel.textContent = "";
      for (const s of SAMPLES) tableSel.add(new Option(s.label, s.id));
      if (DATA.custom) tableSel.add(new Option(`Your file: ${DATA.custom.name}`, "custom"));
      tableSel.value = o.table === "custom" && DATA.custom ? "custom" : SAMPLES.some((s) => s.id === o.table) ? o.table : SAMPLES[0].id; // prettier-ignore
      const chart = DATA.chart || "scatter";
      for (const [id, b] of chartButtons) {
        b.setAttribute("aria-pressed", String(id === chart));
        b.classList.toggle("primary", id === chart);
      }
      const cur = DATA.picks || {};
      const usable = (table?.columns || []).filter((c) => c.type !== "text");
      for (const [key, sel] of Object.entries(picks)) {
        sel.textContent = "";
        if (key === "y" && chart !== "scatter") sel.add(new Option("How many rows (count)", COUNT));
        if (key === "z" || key === "color" || key === "size") sel.add(new Option("None", NONE));
        for (const c of usable) {
          if (key === "size" && c.type === "category") continue;
          sel.add(new Option(c.name, c.name));
        }
        sel.value = cur[key] ?? "";
        sel.closest(".row").hidden = key === "size" && chart !== "scatter";
      }
      flip.checked = !!DATA.flipY;
      flipRow.hidden = chart !== "scatter";
      info.textContent = DATA.error || describe();
      colList.textContent = "";
      for (const c of table?.columns || [])
        colList.append(el("li", { textContent: `${c.name}: ${describeColumn(c)}` }));
    },
  };
  panel.refresh();
  return box;
}

function describe() {
  const r = DATA.report;
  const o = DATA.options || {};
  const { table, custom } = tableFor(o);
  if (!r || !table) return "";
  const n = (x) => x.toLocaleString("en-US");
  const what = custom ? `Your file has ${n(table.rows)} rows` : `${n(table.rows)} rows`;
  const parts = [`${what} and ${table.columns.length} columns.`];
  if (r.chart === "scatter") {
    if (r.sampled)
      parts.push(`That's more than a phone can draw smoothly, so this shows an even random sample of ${n(r.shown)} points (the same ones each time).`); // prettier-ignore
    else parts.push(`Showing all ${n(r.shown)} points.`);
    if (r.skipped) parts.push(`${n(r.skipped)} rows have a missing value in X, Y or Z and are left out.`); // prettier-ignore
  } else {
    parts.push(`Every row is counted: ${n(r.shown)} ${r.chart === "bars" ? "bars" : "cells"}, each the mean of the rows that fall in it.`); // prettier-ignore
    if (r.skipped) parts.push(`${n(r.skipped)} rows have a missing value and are left out.`);
    if (r.base) parts.push(`The values are far from zero, so the Y axis starts at ${r.base}.`);
  }
  if (custom) parts.push("It stays on this device.");
  else if (o.table === "custom")
    parts.push("Your file isn't open in this page, so a sample shows.");
  return parts.join(" ");
}

// ---- Saving ------------------------------------------------------------------------------
// To a file the person chooses where the browser can (showSaveFilePicker);
// elsewhere the browser's own download (on a phone, its save or share sheet).

async function chooseFile(name, type, ext) {
  if (typeof window.showSaveFilePicker !== "function") return null;
  try {
    return await window.showSaveFilePicker({ suggestedName: name, types: [{ description: ext.toUpperCase(), accept: { [type]: [`.${ext}`] } }] }); // prettier-ignore
  } catch (err) {
    if (err?.name === "AbortError") return false;
    return null;
  }
}

async function write(handle, blob, name) {
  const { downloadBlob } = await exportsJS();
  if (handle) {
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
  } else downloadBlob(blob, name);
}

export async function savePicture() {
  const a = app();
  if (!a) return null;
  const { timestampName, canvasToBlob } = await exportsJS();
  const name = timestampName("png", "splashery-data");
  const handle = await chooseFile(name, "image/png", "png");
  if (handle === false) return null;
  return a.withBusy("Taking a picture…", async () => {
    const shot = await a.player.stage.captureFrame();
    const blob = await canvasToBlob(shot);
    await write(handle, blob, name);
    a.ui.toast("Picture saved.");
    return blob;
  });
}

export async function saveVideo(seconds = 6) {
  const a = app();
  if (!a) return null;
  const { timestampName, recordWebM, webmSupport } = await exportsJS();
  const wm = webmSupport();
  if (!wm.ok) {
    a.ui.toast(`Can't make a video here: ${wm.reason}`, 5000);
    return null;
  }
  const name = timestampName("webm", "splashery-data");
  const handle = await chooseFile(name, "video/webm", "webm");
  if (handle === false) return null;
  const player = a.player;
  return a.withBusy("Recording a video…", (progress) =>
    a.withCapture([720, 720], async (base) => {
      const blob = await recordWebM({
        canvas: player.stage.canvas,
        seconds,
        mime: wm.mime,
        onProgress: (f) => progress(f, "Recording a video…"),
        drawFrame: (t) => player.renderAt(base.time + t * seconds, { ...base.cam, yaw: base.cam.yaw + t * Math.PI * 2 }), // prettier-ignore
      });
      await write(handle, blob, name);
      a.ui.toast("Video saved.");
      return blob;
    }),
  );
}

// ---- Recipes -----------------------------------------------------------------------------

const RISE = { key: "rise", label: "Drop and rise", type: "pulse", ease: 2.4 };

export const RECIPES = {
  "data-in-3d": {
    alive: true,
    turntable: true,
    options: [
      { key: "table", label: "Table", type: "text", default: "earthquakes", hidden: true },
      { key: "chart", label: "Chart", type: "text", default: "", hidden: true },
      { key: "x", label: "X", type: "text", default: "", hidden: true },
      { key: "y", label: "Y", type: "text", default: "", hidden: true },
      { key: "z", label: "Z", type: "text", default: "", hidden: true },
      { key: "color", label: "Color", type: "text", default: "", hidden: true },
      { key: "size", label: "Size", type: "text", default: "", hidden: true },
      { key: "flip", label: "Flip Y", type: "text", default: "", hidden: true },
    ],
    controls: [RISE],
    action: { key: "rise", label: "Drop and rise" },
    input: {
      title: "Your table",
      fileButton: "Open a CSV or TSV…",
      accept: ".csv,.tsv,.tab,.txt,text/csv,text/tab-separated-values,text/plain",
      note: "A table saved from a spreadsheet as CSV or TSV, with a header row if it has one. It is read on this device and never uploaded. Pick the columns below; dates, categories and missing cells are understood.", // prettier-ignore
      live: [{ render: renderPanel }],
      async read(text, fileName) {
        openTable(text, fileName || "your table");
        return { table: "custom", chart: "", x: "", y: "", z: "", color: "", size: "", flip: "" };
      },
      shown: () => (DATA.custom ? `Open: ${DATA.custom.name}` : ""),
    },
    credits: [
      { label: "Sample table", title: "Earthquakes of magnitude 4.5 and up, past 30 days (snapshot of October 5, 2026)", source: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/csv.php", author: "U.S. Geological Survey", license: "Public domain (U.S. government work)", licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits" }, // prettier-ignore
      { label: "Sample table", title: "Iris (Fisher, 1936)", source: "https://archive.ics.uci.edu/dataset/53/iris", author: "R. A. Fisher; UCI Machine Learning Repository", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" }, // prettier-ignore
      { label: "Sample table", title: "Mauna Loa monthly mean CO2, May 1974 to August 2026 (snapshot of October 5, 2026)", source: "https://gml.noaa.gov/ccgg/trends/data.html", author: "NOAA Global Monitoring Laboratory", license: "Public domain (U.S. government work)", licenseUrl: "https://gml.noaa.gov/about/disclaimer.html" }, // prettier-ignore
    ],
    async prepare(o) {
      DATA.error = "";
      if (o.table === "custom" && DATA.custom) return;
      await loadSample(o.table === "custom" ? SAMPLES[0].id : o.table);
    },
    drive(t, c, out, info) {
      out.morph = [dropCurve(c.rise ?? 0), 0, 0, 0];
      faceAndResort(out, info);
    },
    build(k, o) {
      let { def, table, custom } = tableFor(o);
      if (!table) ({ def, table } = { def: SAMPLES[0], table: DATA.cache.get(SAMPLES[0].id) });
      const chart = CHARTS.some((x) => x.id === o.chart) ? o.chart : def?.chart || "scatter";
      const given = { x: o.x, y: o.y, z: o.z, color: o.color, size: o.size };
      const picks = resolvePicks(table, given, custom ? {} : def?.picks || {}, chart);
      const flipY = o.flip === "1" || (o.flip !== "0" && !custom && !!def?.flipY && picks.y === def.picks.y); // prettier-ignore
      DATA.options = { ...o };
      DATA.chart = chart;
      DATA.picks = picks;
      DATA.flipY = flipY && chart === "scatter";
      DATA.error = "";
      try {
        DATA.report = buildPlot(k, table, picks, {
          chart,
          flipY: DATA.flipY,
          title: custom ? DATA.custom.name.replace(/\.[a-z]+$/i, "").toUpperCase() : def.title,
          caption: custom ? "YOUR TABLE · ON THIS DEVICE" : def.caption,
        });
      } catch (err) {
        DATA.error = err.message;
        DATA.report = buildPlot(k, table, resolvePicks(table, {}, {}, "scatter"), { chart: "scatter" }); // prettier-ignore
      }
      DATA.report.max = maxPoints(k.count);
      Promise.resolve().then(() => panel?.refresh());
    },
  },

  "climate-records": {
    alive: true,
    options: [
      {
        key: "view",
        label: "Record",
        type: "select",
        default: "co2",
        choices: [
          { id: "co2", label: "CO2 at Mauna Loa (spiral)" },
          { id: "months", label: "Temperature, every month (bars)" },
          { id: "years", label: "Temperature, year by year (wall)" },
        ],
      },
    ],
    controls: [{ key: "play", label: "Play the record", type: "pulse", ease: 9 }],
    action: { key: "play", label: "Play the record" },
    get note() {
      const s = CLIMATE.view === "co2" ? SNAPSHOTS.co2 : SNAPSHOTS.gistemp;
      const what =
        CLIMATE.view === "co2"
          ? "Monthly mean CO2 in parts per million, May 1974 to August 2026: one turn a year, January in front. The coil leans toward May, when the air holds the most CO2 before northern plants draw it down. NOAA's record starts in March 1958, but its months before May 1974 come from the Scripps Institution of Oceanography, whose terms don't allow reuse here, so they are left out."
          : "Global surface temperature anomalies in °C, compared with the 1951–1980 mean, from January 1880 to August 2026.";
      return `${what} Source: ${s.source}; a snapshot taken ${s.taken}, not fetched live.`;
    },
    credits: [
      { label: "Data", title: "Trends in Atmospheric Carbon Dioxide: Mauna Loa monthly mean CO2, May 1974 to August 2026 (snapshot of October 5, 2026)", source: "https://gml.noaa.gov/ccgg/trends/data.html", author: "Xin Lan, Pieter Tans and Kirk W. Thoning, NOAA Global Monitoring Laboratory", license: "Public domain (U.S. government work)", licenseUrl: "https://gml.noaa.gov/about/disclaimer.html" }, // prettier-ignore
      { label: "Data", title: "GISS Surface Temperature Analysis (GISTEMP), version 4, accessed October 5, 2026; Lenssen et al. (2024), JGR Atmospheres", source: "https://data.giss.nasa.gov/gistemp/", author: "GISTEMP Team, NASA Goddard Institute for Space Studies", license: "Public domain (U.S. government work)", licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/" }, // prettier-ignore
    ],
    async prepare(o) {
      if (o.view === "co2") {
        CLIMATE.co2 ||= readCO2(await readAsset(SNAPSHOTS.co2.file));
      } else CLIMATE.temp ||= readGistemp(await readAsset(SNAPSHOTS.gistemp.file));
    },
    drive(t, c, out, info) {
      const d = info.data;
      const p = c.play ?? 0;
      if (d?.view === "co2") {
        // The record draws itself again from May 1974, behind a bright bead.
        const on = p > 0 && p < 1;
        const s = on ? Math.min(1, (1 - p) / 0.92) : 1;
        const e = on ? s * s * (3 - 2 * s) * 0.15 + s * 0.85 : 1;
        out.morph = [on ? e : 1.02, 0, 0, 0];
        faceAndResort(out, info);
        const at = d.curve(Math.min(1, e));
        out.tokens ||= [];
        out.tokens[d.bead] = {
          offset: [at[0] - d.b0[0], at[1] - d.b0[1], at[2] - d.b0[2]],
          visible: on && s < 1 ? 1 : 0,
        };
      } else {
        // The bars sink to zero and grow back (in 2.4 of the 9 seconds).
        const q = p > 0 && p < 1 ? Math.min(1, (1 - p) / 0.27) : 1;
        out.morph = [q < 1 ? dropCurve(1 - q) : 0, 0, 0, 0];
        faceAndResort(out, info);
      }
    },
    build(k, o) {
      CLIMATE.view = o.view;
      if (o.view === "co2") co2Spiral(k, CLIMATE.co2, { source: SNAPSHOTS.co2.caption });
      else if (o.view === "months")
        temperatureBars(k, CLIMATE.temp, { source: SNAPSHOTS.gistemp.caption }); // prettier-ignore
      else temperatureWall(k, CLIMATE.temp, { source: SNAPSHOTS.gistemp.caption });
    },
  },
};

export const CLIMATE = { view: "co2", co2: null, temp: null };
