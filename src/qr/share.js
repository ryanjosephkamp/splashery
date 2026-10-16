// Lane QR r4 part 2 (the owner's idea of October 10, 2026: "a scene as a QR
// code"). The Share tab's "QR code" button (labs) opens this dialog: the
// scene's link (the #s= link, src/exports.js buildShareHash) as a QR code,
// drawn crisp on screen, read back here to check that it scans, and saved as
// a PNG. A phone camera that scans it opens that very scene.
//
// The code holds only the link. Nothing is uploaded, and a file of the
// person's own in the scene stays on their device, exactly as the link
// already works. A link longer than one QR code holds (2,953 bytes at version
// 40 and level L) gets a plain message and a way to save the scene as a file.
// Loaded only when someone opens it.

import { QUIET } from "./encode.js";
import { shareCode } from "./share-code.js";
import { buildShareHash, shareURL, canvasToBlob, downloadBlob, timestampName } from "../exports.js"; // prettier-ignore

// The code as a canvas, `ppm` pixels a module, with its quiet zone: black on
// white, square modules, nothing smoothed.
export function drawCode(code, ppm) {
  const total = code.size + 2 * QUIET;
  const c = document.createElement("canvas");
  c.width = c.height = total * ppm;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000000";
  for (let r = 0; r < code.size; r++)
    for (let col = 0; col < code.size; col++)
      if (code.dark[r * code.size + col]) g.fillRect((QUIET + col) * ppm, (QUIET + r) * ppm, ppm, ppm); // prettier-ignore
  return c;
}

// Only Save PNG pays for mask trials and the second reader. Keep the same
// URL, version, correction level, quiet zone, and native export dimensions.
export async function shareExport(url, made = shareCode(url)) {
  const attempts = [];
  if (!made.ok) return { ok: false, attempts };
  const { readExportCode } = await import("./export-check.js");
  const masks = [made.code.mask, ...Array.from({ length: 8 }, (_, i) => i).filter((i) => i !== made.code.mask)]; // prettier-ignore
  const exact = (read) => read.jsqr === url && read.zxing === url;
  for (const mask of masks) {
    const code = mask === made.code.mask ? made.code : shareCode(url, { mask }).code;
    const canvas = drawCode(code, 10);
    const phone = document.createElement("canvas");
    phone.width = phone.height = Math.min(390, canvas.width);
    phone.getContext("2d").drawImage(canvas, 0, 0, phone.width, phone.height);
    const phoneRead = await readExportCode(phone);
    const nativeRead = exact(phoneRead) ? await readExportCode(canvas) : null;
    attempts.push({ mask, phone: phoneRead, native: nativeRead });
    if (exact(phoneRead) && nativeRead && exact(nativeRead))
      return { ok: true, canvas, mask, attempts };
  }
  return { ok: false, attempts };
}

const CSS = `
.sqr{border:1px solid var(--line);border-radius:var(--radius);padding:0;max-width:min(26rem,calc(100vw - 32px));width:100%;background:var(--page);color:var(--ink);box-shadow:var(--shadow);font:inherit}
.sqr::backdrop{background:rgba(0,0,0,.45)}
.sqr form{display:grid;gap:12px;padding:18px 18px 16px}
.sqr h2{margin:0;font-size:1.15rem}
.sqr p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.4}
.sqr .code{display:flex;justify-content:center;background:#fff;border-radius:10px;padding:6px}
.sqr .code canvas{width:100%;max-width:340px;height:auto;image-rendering:pixelated;display:block}
.sqr .check{color:var(--ink);font-weight:600}
.sqr .buttons{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.sqr .buttons button{font:inherit;padding:8px 14px;border-radius:999px;border:1px solid var(--line-strong);background:transparent;color:var(--ink);cursor:pointer}
.sqr .buttons button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
`;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") e.textContent = v;
    else if (v === true) e.setAttribute(k, "");
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
}

let dialog = null;
// What the dialog shows, for the tests: { url, ok, version, level, bytes, check }.
export const SHARE = { last: null };

export async function openShareQR(app) {
  if (!document.getElementById("sqr-css")) document.head.append(el("style", { id: "sqr-css", text: CSS })); // prettier-ignore
  dialog?.remove();
  const res = await buildShareHash(app.exportScene());
  const url = res.ok ? shareURL(res.hash) : null;
  const made = url ? shareCode(url) : { ok: false, bytes: res.bytes || 0 };
  const close = el("button", { type: "button", id: "sqr-close", text: "Close" });
  const body = [];
  const buttons = [];
  SHARE.last = { url, ok: made.ok, bytes: made.bytes, check: null };
  const last = SHARE.last;
  if (made.ok) {
    const { code, level } = made;
    SHARE.last.version = code.version;
    SHARE.last.level = level;
    // On screen: a whole number of device pixels a module, about 340 CSS
    // pixels across (the canvas keeps its modules square and sharp).
    const total = code.size + 2 * QUIET;
    const ppm = Math.max(2, Math.ceil((340 * (devicePixelRatio || 1)) / total));
    const shown = drawCode(code, ppm);
    shown.id = "sqr-canvas";
    shown.setAttribute("role", "img");
    shown.setAttribute("aria-label", "A QR code that opens this scene");
    const check = el("p", { class: "check", id: "sqr-check", "aria-live": "polite", text: "Checking that it scans…" }); // prettier-ignore
    body.push(
      el("p", { text: "Scan it with a phone camera to open this scene, set up just as it is now." }), // prettier-ignore
      el("div", { class: "code" }, shown),
      check,
      el("p", { id: "sqr-info", text: `Version ${code.version} (${code.size} × ${code.size} modules), error correction ${level}. The link is ${made.bytes.toLocaleString("en-US")} characters.` }), // prettier-ignore
    );
    const save = el("button", { type: "button", class: "primary", id: "sqr-save", text: "Save PNG" }); // prettier-ignore
    const json = el("button", { type: "button", id: "sqr-json", text: "Save scene", hidden: true }); // prettier-ignore
    json.addEventListener("click", () => {
      dialog.close();
      app.exportJSON();
    });
    let saving = false;
    save.addEventListener("click", async () => {
      if (saving) return;
      saving = true;
      save.disabled = true;
      check.textContent = "Checking the PNG at phone size…";
      try {
        const result = await shareExport(url, made);
        last.export = { ok: result.ok, mask: result.mask ?? null, attempts: result.attempts };
        if (!result.ok) {
          check.textContent = "This link's QR code couldn't be read reliably at phone size. Use Save scene instead."; // prettier-ignore
          json.hidden = false;
          return;
        }
        const blob = await canvasToBlob(result.canvas);
        downloadBlob(blob, timestampName("png", "splashery-scene-qr"));
        check.textContent = "✓ The saved PNG reads back at phone size.";
        app.ui?.toast?.("QR code saved.");
      } catch {
        last.export = { ok: false, error: "QR reader or PNG export failed." };
        check.textContent = "The QR readers couldn't finish. Try again, or use Save scene.";
        json.hidden = false;
      } finally {
        saving = false;
        save.disabled = false;
      }
    });
    const splats = el("button", { type: "button", id: "sqr-splats", text: "Show as splats" }); // prettier-ignore
    splats.addEventListener("click", async () => {
      dialog.close();
      await app.chooseToy("qr-code");
      await app.player.switchTo({ options: { text: url, ecc: level } });
    });
    buttons.push(splats, json, save);
    // Read it back, as a phone would (src/qr/scan.js: the browser's own
    // reader, or jsQR).
    import("./scan.js")
      .then(({ readCode }) => readCode(drawCode(code, 4)))
      .then((r) => {
        const ok = r?.text === url;
        last.check = ok;
        if (!saving && !last.export)
          check.textContent = ok
            ? "✓ It scans."
            : "This code didn't read back here. Use Save scene to keep the scene.";
      })
      .catch(() => {
        if (!saving && !last.export) check.textContent = "";
      });
  } else {
    const n = (made.bytes || res.bytes || 0).toLocaleString("en-US");
    body.push(
      el("p", { id: "sqr-long", text: res.ok ? `This scene's link is ${n} characters, more than one QR code can hold (about 2,900). Save the scene as a file instead, and open it with Open a scene.` : "This scene is too big for a link, so it can't be a QR code either. Save the scene as a file instead, and open it with Open a scene." }), // prettier-ignore
    );
    const json = el("button", { type: "button", class: "primary", id: "sqr-json", text: "Save scene" }); // prettier-ignore
    json.addEventListener("click", () => {
      dialog.close();
      app.exportJSON();
    });
    buttons.push(json);
  }
  const own = app.player?.scene?.toy?.media?.file || app.player?.scene?.toy?.media?.files || app.player?.scene?.toy?.kind === "file"; // prettier-ignore
  body.push(
    el("p", { text: `The code holds only the link. Nothing is uploaded.${own ? " Your own file stays on this device: whoever scans the code is asked to open the same file." : ""}` }), // prettier-ignore
  );
  const form = el(
    "form",
    { method: "dialog" },
    el("h2", { id: "sqr-title", text: "This scene as a QR code" }),
    ...body,
    el("div", { class: "buttons" }, close, ...buttons),
  );
  dialog = el("dialog", { class: "sqr", id: "sqr", "aria-labelledby": "sqr-title" }, form);
  close.addEventListener("click", () => dialog.close());
  document.body.append(dialog);
  dialog.showModal();
  return SHARE.last;
}
