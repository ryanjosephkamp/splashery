// Lane Polish (pages): the Picture lab, Your book and the Photo album after
// the owner's audit. Pop out finds a PDF's drawn figures (src/media.js), the
// lab opens close on a phone and changes its pages in place (lane PIC2), raised photos open at a
// visible depth, a book holds the whole book in view while its cover or a
// page turns, links follow only a tap right on them, a closed book's cover
// takes part in Pop out, and the album's captions read as words. (The
// engine's halves, drawn figures and the depth slider, are tested in
// tests/pol-engine.spec.mjs.)

import { test, expect } from "@playwright/test";

// ---- In Node: the recipes with stand-in pictures (as tests/bk5.spec.mjs) -------------

// (Each build its own file name, so a book never resumes where another test left it.)
let PLAYS = 0;
async function play(id, options = {}, pics = null) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/pictures.js");
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const media = pics ? { kind: pics.kind, count: pics.count, name: `${pics.name}${++PLAYS}`, aspect: pics.aspect(0), aspects: null, names: null } : null; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts, media }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const data = { ...(b.value.kit.data || {}), pictures: pics };
  const c = { turn: 0, pop: 0, box: 0 };
  let time = 1;
  let n = 0;
  let pick = null;
  let out = null;
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, c, out, { time, R: 1, tap: n ? { n, pick } : null, data });
    return out;
  };
  const tap = (point) => {
    const a = r.action.at?.(point);
    pick = a?.pick ?? null;
    n++;
    return frame();
  };
  const run = (s) => {
    for (let t = 0; t < s; t += 1 / 30) {
      time += 1 / 30;
      frame();
    }
    return out;
  };
  const set = (key, v) => {
    c[key] = v;
    return frame();
  };
  const settle = async () => {
    for (let i = 0; i < 4; i++) await new Promise((res) => setTimeout(res, 0));
  };
  return { r, kit: b.value.kit, buf: b.value.buf, tap, run, set, frame, settle, get out() { return out; }, get time() { return time; } }; // prettier-ignore
}

function fakeCanvas(w = 40, h = 30) {
  const data = new Uint8ClampedArray(w * h * 4).fill(250);
  for (let y = 8; y < 22; y++) for (let x = 10; x < 30; x++) data.set([30, 60, 150, 255], (y * w + x) * 4); // prettier-ignore
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }) }; // prettier-ignore
}
// Page 1 is a page of contents: a link line running the page's width.
const LINE = { box: [0.1, 0.3, 0.95, 0.35], page: 5 };
const COVER_FIG = [0.2, 0.3, 0.8, 0.6];
function fakePics(count, kind = "pdf", aspect = 612 / 792) {
  return {
    page: 0,
    count,
    kind,
    name: "test",
    opened: [],
    go(p) {
      this.page = Math.max(0, Math.min(count - 1, Math.round(p)));
      return this.page;
    },
    ready: () => true,
    aspect: () => aspect,
    links: async (n) => (n === 1 ? [LINE] : []),
    figures: async (n) => (n === 0 ? [{ box: COVER_FIG }] : []),
    crop: async () => fakeCanvas(),
    openLink(url) {
      this.opened.push(url);
      return true;
    },
  };
}
// Runs fn with the window shaped like a phone held upright (or not).
async function shaped(upright, fn) {
  const had = [globalThis.innerWidth, globalThis.innerHeight];
  Object.assign(globalThis, upright ? { innerWidth: 390, innerHeight: 844 } : { innerWidth: 1440, innerHeight: 900 }); // prettier-ignore
  try {
    return await fn();
  } finally {
    Object.assign(globalThis, { innerWidth: had[0], innerHeight: had[1] });
  }
}

test.describe("the Storybook keeps main's book (no browser)", () => {
  // The Storybook (`book`, Hands-on H3's toy) shares Your book's recipe, so its recipe's
  // polish: false keeps it exactly as on main: no pull-back views, no waits before a turn, the
  // page view one page wide, the old link slack and tinted links, and no cover figures.
  const watch = async (id) => {
    const pics = fakePics(12);
    const b = await play(id, { reading: "one" }, pics);
    const seen = [];
    const step = (s) => {
      for (let t = 0; t < s; t += 1 / 30) {
        b.run(1 / 30);
        seen.push({ t: b.time, key: b.out.view.key, w: b.out.view.size?.[0], page: pics.page });
      }
    };
    const t0 = b.time;
    b.tap([0.3, 0, 0.02]); // opens the cover
    step(1.6);
    b.tap([0.55, 0, 0.02]); // turns a page
    const t1 = b.time;
    step(1.6);
    return { seen, t0, t1, pics };
  };

  test("its views and timings are main's; Your book's are the new ones", async () => {
    const W = 612 / 792;
    const story = await watch("book");
    const keys = new Set(story.seen.map((s) => s.key));
    expect(keys.has("book")).toBe(false);
    expect(keys.has("turn")).toBe(false);
    for (const s of story.seen) if (s.key === "R" || s.key === "L") expect(s.w).toBeCloseTo(W, 4);
    const yours = await watch("your-book");
    expect(yours.seen.some((s) => s.key === "book")).toBe(true);
    expect(yours.seen.some((s) => s.key === "turn")).toBe(true);
    // The Storybook's page turns as soon as it is tapped (no wait for the view): its page index
    // moves at least a quarter second sooner than Your book's.
    const moved = (w) => w.seen.find((s) => s.t > w.t1 && s.page !== w.seen.find((x) => x.t > w.t1)?.page)?.t - w.t1; // prettier-ignore
    const a = moved(story);
    const b = moved(yours);
    if (Number.isFinite(a) && Number.isFinite(b)) expect(a).toBeLessThan(b - 0.25);
  });

  test("its links keep their slack and their tint; its figures are asked for plainly", async () => {
    const asked = [];
    const pics = fakePics(12);
    pics.name = "storybook-figures"; // (its own name: the figures found are kept per file)
    const plain = pics.figures;
    pics.figures = (n, opts) => {
      asked.push(opts);
      return plain(n);
    };
    const b = await play("book", { reading: "one" }, pics);
    b.set("pop", 1);
    await b.settle();
    b.run(0.1);
    await b.settle();
    b.tap([0.3, 0, 0.02]);
    b.run(2);
    await b.settle();
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((o) => o === undefined)).toBe(true);
    const variants = Object.values(b.out.sheets || {}).map((sh) => sh.variant || "");
    expect(variants.some((v) => v.includes("bare"))).toBe(false);
  });
});

test.describe("Picture lab (no browser)", () => {
  test("on a phone held upright it opens close on the page itself; otherwise on the whole lab", async () => {
    await shaped(true, async () => {
      const b = await play("picture-lab", {}, fakePics(3));
      const v = b.frame().view;
      expect(v.key).toMatch(/^page/);
      // The page's own shape (612 x 792 in a 2 x 2 sheet) with a little margin.
      expect(v.size[0]).toBeCloseTo(2.12 * (612 / 792), 3);
      expect(v.size[1]).toBeCloseTo(2.12, 3);
      // A double-tap lets go of it.
      b.r.focus([0, 0, 0]);
      expect(b.frame().view.key).toBe("all");
    });
    await shaped(false, async () => {
      const b = await play("picture-lab", {}, fakePics(3));
      expect(b.frame().view.key).toBe("all");
    });
  });

  // Lane PIC2 (the owner's call of October 17, 2026): the slide is gone; a page changes in place.
  test("a page change happens in place: no slide, the page itself just changes", async () => {
    const pics = fakePics(3);
    const b = await shaped(false, () => play("picture-lab", {}, pics));
    b.frame();
    b.tap([0.6, 0, 0]);
    const xs = [];
    for (let i = 0; i < 12; i++) xs.push(b.run(1 / 30).parts.labpage?.offset?.[0] ?? 0);
    expect(xs.every((x) => x === 0)).toBe(true);
    expect(pics.page).toBe(1);
    // Back from the left half.
    b.tap([-0.6, 0, 0]);
    b.run(1 / 30);
    expect(pics.page).toBe(0);
    // A page changed from the Toy tab doesn't move the page either.
    pics.go(2);
    b.frame();
    expect(b.run(0.1).parts.labpage?.offset?.[0] ?? 0).toBe(0);
  });

  test("a photo's card takes the photo's shape, and the photo rises at depth 2", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const pics = { ...fakePics(1, "image", 1.5), crop: async () => null };
    const b = await shaped(false, () => play("picture-lab", {}, pics));
    // The card takes the photo's shape (2.08 by 2 / 1.5 + 0.08, so about 0.68 as tall as it is
    // wide), where a PDF's card is square: the built splats' extent says so.
    const extent = (buf) => {
      let x = 0;
      let y = 0;
      for (let i = 0; i < buf.count; i++) {
        x = Math.max(x, Math.abs(buf.pos[i * 3]));
        y = Math.max(y, Math.abs(buf.pos[i * 3 + 1]));
      }
      return y / x;
    };
    expect(b.buf.count).toBeGreaterThan(1000);
    expect(extent(b.buf)).toBeCloseTo((2 / 1.5 + 0.08) / 2.08, 1);
    const square = await shaped(false, () => play("picture-lab", {}, fakePics(3)));
    expect(extent(square.buf)).toBeCloseTo(1, 1);
    b.set("pop", 1);
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    b.run(4.2);
    const F = BOOKS_R5.POP;
    expect(F.phase).toBe("up");
    expect(F.depth).toBe(2);
    expect(b.out.slider.value).toBeCloseTo(0.25, 5);
  });
});

test.describe("Your book and the album (no browser)", () => {
  test("one page at a time: the whole book stays in view while the cover or a page turns, then the view glides in", async () => {
    const pics = fakePics(12);
    const b = await play("your-book", { reading: "one" }, pics);
    expect(b.frame().view.key).toBe("C");
    b.tap([0.3, 0, 0.02]);
    expect(b.run(0.3).view.key).toBe("book");
    expect(b.out.view.center).toEqual([0, 0, 0]);
    b.run(1.3);
    expect(b.out.view.key).toBe("R");
    // The page in view has a little margin each side.
    const W = 612 / 792;
    expect(b.out.view.size[0]).toBeCloseTo(1.14 * W, 3);
    b.tap([0.55, 0, 0.02]);
    expect(b.run(0.3).view.key).toBe("turn");
    b.run(1.3);
    expect(`${pics.page}${b.out.view.key}`).toBe("3L");
    // Both pages: as before, the whole book.
    const a = await play("photo-album", { reading: "both" }, fakePics(12, "image"));
    a.tap([0.4, 0, 0.02]);
    expect(a.run(0.3).view.key).toBe("all");
  });

  test("a link is followed only for a tap right on it, never in the strip at the page's outer edge", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const pics = fakePics(12);
    const b = await play("your-book", { reading: "both" }, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.6);
    await b.settle();
    b.run(0.1);
    expect(pics.page).toBe(1);
    // On the line, at the page's outer (right) edge: the page turns.
    b.tap(BOOKS_R5.point(1, [0.93, 0.32]));
    b.run(1.6);
    expect(pics.page).toBe(3);
    pics.go(1);
    b.run(1.6);
    await b.settle();
    b.run(0.1);
    // Just below the line (where the old slack reached): the page turns.
    b.tap(BOOKS_R5.point(1, [0.5, 0.355]));
    b.run(1.6);
    expect(pics.page).toBe(3);
    pics.go(1);
    b.run(1.6);
    await b.settle();
    b.run(0.1);
    // Right on it: the link.
    b.tap(BOOKS_R5.point(1, [0.5, 0.32]));
    b.run(2);
    expect(pics.page).toBe(5);
  });

  test("with Pop out on, a closed book's cover figure rises; a tap off it opens the book", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const pics = fakePics(12);
    const b = await play("your-book", { reading: "both" }, pics);
    b.set("pop", 1);
    await b.settle();
    b.run(0.1);
    await b.settle();
    b.tap(BOOKS_R5.point(0, [0.5, 0.45]));
    await b.settle();
    b.run(1.6);
    const F = BOOKS_R5.POP;
    expect(F.phase).toBe("up");
    expect(F.target.sheet).toBe("cover");
    expect(b.out.sheets.cover.variant).toMatch(/^hole:/);
    expect(pics.page).toBe(0);
    // A tap on it lays it back; a tap off it opens the book.
    // (The risen figure's place is where the book was built; the closed book lies shifted.)
    // (COVER_FIG is centered across the page, so its place's middle is the page's.)
    const shift = BOOKS_R5.point(0, [0.5, 0.5])[0] - F.target.rect.cx;
    b.tap([F.at.cx + shift, F.at.cy, 0.3]);
    b.run(1.2);
    b.tap(BOOKS_R5.point(0, [0.5, 0.95]));
    b.run(1.8);
    expect(pics.page).toBe(1);
  });

  test("with Pop out on, a book's links show a moment, then its pages are drawn bare", async () => {
    const pics = fakePics(12);
    const b = await play("your-book", { reading: "both" }, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.6);
    b.set("pop", 1);
    b.run(0.5);
    const leaves = (o) => Object.entries(o.sheets).filter(([id]) => /^[fb]\d$/.test(id));
    expect(leaves(b.out).some(([, s]) => s.variant)).toBe(false);
    b.run(1.5);
    expect(leaves(b.out).every(([, s]) => s.variant === "bare")).toBe(true);
    b.set("pop", 0);
    expect(leaves(b.out).some(([, s]) => s.variant)).toBe(false);
  });

  test("album captions read as words; a lifted photo opens at depth 2", async () => {
    const { albumCaption, BOOKS_R5 } = await import("../src/packs/pictures.js");
    expect(albumCaption("sailboat.jpg")).toBe("Sailboat");
    expect(albumCaption("red-barn.jpg")).toBe("Red barn");
    expect(albumCaption("my_summer--trip.JPEG")).toBe("My summer trip");
    expect(albumCaption("")).toBe("");
    const pics = { ...fakePics(4, "image"), aspect: () => 1.5, crop: async () => null };
    const b = await play("photo-album", { reading: "both" }, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.8);
    b.set("pop", 1);
    await b.settle();
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    b.run(4.2);
    expect(BOOKS_R5.POP.phase).toBe("up");
    expect(BOOKS_R5.POP.depth).toBe(2);
  });
});

// ---- In the app ----------------------------------------------------------------------

test.describe("Pop out's drawn figures", () => {
  test("Your book, the album and the lab ask for drawn figures; the Storybook doesn't", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    expect(RECIPES.book.polish).toBe(false);
    expect(RECIPES["your-book"].polish).not.toBe(false);
    expect(RECIPES["photo-album"].polish).not.toBe(false);
    expect(RECIPES["picture-lab"].polish).not.toBe(false);
  });
});
