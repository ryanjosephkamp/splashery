// DOM wiring for the control panel, bottom sheet, toasts and progress.
// The app owns state; this module reflects it and forwards user intent.

import {
  SWATCHES,
  TEMPLATE_LABELS,
  sliderToBrushSize,
  brushSizeToSlider,
  RESOLUTIONS,
} from "./state.js";

const $ = (id) => document.getElementById(id);

export function createUI(app) {
  const els = {
    panel: $("panel"),
    panelBody: $("panel-body"),
    sheetToggle: $("sheet-toggle"),
    modePaint: $("mode-paint"),
    modeOrbit: $("mode-orbit"),
    color: $("brush-color"),
    swatches: document.querySelector(".swatches"),
    size: $("brush-size"),
    sizeValue: $("brush-size-value"),
    wetness: $("brush-wetness"),
    wetnessValue: $("brush-wetness-value"),
    opacity: $("brush-opacity"),
    opacityValue: $("brush-opacity-value"),
    dryTime: $("dry-time"),
    dryTimeValue: $("dry-time-value"),
    viscosity: $("viscosity"),
    viscosityValue: $("viscosity-value"),
    undo: $("undo"),
    clear: $("clear"),
    resetCamera: $("reset-camera"),
    template: $("template"),
    seed: $("seed"),
    randomize: $("randomize"),
    resolution: $("resolution"),
    resolutionNote: $("resolution-note"),
    exposure: $("exposure"),
    exposureValue: $("exposure-value"),
    lightAngle: $("light-angle"),
    lightAngleValue: $("light-angle-value"),
    exportJson: $("export-json"),
    importJson: $("import-json"),
    gifFrames: $("gif-frames"),
    gifSize: $("gif-size"),
    exportGif: $("export-gif"),
    webmRow: $("webm-row"),
    webmSeconds: $("webm-seconds"),
    exportWebm: $("export-webm"),
    webmUnavailable: $("webm-unavailable"),
    embedRefresh: $("embed-refresh"),
    embedCopy: $("embed-copy"),
    embedSnippet: $("embed-snippet"),
    embedNote: $("embed-note"),
    exportGroup: $("export-group"),
    progress: $("progress"),
    progressBar: $("progress-bar"),
    progressLabel: $("progress-label"),
    toast: $("toast"),
    perfNote: $("perf-note"),
    dropOverlay: $("drop-overlay"),
  };

  // Swatches.
  for (const hex of SWATCHES) {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = hex;
    b.dataset.color = hex;
    b.setAttribute("aria-label", `Color ${hex}`);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => app.setBrush({ color: hex }));
    els.swatches.appendChild(b);
  }

  // Mode.
  els.modePaint.addEventListener("click", () => app.setMode("paint"));
  els.modeOrbit.addEventListener("click", () => app.setMode("orbit"));

  // Brush.
  els.color.addEventListener("input", () => app.setBrush({ color: els.color.value }));
  els.size.addEventListener("input", () =>
    app.setBrush({ size: sliderToBrushSize(Number(els.size.value)) }),
  );
  els.wetness.addEventListener("input", () =>
    app.setBrush({ wetness: Number(els.wetness.value) / 100 }),
  );
  els.opacity.addEventListener("input", () =>
    app.setBrush({ opacity: Number(els.opacity.value) / 100 }),
  );

  // Physics.
  els.dryTime.addEventListener("input", () =>
    app.setPhysics({ dryTime: Number(els.dryTime.value) / 10 }),
  );
  els.viscosity.addEventListener("input", () =>
    app.setPhysics({ viscosity: Number(els.viscosity.value) / 100 }),
  );

  // Actions.
  els.undo.addEventListener("click", () => app.undo());
  els.clear.addEventListener("click", () => app.clearPaint());
  els.resetCamera.addEventListener("click", () => app.resetCamera());

  // Planet.
  els.template.addEventListener("change", () => app.setTemplate(els.template.value));
  els.randomize.addEventListener("click", () => app.randomize());
  els.resolution.addEventListener("change", () => app.setResolution(Number(els.resolution.value)));

  // Light.
  els.exposure.addEventListener("input", () =>
    app.setLighting({ exposure: Number(els.exposure.value) / 100 }),
  );
  els.lightAngle.addEventListener("input", () =>
    app.setLighting({ keyAzimuth: (Number(els.lightAngle.value) * Math.PI) / 180 }),
  );

  // Export.
  els.exportJson.addEventListener("click", () => app.exportJSON());
  els.importJson.addEventListener("change", () => {
    const f = els.importJson.files && els.importJson.files[0];
    if (f) app.importFile(f);
    els.importJson.value = "";
  });
  els.exportGif.addEventListener("click", () =>
    app.exportGif(Number(els.gifFrames.value), Number(els.gifSize.value)),
  );
  els.exportWebm.addEventListener("click", () => app.exportWebm(Number(els.webmSeconds.value)));
  els.embedRefresh.addEventListener("click", () => app.makeEmbed());
  els.embedCopy.addEventListener("click", () => copyText(els.embedSnippet.value, ui));

  // Bottom sheet.
  const narrow = matchMedia("(max-width: 720px)");
  let expanded = false;
  const applySheet = () => {
    if (narrow.matches) {
      els.panelBody.hidden = !expanded;
      els.panel.classList.toggle("expanded", expanded);
      els.sheetToggle.setAttribute("aria-expanded", String(expanded));
      els.sheetToggle.textContent = expanded ? "Less" : "More";
    } else {
      els.panelBody.hidden = false;
      els.panel.classList.remove("expanded");
    }
  };
  els.sheetToggle.addEventListener("click", () => {
    expanded = !expanded;
    applySheet();
  });
  narrow.addEventListener("change", applySheet);
  applySheet();

  let toastTimer = 0;

  const ui = {
    els,
    setMode(mode) {
      els.modePaint.setAttribute("aria-pressed", String(mode === "paint"));
      els.modeOrbit.setAttribute("aria-pressed", String(mode === "orbit"));
    },
    setBrush(brush) {
      els.color.value = brush.color;
      els.size.value = String(brushSizeToSlider(brush.size));
      els.sizeValue.value = els.size.value;
      els.wetness.value = String(Math.round(brush.wetness * 100));
      els.wetnessValue.value = `${els.wetness.value}%`;
      els.opacity.value = String(Math.round(brush.opacity * 100));
      els.opacityValue.value = `${els.opacity.value}%`;
      for (const b of els.swatches.children) {
        b.setAttribute("aria-pressed", String(b.dataset.color === brush.color));
      }
    },
    setPhysics(p) {
      els.dryTime.value = String(Math.round(p.dryTime * 10));
      els.dryTimeValue.value = `${p.dryTime.toFixed(1)} s`;
      els.viscosity.value = String(Math.round(p.viscosity * 100));
      els.viscosityValue.value = `${els.viscosity.value}%`;
    },
    setLighting(l) {
      els.exposure.value = String(Math.round(l.exposure * 100));
      els.exposureValue.value = l.exposure.toFixed(2);
      const deg = Math.round((l.keyAzimuth * 180) / Math.PI);
      els.lightAngle.value = String(deg);
      els.lightAngleValue.value = `${deg}°`;
    },
    setTemplate(name, seed) {
      els.template.value = name;
      els.seed.value = String(seed >>> 0);
      els.seed.title = `${TEMPLATE_LABELS[name] || name} seed`;
    },
    setResolution(res, note) {
      if (RESOLUTIONS.includes(res)) els.resolution.value = String(res);
      els.resolutionNote.hidden = !note;
      els.resolutionNote.textContent = note || "";
    },
    setUndoEnabled(on) {
      els.undo.disabled = !on;
    },
    setBusy(on) {
      for (const b of [
        els.exportJson,
        els.exportGif,
        els.exportWebm,
        els.embedRefresh,
        els.randomize,
        els.clear,
        els.resolution,
        els.template,
      ]) {
        b.disabled = on;
      }
      els.importJson.disabled = on;
      els.panel.setAttribute("aria-busy", String(on));
    },
    setWebmUnavailable(reason) {
      els.webmRow.hidden = !!reason;
      els.webmUnavailable.hidden = !reason;
      els.webmUnavailable.textContent = reason ? `WebM export is unavailable: ${reason}` : "";
    },
    setEmbed({ snippet, note, ok }) {
      els.embedSnippet.value = snippet || "";
      els.embedNote.textContent = note || "";
      els.embedCopy.disabled = !ok;
    },
    setPerfNote(text) {
      els.perfNote.textContent = text || "";
    },
    toast(message, ms = 3200) {
      els.toast.textContent = message;
      els.toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
    },
    progress: {
      show(label) {
        els.progressLabel.textContent = label;
        els.progressBar.style.width = "0%";
        els.progress.setAttribute("aria-valuenow", "0");
        els.progress.hidden = false;
      },
      update(frac, label) {
        const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100);
        els.progressBar.style.width = `${pct}%`;
        els.progress.setAttribute("aria-valuenow", String(pct));
        if (label) els.progressLabel.textContent = label;
      },
      hide() {
        els.progress.hidden = true;
      },
    },
    showDrop(on) {
      els.dropOverlay.hidden = !on;
    },
    openExport() {
      els.exportGroup.open = true;
    },
    collapseSheet() {
      if (expanded) {
        expanded = false;
        applySheet();
      }
    },
    isTyping(target) {
      if (!target || target === document.body) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target.isContentEditable;
    },
  };
  return ui;
}

async function copyText(text, ui) {
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      ui.toast("Embed snippet copied.");
      return;
    }
  } catch {
    // fall through to the selection fallback
  }
  const ta = ui.els.embedSnippet;
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ui.toast(ok ? "Embed snippet copied." : "Copy is blocked here; select the text and copy it.");
}
