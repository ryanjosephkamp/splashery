// DOM wiring for the panel, shelf, tools, tabs, bottom sheet, toasts and
// progress.
// The app owns state; this module reflects it and forwards user intent.

import { EFFECTS, AXES } from "./effects.js";
import { SHAPES, PALETTES, PROFILES } from "./generators.js";
import { TOYS, thumbURL, shelfCategories, searchToys } from "./toys.js";
import { IDLE_EFFECTS, formatCount } from "./state.js";
import { MOVES } from "./motion.js";
import { PATTERNS, PROJECTIONS, loadFlags } from "./patterns.js";

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
    const pool = shelf.list.filter((t) => t.id !== shelf.current);
    const from = pool.length ? pool : allToys.filter((t) => t.id !== shelf.current);
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
    refreshGameBar();
    els.toyOptions.textContent = "";
    for (const o of recipe?.options || []) {
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
    els.toyNote.textContent = recipe
      ? recipe.note || ""
      : "Every toy can bounce, spin, wobble or float. Tap it to make it hop.";
  }

  // A toy that plays a game (the chess set): load a game from a PGN file or
  // pasted text, or go back to its own game.
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

  // ---- The game bar -----------------------------------------------------------------
  // Under the board while a game toy (the chess set) is out: the game's title
  // and details, where it has got to, and buttons to play, pause, step and
  // jump. Tapping the board also plays or pauses.
  let barGame = null;
  const playing = () => (app.player?.motion?.targets?.play ?? 0) > 0.5;
  function refreshGameBar() {
    const game = barGame;
    els.gameBar.hidden = !game;
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
  setInterval(() => barGame && !document.hidden && refreshGameBar(), 250);
  const pause = () => app.setControl("play", 0);
  $("game-start").addEventListener("click", () => {
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
    if (!barGame) return;
    if (playing()) pause();
    else {
      if (barGame.state().over) barGame.jump("start");
      app.setControl("play", 1);
    }
    refreshGameBar();
  });

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
    setToyPanel(info) {
      renderToyPanel(info);
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
