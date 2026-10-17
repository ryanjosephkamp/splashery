import { MeshWorker } from "./client.js";
import { PROFILES } from "./reconstruct.js";
import { meshPreview } from "./preview.js";
import { zipStored } from "../viewers/splat-io.js";
import { TOYS } from "../toys.js";

const el = (tag, text = "") => {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
};
const fmt = (n) => Math.round(n).toLocaleString("en-US");
export function deviceProfile() {
  return typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches &&
    Math.min(screen.width, screen.height) < 820
    ? "phone"
    : "desktop";
}

export function renderMeshPanel() {
  const profile = deviceProfile(),
    limits = PROFILES[profile],
    fine = profile === "desktop";
  const box = el("div");
  box.id = "mesh-panel";
  box.style.cssText = "display:grid;gap:10px;min-width:0;max-width:100%";
  const intro = el(
    "p",
    "Open a splat file, or enter a built-in toy ID. Conversion stays on this device. The preview below draws the actual triangles.",
  );
  intro.className = "note";
  const file = el("input");
  file.id = "mesh-file";
  file.type = "file";
  file.accept = ".ply,.splat,.spz,.sog,.json,.webp";
  file.multiple = true;
  file.setAttribute("aria-label", "Open splat files");
  file.style.width = "100%";
  const toy = el("input");
  toy.id = "mesh-toy";
  toy.value = "torus";
  toy.placeholder = "Built-in toy ID, such as torus";
  const toyList = el("datalist");
  toyList.id = "mesh-toys";
  toy.setAttribute("list", toyList.id);
  for (const def of TOYS)
    if (def.id !== "splats-to-mesh") {
      const option = el("option", def.label);
      option.value = def.id;
      toyList.append(option);
    }
  box.append(toyList);
  const row = (caption, input) => {
    const label = el("label", caption);
    label.style.cssText = "display:grid;gap:4px;min-width:0";
    label.append(input);
    box.append(label);
    return input;
  };
  box.append(intro);
  row("Splat file (.sog, .ply, .splat, or .spz)", file);
  row("Or use a built-in toy ID", toy);
  const selected = el("p", "Source: torus (default options, at rest).");
  selected.className = "note";
  box.append(selected);
  const quality = el("select");
  quality.id = "mesh-quality";
  for (const [value, label] of [
    ["balanced", "Balanced"],
    ["fine", "Fine (more detail)"],
  ]) {
    const option = el("option", label);
    option.value = value;
    quality.append(option);
  }
  quality.value = fine ? "fine" : "balanced";
  row("Quality", quality);
  const number = (id, label, value, min, max, step = 1) => {
    const input = el("input");
    input.type = "number";
    input.id = id;
    input.value = value;
    input.min = min;
    input.max = max;
    input.step = step;
    row(label, input);
    return input;
  };
  const resolution = number(
    "mesh-resolution",
    "Grid resolution",
    fine ? limits.maxResolution : limits.resolution,
    16,
    limits.maxResolution,
  );
  const level = number(
    "mesh-level",
    "Density level (lower keeps more)",
    fine ? 1 : 0.5,
    0.01,
    100,
    0.05,
  );
  const budget = number(
    "mesh-budget",
    "Maximum triangles",
    limits.triangleBudget,
    500,
    profile === "phone" ? 80000 : 500000,
    500,
  );
  const smoothing = number("mesh-smoothing", "Smoothing passes", 3, 0, 10);
  const floaters = el("input");
  floaters.type = "checkbox";
  floaters.checked = true;
  floaters.id = "mesh-floaters";
  row("Remove small disconnected pieces", floaters);
  const print = el("input");
  print.type = "checkbox";
  print.id = "mesh-print";
  print.checked = fine;
  row("Ready to print (solid, with topology checks)", print);
  const size = number("mesh-size", "Longest print dimension (mm)", 100, 5, 1000);
  const printNote = el(
    "p",
    "Print mode fills enclosed cavities and thickens features. It checks edges, vertex links, and sampled wall thickness. Unsampled regions still need a slicer check. Small details and hollow spaces can change.",
  );
  printNote.className = "note";
  box.append(printNote);
  const ownLicense = el("input");
  ownLicense.type = "text";
  ownLicense.id = "mesh-source-license";
  ownLicense.placeholder = "Original license and attribution, if known";
  row("Your file's license and attribution", ownLicense);
  const ownSource = el("input");
  ownSource.type = "text";
  ownSource.id = "mesh-source-url";
  ownSource.placeholder = "Original source URL, if known";
  row("Your file's source", ownSource);
  const advanced = el("details");
  const summary = el("summary", "Density, triangle budget, and attribution");
  advanced.append(summary);
  for (const control of [resolution, level, budget, smoothing, floaters, ownLicense, ownSource])
    advanced.append(control.parentElement);
  box.insertBefore(advanced, print.parentElement);
  const controls = el("div");
  controls.className = "button-row";
  const convert = el("button", "Convert to mesh");
  convert.id = "mesh-convert";
  convert.type = "button";
  const cancel = el("button", "Cancel");
  cancel.id = "mesh-cancel";
  cancel.type = "button";
  cancel.disabled = true;
  controls.append(convert, cancel);
  const progress = el("progress");
  progress.id = "mesh-progress";
  progress.max = 1;
  progress.value = 0;
  progress.style.width = "100%";
  progress.setAttribute("aria-label", "Mesh conversion progress");
  const status = el("p", "Choose a source, then convert.");
  status.id = "mesh-status";
  status.className = "note";
  status.setAttribute("role", "status");
  const report = el("p");
  report.id = "mesh-report";
  report.className = "note";
  report.style.whiteSpace = "pre-line";
  const canvas = el("canvas");
  canvas.id = "mesh-preview";
  canvas.width = 600;
  canvas.height = 400;
  canvas.hidden = true;
  canvas.style.cssText =
    "width:100%;max-width:100%;height:auto;touch-action:none;border-radius:8px";
  canvas.setAttribute("aria-label", "Triangle mesh preview. Drag to turn it.");
  const hint = el(
    "p",
    "Drag the mesh preview to turn it. GLB keeps vertex color. OBJ includes MTL and vertex color (support varies by viewer). STL has no color.",
  );
  hint.className = "note";
  const saveRow = el("div");
  saveRow.className = "button-row";
  const format = el("select");
  format.id = "mesh-format";
  format.setAttribute("aria-label", "Mesh export format");
  for (const [value, label] of [
    ["glb", "GLB (color)"],
    ["obj", "OBJ + MTL (ZIP)"],
    ["stl", "STL (no color)"],
  ]) {
    const option = el("option", label);
    option.value = value;
    format.append(option);
  }
  const save = el("button", "Save mesh…");
  save.type = "button";
  save.id = "mesh-save";
  save.disabled = true;
  saveRow.append(format, save);
  const license = el(
    "p",
    "The exported mesh keeps its source's license. Your files are never uploaded.",
  );
  license.id = "mesh-license";
  license.className = "note";
  const author = el("p", "Made by Ryan with Codex (GPT-6). MIT code and CC0 original geometry.");
  author.className = "note";
  box.append(controls, progress, status, report, canvas, hint, saveRow, license, author);

  const worker = new MeshWorker(),
    urls = new Set();
  let mode = "toy",
    generation = 0,
    previewOff = null,
    metadata = null,
    disposed = false;
  function clear() {
    generation++;
    worker.cancel();
    previewOff?.();
    previewOff = null;
    save.disabled = true;
    convert.disabled = false;
    cancel.disabled = true;
    canvas.hidden = true;
    report.textContent = "";
    progress.value = 0;
    metadata = null;
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }
  const invalidate = () => {
    clear();
    status.textContent = "Settings changed. Convert again to update the mesh.";
  };
  file.onchange = () => {
    clear();
    ownLicense.value = "";
    ownSource.value = "";
    mode = "file";
    selected.textContent = `Source: ${[...file.files].map((f) => f.name).join(", ") || "choose a file"}`;
    status.textContent = "File selected. Convert to make a mesh.";
  };
  toy.oninput = () => {
    clear();
    mode = "toy";
    selected.textContent = `Source: ${toy.value} (default options, at rest).`;
    status.textContent = "Toy selected. Convert to make a mesh.";
  };
  for (const input of [
    resolution,
    level,
    budget,
    smoothing,
    floaters,
    print,
    size,
    ownLicense,
    ownSource,
  ])
    input.addEventListener("input", invalidate);
  quality.onchange = () => {
    resolution.value = quality.value === "fine" ? limits.maxResolution : limits.resolution;
    level.value = quality.value === "fine" ? 1 : 0.5;
    invalidate();
  };
  cancel.onclick = () => {
    clear();
    status.textContent = "Canceled. Choose a source and convert again.";
  };
  convert.onclick = async () => {
    clear();
    const token = generation;
    convert.disabled = true;
    cancel.disabled = false;
    status.textContent = "Starting conversion…";
    try {
      let source;
      if (mode === "file") {
        const files = [...file.files],
          main =
            files.find((f) => /\.(sog|ply|splat|spz)$/i.test(f.name)) ||
            files.find((f) => /meta\.json$/i.test(f.name));
        if (!main)
          throw new Error(
            "Choose a .sog, .ply, .splat, or .spz file (or SOG meta.json with its pictures).",
          );
        source = {
          kind: "file",
          file: main,
          files,
          license: ownLicense.value,
          source: ownSource.value,
        };
      } else source = { kind: "toy", id: toy.value.trim() };
      const options = {
        profile,
        resolution: Number(resolution.value),
        level: Number(level.value),
        triangleBudget: Number(budget.value),
        smoothIterations: Number(smoothing.value),
        minComponent: floaters.checked ? 0.002 : 0,
        readyToPrint: print.checked,
        printSize: Number(size.value),
      };
      const result = await worker.call("convert", { source, options }, (fraction, text) => {
        if (token === generation && !disposed) {
          progress.value = fraction;
          status.textContent = text;
        }
      });
      if (token !== generation || disposed) return;
      const r = result.report;
      metadata = result.metadata;
      status.textContent = "Mesh ready. Drag the preview to inspect it, then save.";
      report.textContent = `${fmt(r.triangles)} triangles, ${fmt(r.vertices)} vertices, ${fmt(r.sampledSplats)} splats sampled.\n${r.topology.watertight ? "Watertight" : "Open surface"}; ${r.topology.manifold ? "manifold" : "nonmanifold"}. ${r.units === "mm" ? `${r.printSize} mm longest dimension.` : "Source units; choose Ready to print to set millimeters."}\n${r.warnings.join(" ")}`;
      if (r.thicknessCheck)
        report.textContent += `\nSampled minimum wall: ${r.thicknessCheck.minimumMm === null ? "not measurable" : `${r.thicknessCheck.minimumMm.toFixed(2)} mm`}. ${r.printable ? "Sampled print checks passed." : "Not ready to print."}`;
      license.textContent = [
        metadata.title || metadata.name,
        metadata.author,
        metadata.license,
        metadata.source,
        ...(metadata.credits || []).map((c) =>
          [c.title, c.author, c.license, c.source].filter(Boolean).join(" · "),
        ),
      ]
        .filter(Boolean)
        .join(" · ");
      canvas.hidden = false;
      previewOff = meshPreview(canvas, result.preview);
      save.disabled = false;
      progress.value = 1;
    } catch (e) {
      if (token === generation && !disposed) status.textContent = e.message;
    } finally {
      if (token === generation && !disposed) {
        convert.disabled = false;
        cancel.disabled = true;
      }
    }
  };
  save.onclick = async () => {
    const token = generation;
    save.disabled = true;
    try {
      const { files } = await worker.call("save", { format: format.value });
      if (token !== generation || disposed) return;
      const download =
        files.length > 1
          ? {
              name: files[0].name.replace(/\.obj$/, "-obj.zip"),
              bytes: zipStored(files.map((f) => [f.name, f.bytes])),
              type: "application/zip",
            }
          : files[0];
      const url = URL.createObjectURL(new Blob([download.bytes], { type: download.type }));
      urls.add(url);
      const a = el("a");
      a.href = url;
      a.download = download.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.delete(url);
      }, 10000);
    } catch (e) {
      if (token === generation && !disposed) status.textContent = e.message;
    } finally {
      if (token === generation && !disposed) save.disabled = false;
    }
  };
  // The existing custom-panel hook has no teardown callback. Observe removal so
  // changing toys/tabs immediately terminates work and releases the retained mesh.
  const observer = new MutationObserver(() => {
    if (!box.isConnected) {
      disposed = true;
      clear();
      observer.disconnect();
    }
  });
  queueMicrotask(() => {
    if (box.isConnected) observer.observe(document.body, { childList: true, subtree: true });
  });
  return box;
}
