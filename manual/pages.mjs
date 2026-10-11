// The Tinkerer's Manual's pages, in reading order. The web manual is one page per chapter (the
// owner's direction of October 10, 2026); manual/all.html is the whole manual on one page, for the
// PDF. `node manual/build-pages.mjs` writes each page's head, its contents button and its Previous
// and Next buttons from this list, and everything else that follows from it (see that file).
//
// A chapter is a step up the ladder from one splat to making your own: the cover, the titles, the
// menus, and the text all say "Chapter". `ids` are the headings (h2) on the page. manual/coming.html
// is no longer a page of the manual: it only sends an old address (coming.html#moving) to the
// chapter that now has it.

export const PAGES = [
  { file: "index.html", title: "The Tinkerer's Manual", short: "The Tinkerer's Manual", ids: [] },
  { file: "splat.html", chapter: 1, title: "What a splat is", ids: ["splat"] },
  { file: "toy.html", chapter: 2, title: "How a toy is built", ids: ["toy"] },
  { file: "language.html", chapter: 3, title: "The splat equation language", ids: ["language"] },
  { file: "gallery.html", chapter: 4, title: "A gallery of programs", ids: ["gallery"] },
  { file: "pictures.html", chapter: 5, title: "Pictures, screens, and your own input", ids: ["pictures"] },
  { file: "moving.html", chapter: 6, title: "Moving things", ids: ["moving"] },
  { file: "data.html", chapter: 7, title: "Real data as splats", ids: ["data"] },
  { file: "photo3d.html", chapter: 8, title: "Photos and video into 3D", ids: ["photo3d"] },
  { file: "codes.html", chapter: 9, title: "Codes and pages", ids: ["codes"] },
  { file: "make.html", chapter: 10, title: "Make your own", ids: ["make"] },
  { file: "more.html", title: "What else Splashery does now", ids: ["more"] },
  { file: "unique.html", title: "What Splashery can do that other splat tools can't", ids: ["unique"] }, // prettier-ignore
  { file: "built.html", title: "How Splashery is built", ids: ["built"] },
  { file: "share.html", title: "Share links and QR codes", ids: ["share"] },
  { file: "experiments.html", title: "Open questions: other choices, not tried yet", ids: ["experiments"] }, // prettier-ignore
  { file: "later.html", title: "What comes later: Code a toy", ids: ["later"] },
  { file: "glossary.html", title: "Glossary", ids: ["glossary"] },
  { file: "reading.html", title: "Further reading", ids: ["reading"] },
  { file: "references.html", title: "References", ids: ["references"] },
  { file: "card.html", title: "Quick reference", ids: ["card"] },
]; // prettier-ignore

// The label a chapter has in a title or a menu: "Chapter 2: How a toy is built".
export const label = (p) => (p.chapter ? `Chapter ${p.chapter}: ${p.title}` : p.title);
