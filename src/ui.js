// DOM wiring for the panel, shelf, tools, tabs, bottom sheet, toasts and
// progress.
// The app owns state; this module reflects it and forwards user intent.

import { EFFECTS, AXES } from "./effects.js";
import { SHAPES, PALETTES, PROFILES } from "./generators.js";
import { TOYS, thumbURL, shelfCategories, searchToys, onShelf } from "./toys.js";
import { IDLE_EFFECTS, formatCount } from "./state.js";
import { MOVES } from "./motion.js";
import { PATTERNS, PROJECTIONS, loadFlags } from "./patterns.js";
import { initLive, renderLive } from "./live/panel.js"; // lane Live input

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
  // The Orbit tool on a stretchy toy (a recipe with `grab`).
  stretch: "Drag the toy to stretch it; drag beside it to turn it. Scroll or pinch to zoom.",
  clay: "Drag on a generated toy to add lumps of clay, or switch to Erase to carve it away.",
};

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

export function createUI(app) {
  initLive(app); // lane Live input: the live sources, and Clap to tap (labs)
  const els = {
    panel: $("panel"),
    panelBody: $("panel-body"),
    dock: document.querySelector(".dock"),
    sheetToggle: $("sheet-toggle"),
    sheetHandle: $("sheet-handle"),
    tabs: $("tabs"),
    panes: $("panes"),
    shelf: $("shelf"),
    shelfEmpty: $("shelf-empty"),
    shelfChips: $("shelf-chips"),
    shelfFind: $("shelf-find"),
    shelfSearch: $("shelf-search"),
    shelfSearchToggle: $("shelf-search-toggle"),
    shelfSurprise: $("shelf-surprise"),
    toyGroup: $("toy-group"),
    toyActionRow: $("toy-action-row"),
    toyAction: $("toy-action"),
    toyControls: $("toy-controls"),
    toyAliveRow: $("toy-alive-row"),
    toyAlive: $("toy-alive"),
    toyMove: $("toy-move"),
    toySpeed: $("toy-speed"),
    toySpeedValue: $("toy-speed-value"),
    toyOptions: $("toy-options"),
    toyFlag: $("toy-flag"),
    toyNote: $("toy-note"),
    patId: $("pat-id"),
    patFlagRow: $("pat-flag-row"),
    patFlag: $("pat-flag"),
    patColorsRow: $("pat-colors-row"),
    patC1: $("pat-c1"),
    patC2: $("pat-c2"),
    patC3: $("pat-c3"),
    patMore: $("pat-more"),
    patProj: $("pat-proj"),
    patRepeats: $("pat-repeats"),
    patRepeatsValue: $("pat-repeats-value"),
    patScaleRow: $("pat-scale-row"),
    patScale: $("pat-scale"),
    patScaleValue: $("pat-scale-value"),
    patAmount: $("pat-amount"),
    patAmountValue: $("pat-amount-value"),
    patDetail: $("pat-detail"),
    patDetailValue: $("pat-detail-value"),
    patNote: $("pat-note"),
    soundToggle: $("sound-toggle"),
    turntableToggle: $("turntable-toggle"), // lane Viewer
    tiltToggle: $("tilt-toggle"), // lane Viewer
    viewReset: $("view-reset"), // lane Viewer
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
    lookBg: $("look-bg"),
    lookBgColor: $("look-bg-color"),
    lookTheme: $("look-theme"),
    lookDetail: $("look-detail"),
    lookAccent: $("look-accent"),
    lookAccentColor: $("look-accent-color"),
    lookSize: $("look-size"),
    lookSizeValue: $("look-size-value"),
    lookExposure: $("look-exposure"),
    lookExposureValue: $("look-exposure-value"),
    autoTurntable: $("auto-turntable"),
    resetAll: $("reset-all"),
    resetNote: $("reset-note"),
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
    embedSize: $("embed-size"),
    embedCopy: $("embed-copy"),
    embedSnippet: $("embed-snippet"),
    elementCopy: $("element-copy"),
    elementSnippet: $("element-snippet"),
    embedNote: $("embed-note"),
    credits: $("credits"),
    renderInfo: $("render-info"),
    toyStatus: $("toy-status"),
    gameBar: $("game-bar"),
    gameBarTitle: $("game-bar-title"),
    gameBarInfo: $("game-bar-info"),
    gameBarMove: $("game-bar-move"),
    gamePlay: $("game-play"),
    songTitle: $("song-bar-title"),
    songLoop: $("song-loop"),
    songSpeed: $("song-speed"),
    songSeek: $("song-seek"),
    progress: $("progress"),
    progressBar: $("progress-bar"),
    progressLabel: $("progress-label"),
    toast: $("toast"),
    dropOverlay: $("drop-overlay"),
  };

  // ---- Shelf -----------------------------------------------------------------
  // Cards are made once; filtering by category or search just re-orders
  // which ones are in the shelf. Thumbnails load lazily as they scroll in.
  const cards = new Map();
  for (const toy of TOYS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toy-card";
    b.dataset.toy = toy.id;
    // Labs: a toy being tried out keeps its card, hidden, unless labs is on.
    if (!onShelf(toy)) b.hidden = true;
    b.setAttribute("aria-pressed", "false");
    b.title = toy.note ? `${toy.label} (${toy.note})` : toy.label;
    const img = document.createElement("img");
    img.alt = "";
    img.width = 64;
    img.height = 64;
    img.loading = "lazy";
    img.decoding = "async";
    img.src = thumbURL(toy);
    // A failed thumbnail is fetched once more past any cache, then becomes
    // a plain tile.
    img.addEventListener("error", () => {
      if (!img.dataset.retried) {
        img.dataset.retried = "true";
        const url = new URL(img.src);
        url.searchParams.set("retry", String(Date.now()));
        img.src = url.href;
      } else {
        img.replaceWith(Object.assign(document.createElement("span"), { className: "thumb" }));
      }
    });
    const label = document.createElement("span");
    label.textContent = toy.label;
    b.append(img, label);
    b.addEventListener("click", () => {
      // Picking from the phone grid folds it back to the row at once.
      if (mode === "grid") setMode("row");
      app.chooseToy(toy.id);
    });
    cards.set(toy.id, b);
  }

  const categories = shelfCategories();
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const allToys = TOYS.map((t, i) => ({ t, i }))
    .sort((a, b) => (order.get(a.t.category) ?? 99) - (order.get(b.t.category) ?? 99) || a.i - b.i)
    .map((x) => x.t);
  const shelf = { category: "all", query: "", list: allToys, current: null };
  const chips = new Map();
  for (const c of [{ id: "all", label: "All" }, ...categories]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.category = c.id;
    b.textContent = c.label;
    b.setAttribute("aria-pressed", String(c.id === "all"));
    b.addEventListener("click", () => {
      shelf.category = c.id;
      if (shelf.query) {
        shelf.query = "";
        els.shelfSearch.value = "";
      }
      renderShelf();
    });
    els.shelfChips.appendChild(b);
    chips.set(c.id, b);
  }

  function renderShelf() {
    const q = shelf.query.trim();
    const list = q
      ? searchToys(q, allToys)
      : shelf.category === "all"
        ? allToys
        : allToys.filter((t) => t.category === shelf.category);
    shelf.list = list;
    els.shelf.replaceChildren(...list.map((t) => cards.get(t.id)));
    els.shelf.scrollLeft = 0;
    els.shelf.scrollTop = 0;
    els.shelfEmpty.hidden = list.length > 0;
    els.shelfEmpty.textContent = list.length ? "" : `No toys match “${q}”.`;
    for (const [id, b] of chips)
      b.setAttribute("aria-pressed", String(!q && id === shelf.category));
    revealCurrent();
  }

  function revealCurrent() {
    const card = shelf.current && cards.get(shelf.current);
    if (!card || !card.isConnected) return;
    const box = els.shelf;
    if (box.scrollWidth > box.clientWidth) {
      const left = card.offsetLeft - box.offsetLeft;
      if (left < box.scrollLeft || left + card.offsetWidth > box.scrollLeft + box.clientWidth)
        box.scrollLeft = Math.max(0, left - 12);
    }
    if (box.scrollHeight > box.clientHeight) {
      const top = card.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + card.offsetHeight > box.scrollTop + box.clientHeight)
        box.scrollTop = Math.max(0, top - 4);
    }
  }

  function setSearching(on) {
    els.dock.classList.toggle("searching", on);
    els.shelfSearchToggle.setAttribute("aria-expanded", String(on));
    if (on) els.shelfSearch.focus({ preventScroll: true });
    else if (shelf.query) {
      shelf.query = "";
      els.shelfSearch.value = "";
      renderShelf();
    }
    refreshDock();
  }

  els.shelfSearch.addEventListener("input", () => {
    shelf.query = els.shelfSearch.value;
    renderShelf();
  });
  els.shelfSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && shelf.list.length) {
      e.preventDefault();
      app.chooseToy(shelf.list[0].id);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (shelf.query) {
        shelf.query = "";
        els.shelfSearch.value = "";
        renderShelf();
      } else setSearching(false);
    }
  });
  els.shelfSearchToggle.addEventListener("click", () =>
    setSearching(!els.dock.classList.contains("searching")),
  );
  els.shelfSurprise.addEventListener("click", () => {
    // Labs toys stay out of Surprise me unless labs is on.
    const pool = shelf.list.filter((t) => t.id !== shelf.current && onShelf(t));
    const from = pool.length ? pool : allToys.filter((t) => t.id !== shelf.current && onShelf(t)); // prettier-ignore
    if (from.length) app.chooseToy(from[Math.floor(Math.random() * from.length)].id);
  });
  // A mouse wheel scrolls the category chips sideways.
  els.shelfChips.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (els.shelfChips.scrollWidth <= els.shelfChips.clientWidth) return;
      els.shelfChips.scrollLeft += e.deltaY;
      e.preventDefault();
    },
    { passive: false },
  );
  renderShelf();

  // ---- Tools -----------------------------------------------------------------
  for (const b of els.tools.querySelectorAll("button")) {
    b.addEventListener("click", () => {
      app.setTool(b.dataset.tool);
      // A tool with settings (paint colours, clay, strength) opens them.
      if (b.dataset.tool !== "orbit") showTab("tools");
    });
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
    const stretchy = tool === "orbit" && app.player?.toyInfo?.recipe?.grab;
    els.toolHint.textContent = def ? def.hint : TOOL_HINTS[stretchy ? "stretch" : tool] || "";
    if (def) for (const p of def.params) makeSlider(def, p, els.toolParams);
    els.paintExtras.hidden = tool !== "paint";
    els.clayExtras.hidden = tool !== "clay";
  }

  // ---- This toy ----------------------------------------------------------------
  // Motion for every toy, plus a kit toy's action, controls and options.
  for (const m of MOVES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.move = m.id;
    b.textContent = m.label;
    b.setAttribute("aria-pressed", String(m.id === "still"));
    b.addEventListener("click", () => app.setMotion({ move: m.id }));
    els.toyMove.appendChild(b);
  }
  els.toySpeed.addEventListener("input", () =>
    app.setMotion({ speed: Number(els.toySpeed.value) / 100 }),
  );
  els.toyAlive.addEventListener("change", () => app.setMotion({ alive: els.toyAlive.checked }));
  els.toyAction.addEventListener("click", () => app.act());
  const controlInputs = new Map(); // key -> { input, output, def }

  function renderToyPanel(info) {
    const recipe = info?.recipe || null;
    if (app.tool === "orbit")
      els.toolHint.textContent = TOOL_HINTS[recipe?.grab ? "stretch" : "orbit"];
    els.toyActionRow.hidden = !recipe?.action;
    els.toyAction.textContent = recipe?.action?.label || "";
    els.toyAliveRow.hidden = !recipe?.alive;
    els.toyControls.textContent = "";
    controlInputs.clear();
    for (const c of recipe?.controls || []) {
      if (c.type === "pulse") continue;
      if (c.type === "toggle") {
        if (recipe.action?.key === c.key) continue;
        const row = document.createElement("label");
        row.className = "check-row";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "switch";
        input.setAttribute("role", "switch");
        input.addEventListener("change", () => app.setControl(c.key, input.checked ? 1 : 0));
        const text = document.createElement("span");
        text.textContent = c.label;
        row.append(input, text);
        els.toyControls.appendChild(row);
        controlInputs.set(c.key, { input, def: c });
        continue;
      }
      const row = document.createElement("label");
      row.className = "row";
      const name = document.createElement("span");
      name.textContent = c.label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.id = `ctl-${c.key}`;
      const output = document.createElement("output");
      output.htmlFor = input.id;
      input.addEventListener("input", () => {
        output.value = `${input.value}%`;
        app.setControl(c.key, Number(input.value) / 100);
      });
      row.append(name, input, output);
      els.toyControls.appendChild(row);
      controlInputs.set(c.key, { input, output, def: c });
    }
    barGame = recipe?.game || null;
    if (recipe?.game) renderGamePanel(recipe.game);
    barSong = recipe?.song || null; // lane Pianos
    if (recipe?.song) renderSongPanel(recipe.song);
    refreshGameBar();
    els.toyOptions.textContent = "";
    // A kit toy's options, or a scan's looks (info.optionDefs).
    for (const o of info?.optionDefs || recipe?.options || []) {
      if (o.hidden) continue;
      const row = document.createElement("label");
      row.className = "row";
      const name = document.createElement("span");
      name.textContent = o.label;
      row.appendChild(name);
      const value = info.options?.[o.key] ?? o.default;
      let input;
      if (o.type === "select") {
        input = document.createElement("select");
        for (const ch of o.choices) input.add(new Option(ch.label, ch.id));
        input.value = value;
        input.addEventListener("change", () => app.setToyOption(o.key, input.value));
      } else if (o.type === "flag") {
        // A country's flag, from the flag catalogue (the Moon's flag).
        input = document.createElement("select");
        input.add(new Option(value.toUpperCase(), value));
        input.value = value;
        loadFlags().then((flags) => {
          input.textContent = "";
          const sorted = flags.slice().sort((a, b) => a.name.localeCompare(b.name));
          for (const f of sorted) input.add(new Option(f.name, f.code));
          input.value = value;
        });
        input.addEventListener("change", () => app.setToyOption(o.key, input.value));
      } else if (o.type === "color") {
        const well = document.createElement("span");
        well.className = "color-well small";
        input = document.createElement("input");
        input.type = "color";
        input.value = value;
        input.setAttribute("aria-label", o.label);
        input.addEventListener("change", () => app.setToyOption(o.key, input.value));
        well.appendChild(input);
        row.appendChild(well);
        els.toyOptions.appendChild(row);
        continue;
      } else if (o.type === "switch") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.className = "switch";
        input.checked = !!value;
        input.addEventListener("change", () => app.setToyOption(o.key, input.checked));
      } else {
        input = document.createElement("input");
        input.type = "range";
        input.min = String(o.min ?? 0);
        input.max = String(o.max ?? 1);
        input.step = String(o.step ?? 0.01);
        input.value = String(value);
        input.addEventListener("change", () => app.setToyOption(o.key, Number(input.value)));
      }
      row.appendChild(input);
      els.toyOptions.appendChild(row);
    }
    if (recipe?.input) renderInputPanel(recipe.input);
    els.toyNote.textContent = recipe
      ? recipe.note || ""
      : "Every toy can bounce, spin, wobble or float. Tap it to make it hop.";
  }

  // A toy that plays a game (the chess set): load a game from a PGN file or
  // pasted text, or go back to its own game.
  // The open game panel: it follows a game that changes on the board by
  // itself (a move played by tapping the pieces starts your own game).
  let panelRefresh = null;
  function renderGamePanel(game) {
    const box = document.createElement("div");
    box.className = "game-box";
    box.id = "toy-game";
    const now = document.createElement("p");
    now.className = "note game-title";
    const error = document.createElement("div");
    error.className = "warning";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".pgn,.txt,application/x-chess-pgn,application/vnd.chess-pgn,text/plain";
    file.hidden = true;
    file.id = "game-file";
    const row = document.createElement("div");
    row.className = "button-row";
    const button = (label, id, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.textContent = label;
      b.addEventListener("click", fn);
      row.appendChild(b);
      return b;
    };
    const paste = document.createElement("div");
    paste.className = "game-paste";
    paste.hidden = true;
    const text = document.createElement("textarea");
    text.id = "game-text";
    text.rows = 5;
    text.spellcheck = false;
    text.setAttribute("aria-label", "A game in PGN");
    text.placeholder = '[White "Morphy"]\n[Black "Allies"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 …';
    const go = document.createElement("button");
    go.type = "button";
    go.id = "game-play-text";
    go.className = "primary";
    go.textContent = "Play this game";
    const goRow = document.createElement("div");
    goRow.className = "button-row";
    goRow.appendChild(go);
    paste.append(text, goRow);
    // The game's details, which can be edited (the title follows them).
    const details = document.createElement("details");
    details.className = "game-details";
    const summary = document.createElement("summary");
    summary.textContent = "Game details";
    details.appendChild(summary);
    const fields = {};
    for (const [key, label] of [
      ["White", "White"],
      ["Black", "Black"],
      ["Event", "Event"],
      ["Site", "Where"],
      ["Date", "Date"],
      ["Result", "Result"],
    ]) {
      const r = document.createElement("label");
      r.className = "row";
      const name = document.createElement("span");
      name.textContent = label;
      const input = document.createElement("input");
      input.type = "text";
      input.id = `game-tag-${key.toLowerCase()}`;
      input.spellcheck = false;
      input.addEventListener("change", async () => {
        await game.setTags({ [key]: input.value.trim() });
        refresh();
      });
      r.append(name, input);
      details.appendChild(r);
      fields[key] = input;
    }
    const refresh = () => {
      now.textContent = `On the board: ${game.title()}`;
      reset.hidden = game.isDefault();
      const tags = game.tags();
      for (const [key, input] of Object.entries(fields)) input.value = tags[key] || "";
      els.toyAction.textContent = app.player?.toyInfo?.recipe?.action?.label || els.toyAction.textContent; // prettier-ignore
      refreshGameBar();
    };
    panelRefresh = { game, title: game.title(), refresh };
    const load = async (source) => {
      error.hidden = true;
      try {
        const g = await game.load(source);
        refresh();
        paste.hidden = true;
        const plies = g.plies.length;
        const moves = Math.ceil((plies + (g.firstTurn === "b" ? 1 : 0)) / 2);
        ui.toast(`${g.title}: ${moves} move${moves === 1 ? "" : "s"}${g.more ? " (the first game in the file)" : ""}`); // prettier-ignore
        app.setControl("play", 0);
        app.setControl("play", 1);
      } catch (err) {
        error.textContent = `That game can't be played: ${err.message}`;
        error.hidden = false;
      }
    };
    button("Open a PGN file…", "game-open", () => file.click());
    button("Paste a game", "game-paste", () => {
      paste.hidden = !paste.hidden;
      if (!paste.hidden) text.focus();
    });
    const reset = button("Opera Game", "game-reset", () => {
      game.reset();
      error.hidden = true;
      refresh();
      app.setControl("play", 0);
    });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      file.value = "";
      if (!f) return;
      if (f.size > 2e6) {
        error.textContent = "That file is too big for one game (over 2 MB).";
        error.hidden = false;
        return;
      }
      load(await f.text());
    });
    go.addEventListener("click", () => load(text.value));
    box.append(now, row, paste, error, file, details);
    els.toyControls.appendChild(box);
    refresh();
  }

  // A drawing pad for a toy's input panel (input.pad = { cols, rows, max,
  // button, value }): a grid you draw on with a soft brush, a Clear button
  // and a button that hands the drawing to input.read as the text
  // "pad:v,v,..." (row by row, each cell 0..max). value() gives the drawing
  // to start from, in the same form.
  function renderInputPad(pad, apply) {
    const cols = pad.cols || 8;
    const rows = pad.rows || 8;
    const max = pad.max || 16;
    const cells = new Array(cols * rows).fill(0);
    const start = String(pad.value?.() || "").replace(/^pad:/, "");
    start
      .split(",")
      .slice(0, cells.length)
      .forEach((v, i) => (cells[i] = Math.max(0, Math.min(max, Number(v) || 0))));
    const wrap = document.createElement("div");
    wrap.className = "input-pad";
    const canvas = document.createElement("canvas");
    canvas.id = "toy-input-pad";
    canvas.width = cols * 24;
    canvas.height = rows * 24;
    canvas.setAttribute("aria-label", pad.label || "Drawing pad");
    const g = canvas.getContext("2d");
    const draw = () => {
      const w = canvas.width / cols;
      const h = canvas.height / rows;
      cells.forEach((v, i) => {
        const t = v / max;
        const c = Math.round(20 + 225 * t);
        g.fillStyle = `rgb(${c},${c},${Math.round(40 + 215 * t)})`;
        g.fillRect((i % cols) * w, Math.floor(i / cols) * h, w - 1, h - 1);
      });
    };
    // A soft brush: the cell under the pointer fills fastest, its
    // neighbors a little.
    const ink = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * cols - 0.5;
      const y = ((e.clientY - r.top) / r.height) * rows - 0.5;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const d = Math.hypot(i - x, j - y);
          if (d < 1.1) cells[j * cols + i] = Math.min(max, cells[j * cols + i] + max * 0.3 * (1.1 - d)); // prettier-ignore
        }
      draw();
    };
    let down = false;
    canvas.addEventListener("pointerdown", (e) => {
      down = true;
      canvas.setPointerCapture?.(e.pointerId);
      ink(e);
    });
    canvas.addEventListener("pointermove", (e) => down && ink(e));
    const up = () => (down = false);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    const buttons = document.createElement("div");
    buttons.className = "button-row";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.id = "toy-input-pad-clear";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
      cells.fill(0);
      draw();
    });
    const go = document.createElement("button");
    go.type = "button";
    go.className = "primary";
    go.id = "toy-input-pad-go";
    go.textContent = pad.button || "Use this drawing";
    go.addEventListener("click", () => apply(`pad:${cells.map((v) => Math.round(v)).join(",")}`));
    buttons.append(clear, go);
    wrap.append(canvas, buttons);
    draw();
    return wrap;
  }

  // ---- Pictures: open a file or a web address (lane Pictures) ------------------------
  // A picture toy's input panel (input.media = { accept: ["pdf", "image",
  // "gif", "video"] }): a button that opens a file of those kinds from this
  // device, a field for a web address, what shows now, the page buttons (or
  // play and pause for a video) and a way back to the toy's sample. Errors
  // (a file this browser can't read, an address that refuses) show in the
  // panel's warning.
  let mediaPanel = null;
  const MEDIA_TYPES = {
    pdf: ".pdf,application/pdf",
    image: "image/*",
    gif: ".gif,image/gif",
    video: "video/*,.mp4,.webm,.mov,.m4v",
  };
  // The web-address box names only what this toy opens, in its accept order:
  // "https://… a video, GIF or picture" (the owner's review, September 29, 2026).
  const MEDIA_WORDS = { pdf: "PDF", image: "picture", gif: "GIF", video: "video" };
  function mediaPlaceholder(kinds) {
    const words = kinds.map((k) => MEDIA_WORDS[k]).filter(Boolean);
    if (!words.length) return "https://…";
    const list =
      words.length > 1 ? `${words.slice(0, -1).join(", ")} or ${words.at(-1)}` : words[0];
    return `https://… a ${list}`;
  }
  function renderInputMedia(media, error) {
    const wrap = document.createElement("div");
    wrap.className = "input-media";
    const kinds = media.accept || Object.keys(MEDIA_TYPES);
    const file = document.createElement("input");
    file.type = "file";
    file.hidden = true;
    file.id = "toy-media-file";
    file.accept = kinds.map((k) => MEDIA_TYPES[k]).join(",");
    file.multiple = !!media.multiple; // a set of pictures at once (lane Books)
    const busy = (on) => {
      for (const b of wrap.querySelectorAll("button")) b.disabled = on;
    };
    const run = async (source) => {
      error.hidden = true;
      busy(true);
      try {
        await app.openMedia(source);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        busy(false);
        refreshMedia();
      }
    };
    const openRow = document.createElement("div");
    openRow.className = "button-row";
    const open = document.createElement("button");
    open.type = "button";
    open.id = "toy-media-open";
    open.className = "primary";
    open.textContent = media.button || "Open a file…";
    open.addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const list = [...(file.files || [])];
      file.value = "";
      if (list.length > 1) run(list);
      else if (list[0]) run(list[0]);
    });
    const sample = document.createElement("button");
    sample.type = "button";
    sample.id = "toy-media-sample";
    sample.textContent = "Back to the sample";
    sample.addEventListener("click", async () => {
      error.hidden = true;
      await app.clearMedia();
      refreshMedia();
    });
    openRow.append(open, sample);
    const form = document.createElement("form");
    form.className = "input-row";
    const url = document.createElement("input");
    url.type = "url";
    url.id = "toy-media-url";
    url.placeholder = mediaPlaceholder(kinds);
    url.spellcheck = false;
    url.autocomplete = "off";
    url.setAttribute("aria-label", "A web address to open");
    const go = document.createElement("button");
    go.type = "submit";
    go.id = "toy-media-go";
    go.textContent = "Open";
    form.append(url, go);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (url.value.trim()) run(url.value.trim());
    });
    const now = document.createElement("p");
    now.className = "note input-shown";
    now.id = "toy-media-now";
    const pages = document.createElement("div");
    pages.className = "button-row";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.id = "toy-media-prev";
    prev.textContent = "Previous";
    prev.addEventListener("click", () => app.pictureStep(-1));
    const next = document.createElement("button");
    next.type = "button";
    next.id = "toy-media-next";
    next.textContent = "Next";
    next.addEventListener("click", () => app.pictureStep(1));
    const play = document.createElement("button");
    play.type = "button";
    play.id = "toy-media-play";
    play.addEventListener("click", () => {
      app.pictureTogglePlay();
      refreshMedia();
    });
    pages.append(prev, next, play);
    // A video's scrub bar and its time (lane Books, for lane Screens).
    const scrubRow = document.createElement("div");
    scrubRow.className = "input-row media-scrub";
    scrubRow.hidden = true;
    const scrub = document.createElement("input");
    scrub.type = "range";
    scrub.id = "toy-media-scrub";
    scrub.min = "0";
    scrub.max = "1000";
    scrub.step = "1";
    scrub.value = "0";
    scrub.setAttribute("aria-label", "Where the video is");
    const clock = document.createElement("span");
    clock.className = "note";
    clock.id = "toy-media-time";
    let dragging = false;
    scrub.addEventListener("pointerdown", () => (dragging = true));
    scrub.addEventListener("change", () => (dragging = false));
    scrub.addEventListener("input", () => {
      const d = app.player?.pictures?.api.duration || 0;
      if (d) app.pictureSeek((Number(scrub.value) / 1000) * d);
    });
    scrubRow.append(scrub, clock);
    const tick = () => {
      if (!scrub.isConnected) return;
      const api = app.player?.pictures?.api;
      const d = api?.duration || 0;
      if (!scrubRow.hidden && d) {
        if (!dragging) scrub.value = String(Math.round((api.time / d) * 1000));
        const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
        clock.textContent = `${fmt(api.time)} / ${fmt(d)}`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // A set's pictures in their order, to move up and down (lane Books:
    // `media.list`, the digital frame).
    const list = document.createElement("ol");
    list.className = "media-list";
    list.id = "toy-media-list";
    list.hidden = true;
    wrap.append(openRow, form, now, pages, scrubRow, list, file);
    mediaPanel = { now, prev, next, play, pages, sample, scrubRow, list: media.list ? list : null, listKey: "" }; // prettier-ignore
    refreshMedia();
    // Again once the panel is in the page (lane Books): pages that arrived
    // before it would otherwise leave it blank until the next page.
    requestAnimationFrame(() => refreshMedia());
    // A toy that opens PDFs keeps the words of the page on show (the text layer).
    if (kinds.includes("pdf")) wrap.insertBefore(renderMediaText(), file);
    return wrap;
  }

  // What the picture panel shows: the name, the page or frame count, and
  // the buttons that apply.
  function refreshMedia(p = app.player?.pictures?.info() || null) {
    const m = mediaPanel;
    if (!m || !m.now.isConnected) return;
    const own = !!app.player?.scene?.toy?.media;
    m.sample.hidden = !own;
    if (!p?.kind) {
      m.now.textContent = "Opening…";
      m.pages.hidden = true;
      return;
    }
    const what = { pdf: "a PDF", image: "a picture", gif: "a GIF", video: "a video" }[p.kind];
    const set = p.kind === "image" && p.count > 1; // a set of pictures (lane Books)
    const where = p.kind === "pdf" ? `, page ${p.page + 1} of ${p.count}` : p.kind === "gif" ? `, ${p.count} frames` : set ? `, picture ${p.page + 1}` : ""; // prettier-ignore
    m.now.textContent = set ? `Showing ${p.name}${where}.` : `Showing ${p.name} (${what}${where}).`;
    const paged = (p.kind === "pdf" || set) && p.count > 1;
    m.prev.hidden = m.next.hidden = !paged;
    m.prev.disabled = p.page <= 0;
    m.next.disabled = p.page >= p.count - 1;
    m.play.hidden = p.kind !== "video";
    m.play.textContent = p.playing ? "Pause" : "Play";
    m.scrubRow.hidden = p.kind !== "video";
    m.pages.hidden = !paged && p.kind !== "video";
    if (m.list) refreshMediaList(m, set);
  }

  // The set's list (lane Books): a small picture and the name of each, with
  // buttons to move it up or down. Rebuilt when the set or its order
  // changes.
  function refreshMediaList(m, set) {
    const api = app.player?.pictures?.api;
    const names = set && api ? api.names : [];
    m.list.hidden = names.length < 2;
    const key = names.join("\n");
    if (key === m.listKey) return;
    m.listKey = key;
    m.list.textContent = "";
    const move = (j, d) => {
      const order = names.map((_, i) => i);
      [order[j], order[j + d]] = [order[j + d], order[j]];
      if (api.reorder(order)) refreshMedia();
    };
    names.forEach((name, j) => {
      const li = document.createElement("li");
      const pic = document.createElement("canvas");
      pic.width = pic.height = 40;
      pic.setAttribute("aria-hidden", "true");
      api.thumb(j, 40).then((c) => {
        if (!c || !pic.isConnected) return;
        const g = pic.getContext("2d");
        g.drawImage(c, (40 - c.width) / 2, (40 - c.height) / 2);
      });
      const label = document.createElement("span");
      label.textContent = name;
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.disabled = j === 0;
      up.setAttribute("aria-label", `Move ${name} up`);
      up.addEventListener("click", () => move(j, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.disabled = j === names.length - 1;
      down.setAttribute("aria-label", `Move ${name} down`);
      down.addEventListener("click", () => move(j, 1));
      li.append(pic, label, up, down);
      m.list.append(li);
    });
  }

  // ---- Words on the page: a PDF's text layer ----------------------------------------
  // A PDF's pages show as splats, pictures of text: a screen reader can't
  // read them, and nobody can select, copy or search them. A toy that opens
  // PDFs keeps the real words of the page on show (from the PDF's own text
  // layer, read by PDF.js) in a box that folds open under the picture panel,
  // to read, select, copy and find across the PDF. It doesn't protect the
  // PDF; it makes the splat page as readable as the PDF itself. Words are
  // read only while the box is open.
  let mediaText = null;
  let mediaTextOpen = false; // the box stays open when the panel is rebuilt
  const NO_TEXT = "This page has no text layer (it may be a scan), so there are no words to show.";
  const FIND_MAX = 50; // results listed

  // A PDF's lines break where the page ran out of width, so they join into
  // paragraphs. One ends at a blank line, after a line well short of the
  // page's full ones (a paragraph's last line, a heading, a table's row),
  // before a list item, and before a short line after a sentence's end (a
  // heading). A word split at a line's end keeps its hyphen.
  function textParagraphs(text) {
    const lines = text.split("\n").map((l) => l.trim());
    const lengths = lines
      .filter(Boolean)
      .map((l) => l.length)
      .sort((a, b) => a - b);
    const full = lengths[Math.floor(lengths.length * 0.8)] || 0;
    const out = [];
    let cur = "";
    const end = () => {
      if (cur) out.push(cur);
      cur = "";
    };
    for (const line of lines) {
      if (!line) {
        end();
        continue;
      }
      const short = line.length < full * 0.75;
      const item = /^([•◦▪‣∙–—-]|\d{1,3}[.)])\s/.test(line);
      if (item || (short && /[.!?:]["'”’)]?$/.test(cur))) end();
      const hyphen = /\p{L}-$/u.test(cur) && /^\p{Ll}/u.test(line);
      cur = !cur ? line : hyphen ? cur + line : `${cur} ${line}`;
      if (short) end();
    }
    end();
    return out;
  }

  // Finds what was typed, whatever its case, spaces made one.
  function findPattern(q) {
    const words = q.trim().replace(/\s+/g, " ");
    return words ? new RegExp(`(${words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi") : null;
  }

  // Text into el, with each match of the search marked.
  function appendMarked(el, s, re) {
    if (!re) {
      el.append(s);
      return;
    }
    s.split(re).forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 0) {
        el.append(part);
        return;
      }
      const mark = document.createElement("mark");
      mark.textContent = part;
      el.append(mark);
    });
  }

  // A few words either side of a match, cut at spaces.
  function snippet(flat, at, len) {
    let a = Math.max(0, at - 40);
    let b = Math.min(flat.length, at + len + 60);
    if (a > 0) {
      const sp = flat.indexOf(" ", a);
      if (sp >= 0 && sp < at) a = sp + 1;
    }
    if (b < flat.length) {
      const sp = flat.lastIndexOf(" ", b);
      if (sp > at + len) b = sp;
    }
    return `${a > 0 ? "…" : ""}${flat.slice(a, b)}${b < flat.length ? "…" : ""}`;
  }

  function renderMediaText() {
    const box = document.createElement("details");
    box.id = "toy-media-text-box";
    box.className = "media-text-box";
    box.hidden = true;
    box.open = mediaTextOpen;
    const summary = document.createElement("summary");
    summary.textContent = "Words on this page";
    const words = document.createElement("div");
    words.id = "toy-media-text";
    words.className = "media-text";
    words.tabIndex = 0;
    words.setAttribute("role", "region");
    words.setAttribute("aria-label", "Words on this page");
    const reading = document.createElement("p");
    reading.className = "note";
    reading.textContent = "Reading the page…";
    words.append(reading);
    // Select all (Ctrl or Cmd and A) takes this page's words, not the site.
    words.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        getSelection()?.selectAllChildren(words);
      }
    });
    const tools = document.createElement("div");
    tools.className = "media-text-tools";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.id = "toy-media-copy";
    copy.textContent = "Copy";
    copy.title = "Copy the words on this page";
    copy.disabled = true; // until the page's words are in
    const form = document.createElement("form");
    form.className = "input-row";
    form.setAttribute("role", "search");
    const find = document.createElement("input");
    find.type = "search";
    find.id = "toy-media-find";
    find.placeholder = "Find words in this PDF";
    find.spellcheck = false;
    find.autocomplete = "off";
    find.setAttribute("aria-label", "Find words in this PDF");
    const go = document.createElement("button");
    go.type = "submit";
    go.id = "toy-media-find-go";
    go.textContent = "Find";
    form.append(find, go);
    tools.append(copy, form);
    const note = document.createElement("p");
    note.className = "note media-find-note";
    note.id = "toy-media-find-note";
    note.setAttribute("role", "status");
    note.hidden = true;
    const found = document.createElement("ol");
    found.id = "toy-media-found";
    found.className = "media-found";
    found.hidden = true;
    box.append(summary, words, tools, note, found);
    const t = { box, words, copy, find, note, found, media: null, page: -1, text: null, re: null, search: 0, copyTimer: 0 }; // prettier-ignore
    mediaText = t;
    box.addEventListener("toggle", () => {
      mediaTextOpen = box.open;
      refreshMediaText();
    });
    copy.addEventListener("click", async () => {
      const text = textParagraphs(t.text || "").join("\n\n");
      if (!text) return;
      const say = (w) => {
        copy.textContent = w;
        clearTimeout(t.copyTimer);
        t.copyTimer = setTimeout(() => (copy.textContent = "Copy"), 1600);
      };
      try {
        await navigator.clipboard.writeText(text);
        say("Copied");
      } catch {
        // No clipboard here (an older browser, or it was refused): the words
        // are selected, for the device's own Copy.
        getSelection()?.selectAllChildren(words);
        let done = false;
        try {
          done = document.execCommand("copy");
        } catch {}
        say(done ? "Copied" : "Selected");
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      findInMedia(find.value);
    });
    requestAnimationFrame(() => refreshMediaText());
    return box;
  }

  // Shows page n's words, marked where they match the search.
  function showWords(t, text, n) {
    t.words.replaceChildren();
    t.words.removeAttribute("aria-busy");
    t.words.setAttribute("aria-label", `Words on page ${n + 1}`);
    t.copy.disabled = !text;
    if (!text) {
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = NO_TEXT;
      t.words.append(p);
      return;
    }
    for (const para of textParagraphs(text)) {
      const p = document.createElement("p");
      appendMarked(p, para, t.re);
      t.words.append(p);
    }
    // The top of the page, or down to the first match when it's further on.
    const mark = t.words.querySelector("mark");
    const below = mark && mark.offsetTop + mark.offsetHeight > t.words.clientHeight - 8;
    t.words.scrollTop = below ? Math.max(0, mark.offsetTop - 24) : 0;
  }

  // Reads page n's words (from the PDF, or its cache) into the box.
  function loadWords(t, n) {
    t.page = n;
    t.text = null;
    t.words.setAttribute("aria-label", `Words on page ${n + 1}`);
    t.words.setAttribute("aria-busy", "true");
    // "Reading…" only for a page that takes a moment (not one read before).
    const slow = setTimeout(() => {
      if (t.page !== n || t.text !== null) return;
      const p = document.createElement("p");
      p.className = "note";
      p.textContent = "Reading the page…";
      t.words.replaceChildren(p);
    }, 150);
    app.player.pictures.api.text(n).then((text) => {
      clearTimeout(slow);
      if (mediaText !== t || t.page !== n || t.media !== app.player?.pictures?.media) return;
      t.text = text;
      showWords(t, text, n);
    });
  }

  // The words box follows the page on show: shown for a PDF, and reading a
  // new page's words while it is open.
  function refreshMediaText(p = app.player?.pictures?.info() || null) {
    const t = mediaText;
    if (!t || !t.box.isConnected) return;
    const media = app.player?.pictures?.media || null;
    const pdf = p?.kind === "pdf" && media?.kind === "pdf" && !!media.text;
    t.box.hidden = !pdf;
    if (media !== t.media) {
      // Other media: forget its page, the search and the results.
      t.media = media;
      t.page = -1;
      t.text = null;
      t.re = null;
      t.search++;
      t.note.hidden = t.found.hidden = true;
      t.found.replaceChildren();
    }
    if (!pdf || !t.box.open || p.page === t.page) return;
    loadWords(t, p.page);
  }

  // Finds words across the PDF, page by page: the pages' words are read
  // once (the PDF keeps them), and the first FIND_MAX matches are listed,
  // each a button to its page.
  async function findInMedia(q) {
    const t = mediaText;
    const media = app.player?.pictures?.media;
    const id = ++t.search;
    t.re = findPattern(q);
    t.found.replaceChildren();
    t.found.hidden = true;
    if (t.text !== null) showWords(t, t.text, t.page); // marks on the page on show
    t.note.hidden = !t.re;
    if (!t.re || !media?.text) return;
    const hits = [];
    let total = 0;
    let pages = 0;
    for (let n = 0; n < media.count; n++) {
      if (n % 10 === 0) t.note.textContent = `Looking through page ${n + 1} of ${media.count}…`;
      const flat = textParagraphs(await app.player.pictures.api.text(n)).join(" ");
      // A newer search, other media or a new panel: this one stops.
      if (mediaText !== t || t.search !== id || app.player?.pictures?.media !== media) return;
      let on = 0;
      for (const m of flat.matchAll(t.re)) {
        on++;
        if (hits.length < FIND_MAX) hits.push({ n, text: snippet(flat, m.index, m[0].length) });
      }
      total += on;
      if (on) pages++;
    }
    const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    t.note.textContent = !total
      ? "No matches."
      : `Found ${plural(total, "match", "matches")} on ${plural(pages, "page", "pages")}.${total > hits.length ? ` The first ${hits.length} are listed.` : ""}`; // prettier-ignore
    for (const h of hits) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const where = document.createElement("span");
      where.className = "media-found-page";
      where.textContent = `Page ${h.n + 1}:`;
      b.append(where, " ");
      appendMarked(b, h.text, t.re);
      b.addEventListener("click", () => {
        app.pictureGo(h.n);
        // Already on that page: its first match comes into view again.
        if (t.page === h.n && t.text !== null) showWords(t, t.text, h.n);
      });
      li.append(b);
      t.found.append(li);
    }
    t.found.hidden = !hits.length;
  }
  // ---- End of pictures ---------------------------------------------------------------

  // A toy that takes something of yours (the molecule: a name, formula or
  // SMILES, or a file; the protein: a PDB or mmCIF file). The recipe's
  // input.read turns it into option values, or throws a message to show.
  function renderInputPanel(input) {
    const box = document.createElement("div");
    box.className = "input-box";
    box.id = "toy-input";
    const title = document.createElement("p");
    title.className = "input-title";
    title.textContent = input.title;
    const shown = document.createElement("p");
    shown.className = "note input-shown";
    shown.textContent = input.shown?.() || "";
    shown.hidden = !shown.textContent;
    const error = document.createElement("div");
    error.className = "warning";
    error.setAttribute("role", "alert");
    error.hidden = true;
    // file: the File itself, for a recipe with input.binary (a sound file,
    // say), which reads it itself; the text is then "". files: every file
    // picked, for a recipe with input.multiple too (a model and its textures).
    const apply = async (text, fileName = "", file = null, files = file ? [file] : []) => {
      error.hidden = true;
      try {
        const options = await input.read(text, fileName, file, files);
        await app.setToyOptions(options);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    };
    box.append(title);
    if (input.placeholder) {
      const row = document.createElement("form");
      row.className = "input-row";
      const text = document.createElement("input");
      text.type = "text";
      text.id = "toy-input-text";
      text.placeholder = input.placeholder;
      text.spellcheck = false;
      text.autocomplete = "off";
      text.setAttribute("aria-label", input.title);
      const go = document.createElement("button");
      go.type = "submit";
      go.className = "primary";
      go.id = "toy-input-go";
      go.textContent = input.button || "Show it";
      row.append(text, go);
      row.addEventListener("submit", (e) => {
        e.preventDefault();
        apply(text.value);
      });
      box.append(row);
    }
    if (input.pad) box.append(renderInputPad(input.pad, apply));
    if (input.media) box.append(renderInputMedia(input.media, error)); // Pictures
    if (input.live) box.append(renderLive(input.live, { error })); // Live input
    const file = document.createElement("input");
    file.type = "file";
    file.accept = input.accept || "";
    file.multiple = !!input.multiple;
    file.hidden = true;
    file.id = "toy-input-file";
    const fileRow = document.createElement("div");
    fileRow.className = "button-row";
    // fileButton: false leaves the file button out (a toy that only takes
    // typing or drawing).
    fileRow.hidden = input.fileButton === false || !!input.media;
    const open = document.createElement("button");
    open.type = "button";
    open.id = "toy-input-open";
    open.textContent = input.fileButton || "Open a file…";
    open.addEventListener("click", () => file.click());
    fileRow.append(open);
    file.addEventListener("change", async () => {
      const files = [...(file.files || [])];
      const f = files[0];
      file.value = "";
      if (!f) return;
      // input.maxBytes (lane Live input r2): a toy that streams its file
      // (the song landscape) may take bigger ones.
      const max = input.maxBytes || 40e6;
      if (files.reduce((sum, x) => sum + x.size, 0) > max) {
        error.textContent = `That file is too big (over ${Math.round(max / 1e6)} MB).`;
        error.hidden = false;
        return;
      }
      if (input.binary) apply("", f.name, f, files);
      else apply(await f.text(), f.name);
    });
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = input.note || "";
    box.append(fileRow, shown, error, note, file);
    els.toyOptions.appendChild(box);
  }

  // ---- The game bar -----------------------------------------------------------------
  // Under the board while a game toy (the chess set) is out: the game's title
  // and details, where it has got to, and buttons to play, pause, step and
  // jump. Tapping the board also plays or pauses.
  let barGame = null;
  let barSong = null; // the song bar's song (lane Pianos)
  let seeking = false;
  const playing = () => (app.player?.motion?.targets?.play ?? 0) > 0.5;
  function refreshGameBar() {
    const game = barGame;
    const song = !game ? barSong : null;
    els.gameBar.hidden = !game && !song;
    // The song bar (lane Pianos) is the game bar with its song buttons.
    els.gameBar.classList.toggle("song-bar", !!song);
    for (const id of ["game-back", "game-next", "game-end", "game-bar-title"])
      $(id).hidden = !!song;
    for (const el of [els.songTitle, els.songLoop, els.songSpeed, els.songSeek]) el.hidden = !song;
    if (song) return refreshSongBar(song);
    if (!game) return;
    const tags = game.tags();
    const known = (x) => (x && !/^[?.\s]*$/.test(x) ? x : "");
    const date = known(tags.Date)
      .replace(/\.\?\?/g, "")
      .replace(/\./g, "-");
    els.gameBarTitle.textContent = game.title();
    els.gameBarInfo.textContent = [known(tags.Event), known(tags.Site), date, known(tags.Result)]
      .filter(Boolean)
      .filter((x, i, a) => a.indexOf(x) === i)
      .join(" · ");
    const st = game.state();
    const moves = Math.ceil(st.n / 2);
    const at = Math.ceil(st.played / 2);
    els.gameBarMove.textContent = st.over
      ? `Game over after ${moves} moves`
      : st.played
        ? `Move ${at} of ${moves}`
        : `${moves} moves`;
    els.gamePlay.dataset.playing = String(playing());
    els.gamePlay.setAttribute("aria-label", playing() ? "Pause" : "Play");
  }
  setInterval(() => {
    if (barSong && !barGame && !document.hidden) refreshSongBar(barSong);
    if (!barGame || document.hidden) return;
    const p = panelRefresh;
    if (p && p.game === barGame && p.game.title() !== p.title) {
      p.title = p.game.title();
      p.refresh();
    } else refreshGameBar();
  }, 250);
  const pause = () => app.setControl("play", 0);
  $("game-start").addEventListener("click", () => {
    if (barSong && !barGame) {
      barSong.toStart();
      return refreshSongBar(barSong);
    }
    pause();
    barGame?.jump("start");
  });
  $("game-back").addEventListener("click", () => {
    pause();
    barGame?.step(-1);
  });
  $("game-next").addEventListener("click", () => {
    pause();
    barGame?.step(1);
  });
  $("game-end").addEventListener("click", () => {
    pause();
    barGame?.jump("end");
  });
  els.gamePlay.addEventListener("click", () => {
    if (barSong && !barGame) {
      if (barSong.state().playing) barSong.pause();
      else barSong.play();
      return refreshSongBar(barSong);
    }
    if (!barGame) return;
    if (playing()) pause();
    else {
      if (barGame.state().over) barGame.jump("start");
      app.setControl("play", 1);
    }
    refreshGameBar();
  });

  // ---- The song bar (lane Pianos) ---------------------------------------------------
  // The game bar for a keyboard toy's song (recipe.song, made by
  // songControls in src/songs.js): a title you can edit, back to the start,
  // play and pause, loop, speed, and a slider for where the song has got to
  // (drag it to move there).
  function refreshSongBar(song) {
    const st = song.state();
    if (document.activeElement !== els.songTitle) els.songTitle.value = song.title();
    els.gameBarInfo.textContent = song.info?.() || "";
    els.gameBarMove.textContent = `${songClock(st.pos)} / ${songClock(st.length)}`;
    if (!seeking) els.songSeek.value = String(Math.round((1000 * st.pos) / Math.max(0.01, st.length))); // prettier-ignore
    els.songLoop.setAttribute("aria-pressed", String(!!st.loop));
    if (document.activeElement !== els.songSpeed) els.songSpeed.value = String(st.speed);
    els.gamePlay.dataset.playing = String(!!st.playing);
    els.gamePlay.setAttribute("aria-label", st.playing ? "Pause" : "Play");
    els.gamePlay.title = st.playing ? "Pause" : "Play the song";
  }
  const songClock = (sec) => {
    const x = Math.max(0, Math.floor(sec + 1e-6));
    return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
  };
  els.songTitle.addEventListener("change", () => {
    barSong?.setTitle(els.songTitle.value.trim());
    songPanelRefresh?.();
    if (barSong) refreshSongBar(barSong);
  });
  els.songTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.songTitle.blur();
  });
  els.songLoop.addEventListener("click", () => {
    if (!barSong) return;
    barSong.setLoop(!barSong.state().loop);
    refreshSongBar(barSong);
  });
  els.songSpeed.addEventListener("change", () => {
    barSong?.setSpeed(Number(els.songSpeed.value));
    if (barSong) refreshSongBar(barSong);
  });
  els.songSeek.addEventListener("input", () => {
    if (!barSong) return;
    seeking = true;
    barSong.seek((Number(els.songSeek.value) / 1000) * barSong.state().length);
    refreshSongBar(barSong);
  });
  els.songSeek.addEventListener("change", () => {
    seeking = false;
  });

  // The Toy tab's song panel: the toy's own songs, a MIDI file of yours or a
  // tune in ABC notation pasted as text.
  let songPanelRefresh = null;
  function renderSongPanel(song) {
    const box = document.createElement("div");
    box.className = "game-box song-box";
    box.id = "toy-song";
    const now = document.createElement("p");
    now.className = "note game-title";
    const pick = document.createElement("label");
    pick.className = "row";
    const pickName = document.createElement("span");
    pickName.textContent = "Song";
    const select = document.createElement("select");
    select.id = "song-choice";
    pick.append(pickName, select);
    const error = document.createElement("div");
    error.className = "warning";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".mid,.midi,.kar,.rmi,.abc,.txt,audio/midi,audio/x-midi,text/plain";
    file.hidden = true;
    file.id = "song-file";
    const row = document.createElement("div");
    row.className = "button-row";
    const button = (label, id, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.id = id;
      b.textContent = label;
      b.addEventListener("click", fn);
      row.appendChild(b);
      return b;
    };
    const paste = document.createElement("div");
    paste.className = "game-paste";
    paste.hidden = true;
    const text = document.createElement("textarea");
    text.id = "song-text";
    text.rows = 6;
    text.spellcheck = false;
    text.setAttribute("aria-label", "A tune in ABC notation");
    text.placeholder = "X:1\nT:A folk tune\nM:4/4\nL:1/8\nK:G\n|:GABG DGBG|dcBA B2AB|…";
    const go = document.createElement("button");
    go.type = "button";
    go.id = "song-play-text";
    go.className = "primary";
    go.textContent = "Play this tune";
    const goRow = document.createElement("div");
    goRow.className = "button-row";
    goRow.appendChild(go);
    paste.append(text, goRow);
    const note = document.createElement("p");
    note.className = "note";
    note.textContent =
      "A MIDI file (.mid) plays key for key; notes beyond the keyboard move up or down by octaves. ABC is a plain-text tune format (thousands of folk tunes are online). Your file stays on your device.";
    const refresh = () => {
      select.textContent = "";
      for (const s of song.list()) select.add(new Option(s.title, s.id));
      select.value = song.current();
      now.textContent = `Playing: ${song.title()}`;
    };
    songPanelRefresh = refresh;
    select.addEventListener("change", () => {
      song.choose(select.value);
      error.hidden = true;
      refresh();
      refreshSongBar(song);
    });
    const load = async (data, name) => {
      error.hidden = true;
      try {
        const r = await song.load(data, name);
        refresh();
        refreshSongBar(song);
        paste.hidden = true;
        const moved = r.moved ? `; ${r.moved} note${r.moved === 1 ? "" : "s"} moved by octaves to fit` : ""; // prettier-ignore
        ui.toast(`${r.title}: ${r.notes} notes, ${songClock(r.length)}${moved}`);
        song.play();
      } catch (err) {
        error.textContent = `That song can't be played: ${err.message}`;
        error.hidden = false;
      }
    };
    button("Open a MIDI file…", "song-open", () => file.click());
    button("Paste ABC", "song-paste", () => {
      paste.hidden = !paste.hidden;
      if (!paste.hidden) text.focus();
    });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      file.value = "";
      if (!f) return;
      if (f.size > 2e6) {
        error.textContent = "That file is too big for a song (over 2 MB).";
        error.hidden = false;
        return;
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      const midi = String.fromCharCode(...bytes.subarray(0, 4));
      load(midi === "MThd" || midi === "RIFF" ? bytes : new TextDecoder().decode(bytes), f.name);
    });
    go.addEventListener("click", () => load(text.value, ""));
    box.append(now, pick, row, paste, error, note, file);
    els.toyControls.appendChild(box);
    refresh();
  }

  function showMotion(m, controls = {}) {
    for (const b of els.toyMove.children)
      b.setAttribute("aria-pressed", String(b.dataset.move === m.move));
    els.toySpeed.value = String(Math.round(m.speed * 100));
    els.toySpeedValue.value = pct(m.speed);
    els.toyAlive.checked = m.alive;
    for (const [key, c] of controlInputs) {
      const v = controls[key] ?? m.controls?.[key] ?? c.def.default ?? 0;
      if (c.def.type === "toggle") c.input.checked = v > 0.5;
      else {
        c.input.value = String(Math.round(v * 100));
        c.output.value = pct(v);
      }
    }
  }

  // ---- Pattern ------------------------------------------------------------------
  for (const p of PATTERNS) els.patId.add(new Option(p.label, p.id));
  for (const p of PROJECTIONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.proj = p.id;
    b.textContent = p.label;
    b.addEventListener("click", () => app.setPattern({ projection: p.id }));
    els.patProj.appendChild(b);
  }
  let flagsListed = null;
  function listFlags() {
    flagsListed ||= loadFlags().then((flags) => {
      const sorted = flags.slice().sort((a, b) => a.name.localeCompare(b.name));
      for (const f of sorted) {
        els.patFlag.add(new Option(f.name, f.code));
        els.toyFlag.add(new Option(f.name, f.code));
      }
      const p = app.player?.scene.pattern;
      els.patFlag.value = p?.flag || "";
      els.toyFlag.value = p?.id === "flag" ? p.flag : "";
    });
    return flagsListed;
  }
  // The flag list is small; fetch it soon after start so pickers are full
  // before anyone opens them.
  setTimeout(listFlags, 1500);
  // The quick "Flag colours" picker in the Play tab.
  els.toyFlag.addEventListener("focus", listFlags);
  els.toyFlag.addEventListener("pointerdown", listFlags);
  els.toyFlag.addEventListener("change", () => {
    const code = els.toyFlag.value;
    app.setPattern(code ? { id: "flag", flag: code } : { id: "none" });
  });
  els.patId.addEventListener("change", () => app.setPattern({ id: els.patId.value }));
  els.patFlag.addEventListener("change", () => app.setPattern({ flag: els.patFlag.value }));
  for (const [i, el] of [els.patC1, els.patC2, els.patC3].entries()) {
    el.addEventListener("input", () => {
      const colors = app.player.scene.pattern.colors.slice();
      colors[i] = el.value;
      app.setPattern({ colors });
    });
  }
  const patSlider = (el, key, out, fmt) => {
    el.addEventListener("input", () => {
      const v = key === "repeats" ? Number(el.value) : Number(el.value) / 100;
      out.value = fmt(v);
      app.setPattern({ [key]: v });
    });
  };
  patSlider(els.patRepeats, "repeats", els.patRepeatsValue, (v) => String(v));
  patSlider(els.patScale, "scale", els.patScaleValue, pct);
  patSlider(els.patAmount, "amount", els.patAmountValue, pct);
  patSlider(els.patDetail, "detail", els.patDetailValue, pct);
  const COLOURED = [
    "stripes",
    "bands",
    "dots",
    "checks",
    "stars",
    "hearts",
    "zigzag",
    "gradient",
    "marble",
  ];

  function showPattern(p) {
    els.patId.value = p.id;
    els.patFlagRow.hidden = p.id !== "flag";
    if (p.id === "flag") listFlags().then(() => (els.patFlag.value = p.flag));
    if (els.toyFlag.options.length > 1 || p.id === "flag")
      listFlags().then(() => (els.toyFlag.value = p.id === "flag" ? p.flag : ""));
    els.patColorsRow.hidden = !COLOURED.includes(p.id);
    els.patC1.value = p.colors[0];
    els.patC2.value = p.colors[1];
    els.patC3.value = p.colors[2];
    els.patMore.hidden = p.id === "none";
    els.patScaleRow.hidden = ["flag", "gradient", "rainbow"].includes(p.id);
    for (const b of els.patProj.children)
      b.setAttribute("aria-pressed", String(b.dataset.proj === p.projection));
    els.patRepeats.value = String(p.repeats);
    els.patRepeatsValue.value = String(p.repeats);
    els.patRepeats.disabled = p.projection === "front";
    els.patScale.value = String(Math.round(p.scale * 100));
    els.patScaleValue.value = pct(p.scale);
    els.patAmount.value = String(Math.round(p.amount * 100));
    els.patAmountValue.value = pct(p.amount);
    els.patDetail.value = String(Math.round(p.detail * 100));
    els.patDetailValue.value = pct(p.detail);
  }

  // ---- Sound --------------------------------------------------------------------
  els.soundToggle.addEventListener("click", () => app.toggleSound());

  // ---- View settings (lane Viewer) ----------------------------------------------
  els.turntableToggle.addEventListener("click", () => app.toggleTurntable());
  els.tiltToggle.addEventListener("click", () => app.toggleTiltLock());
  els.viewReset.addEventListener("click", () => app.resetCamera());

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
  for (const b of els.lookDetail.querySelectorAll("button")) {
    b.addEventListener("click", () => app.setDetail(b.dataset.detail));
  }
  for (const e of IDLE_EFFECTS) els.autoEffect.add(new Option(e.label, e.id));
  // Reset everything: a second tap within a few seconds confirms.
  let resetArmed = null;
  const disarmReset = () => {
    clearTimeout(resetArmed);
    resetArmed = null;
    els.resetAll.textContent = "Reset everything";
    els.resetAll.classList.remove("armed");
  };
  els.resetAll.addEventListener("click", async () => {
    if (!resetArmed) {
      els.resetAll.textContent = "Tap again to reset";
      els.resetAll.classList.add("armed");
      resetArmed = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    await app.resetAll();
  });
  els.resetAll.addEventListener("blur", () => resetArmed && setTimeout(disarmReset, 200));
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
  els.embedSize.addEventListener("change", () => app.updateEmbed());
  els.embedCopy.addEventListener("click", () =>
    copyText(els.embedSnippet, "Iframe snippet copied."),
  );
  els.elementCopy.addEventListener("click", () =>
    copyText(els.elementSnippet, "Element snippet copied."),
  );

  // ---- Tabs ------------------------------------------------------------------------
  const tabs = [...els.tabs.querySelectorAll("[role='tab']")];
  let currentTab = "play";
  function showTab(name, { focus = false } = {}) {
    for (const t of tabs) {
      const on = t.id === `tab-${name}`;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    }
    const changed = currentTab !== name;
    currentTab = name;
    if (changed) els.panes.scrollTop = 0;
    if (name === "share") app.updateEmbed();
  }
  for (const t of tabs) t.addEventListener("click", () => showTab(t.id.slice(4)));
  els.tabs.addEventListener("keydown", (e) => {
    const i = tabs.findIndex((t) => t.id === `tab-${currentTab}`);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    showTab(tabs[j].id.slice(4), { focus: true });
  });

  // ---- Panel and shelf size (wide screens) ------------------------------------------
  // Drag the panel's left edge to make the panel (and the shelf, which gains
  // columns) wider, and the grip under the shelf to show more rows of toys.
  // Double-click a grip to switch between the usual and a big size; the arrow
  // keys move a focused grip. The sizes are kept in this browser.
  const SIZES = {
    panel: { css: "--panel-w", key: "splashery.panelWidth", min: 300, usual: 344, big: 560, step: 24 }, // prettier-ignore
    shelf: { css: "--shelf-h", key: "splashery.shelfHeight", min: 120, usual: 232, big: 460, step: 24 }, // prettier-ignore
  };
  const sizeMax = {
    panel: () => Math.max(300, Math.min(760, window.innerWidth * 0.62)),
    shelf: () => Math.max(120, window.innerHeight * 0.62),
  };
  const sizes = {};
  function setSize(which, v, save = true) {
    const S = SIZES[which];
    const n = Math.round(Math.min(sizeMax[which](), Math.max(S.min, v)));
    sizes[which] = n;
    document.documentElement.style.setProperty(S.css, `${n}px`);
    grips[which].setAttribute("aria-valuenow", String(n));
    if (!save) return;
    try {
      localStorage.setItem(S.key, String(n));
    } catch {
      // Private windows may refuse storage; the size still applies now.
    }
  }
  function makeGrip(which, label, orientation, parent, before = null) {
    const g = document.createElement("div");
    g.className = `grip grip-${which}`;
    g.setAttribute("role", "separator");
    g.setAttribute("aria-orientation", orientation);
    g.setAttribute("aria-label", label);
    g.setAttribute("aria-valuemin", String(SIZES[which].min));
    g.title = `${label}: drag, or double-click for a bigger size`;
    g.tabIndex = 0;
    parent.insertBefore(g, before);
    return g;
  }
  const grips = {
    panel: makeGrip("panel", "Panel width", "vertical", els.panel, els.panel.firstChild),
    shelf: makeGrip("shelf", "Shelf height", "horizontal", els.dock, els.shelf.nextSibling),
  };
  for (const [which, g] of Object.entries(grips)) {
    const S = SIZES[which];
    // The panel grows leftwards (it sits on the right); the shelf downwards.
    const sign = which === "panel" ? -1 : 1;
    let drag = null;
    g.addEventListener("pointerdown", (e) => {
      if (narrow.matches || e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      drag = { at: which === "panel" ? e.clientX : e.clientY, from: sizes[which] ?? S.usual };
      document.body.classList.add("resizing");
    });
    g.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const now = which === "panel" ? e.clientX : e.clientY;
      setSize(which, drag.from + sign * (now - drag.at), false);
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      document.body.classList.remove("resizing");
      setSize(which, sizes[which]);
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
    g.addEventListener("dblclick", () => {
      const cur = sizes[which] ?? S.usual;
      setSize(which, cur < (S.usual + S.big) / 2 ? S.big : S.usual);
    });
    g.addEventListener("keydown", (e) => {
      const grow = which === "panel" ? "ArrowLeft" : "ArrowDown";
      const shrink = which === "panel" ? "ArrowRight" : "ArrowUp";
      const cur = sizes[which] ?? S.usual;
      if (e.key === grow) setSize(which, cur + S.step);
      else if (e.key === shrink) setSize(which, cur - S.step);
      else if (e.key === "Home") setSize(which, S.min);
      else if (e.key === "End") setSize(which, sizeMax[which]());
      else return;
      e.preventDefault();
    });
    let saved = NaN;
    try {
      saved = Number(localStorage.getItem(S.key));
    } catch {
      // No storage: start at the usual size.
    }
    setSize(which, saved > 0 ? saved : S.usual, false);
  }
  window.addEventListener("resize", () => {
    for (const which of Object.keys(SIZES)) setSize(which, sizes[which], false);
  });

  // ---- Bottom sheet ---------------------------------------------------------------
  // On phones the panel is a bottom sheet with three states:
  //  - "row": the dock (shelf row and tools) only;
  //  - "grid": the shelf opens into a grid of toys that fills the sheet;
  //  - "panel": the tabs open above the dock.
  // The stage shrinks to the space above the panel, so the toy stays in view
  // while you change things. Dragging the handle or the shelf up opens the
  // grid; More opens the panel (from the row or the grid). Tapping the toy,
  // swiping the handle down, swiping down from the top of the grid or the
  // controls, Escape or Done goes back to the row.
  // Set SHELF_GRID to false to switch the grid off: the handle then opens the
  // panel as before.
  const SHELF_GRID = true;
  const narrow = matchMedia("(max-width: 760px)");
  let mode = "row";
  function refreshDock() {
    if (!narrow.matches) {
      document.documentElement.style.removeProperty("--dock-h");
      return;
    }
    const h = els.panel.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--dock-h", `${Math.round(h)}px`);
  }
  const applySheet = () => {
    const m = narrow.matches ? mode : "row";
    els.panelBody.hidden = narrow.matches && m !== "panel";
    document.body.classList.toggle("sheet-open", m === "panel");
    document.body.classList.toggle("shelf-grid", m === "grid");
    els.sheetToggle.setAttribute("aria-expanded", String(mode === "panel"));
    // From the grid, More goes straight to the settings (one tap); the
    // handle, a swipe down, a pick or a tap on the toy closes the grid.
    els.sheetToggle.textContent = m === "panel" ? "Done" : "More";
    refreshDock();
  };
  function setMode(m) {
    if (m === "grid" && !SHELF_GRID) m = "panel";
    if (mode === m) return;
    mode = m;
    applySheet();
    if (m !== "panel") revealCurrent();
  }
  new ResizeObserver(refreshDock).observe(els.panel);
  els.sheetToggle.addEventListener("click", () => setMode(mode === "panel" ? "row" : "panel"));
  narrow.addEventListener("change", applySheet);

  // The handle: swipe up for the grid, down for the row, tap to toggle. The
  // tab bar takes the same swipes but keeps the panel open when swiped up.
  function bindSwipe(el, up, tap) {
    let start = null;
    el.addEventListener("pointerdown", (e) => {
      if (!narrow.matches || (e.pointerType === "mouse" && e.button !== 0)) return;
      start = { y: e.clientY, id: e.pointerId };
    });
    el.addEventListener("pointerup", (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = e.clientY - start.y;
      start = null;
      if (dy > 28) setMode("row");
      else if (dy < -28) setMode(up());
      else if (tap) setMode(tap());
    });
    el.addEventListener("pointercancel", () => (start = null));
  }
  bindSwipe(
    els.sheetHandle,
    () => (mode === "panel" ? "panel" : "grid"),
    () => (mode === "row" ? "grid" : "row"),
  );
  bindSwipe(els.tabs, () => "panel", null);

  // Dragging the shelf row up opens the grid; dragging down from the top of
  // the grid closes it. Sideways drags scroll the row as usual.
  let lift = null;
  els.shelf.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      lift =
        narrow.matches && e.touches.length === 1
          ? { x: t.clientX, y: t.clientY, top: els.shelf.scrollTop }
          : null;
    },
    { passive: true },
  );
  els.shelf.addEventListener(
    "touchmove",
    (e) => {
      if (!lift) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - lift.x);
      const dy = t.clientY - lift.y;
      if (mode !== "grid" && dy < -36 && -dy > dx * 1.5) {
        lift = null;
        setMode("grid");
      } else if (mode === "grid" && lift.top <= 0 && els.shelf.scrollTop <= 0) {
        if (dy > 90 && dy > dx * 2) {
          lift = null;
          setMode("row");
        }
      }
    },
    { passive: true },
  );
  els.shelf.addEventListener("touchend", () => (lift = null), { passive: true });

  // Swiping down from the top of the scrolled controls closes the sheet too.
  let pull = null;
  els.panes.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      const onInput = e.target.closest?.("input, select, textarea");
      pull =
        narrow.matches && mode === "panel" && e.touches.length === 1 && !onInput
          ? { x: t.clientX, y: t.clientY, top: els.panes.scrollTop }
          : null;
    },
    { passive: true },
  );
  els.panes.addEventListener(
    "touchmove",
    (e) => {
      if (!pull || pull.top > 0 || els.panes.scrollTop > 0) return;
      const t = e.touches[0];
      const dy = t.clientY - pull.y;
      if (dy > 90 && dy > Math.abs(t.clientX - pull.x) * 2) {
        pull = null;
        setMode("row");
      }
    },
    { passive: true },
  );
  els.panes.addEventListener("touchend", () => (pull = null), { passive: true });
  applySheet();

  // ---- A toy's labels (lane Anatomy) ------------------------------------------------
  // A kit toy's drive() may set out.legend = { title, items: [{ text, head,
  // on, dim }] }: a list of names shown as page text beside the stage while
  // it is set (the anatomy atlas's parts). `head` makes an item a heading,
  // `on` highlights it and `dim` grays it. The list is rebuilt only when it
  // changes, and hidden as soon as a frame leaves it unset.
  const legendBox = $("toy-legend");
  let legendKey = "";
  app.player?.on("frame", () => {
    const lg = app.player.motion?.out?.legend || null;
    const key = lg ? JSON.stringify(lg) : "";
    if (key === legendKey) return;
    legendKey = key;
    legendBox.textContent = "";
    legendBox.hidden = !lg;
    if (!lg) return;
    if (lg.title) {
      const title = document.createElement("p");
      title.className = "toy-legend-title";
      title.textContent = lg.title;
      legendBox.appendChild(title);
    }
    const list = document.createElement("ul");
    for (const it of lg.items || []) {
      const li = document.createElement("li");
      li.textContent = it.text;
      if (it.head) li.classList.add("head");
      if (it.on) li.classList.add("on");
      if (it.dim) li.classList.add("dim");
      list.appendChild(li);
    }
    legendBox.appendChild(list);
  });

  // ---- Toy help (lane Help) ---------------------------------------------------------
  // A short how-to-play line when a new toy opens (picked from the shelf,
  // opened from a link or after a refresh). It fades after a few seconds and
  // "?" shows it again. The About tab gets "About this toy". The text comes
  // from src/toy-help.js, loaded when the first toy opens so it never holds
  // up the first paint. Nothing here goes into links or saved scenes.
  const HELP_MS = 7000;
  // Automated browsers (the test suite) show the line by itself only with
  // ?help=show, so the older screenshot tests see the stage as before; "?"
  // works everywhere.
  const helpAuto = !navigator.webdriver || new URLSearchParams(location.search).get("help") === "show"; // prettier-ignore
  const help = {
    line: $("help-line"),
    text: $("help-line-text"),
    about: $("help-line-about"),
    toggle: $("help-toggle"),
    name: $("toy-about-name"),
    aboutText: $("toy-about-text"),
    howTo: $("toy-about-howto"),
    can: $("toy-about-can"),
  };
  let helpModule = null;
  let helpKey = null;
  let helpInfo = null;
  let helpTimer = 0;
  function hideHelpLine() {
    clearTimeout(helpTimer);
    help.line.classList.remove("show");
    help.toggle.setAttribute("aria-expanded", "false");
    // Hidden once faded (the fade is off under reduced motion).
    helpTimer = setTimeout(() => (help.line.hidden = true), 500);
  }
  // On a phone the line sits under the toy's name line, which wraps to two
  // lines for a scan's credit.
  function placeHelpLine() {
    const r = els.toyStatus.getBoundingClientRect();
    help.line.style.top = narrow.matches && r.height ? `${Math.round(r.bottom + 6)}px` : "";
  }
  function showHelpLine() {
    clearTimeout(helpTimer);
    placeHelpLine();
    help.line.hidden = false;
    void help.line.offsetWidth; // start the fade from the hidden state
    help.line.classList.add("show");
    help.toggle.setAttribute("aria-expanded", "true");
    helpTimer = setTimeout(hideHelpLine, HELP_MS);
  }
  function renderToyAbout(h) {
    help.name.textContent = h.label;
    const paras = h.about.length
      ? h.about
      : ["A longer description of this toy is on its way. Until then, here is how to play."];
    help.aboutText.replaceChildren(
      ...paras.map((t) => {
        const p = document.createElement("p");
        p.textContent = t;
        if (!h.about.length) p.className = "note";
        return p;
      }),
    );
    help.howTo.textContent = h.howTo;
    help.can.replaceChildren(
      ...h.abilities.flatMap(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        return [dt, dd];
      }),
    );
  }
  async function setToyHelp(info) {
    helpInfo = info;
    // A new toy shows the line; the same toy rebuilt (an option, the detail
    // tier) only updates the text.
    const key = info ? `${info.kind}:${info.id ?? info.label}` : null;
    const isNew = key !== helpKey;
    helpKey = key;
    let mod;
    try {
      mod = await (helpModule ??= import("./toy-help.js"));
    } catch {
      helpModule = null;
      return;
    }
    if (helpInfo !== info || !info) return;
    const h = mod.toyHelp(info);
    help.text.textContent = h.howTo;
    help.line.dataset.toy = key;
    renderToyAbout(h);
    help.toggle.hidden = false;
    if (isNew && helpAuto) showHelpLine();
  }
  help.toggle.addEventListener("click", () =>
    help.line.classList.contains("show") ? hideHelpLine() : showHelpLine(),
  );
  help.about.addEventListener("click", () => {
    hideHelpLine();
    showTab("about");
    if (narrow.matches) setMode("panel");
    els.panes.scrollTop = 0;
  });
  // /Toy help

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
      shelf.current = id;
      for (const [tid, b] of cards) b.setAttribute("aria-pressed", String(tid === id));
      revealCurrent();
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
    // Pictures: the picture panel follows the pages (and media errors).
    setPictures(p, media) {
      refreshMedia(p);
      refreshMediaText(p); // the words box follows the page
    },
    setToyPanel(info) {
      renderToyPanel(info);
      setToyHelp(info); // Toy help (lane Help)
      showMotion(app.player.effectiveMotion(), app.player.scene.motion.controls);
    },
    // Shows motion as it runs (under reduced motion, off until asked).
    setMotion(m, controls) {
      showMotion(app.player.effectiveMotion(), controls || m.controls);
    },
    setPattern(p, note) {
      showPattern(p);
      els.patNote.textContent = note || "";
    },
    setSound(on) {
      els.soundToggle.setAttribute("aria-pressed", String(on));
      els.soundToggle.title = on ? "Sound effects on" : "Sound effects off";
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
    setDetail(detail) {
      for (const b of els.lookDetail.querySelectorAll("button")) {
        b.setAttribute("aria-pressed", String(b.dataset.detail === detail));
      }
    },
    setAutoplay(a, reducedMotion) {
      els.autoTurntable.checked = a.turntable;
      els.autoEffect.value = a.effect;
      els.motionNote.hidden = !reducedMotion;
      els.autoTurntable.disabled = els.autoEffect.disabled = !!reducedMotion;
      // The top-bar turntable button (lane Viewer); reduced motion wins.
      const spin = !!a.turntable && !reducedMotion;
      els.turntableToggle.setAttribute("aria-pressed", String(spin));
      els.turntableToggle.disabled = !!reducedMotion;
      els.turntableToggle.title = reducedMotion
        ? "Turntable: off (your system asks for reduced motion)"
        : spin
          ? "Turntable: spins when idle, on every toy"
          : "Turntable: off for every toy";
    },
    // The top-bar tilt lock button (lane Viewer).
    setTiltLock(locked) {
      els.tiltToggle.setAttribute("aria-pressed", String(!!locked));
      els.tiltToggle.title = locked
        ? "Tilt lock: on (drag spins it left and right)"
        : "Tilt lock: off (drag turns it any way)";
    },
    setFileToy(isFile, flip) {
      els.byoFlipRow.hidden = !isFile;
      els.byoFlip.checked = !!flip;
    },
    showLargeFile(text, canDownsample) {
      if (text) {
        showTab("make");
        setMode("panel");
      }
      els.byoWarning.hidden = !text;
      els.byoWarningText.textContent = text || "";
      els.byoDownsample.hidden = !canDownsample;
    },
    setStatus(text) {
      els.toyStatus.textContent = text || "";
      placeHelpLine(); // Toy help (lane Help)
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
    embedSize() {
      return els.embedSize.value;
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
      setMode("row");
    },
    // True when the phone sheet (the grid or the panel) covers part of the stage.
    sheetOpen() {
      return mode !== "row" && narrow.matches;
    },
    showTab,
    currentTab() {
      return currentTab;
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
