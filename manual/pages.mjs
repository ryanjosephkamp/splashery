// The Tinkerer's Manual's pages, in reading order. The web manual is one page per chapter (the
// owner's direction of October 10, 2026); manual/all.html is the whole manual on one page, for the
// PDF. `node manual/build-pages.mjs` writes each page's head, its contents button and its Previous
// and Next buttons from this list, and everything else that follows from it (see that file).
//
// A chapter is a learning level (the cover says "Chapter" in titles and navigation; the text still
// says "Level" where it speaks of the ladder). `ids` are the headings (h2) on the page.

export const PAGES = [
  { file: "index.html", title: "The Tinkerer's Manual", short: "The Tinkerer's Manual", ids: [] },
  { file: "splat.html", chapter: 1, title: "What a splat is", ids: ["splat"] },
  { file: "toy.html", chapter: 2, title: "How a toy is built", ids: ["toy"] },
  { file: "language.html", chapter: 3, title: "The splat equation language", ids: ["language"] },
  { file: "gallery.html", chapter: 4, title: "A gallery of programs", ids: ["gallery"] },
  { file: "pictures.html", chapter: 5, title: "Pictures, screens, and your own input", ids: ["pictures"] },
  { file: "coming.html", title: "Chapters 6 to 10: coming next", ids: ["moving", "data", "photo3d", "codes", "make"] }, // prettier-ignore
  { file: "more.html", title: "What else Splashery does now", ids: ["more"] },
  { file: "unique.html", title: "What Splashery can do that other splat tools can't", ids: ["unique"] }, // prettier-ignore
  { file: "experiments.html", title: "Open questions: other choices, not tried yet", ids: ["experiments"] }, // prettier-ignore
  { file: "later.html", title: "What comes later: Code a toy", ids: ["later"] },
  { file: "glossary.html", title: "Glossary", ids: ["glossary"] },
  { file: "reading.html", title: "Further reading", ids: ["reading"] },
  { file: "references.html", title: "References", ids: ["references"] },
  { file: "card.html", title: "Quick reference", ids: ["card"] },
]; // prettier-ignore

// The label a chapter has in a title or a menu: "Chapter 2: How a toy is built".
export const label = (p) => (p.chapter ? `Chapter ${p.chapter}: ${p.title}` : p.title);

// The chapters that are only a heading and a note (Levels 6 to 10 are not written yet), as they
// appear in the contents.
export const COMING = [
  { id: "moving", chapter: 6, title: "Moving things" },
  { id: "data", chapter: 7, title: "Real data as splats" },
  { id: "photo3d", chapter: 8, title: "Photos and video into 3D" },
  { id: "codes", chapter: 9, title: "Codes and pages" },
  { id: "make", chapter: 10, title: "Make your own" },
];
