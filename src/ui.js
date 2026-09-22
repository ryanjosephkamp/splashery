// DOM wiring for the panel, shelf, tools, bottom sheet, toasts and progress.
// The app owns state; this module reflects it and forwards user intent.

import { EFFECTS, AXES } from "./effects.js";
import { SHAPES, PALETTES, PROFILES } from "./generators.js";
import { TOYS, thumbURL } from "./toys.js";
import { IDLE_EFFECTS, formatCount } from "./state.js";

const $ = (id) => document.getElementById(id);

const SWATCHES = [
  "#e63b2e",
  "#f2a93b",
  "#f5e663",
  "#2f9e6a",
  "#0b4f9c",
  "#7a3fb1",
  "#ff5fa2",
  "#ffffff",
  "#111111",
];
const TOOL_HINTS = {
  orbit: "Drag to turn the toy, scroll or pinch to zoom, twist two fingers to roll.",
  clay: "Drag on a generated toy to add lumps of clay, or switch to Erase to carve it away.",
};

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

export function createUI(app) {
  const els = {
    panel: $("panel"),
    panelBody: $("panel-body"),
    dock: document.querySelector(".dock"),
    sheetToggle: $("sheet-toggle"),
    shelf: $("shelf"),
    tools: $("tools"),
    toolHint: $("tool-hint"),
    toolParams: $("tool-params"),
    paintExtras: $("paint-extras"),
    swatches: $("swatches"),
    paintColor: $("paint-color"),
    clearPaint: $("clear-paint"),
    paintCount: $("paint-count"),
    clayExtras: $("clay-extras"),
    clayAdd: $("clay-add"),
    clayErase: $("clay-erase"),
    claySize: $("clay-size"),
    claySizeValue: $("clay-size-value"),
    clayNote: $("clay-note"),
    pokeNow: $("poke-now"),
    resetCamera: $("reset-camera"),
    effects: $("effects"),
    effectsOff: $("effects-off"),
    genShape: $("gen-shape"),
    genPalette: $("gen-palette"),
    genSeed: $("gen-seed"),
    genDice: $("gen-dice"),
    genCount: $("gen-count"),
    genCountValue: $("gen-count-value"),
    genJitter: $("gen-jitter"),
    genJitterValue: $("gen-jitter-value"),
    genRough: $("gen-rough"),
    genRoughValue: $("gen-rough-value"),
    genNoise: $("gen-noise"),
    genNoiseValue: $("gen-noise-value"),
    genMake: $("gen-make"),
    genNote: $("gen-note"),
    makeGroup: $("make-group"),
    lookBg: $("look-bg"),
    lookBgColor: $("look-bg-color"),
    lookTheme: $("look-theme"),
    lookAccent: $("look-accent"),
    lookAccentColor: $("look-accent-color"),
    lookSize: $("look-size"),
    lookSizeValue: $("look-size-value"),
    lookExposure: $("look-exposure"),
    lookExposureValue: $("look-exposure-value"),
    autoTurntable: $("auto-turntable"),
    autoEffect: $("auto-effect"),
    motionNote: $("motion-note"),
    byoFile: $("byo-file"),
    byoFlipRow: $("byo-flip-row"),
    byoFlip: $("byo-flip"),
    byoWarning: $("byo-warning"),
    byoWarningText: $("byo-warning-text"),
    byoDownsample: $("byo-downsample"),
    byoAnyway: $("byo-anyway"),
    byoCancel: $("byo-cancel"),
    byoGroup: $("byo-group"),
    shareLink: $("share-link"),
    linkNote: $("link-note"),
    exportJson: $("export-json"),
    importJson: $("import-json"),
    exportPng: $("export-png"),
    gifKind: $("gif-kind"),
    gifFrames: $("gif-frames"),
    gifSize: $("gif-size"),
    exportGif: $("export-gif"),
    webmRow: $("webm-row"),
    webmSeconds: $("webm-seconds"),
    exportWebm: $("export-webm"),
    webmUnavailable: $("webm-unavailable"),
    embedTransparent: $("embed-transparent"),
    embedCopy: $("embed-copy"),
    embedSnippet: $("embed-snippet"),
    elementCopy: $("element-copy"),
    elementSnippet: $("element-snippet"),
    embedNote: $("embed-note"),
    shareGroup: $("share-group"),
    credits: $("credits"),
    renderInfo: $("render-info"),
    toyStatus: $("toy-status"),
    progress: $("progress"),
    progressBar: $("progress-bar"),
    progressLabel: $("progress-label"),
    toast: $("toast"),
    dropOverlay: $("drop-overlay"),
  };

  // ---- Shelf -----------------------------------------------------------------
  for (const toy of TOYS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toy-card";
    b.dataset.toy = toy.id;
    b.setAttribute("aria-pressed", "false");
    b.title = toy.note ? `${toy.label} (${toy.note})` : toy.label;
    const img = document.createElement("img");
    img.alt = "";
    img.width = 64;
    img.height = 64;
    img.loading = "lazy";
    img.decoding = "async";
    img.src = thumbURL(toy);
    img.addEventListener(
      "error",
      () => img.replaceWith(Object.assign(document.createElement("span"), { className: "thumb" })),
      {
        once: true,
      },
    );
    const label = document.createElement("span");
    label.textContent = toy.label;
    b.append(img, label);
    b.addEventListener("click", () => app.chooseToy(toy.id));
    els.shelf.appendChild(b);
  }

  // ---- Tools -----------------------------------------------------------------
  for (const b of els.tools.querySelectorAll("button")) {
    b.addEventListener("click", () => app.setTool(b.dataset.tool));
  }
  for (const hex of SWATCHES) {
    const b = document.createElement("button");
    b.type = "button";
    b.style.background = hex;
    b.dataset.color = hex;
    b.setAttribute("aria-label", `Paint colour ${hex}`);
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => app.setEffectParam("paint", "color", hex));
    els.swatches.appendChild(b);
  }
  els.paintColor.addEventListener("input", () =>
    app.setEffectParam("paint", "color", els.paintColor.value),
  );
  els.clearPaint.addEventListener("click", () => app.clearPaint());
  els.clayAdd.addEventListener("click", () => app.setClayMode("add"));
  els.clayErase.addEventListener("click", () => app.setClayMode("erase"));
  els.claySize.addEventListener("input", () => {
    app.claySize = Number(els.claySize.value) / 100;
    els.claySizeValue.value = `${els.claySize.value}%`;
  });
  els.pokeNow.addEventListener("click", () => app.pokeRandom());
  els.resetCamera.addEventListener("click", () => app.resetCamera());

  // ---- Effects ---------------------------------------------------------------
  const sliders = new Map(); // "id.key" -> { input, output, def }
  const switches = new Map();
  const bodies = new Map();
  const axisGroups = new Map();

  function makeSlider(def, p, container) {
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = p.label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(p.min * 100);
    input.max = String(p.max * 100);
    input.step = "1";
    input.id = `fx-${def.id}-${p.key}`;
    const output = document.createElement("output");
    output.htmlFor = input.id;
    input.addEventListener("input", () =>
      app.setEffectParam(def.id, p.key, Number(input.value) / 100),
    );
    row.append(name, input, output);
    container.appendChild(row);
    sliders.set(`${def.id}.${p.key}`, { input, output, p });
  }

  for (const def of EFFECTS) {
    if (def.kind !== "ambient") continue;
    const wrap = document.createElement("div");
    wrap.className = "effect";
    wrap.id = `effect-${def.id}`;
    const head = document.createElement("div");
    head.className = "effect-head";
    const label = document.createElement("label");
    const sw = document.createElement("input");
    sw.type = "checkbox";
    sw.className = "switch";
    sw.id = `fx-${def.id}`;
    sw.setAttribute("role", "switch");
    sw.addEventListener("change", () => app.toggleEffect(def.id, sw.checked));
    const text = document.createElement("span");
    text.textContent = def.label;
    label.append(sw, text);
    label.title = def.hint;
    head.appendChild(label);
    if (def.axis) {
      const seg = document.createElement("div");
      seg.className = "segmented small axis";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", `${def.label} axis`);
      for (const ax of AXES) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = ax.toUpperCase();
        b.dataset.axis = ax;
        b.setAttribute("aria-label", `${def.label} along ${ax.toUpperCase()}`);
        b.addEventListener("click", () => app.setEffectParam(def.id, "axis", ax));
        seg.appendChild(b);
      }
      head.appendChild(seg);
      axisGroups.set(def.id, seg);
    }
    const body = document.createElement("div");
    body.className = "effect-body";
    const hint = document.createElement("p");
    hint.className = "note";
    hint.textContent = def.hint;
    body.appendChild(hint);
    for (const p of def.params) makeSlider(def, p, body);
    wrap.append(head, body);
    els.effects.appendChild(wrap);
    switches.set(def.id, sw);
    bodies.set(def.id, body);
  }
  els.effectsOff.addEventListener("click", () => app.allEffectsOff());

  // Tool sliders are rebuilt when the tool changes.
  function renderToolParams(tool) {
    els.toolParams.textContent = "";
    for (const [k, v] of [...sliders]) if (k.startsWith(`${tool}.`)) sliders.delete(k);
    const def = EFFECTS.find((e) => e.id === tool);
    els.toolHint.textContent = def ? def.hint : TOOL_HINTS[tool] || "";
    if (def) for (const p of def.params) makeSlider(def, p, els.toolParams);
    els.paintExtras.hidden = tool !== "paint";
    els.clayExtras.hidden = tool !== "clay";
  }

  // ---- Make a toy -------------------------------------------------------------
  for (const s of SHAPES) els.genShape.add(new Option(s.label, s.id));
  for (const p of PALETTES) els.genPalette.add(new Option(p.label, p.id));
  const profile = PROFILES[app.player?.profile || "strong"];
  els.genCount.max = String(profile.maxCount);
  const genInput = () => app.setGenerator(readGenerator());
  function readGenerator() {
    return {
      shape: els.genShape.value,
      palette: els.genPalette.value,
      seed: Number(els.genSeed.value) >>> 0,
      count: Number(els.genCount.value),
      sizeJitter: Number(els.genJitter.value) / 100,
      roughness: Number(els.genRough.value) / 100,
      colorNoise: Number(els.genNoise.value) / 100,
    };
  }
  for (const el of [els.genShape, els.genPalette, els.genSeed])
    el.addEventListener("change", genInput);
  for (const el of [els.genCount, els.genJitter, els.genRough, els.genNoise]) {
    el.addEventListener("input", () => {
      showGeneratorValues(readGenerator());
      app.setGenerator(readGenerator(), { rebuild: false });
    });
    el.addEventListener("change", genInput);
  }
  els.genDice.addEventListener("click", () => {
    els.genSeed.value = String(Math.floor(Math.random() * 1e6));
    genInput();
  });
  els.genMake.addEventListener("click", () => app.makeToy(readGenerator()));

  function showGeneratorValues(g) {
    els.genCountValue.value = formatCount(g.count);
    els.genJitterValue.value = pct(g.sizeJitter);
    els.genRoughValue.value = pct(g.roughness);
    els.genNoiseValue.value = pct(g.colorNoise);
  }

  // ---- Look ------------------------------------------------------------------
  const lookInput = () => {
    const bg = els.lookBg.value === "custom" ? els.lookBgColor.value : els.lookBg.value;
    const accent = els.lookAccent.value === "custom" ? els.lookAccentColor.value : "auto";
    app.setLook({
      background: bg,
      accent,
      splatScale: Number(els.lookSize.value) / 100,
      exposure: Number(els.lookExposure.value) / 100,
    });
  };
  els.lookBg.addEventListener("change", lookInput);
  els.lookBgColor.addEventListener("input", () => {
    els.lookBg.value = "custom";
    lookInput();
  });
  els.lookAccent.addEventListener("change", lookInput);
  els.lookAccentColor.addEventListener("input", () => {
    els.lookAccent.value = "custom";
    lookInput();
  });
  els.lookSize.addEventListener("input", lookInput);
  els.lookExposure.addEventListener("input", lookInput);
  for (const b of els.lookTheme.querySelectorAll("button")) {
    b.addEventListener("click", () => app.setLook({ theme: b.dataset.theme }));
  }
  for (const e of IDLE_EFFECTS) els.autoEffect.add(new Option(e.label, e.id));
  els.autoTurntable.addEventListener("change", () =>
    app.setAutoplay({ turntable: els.autoTurntable.checked }),
  );
  els.autoEffect.addEventListener("change", () =>
    app.setAutoplay({ effect: els.autoEffect.value }),
  );

  // ---- Bring your own ------------------------------------------------------------
  els.byoFile.addEventListener("change", () => {
    const f = els.byoFile.files && els.byoFile.files[0];
    if (f) app.openFile(f);
    els.byoFile.value = "";
  });
  els.byoFlip.addEventListener("change", () => app.setFlip(els.byoFlip.checked));
  els.byoDownsample.addEventListener("click", () => app.resolveLargeFile("downsample"));
  els.byoAnyway.addEventListener("click", () => app.resolveLargeFile("all"));
  els.byoCancel.addEventListener("click", () => app.resolveLargeFile("cancel"));

  // ---- Share -------------------------------------------------------------------
  els.shareLink.addEventListener("click", () => app.copyLink());
  els.exportJson.addEventListener("click", () => app.exportJSON());
  els.importJson.addEventListener("change", () => {
    const f = els.importJson.files && els.importJson.files[0];
    if (f) app.openFile(f);
    els.importJson.value = "";
  });
  els.exportPng.addEventListener("click", () => app.exportPNG());
  els.exportGif.addEventListener("click", () =>
    app.exportGIF({
      kind: els.gifKind.value,
      frames: Number(els.gifFrames.value),
      size: Number(els.gifSize.value),
    }),
  );
  els.exportWebm.addEventListener("click", () => app.exportWebM(Number(els.webmSeconds.value)));
  els.embedTransparent.addEventListener("change", () => app.updateEmbed());
  els.embedCopy.addEventListener("click", () =>
    copyText(els.embedSnippet, "Iframe snippet copied."),
  );
  els.elementCopy.addEventListener("click", () =>
    copyText(els.elementSnippet, "Element snippet copied."),
  );
  els.shareGroup.addEventListener("toggle", () => {
    if (els.shareGroup.open) app.updateEmbed();
  });

  // ---- Bottom sheet ---------------------------------------------------------------
  const narrow = matchMedia("(max-width: 760px)");
  let expanded = false;
  const applySheet = () => {
    if (narrow.matches) {
      els.panelBody.hidden = !expanded;
      els.sheetToggle.setAttribute("aria-expanded", String(expanded));
      els.sheetToggle.textContent = expanded ? "Less" : "More";
      const h = els.dock.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--dock-h", `${Math.round(h)}px`);
    } else {
      els.panelBody.hidden = false;
    }
  };
  els.sheetToggle.addEventListener("click", () => {
    expanded = !expanded;
    applySheet();
  });
  narrow.addEventListener("change", applySheet);
  applySheet();

  let toastTimer = 0;

  async function copyText(textarea, message) {
    const text = textarea.value;
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ui.toast(message);
        return;
      }
    } catch {
      // fall through to the selection fallback
    }
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ui.toast(ok ? message : "Copy is blocked here; select the text and copy it.");
  }

  const ui = {
    els,
    setTool(tool) {
      for (const b of els.tools.querySelectorAll("button")) {
        b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
      }
      renderToolParams(tool);
    },
    setShelf(id) {
      for (const b of els.shelf.querySelectorAll(".toy-card")) {
        b.setAttribute("aria-pressed", String(b.dataset.toy === id));
      }
    },
    setEffects(fx) {
      for (const [id, sw] of switches) {
        sw.checked = !!fx[id].on;
        bodies.get(id).hidden = !fx[id].on;
      }
      for (const [key, s] of sliders) {
        const [id, k] = key.split(".");
        const v = fx[id][k];
        s.input.value = String(Math.round(v * 100));
        s.output.value =
          s.p.unit === "°" ? `${Math.round(v)}°` : s.p.min < 0 ? `${Math.round(v * 100)}` : pct(v);
      }
      for (const [id, seg] of axisGroups) {
        for (const b of seg.querySelectorAll("button"))
          b.setAttribute("aria-pressed", String(b.dataset.axis === fx[id].axis));
      }
      els.paintColor.value = fx.paint.color;
      for (const b of els.swatches.children)
        b.setAttribute("aria-pressed", String(b.dataset.color === fx.paint.color));
    },
    setPaintCount(n) {
      els.paintCount.textContent = n ? `${n} paint stamps` : "";
      els.clearPaint.disabled = !n;
    },
    setClayMode(mode) {
      els.clayAdd.setAttribute("aria-pressed", String(mode === "add"));
      els.clayErase.setAttribute("aria-pressed", String(mode === "erase"));
    },
    setClayAvailable(ok, note) {
      els.clayNote.textContent = note || "";
      els.clayAdd.disabled = els.clayErase.disabled = !ok;
    },
    setGenerator(g) {
      els.genShape.value = g.shape;
      els.genPalette.value = g.palette;
      els.genSeed.value = String(g.seed);
      els.genCount.value = String(g.count);
      els.genJitter.value = String(Math.round(g.sizeJitter * 100));
      els.genRough.value = String(Math.round(g.roughness * 100));
      els.genNoise.value = String(Math.round(g.colorNoise * 100));
      showGeneratorValues(g);
    },
    setGeneratorNote(text) {
      els.genNote.textContent = text || "";
    },
    setLook(look, resolvedTheme) {
      if (look.background === "page" || look.background === "transparent")
        els.lookBg.value = look.background;
      else {
        els.lookBg.value = "custom";
        els.lookBgColor.value = look.background;
      }
      if (look.accent === "auto") els.lookAccent.value = "auto";
      else {
        els.lookAccent.value = "custom";
        els.lookAccentColor.value = look.accent;
      }
      els.lookSize.value = String(Math.round(look.splatScale * 100));
      els.lookSizeValue.value = `${look.splatScale.toFixed(2)}×`;
      els.lookExposure.value = String(Math.round(look.exposure * 100));
      els.lookExposureValue.value = look.exposure.toFixed(2);
      for (const b of els.lookTheme.querySelectorAll("button")) {
        b.setAttribute("aria-pressed", String(b.dataset.theme === look.theme));
      }
      document.documentElement.dataset.theme = resolvedTheme;
    },
    setAutoplay(a, reducedMotion) {
      els.autoTurntable.checked = a.turntable;
      els.autoEffect.value = a.effect;
      els.motionNote.hidden = !reducedMotion;
      els.autoTurntable.disabled = els.autoEffect.disabled = !!reducedMotion;
    },
    setFileToy(isFile, flip) {
      els.byoFlipRow.hidden = !isFile;
      els.byoFlip.checked = !!flip;
    },
    showLargeFile(text, canDownsample) {
      els.byoGroup.open = true;
      els.byoWarning.hidden = !text;
      els.byoWarningText.textContent = text || "";
      els.byoDownsample.hidden = !canDownsample;
    },
    setStatus(text) {
      els.toyStatus.textContent = text || "";
    },
    setCredits(nodes) {
      els.credits.replaceChildren(...nodes);
    },
    setRenderInfo(text) {
      els.renderInfo.textContent = text;
    },
    setBusy(on) {
      for (const b of [
        els.exportJson,
        els.exportGif,
        els.exportWebm,
        els.exportPng,
        els.genMake,
        els.shareLink,
      ]) {
        b.disabled = on;
      }
      els.importJson.disabled = on;
      els.byoFile.disabled = on;
      els.panel.setAttribute("aria-busy", String(on));
    },
    setWebmUnavailable(reason) {
      els.webmRow.hidden = !!reason;
      els.webmUnavailable.hidden = !reason;
      els.webmUnavailable.textContent = reason ? `Video export is unavailable: ${reason}` : "";
    },
    setEmbed({ iframe, element, note }) {
      els.embedSnippet.value = iframe || "";
      els.elementSnippet.value = element || "";
      els.embedNote.textContent = note || "";
      els.embedCopy.disabled = !iframe;
      els.elementCopy.disabled = !element;
    },
    setLinkNote(text) {
      els.linkNote.textContent = text || "";
    },
    embedTransparent() {
      return els.embedTransparent.checked;
    },
    toast(message, ms = 3200) {
      els.toast.textContent = message;
      els.toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
    },
    progress: {
      show(label) {
        els.progressLabel.textContent = label || "Loading…";
        els.progressBar.style.width = "0%";
        els.progress.setAttribute("aria-valuenow", "0");
        els.progress.hidden = false;
      },
      update(frac, label) {
        const p = Math.round(Math.min(1, Math.max(0, frac)) * 100);
        els.progressBar.style.width = `${p}%`;
        els.progress.setAttribute("aria-valuenow", String(p));
        if (label) els.progressLabel.textContent = label;
      },
      hide() {
        els.progress.hidden = true;
      },
    },
    showDrop(on) {
      els.dropOverlay.hidden = !on;
    },
    collapseSheet() {
      if (expanded) {
        expanded = false;
        applySheet();
      }
    },
    refreshSheet: applySheet,
    isTyping(target) {
      if (!target || target === document.body) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target.isContentEditable;
    },
  };
  return ui;
}
