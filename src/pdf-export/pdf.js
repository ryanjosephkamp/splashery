// Lane PDF lab: the PDF itself. Builds a toy's page ("Still + live toy") and,
// as an option, a second page with a recording of one tap played as a flip
// book, from plain data: no app, no player and no DOM, so the same code runs in
// the app (src/pdf-export/index.js), in Node (tools/pdf-*.mjs) and for a
// catalog of every toy, one page each (buildCatalogPDF).
//
// pdf-lib (vendor/pdf-lib/, MIT) writes the file; it is loaded only when
// someone exports. The QR code comes from Project Nayuki's generator through
// src/qr/encode.js. The recording follows the `animate` LaTeX package's widget
// method, which docs/audits/pdf-motion-2026-10.md saw play in desktop Firefox
// (and which the package documents for Acrobat): each frame is a hidden push
// button whose look is the picture, and the PDF's own JavaScript shows one at
// a time on a timer. Viewers without PDF JavaScript show the first frame.
//
// An entry (see entry.js) is:
//   { id, label, shelf, howTo, about: [paragraph], credits: [credit],
//     notes: [line], url, still: { bytes, type: "jpeg" | "png" }, date }
// a credit: { label, title, author, license, licenseUrl, source, changes }
// a recording: { frames: [Uint8Array JPEG], size, fps, seconds, tapFrame }

import { encodeQR, QUIET } from "../qr/encode.js";

let lib = null;
export async function loadPdfLib() {
  if (!lib) lib = await import("../../vendor/pdf-lib/pdf-lib.esm.min.js");
  return lib;
}

// US Letter, in points.
export const PAGE = { w: 612, h: 792, margin: 48 };

const INK = [0.11, 0.11, 0.13];
const GRAY = [0.4, 0.4, 0.44];
const LINK = [0.05, 0.33, 0.75];
const ACCENT = [0.9, 0.23, 0.18];

// ---- Text ----------------------------------------------------------------------

// The standard PDF fonts only have the Windows-1252 characters. Common others
// get a plain stand-in; accents fall back to the bare letter; the rest to "?".
const STAND_IN = {
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "≈": "~",
  "≤": "<=",
  "≥": ">=",
  "−": "-",
  "‑": "-",
  "′": "'",
  "″": '"',
  " ": " ",
  " ": " ",
  " ": " ",
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  Δ: "Delta",
  θ: "theta",
  λ: "lambda",
  π: "pi",
  σ: "sigma",
  Ω: "Ohm",
  ω: "omega",
  "²": "2",
  "³": "3",
};

export function makeSafe(font) {
  const ok = new Set(font.getCharacterSet());
  return (text) => {
    let out = "";
    for (const ch of String(text ?? "")) {
      const code = ch.codePointAt(0);
      if (ch === "\n" || ok.has(code)) out += ch;
      else if (STAND_IN[ch] !== undefined) out += STAND_IN[ch];
      else {
        const bare = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
        out += bare && [...bare].every((c) => ok.has(c.codePointAt(0))) ? bare : "?";
      }
    }
    return out;
  };
}

// Splits text into lines no wider than `width` at `size`.
export function wrap(text, font, size, width) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = w;
      }
      // A single word longer than the line (a long URL) is cut.
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

// A PDF literal string (pdf-lib writes PDFString as given, without escaping).
function literal(P, s) {
  return P.PDFString.of(String(s).replace(/[\\()]/g, (c) => `\\${c}`));
}

function link(P, doc, page, rect, url) {
  const ctx = doc.context;
  const annot = ctx.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: rect,
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: literal(P, url) },
  });
  page.node.addAnnot(ctx.register(annot));
}

// ---- QR -------------------------------------------------------------------------

// The QR code's dark modules as rows of runs, with the quiet zone, for drawing
// as vector squares. `size` includes the quiet zone.
export function qrFor(text) {
  const q = encodeQR(text, "L");
  return { ...q, total: q.size + QUIET * 2 };
}

function drawQR(P, page, q, x, y, side) {
  const m = side / q.total;
  page.drawRectangle({ x, y, width: side, height: side, color: P.rgb(1, 1, 1) });
  for (let r = 0; r < q.size; r++) {
    let c = 0;
    while (c < q.size) {
      if (!q.dark[r * q.size + c]) {
        c++;
        continue;
      }
      let e = c;
      while (e < q.size && q.dark[r * q.size + e]) e++;
      // A hair wider than the module, so neighbors never show a seam.
      page.drawRectangle({
        x: x + (QUIET + c) * m,
        y: y + side - (QUIET + r + 1) * m - 0.02,
        width: (e - c) * m + 0.02,
        height: m + 0.04,
        color: P.rgb(0, 0, 0),
      });
      c = e;
    }
  }
}

// ---- The toy's page -------------------------------------------------------------

export async function makeFonts(doc) {
  const P = await loadPdfLib();
  const regular = await doc.embedFont(P.StandardFonts.Helvetica);
  const bold = await doc.embedFont(P.StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(P.StandardFonts.HelveticaOblique);
  return { regular, bold, italic, safe: makeSafe(regular) };
}

async function embedStill(doc, still) {
  if (!still?.bytes) return null;
  return still.type === "png" ? doc.embedPng(still.bytes) : doc.embedJpg(still.bytes);
}

// A writer that flows text down the page and starts a new page when full.
function flow(P, doc, fonts, page, y) {
  const left = PAGE.margin;
  const width = PAGE.w - PAGE.margin * 2;
  const st = { page, y };
  const room = (h) => {
    if (st.y - h >= PAGE.margin + 18) return;
    st.page = doc.addPage([PAGE.w, PAGE.h]);
    st.y = PAGE.h - PAGE.margin;
  };
  st.text = (
    text,
    {
      size = 10,
      font = fonts.regular,
      color = INK,
      lead = 1.38,
      gap = 0,
      url = null,
      indent = 0,
    } = {},
  ) => {
    // prettier-ignore
    const lines = wrap(fonts.safe(text), font, size, width - indent);
    for (const line of lines) {
      room(size * lead);
      st.y -= size * lead;
      st.page.drawText(line, { x: left + indent, y: st.y, size, font, color: P.rgb(...color) });
      if (url) {
        const w = font.widthOfTextAtSize(line, size);
        link(P, doc, st.page, [left + indent, st.y - 2, left + indent + w, st.y + size], url);
      }
    }
    st.y -= gap;
  };
  return st;
}

// The words a page says about where the toy really lives.
export const WORDS = {
  still:
    "This page is a still picture of a Splashery toy. The live toy runs in a web browser: open the link or scan the code to play with it, set up as in the picture.",
  recording:
    "This page holds a recording of one tap: pictures shown one after another. It is not the toy itself, so you can't turn it or tap it here. The recording plays in desktop Firefox and in Adobe Acrobat and Acrobat Reader on a computer. Other apps (phones, Preview, Chrome) show the first picture only.",
  controls:
    "Buttons, left to right: first picture, step back, play or pause, step forward, last picture. Tapping the picture plays or pauses it too.",
};

// Draws one toy's page. Returns the page.
export async function addToyPage(doc, fonts, entry) {
  const P = await loadPdfLib();
  const page = doc.addPage([PAGE.w, PAGE.h]);
  const { regular, bold, italic, safe } = fonts;
  const m = PAGE.margin;
  let y = PAGE.h - m;
  // The masthead.
  page.drawText("SPLASHERY", { x: m, y: y - 9, size: 9, font: bold, color: P.rgb(...ACCENT) });
  if (entry.date) {
    const d = safe(entry.date);
    page.drawText(d, { x: PAGE.w - m - regular.widthOfTextAtSize(d, 9), y: y - 9, size: 9, font: regular, color: P.rgb(...GRAY) }); // prettier-ignore
  }
  y -= 40;
  const title = safe(entry.label || entry.id);
  let tsize = 26;
  while (tsize > 14 && bold.widthOfTextAtSize(title, tsize) > PAGE.w - m * 2) tsize -= 1;
  page.drawText(title, { x: m, y, size: tsize, font: bold, color: P.rgb(...INK) });
  y -= 18;
  if (entry.shelf) {
    page.drawText(safe(entry.shelf), { x: m, y, size: 10, font: regular, color: P.rgb(...GRAY) });
  }
  y -= 14;
  // The still and, beside it, the code and the link.
  const side = 330;
  const img = await embedStill(doc, entry.still);
  const top = y;
  if (img) {
    const s = Math.min(side / img.width, side / img.height);
    const w = img.width * s;
    const h = img.height * s;
    page.drawImage(img, { x: m + (side - w) / 2, y: top - side + (side - h) / 2, width: w, height: h }); // prettier-ignore
    page.drawRectangle({ x: m, y: top - side, width: side, height: side, borderColor: P.rgb(0.82, 0.82, 0.85), borderWidth: 0.75 }); // prettier-ignore
  }
  const cx = m + side + 24;
  const cw = PAGE.w - m - cx;
  let ry = top;
  if (entry.url) {
    const q = qrFor(entry.url);
    const qs = Math.min(cw, 168);
    drawQR(P, page, q, cx, ry - qs, qs);
    link(P, doc, page, [cx, ry - qs, cx + qs, ry], entry.url);
    ry -= qs + 14;
    page.drawText(safe("Open the live toy"), { x: cx, y: ry, size: 13, font: bold, color: P.rgb(...LINK) }); // prettier-ignore
    const lw = bold.widthOfTextAtSize("Open the live toy", 13);
    page.drawLine({ start: { x: cx, y: ry - 2 }, end: { x: cx + lw, y: ry - 2 }, thickness: 0.8, color: P.rgb(...LINK) }); // prettier-ignore
    link(P, doc, page, [cx, ry - 4, cx + lw, ry + 13], entry.url);
    ry -= 6;
    const host = shortURL(entry.url);
    for (const line of wrap(safe(host), regular, 8.5, cw)) {
      ry -= 11;
      page.drawText(line, { x: cx, y: ry, size: 8.5, font: regular, color: P.rgb(...GRAY) });
    }
    ry -= 6;
    for (const line of wrap(
      safe(
        "Scan the code with a phone's camera, or click the link. It opens this toy in a web browser, set up as in the picture.",
      ),
      italic,
      9,
      cw,
    )) {
      // prettier-ignore
      ry -= 12;
      page.drawText(line, { x: cx, y: ry, size: 9, font: italic, color: P.rgb(...GRAY) });
    }
  }
  y = Math.min(top - side, ry) - 10;
  // How to play, what it is, credits.
  const st = flow(P, doc, fonts, page, y);
  if (entry.howTo) {
    st.text("How to play", { size: 11, font: bold, gap: 1 });
    st.text(entry.howTo, { size: 10.5, gap: 6 });
  }
  if (entry.about?.length) {
    st.text("About this toy", { size: 11, font: bold, gap: 1 });
    for (const p of entry.about) st.text(p, { size: 9.5, gap: 4 });
    st.y -= 2;
  }
  st.text("Credits and licenses", { size: 9.5, font: bold, gap: 1 });
  for (const c of entry.credits || []) st.text(creditLine(c), { size: 7.5, lead: 1.3, url: c.source || c.licenseUrl || null, gap: 1.5 }); // prettier-ignore
  for (const n of entry.notes || []) st.text(n, { size: 7.5, lead: 1.3, gap: 1.5 });
  st.y -= 4;
  st.text(WORDS.still, { size: 7.5, font: italic, color: GRAY, lead: 1.3 });
  return page;
}

export function creditLine(c) {
  const parts = [];
  const what = c.title ? `"${c.title}"` : "";
  parts.push(c.label ? `${c.label}: ${what}` : what);
  if (c.author) parts[0] += ` by ${c.author}`;
  let s = parts[0].replace(/^: /, "");
  if (c.license) s += `, ${c.license}${c.licenseUrl ? ` (${shortURL(c.licenseUrl)})` : ""}`;
  s += ".";
  if (c.source) s += ` Source: ${shortURL(c.source)}.`;
  if (c.changes) s += ` ${c.changes}`;
  return s.replace(/\.\./g, ".");
}

// A URL without its scheme, and a scene link without its long code.
export function shortURL(url) {
  const u = String(url).replace(/^https?:\/\//, "");
  const i = u.indexOf("#s=");
  return i >= 0 ? `${u.slice(0, i)} (with this toy's scene)` : u.replace(/\/$/, "");
}

// ---- The recording page -----------------------------------------------------------

// The PDF JavaScript for the flip book. `n` frames named spf0.., buttons
// spplay/sppause, a counter field spcount. It mirrors the animate package's
// widget method (show one frame field, hide the last, on app.setInterval).
export function flipBookScript(n, fps) {
  const last = n - 1;
  return [
    "if(typeof sp_fr=='undefined'||!sp_fr){",
    "var sp_fr=[],sp_on=0,sp_idx=0,sp_int=null,sp_playing=false,sp_doc=this;",
    `for(var i=0;i<${n};i++){sp_fr[i]=this.getField('spf'+i);}`,
    "var sp_play_b=this.getField('spplay'),sp_pause_b=this.getField('sppause'),sp_count=this.getField('spcount');",
    `var sp_seek=function(f){if(f>${last}||f<0)return -1;sp_idx=f;try{sp_fr[sp_on].display=display.hidden;sp_fr[f].display=display.visible;}catch(e){}sp_on=f;try{sp_count.value='Picture '+(f+1)+' of ${n}';}catch(e){}sp_doc.dirty=false;return 0;};`,
    "var sp_buttons=function(){try{sp_play_b.display=sp_playing?display.hidden:display.visible;sp_pause_b.display=sp_playing?display.visible:display.hidden;}catch(e){}sp_doc.dirty=false;};",
    `var sp_next=function(){if(sp_seek(sp_idx+1)<0)sp_seek(0);};`,
    "var sp_pause=function(){try{app.clearInterval(sp_int);}catch(e){}sp_int=null;sp_playing=false;sp_buttons();};",
    `var sp_play=function(){var t=null;try{t=app.setInterval('sp_next()',${Math.round(1000 / fps)});}catch(e){}try{if(sp_int)app.clearInterval(sp_int);}catch(e){}sp_int=t;sp_playing=true;sp_buttons();};`,
    "var sp_toggle=function(){if(sp_playing)sp_pause();else sp_play();};",
    "var sp_step=function(d){if(sp_playing)sp_pause();if(sp_seek(sp_idx+d)<0)sp_seek(d>0?0:" +
      last +
      ");};",
    "var sp_first=function(){sp_pause();sp_seek(0);};",
    `var sp_last=function(){sp_pause();sp_seek(${last});};`,
    "sp_seek(0);}",
  ].join("");
}

// What leaving the page does: stop the timer and go back to the first frame.
const LEAVE = "try{if(sp_playing)sp_pause();sp_seek(0);}catch(e){}";

// A button's look: a rounded key with an icon.
function keyLook(kind, w, h) {
  const r = 5;
  const box = `0.94 0.94 0.95 rg 0.55 0.55 0.6 RG 0.8 w ${roundRect(0.5, 0.5, w - 1, h - 1, r)} B`;
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) * 0.26;
  const tri = (x, dir) => `${x} ${cy - s} m ${x + dir * s * 1.5} ${cy} l ${x} ${cy + s} l h f`;
  const bar = (x) => `${x} ${cy - s} ${s * 0.45} ${s * 2} re f`;
  const icon = {
    first: `${bar(cx - s * 1.25)} ${tri(cx + s * 0.9, -1)}`,
    back: `${tri(cx + s * 0.35, -1)} ${bar(cx + s * 0.55)}`,
    play: tri(cx - s * 0.6, 1),
    pause: `${bar(cx - s * 0.75)} ${bar(cx + s * 0.3)}`,
    fwd: `${bar(cx - s * 1)} ${tri(cx - s * 0.35, 1)}`,
    last: `${tri(cx - s * 0.9, 1)} ${bar(cx + s * 0.8)}`,
  }[kind];
  return `q ${box} 0.12 0.12 0.14 rg ${icon} Q`;
}

function roundRect(x, y, w, h, r) {
  const k = 0.5523 * r;
  return [
    `${x + r} ${y} m`,
    `${x + w - r} ${y} l`,
    `${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r} c`,
    `${x + w} ${y + h - r} l`,
    `${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h} c`,
    `${x + r} ${y + h} l`,
    `${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r} c`,
    `${x} ${y + r} l`,
    `${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c h`,
  ].join(" ");
}

// Adds the flip book page. Returns the page.
export async function addRecordingPage(doc, fonts, entry, rec) {
  const P = await loadPdfLib();
  const ctx = doc.context;
  const page = doc.addPage([PAGE.w, PAGE.h]);
  const { regular, bold, italic, safe } = fonts;
  const m = PAGE.margin;
  const n = rec.frames.length;
  let y = PAGE.h - m;
  page.drawText("SPLASHERY", { x: m, y: y - 9, size: 9, font: bold, color: P.rgb(...ACCENT) });
  y -= 38;
  const title = safe(`${entry.label || entry.id}: a recording of one tap`);
  let tsize = 20;
  while (tsize > 12 && bold.widthOfTextAtSize(title, tsize) > PAGE.w - m * 2) tsize -= 1;
  page.drawText(title, { x: m, y, size: tsize, font: bold, color: P.rgb(...INK) });
  y -= 8;
  const st = flow(P, doc, fonts, page, y);
  st.text(WORDS.recording, { size: 10, gap: 2 });
  st.text(`${n} pictures, ${rec.seconds.toFixed(1)} seconds at ${rec.fps} pictures a second.`, { size: 9, color: GRAY }); // prettier-ignore
  y = st.y - 12;
  // The frames: stacked push buttons, one visible at a time.
  const side = 396;
  const fx = (PAGE.w - side) / 2;
  const rect = [fx, y - side, fx + side, y];
  page.drawRectangle({ x: fx - 1, y: y - side - 1, width: side + 2, height: side + 2, borderColor: P.rgb(0.82, 0.82, 0.85), borderWidth: 0.75 }); // prettier-ignore
  const fields = [];
  const widget = (dict) => {
    const ref = ctx.register(ctx.obj({ Type: "Annot", Subtype: "Widget", P: page.ref, ...dict }));
    page.node.addAnnot(ref);
    fields.push(ref);
    return ref;
  };
  for (let i = 0; i < n; i++) {
    const img = await doc.embedJpg(rec.frames[i]);
    const look = ctx.register(
      ctx.flateStream(`q ${side} 0 0 ${side} 0 0 cm /Im0 Do Q`, {
        Type: "XObject",
        Subtype: "Form",
        FormType: 1,
        BBox: [0, 0, side, side],
        Resources: { XObject: { Im0: img.ref }, ProcSet: ["PDF", "ImageC"] },
      }),
    );
    widget({
      FT: "Btn",
      Ff: 65536,
      F: i === 0 ? 4 : 2,
      T: literal(P, `spf${i}`),
      TU: literal(P, `Picture ${i + 1} of ${n}`),
      Rect: rect,
      // As animate does: PDF.js only takes a push button that has an action.
      A: { S: "ResetForm" },
      BS: { W: 0 },
      H: "N",
      AP: { N: look },
      MK: { TP: 1, I: look, IF: { S: "A", FB: true } },
    });
  }
  const init = flipBookScript(n, rec.fps);
  const js = (code) => ctx.register(ctx.obj({ S: "JavaScript", JS: ctx.register(ctx.stream(code)) })); // prettier-ignore
  const run = (call) => js(`${init}try{${call}}catch(e){}`);
  // The controls.
  const kw = 40;
  const kh = 28;
  const gap = 8;
  const keys = ["first", "back", "play", "fwd", "last"];
  const rowW = keys.length * kw + (keys.length - 1) * gap;
  let kx = (PAGE.w - rowW) / 2;
  const ky = y - side - 12 - kh;
  const lookFor = (kind) =>
    ctx.register(
      ctx.flateStream(keyLook(kind, kw, kh), {
        Type: "XObject",
        Subtype: "Form",
        FormType: 1,
        BBox: [0, 0, kw, kh],
        Resources: {},
      }),
    );
  const names = { first: "Go to the first picture", back: "Step back one picture", play: "Play", pause: "Pause", fwd: "Step forward one picture", last: "Go to the last picture" }; // prettier-ignore
  const calls = { first: "sp_first();", back: "sp_step(-1);", play: "sp_play();", pause: "sp_pause();", fwd: "sp_step(1);", last: "sp_last();" }; // prettier-ignore
  const button = (kind, x, hidden = false) => {
    const look = lookFor(kind);
    widget({
      FT: "Btn",
      Ff: 65536,
      F: hidden ? 2 : 4,
      T: literal(P, `sp${kind}`),
      TU: literal(P, names[kind]),
      Rect: [x, ky, x + kw, ky + kh],
      BS: { W: 0 },
      H: "P",
      AP: { N: look },
      MK: { TP: 1, I: look, IF: { S: "A", FB: true } },
      AA: { D: run(calls[kind]) },
    });
  };
  for (const k of keys) {
    if (k === "play") {
      button("play", kx);
      button("pause", kx, true);
    } else button(k, kx);
    kx += kw + gap;
  }
  // The counter.
  const font = regular;
  const count = `Picture 1 of ${n}`;
  const cw = 160;
  const cyy = ky - 22;
  const ccx = (PAGE.w - cw) / 2;
  const tw = font.widthOfTextAtSize(count, 9);
  const countLook = ctx.register(
    ctx.flateStream(
      `/Tx BMC q BT /Helv 9 Tf 0.4 0.4 0.44 rg ${(cw - tw) / 2} 5 Td (${count}) Tj ET Q EMC`,
      {
        // prettier-ignore
        Type: "XObject",
        Subtype: "Form",
        FormType: 1,
        BBox: [0, 0, cw, 16],
        Resources: { Font: { Helv: font.ref } },
      },
    ),
  );
  widget({
    FT: "Tx",
    Ff: 1,
    F: 4,
    T: literal(P, "spcount"),
    V: literal(P, count),
    DA: literal(P, "/Helv 9 Tf 0.4 0.4 0.44 rg"),
    Q: 1,
    Rect: [ccx, cyy, ccx + cw, cyy + 16],
    BS: { W: 0 },
    AP: { N: countLook },
  });
  // Tapping the picture plays or pauses: a clear button over the frames.
  const clear = ctx.register(ctx.flateStream("", { Type: "XObject", Subtype: "Form", FormType: 1, BBox: [0, 0, side, side], Resources: {} })); // prettier-ignore
  widget({
    FT: "Btn",
    Ff: 65536,
    F: 4,
    T: literal(P, "sptap"),
    TU: literal(P, "Play or pause"),
    Rect: rect,
    BS: { W: 0 },
    H: "N",
    AP: { N: clear },
    AA: { D: run("sp_toggle();") },
  });
  // Opening the page sets the script up; leaving it stops the timer.
  page.node.set(P.PDFName.of("AA"), ctx.obj({ O: js(init), C: js(LEAVE) }));
  // The form.
  const form = doc.catalog.lookup(P.PDFName.of("AcroForm"));
  if (form) {
    form.lookup(P.PDFName.of("Fields")).push(...fields);
  } else {
    doc.catalog.set(
      P.PDFName.of("AcroForm"),
      ctx.obj({ Fields: fields, NeedAppearances: false, DR: { Font: { Helv: font.ref } }, DA: literal(P, "/Helv 9 Tf 0 g") }), // prettier-ignore
    );
  }
  // Below the picture: how to use it, and the live toy.
  const below = flow(P, doc, fonts, page, cyy - 6);
  below.text(WORDS.controls, { size: 9, color: GRAY, gap: 4 });
  if (entry.url) {
    below.text("Open the live toy in a browser", { size: 11, font: bold, color: LINK, url: entry.url }); // prettier-ignore
    below.text(`${shortURL(entry.url)}. The QR code on page 1 opens it too.`, { size: 8.5, color: GRAY }); // prettier-ignore
  }
  below.text(" ", { size: 4 });
  below.text("A recording of the effect, not the toy's 3D engine running inside a PDF.", { size: 8, font: italic, color: GRAY }); // prettier-ignore
  return page;
}

// ---- Whole documents --------------------------------------------------------------

async function newDoc(meta) {
  const P = await loadPdfLib();
  const doc = await P.PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor("Splashery");
  doc.setCreator("Splashery (https://ryanjosephkamp.github.io/splashery/)");
  doc.setProducer("Splashery PDF export with pdf-lib");
  if (meta.subject) doc.setSubject(meta.subject);
  doc.setLanguage("en-US");
  return doc;
}

const SAVE = { useObjectStreams: false };

// One toy: its page, and with a recording the flip book after it.
export async function buildToyPDF(entry, { recording = null } = {}) {
  const doc = await newDoc({
    title: `${entry.label || entry.id}: Splashery`,
    subject: recording ? "A Splashery toy: a still, a live link and a recording of one tap" : "A Splashery toy: a still and a live link", // prettier-ignore
  });
  const fonts = await makeFonts(doc);
  await addToyPage(doc, fonts, entry);
  if (recording?.frames?.length) await addRecordingPage(doc, fonts, entry, recording);
  return doc.save(SAVE);
}

// Many toys, one page each, in the order given (the Toy pages lane's catalog).
// Each entry needs its own still; see docs/handoff/PDFLab.md, "Reuse".
export async function buildCatalogPDF(entries, { title = "Splashery: the toys", onProgress } = {}) {
  const doc = await newDoc({ title, subject: "Every Splashery toy, one per page" });
  const fonts = await makeFonts(doc);
  for (let i = 0; i < entries.length; i++) {
    await addToyPage(doc, fonts, entries[i]);
    onProgress?.((i + 1) / entries.length);
  }
  return doc.save(SAVE);
}

// ---- Size --------------------------------------------------------------------------

// About what a recording adds, before it is made: its frames at the size of a
// sample frame, with room for busier frames, plus the page and its script.
// Kept as an upper bound (tests/pdf.spec.mjs checks the real file fits).
export function estimateRecording({ frames, sampleBytes }) {
  return Math.round(frames * (sampleBytes * 1.6 + 1400) + 24000);
}
