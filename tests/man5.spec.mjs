// Manual r5: the Codex audit's fixes, the PDF (the 60 gallery programs, links that reach the public
// copies, the same bytes from the same input), and the two new chapters ("How Splashery is built" and
// "Share links and QR codes", with its live demo). Screenshots man5-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PAGES } from "../manual/pages.mjs";
import { encodeSceneHash, decodeSceneHash } from "../src/codec.js";
import { shareCode } from "../src/qr/share-code.js";

const SHOTS = path.resolve("tests/screenshots");
const read = (f) => fs.readFileSync(`manual/${f}`, "utf8");
const plain = (h) => h.replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); // prettier-ignore

test.describe("the audit's fixes (docs/audits/manual-audit-2026-10/REPORT.md)", () => {
  test("F01: Splashery is primarily splat based, and Sharp view is not splats", () => {
    const cover = plain(read("index.html"));
    expect(cover).toContain("Almost every toy");
    expect(cover).toContain("primarily splat based");
    expect(cover).toContain("textured relief");
    expect(cover).toContain("not drawn with splats");
    expect(cover).not.toContain("They are still splats");
    expect(cover).not.toMatch(/Every toy in the Splashery Playground is made of/);
  });

  test("F12 to F16: the gallery's sentences agree with their programs", () => {
    const g = JSON.parse(fs.readFileSync("src/equation-gallery.json", "utf8"));
    const by = Object.fromEntries(g.map((e) => [e.id, e]));
    expect(by.sphere.about).not.toContain("latitude");
    expect(by.sphere.about).toContain("longitude");
    expect(by["rose-curve"].about).toContain("12 petals");
    expect(by["rose-curve"].about).not.toContain("six-petal");
    // x = (2+cos(2u))cos(3u+t), z = ...sin(3u+t), y = sin(2u) is the trefoil.
    expect(by["figure-eight-knot"].title).toBe("Trefoil knot beads");
    expect(by["figure-eight-knot"].about).toContain("trefoil");
    expect(by["figure-eight-knot"].source).toContain("Trefoil_knot");
    expect(by["orbiting-rings"].about).not.toMatch(/three circular/i);
    expect(by["orbiting-rings"].title).not.toContain("rings");
    // hue = u/(2pi) only: nothing follows the tube.
    expect(by["angle-around-torus"]?.about ?? g.find((e) => e.title === "Angle around the torus").about).not.toContain("follows the tube"); // prettier-ignore
    // The manual's page was built from the file.
    const html = read("gallery.html");
    for (const e of g) expect(html).toContain(e.program.split("\n")[0].replace(/&/g, "&amp;"));
    expect(html).not.toContain("six-petal");
    expect(html).toContain("labs");
  });

  test("F17 to F19, F28, F29: fluids, recording, Hands-on, budgets, and the link format", () => {
    const more = plain(read("more.html"));
    expect(more).toContain("four small splats");
    expect(more).toContain("one smooth surface");
    expect(more).not.toContain("drawn as its own splats, one per particle");
    expect(more).toContain("nothing is recorded unless you ask");
    expect(more).toContain("saves it only to a file you choose");
    expect(more).toContain("Most toys play this way");
    expect(more).not.toContain("Every toy plays this way");
    const u = plain(read("unique.html"));
    expect(u).toContain("still download");
    expect(u).toContain("raw deflate");
    expect(u).toContain("j.");
    expect(u).toContain("not readable as plain text");
  });

  test("F05, F25, F26: the option keys, what is packed, and what a bad number becomes", () => {
    const l = plain(read("language.html"));
    expect(l).toContain("come to 16");
    expect(l).not.toContain("One more key would fit");
    expect(l).toContain("the move from its place to its target place");
    expect(l).toContain("+∞ is 1 and −∞ is 0");
    expect(l).not.toContain("a red, green, or blue that can't becomes 0");
  });

  test("F11, F23, F27, F30: the added blur, the tilt qualifier, the 0.37 caution, the author copy", () => {
    const s = plain(read("splat.html"));
    expect(s).toContain("0.3 square pixels");
    expect(s).toContain("first-order footprint");
    expect(s).toContain("usually not zero");
    expect(s).toContain("blending space");
    expect(plain(read("references.html"))).toContain(
      "keithp.com/~keithp/porterduff/p253-porter.pdf",
    );
  });

  test("F20: the experiment notes say what is built", () => {
    const s = plain(read("splat.html"));
    expect(s).not.toContain("is a planned experiment in the Kit lab");
    expect(s).toContain("docs/lab/GLOSS.md");
  });

  test("F07 to F10, F24: the demos' readouts (the toy's own reader, thin versus flat, easing, one moment)", async ({
    page,
  }) => {
    await page.goto("/manual/language.html");
    // F07: the reader demo asks the toy's own reader; a text longer than 240 characters is refused.
    await page.fill("#parse-input", "u+".repeat(130) + "1");
    await expect(page.locator("#parse-tree")).toContainText("over 240 characters");
    // Nested 40 deep (over the toy's 32): the tree is drawn, and the toy's reader says no.
    await page.fill("#parse-input", "(".repeat(40) + "u" + ")".repeat(40));
    await expect(page.locator("#parse-tree")).toContainText("would not accept");
    await page.fill("#parse-input", "sin 2u");
    await expect(page.locator("#parse-tree")).not.toContainText("would not accept");
    // 120 to 240 characters is fine now.
    await page.fill("#parse-input", "u+".repeat(70) + "1");
    await expect(page.locator("#parse-tree")).not.toContainText("would not accept");
    // F09 and F10: no wall-clock time at one place of the slider; one moment has no worst case.
    await page.fill("#t-knots", "1");
    await page.dispatchEvent("#t-knots", "input");
    const t = await page.locator("#t-readout").textContent();
    expect(t).not.toContain("wall clock");
    expect(t).toContain("easing in and out");
    expect(t).not.toContain("200.0%");
    expect(t).toContain("worst case for a turn: none");
    expect(t).toContain("the toy offers 12 to 15");
    await page.fill("#t-knots", "12");
    await page.dispatchEvent("#t-knots", "input");
    const t12 = await page.locator("#t-readout").textContent();
    expect(t12).toContain("worst case for a turn: 3.4%");
    expect(t12).not.toContain("the toy offers");
  });

  test("F08 and F24: a thin matrix is valid with a warning; a negative size is not printed as NaN", async ({
    page,
  }) => {
    await page.goto("/manual/splat.html");
    await page.click("#cov-mode-matrix");
    const set = async (id, v) => {
      await page.fill(`#${id}`, String(v));
      await page.dispatchEvent(`#${id}`, "input");
    };
    // A narrow bell (a = 0.6, c = 0.01, a little tilt) is valid.
    await set("cov-a", 0.6);
    await set("cov-b", 0.07);
    await set("cov-c", 0.01);
    await expect(page.locator("#cov-verdict")).toContainText("Valid");
    // A negative eigenvalue: no NaN anywhere.
    await set("cov-a", 0.1);
    await set("cov-b", 0.5);
    await set("cov-c", 0.1);
    await expect(page.locator("#cov-verdict")).toContainText("Not valid");
    const r = await page.locator("#cov-readout").textContent();
    expect(r).not.toContain("NaN");
    expect(r).toContain("negative");
  });
});

test.describe("the PDF", () => {
  test("it prints the 60 gallery programs and their Run it links", async ({ page }) => {
    await page.goto("/manual/all.html");
    await page.emulateMedia({ media: "print" });
    const g = JSON.parse(fs.readFileSync("src/equation-gallery.json", "utf8"));
    const shown = await page.evaluate(() => {
      document.querySelectorAll("details").forEach((d) => (d.open = true));
      const vis = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"; // prettier-ignore
      return {
        pre: [...document.querySelectorAll(".gallery-grid details.program pre")].filter(vis).length,
        links: [...document.querySelectorAll(".gallery-grid .card-links a.button")].filter(vis).length, // prettier-ignore
      };
    });
    expect(shown).toEqual({ pre: g.length, links: g.length });
  });

  test("its text has every program, and its links never point at a local server", async ({
    page,
  }) => {
    await page.goto("/manual/");
    const res = await page.evaluate(async () => {
      const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      const data = new Uint8Array(
        await (await fetch("/manual/tinkerers-manual.pdf")).arrayBuffer(),
      );
      const doc = await pdfjs.getDocument({ data }).promise;
      let text = "";
      const urls = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        text += (await p.getTextContent()).items.map((x) => x.str).join(" ") + "\n";
        for (const a of await p.getAnnotations()) if (a.url) urls.push(a.url);
      }
      return { pages: doc.numPages, text: text.replace(/\s+/g, " "), urls };
    });
    expect(res.pages).toBeGreaterThan(90);
    const g = JSON.parse(fs.readFileSync("src/equation-gallery.json", "utf8"));
    for (const e of g) {
      // A long line wraps in the print; compare without spaces.
      const firstLine = e.program.split("\n")[0].replace(/\s+/g, "");
      expect(res.text.replace(/\s+/g, ""), e.id).toContain(firstLine);
    }
    expect(res.urls.filter((u) => /127\.0\.0\.1|localhost/.test(u))).toEqual([]);
    expect(res.urls).toContain(
      "https://ryanjosephkamp.github.io/splashery/manual/example-recipe.js",
    );
    // The two new chapters are in it, in order, and the arrow of the affine definition is too.
    expect(res.text.indexOf("How Splashery is built")).toBeGreaterThan(0);
    expect(res.text.indexOf("Share links and QR codes", res.text.indexOf("How Splashery is built"))).toBeGreaterThan(0); // prettier-ignore
    expect(res.text.replace(/\s+/g, "")).toContain("p↦Ap+b");
  });

  test("the same input and the same Chromium print the same bytes", async () => {
    test.setTimeout(420_000);
    const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "man5-pdf-"));
    const a = path.join(dir, "a.pdf");
    const b = path.join(dir, "b.pdf");
    const env = { ...process.env, SPLASHERY_CHROMIUM: process.env.SPLASHERY_CHROMIUM || "" };
    if (!env.SPLASHERY_CHROMIUM) delete env.SPLASHERY_CHROMIUM;
    for (const out of [a, b])
      execFileSync("node", ["tools/manual-pdf.mjs", out, "--allow-other-browser"], { env, stdio: "pipe" }); // prettier-ignore
    const A = fs.readFileSync(a);
    expect(A.equals(fs.readFileSync(b))).toBe(true);
    // The shipped PDF is that print of this input (when the pinned Chromium made it).
    const shipped = fs.readFileSync("manual/tinkerers-manual.pdf");
    if (A.toString("latin1").includes("Skia/PDF m141") && shipped.toString("latin1").includes("Skia/PDF m141")) // prettier-ignore
      expect(A.equals(shipped), "run tools/manual-pdf.mjs again: the shipped PDF is out of date").toBe(true); // prettier-ignore
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

test.describe("the two new chapters", () => {
  test("they are pages after the unique features, in the contents and in the PDF's page", () => {
    const files = PAGES.map((p) => p.file);
    const i = files.indexOf("unique.html");
    expect(files.slice(i + 1, i + 3)).toEqual(["built.html", "share.html"]);
    const cover = read("index.html");
    expect(cover).toContain('href="built.html">How Splashery is built');
    expect(cover).toContain('href="share.html">Share links and QR codes');
    const all = read("all.html");
    expect(all.indexOf('id="built"')).toBeGreaterThan(all.indexOf('id="unique"'));
    expect(all.indexOf('id="share"')).toBeGreaterThan(all.indexOf('id="built"'));
    expect(all.indexOf('id="experiments"')).toBeGreaterThan(all.indexOf('id="share"'));
  });

  test("every file the two chapters (and the audit's fixes) cite exists", () => {
    const missing = [];
    for (const f of ["built.html", "share.html", "more.html", "unique.html"]) {
      const text = read(f);
      for (const m of text.matchAll(
        /<code>((?:src|tools|tests|docs|vendor|assets|embed|worlds|manual|site)\/[A-Za-z0-9_./-]*[A-Za-z0-9_])<\/code>/g,
      )) {
        // prettier-ignore
        const p = m[1].replace(/\/$/, "");
        if (!fs.existsSync(p)) missing.push(`${f}: ${p}`);
      }
      for (const m of text.matchAll(/<code>(index\.html|styles\.css|package\.json|playwright\.config\.mjs|CLAUDE\.md|CREDITS\.md|LICENSES\.md|README\.md)<\/code>/g)) // prettier-ignore
        if (!fs.existsSync(m[1])) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  test("the library table lists every folder of vendor/, and LICENSES.md has each", () => {
    const html = read("built.html");
    const licenses = fs.readFileSync("LICENSES.md", "utf8");
    const folders = fs.readdirSync("vendor", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); // prettier-ignore
    expect(folders.length).toBeGreaterThanOrEqual(15);
    for (const f of folders) {
      expect(html, f).toContain(`<code>${f}</code>`);
      expect(licenses, f).toContain(`vendor/${f}`);
    }
    // The versions in the table are the ones LICENSES.md names.
    for (const v of [
      "PlayCanvas 2.22.3",
      "gifenc 1.0.3",
      "PDF.js 6.3.289",
      "omggif 1.0.10",
      "ONNX Runtime Web 1.30.0",
      "Splat.js 0.1.0",
      "jsQR 1.4.0",
      "ZXing for JavaScript 0.21.3",
      "pdf-lib 1.17.1",
      "laz-perf 0.0.7",
      "dicom-parser 1.8.21",
      "splat-transform 3.6.1",
    ]) {
      // prettier-ignore
      expect(plain(html), v).toContain(v);
    }
    expect(licenses).toContain("PlayCanvas Engine 2.22.3");
    expect(licenses).toContain("pdf-lib 1.17.1");
    expect(licenses).toContain("laz-perf 0.0.7");
    expect(licenses).toContain("dicom-parser 1.8.21");
    expect(licenses).toContain("ONNX Runtime Web 1.30.0");
    expect(licenses).toContain("jsQR 1.4.0");
    expect(licenses).toContain("ZXing for JavaScript 0.21.3");
    expect(licenses).toContain("splat-transform 3.6.1");
    // "Loaded only when ..." claims that a test can check: these are dynamic imports in the source.
    expect(fs.readFileSync("src/media.js", "utf8")).toContain("vendor/pdfjs/");
    expect(fs.readFileSync("src/pdf-export/pdf.js", "utf8")).toContain("await import(");
    expect(fs.readFileSync("src/exports.js", "utf8")).toContain('from "gifenc"');
  });

  test("the code's own claims: one engine import, the device order, the link format", () => {
    expect(fs.readFileSync("src/pc.js", "utf8")).toContain("export * from");
    expect(fs.readFileSync("src/stage.js", "utf8")).toContain("DEVICETYPE_WEBGPU");
    const codec = fs.readFileSync("src/codec.js", "utf8");
    expect(codec).toContain('"d." +');
    expect(codec).toContain('"j." +');
    expect(codec).toContain('"deflate-raw"');
    expect(fs.readFileSync("src/exports.js", "utf8")).toContain("LINK_LIMIT = 12 * 1024");
    expect(fs.readFileSync("src/qr/share-code.js", "utf8")).toContain("MAX_BYTES = 2953");
    expect(fs.readFileSync("package.json", "utf8")).not.toMatch(/"build"/);
  });

  test("the codec: d. is raw deflate in base64url, j. is the same JSON uncompressed, old versions load", async () => {
    const scene = { app: "splashery", version: 3, seed: 7, toy: { kind: "builtin", id: "cactus" } };
    const d = await encodeSceneHash(scene);
    expect(d).toMatch(/^d\.[A-Za-z0-9_-]+$/);
    expect(await decodeSceneHash(d)).toEqual(scene);
    // j.: base64url of the UTF-8 JSON itself.
    const j = "j." + Buffer.from(JSON.stringify(scene)).toString("base64url");
    expect(await decodeSceneHash(j)).toEqual(scene);
    // d.: what is inside really is raw deflate (Node's inflateRaw reads it).
    const zlib = await import("node:zlib");
    const back = zlib.inflateRawSync(Buffer.from(d.slice(2), "base64url")).toString("utf8");
    expect(JSON.parse(back)).toEqual(scene);
    // A changed character usually breaks it (and never goes unnoticed as the same scene, here).
    let broke = 0;
    for (let i = 2; i < d.length; i += 3) {
      const c = d[i] === "A" ? "B" : "A";
      try {
        const out = await decodeSceneHash(d.slice(0, i) + c + d.slice(i + 1));
        if (JSON.stringify(out) === JSON.stringify(scene)) continue;
      } catch {
        // damaged
      }
      broke++;
    }
    expect(broke).toBeGreaterThan(Math.floor((d.length - 2) / 3) * 0.7);
    // The format letter must be d or j, and a dot must follow.
    await expect(decodeSceneHash("x.AAAA")).rejects.toThrow(/Unknown scene hash format/);
    await expect(decodeSceneHash("AAAA")).rejects.toThrow(/Malformed/);
    // Old schemas load (version 2 as version 3, version 1 is refused).
    const { normalizeScene } = await import("../src/state.js");
    const v2 = normalizeScene({
      app: "splashery",
      version: 2,
      toy: { kind: "builtin", id: "cactus" },
    });
    expect(v2.version).toBe(3);
    expect(() => normalizeScene({ version: 1 })).toThrow(/v1/);
    expect(() => normalizeScene({ version: 9 })).toThrow(/newer Splashery/);
  });

  test("a scene's link and its QR code: sizes as the chapter says", async () => {
    const scene = { app: "splashery", version: 3, seed: 7, toy: { kind: "builtin", id: "cactus" } };
    const url = `https://ryanjosephkamp.github.io/splashery/#s=${await encodeSceneHash(scene)}`;
    const made = shareCode(url);
    expect(made.ok).toBe(true);
    expect(made.level).toBe("M");
    // Too long for one code: more than 2,953 bytes.
    const long = `${url}${"x".repeat(3000)}`;
    expect(shareCode(long).ok).toBe(false);
  });

  test("the demo: it encodes, reads back, breaks, and draws a QR code that reads back to the link (390 and 1440)", async ({
    browser,
  }) => {
    for (const [w, h, name] of [
      [390, 844, "390x844"],
      [1440, 900, "1440x900"],
    ]) {
      // prettier-ignore
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500 });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/manual/share.html");
      await page.waitForFunction(() => document.getElementById("sh-hash")?.value.startsWith("d."));
      const scene = JSON.parse(await page.inputValue("#sh-json"));
      const hash = await page.inputValue("#sh-hash");
      expect(await decodeSceneHash(hash)).toEqual(scene);
      await expect(page.locator("#sh-sizes")).toContainText("raw deflate");
      await expect(page.locator("#sh-decoded")).toContainText("Read back from the link");
      await expect(page.locator("#sh-decoded")).toContainText("normalizeScene");
      // The QR code drawn is the code of the link the demo shows; read it back with jsQR.
      await expect(page.locator("#sh-qr-note")).toContainText("version");
      await page.addScriptTag({ path: "vendor/jsqr/jsQR.js" });
      const read = await page.evaluate(() => {
        const c = document.getElementById("sh-qr");
        const g = c.getContext("2d");
        const img = g.getImageData(0, 0, c.width, c.height);
        return globalThis.jsQR(img.data, img.width, img.height)?.data ?? null;
      });
      expect(read).toBe(
        new URL("../", `http://127.0.0.1:4173/manual/share.html`).href + `#s=${hash}`,
      );
      // Edit the scene: the link follows. A bad JSON says so.
      await page.fill("#sh-json", JSON.stringify({ ...scene, seed: 99 }));
      await expect(page.locator("#sh-decoded")).toContainText('"seed":99');
      expect((await page.inputValue("#sh-hash")) !== hash).toBe(true);
      await page.fill("#sh-json", "{ not json");
      await expect(page.locator("#sh-sizes")).toContainText("not valid JSON");
      await page.click("#sh-reset");
      await expect(page.locator("#sh-decoded")).toContainText("Read back from the link");
      // One changed character: the text is damaged or different, and Put it back restores it.
      await page.click("#sh-break");
      await expect(page.locator("#sh-decoded")).toContainText("changed from");
      await page.click("#sh-undo");
      await expect(page.locator("#sh-decoded")).toContainText("Read back from the link");
      // A scene too big for one QR code says so.
      const stamps = Array.from({ length: 400 }, (_, i) => [Math.sin(i) * 0.5 + 0.5, Math.cos(i * 7.3) * 0.5 + 0.5, 0.5, 0.06, "#" + ((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6), 1]); // prettier-ignore
      await page.fill("#sh-json", JSON.stringify({ ...scene, paint: { stamps } }));
      await expect(page.locator("#sh-qr-note")).toContainText("more than one QR code holds");
      await page.click("#sh-reset");
      // No sideways scroll, and a picture of the demo.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.addStyleTag({ content: ".outline { display: none !important; }" });
      await page.locator("#demo-share").screenshot({ path: path.join(SHOTS, `man5-demo-share-${name}.png`) }); // prettier-ignore
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });

  test("the new chapters at phone size: no sideways scroll, tables scroll in their own boxes", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    for (const f of ["built.html", "share.html"]) {
      await page.goto(`/manual/${f}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), f).toBe(true); // prettier-ignore
      await page.screenshot({
        path: path.join(SHOTS, `man5-${f.replace(".html", "")}-390x844.png`),
      });
    }
    await ctx.close();
  });
});
