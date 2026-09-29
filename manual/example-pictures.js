import { smoothstep } from "../src/kit.js";

// Two small picture toys for Level 5 of the Tinkerer's Manual: a framed photo
// that opens your own picture, and a little book whose page turns like paper.
export const RECIPES = {
  "little-frame": {
    turntable: false,
    tiltLock: true, // a drag only spins it left and right
    pictures: {
      sample: () => "assets/toys/picture-lab/photo.jpg", // shown until you open your own
      accept: ["image", "gif", "video"],
    },
    input: {
      title: "Your own picture",
      media: { accept: ["image", "gif", "video"] },
      note: "Open a photo, a GIF or a video. Files stay on this device.",
    },
    build(k) {
      // The picture: a sheet, filled with splats after the build.
      k.sheet({ id: "photo", center: [0, 0, 0.03], width: 1.5, height: 1 });
      // A gray card behind it, and four wooden bars around it.
      k.add(k.box(1.6, 1.1, 0.02), { pos: [0, 0, -0.02], color: "#9a9a9a" });
      for (const [w, h, x, y] of [
        [1.8, 0.1, 0, 0.6],
        [1.8, 0.1, 0, -0.6],
        [0.1, 1.1, -0.85, 0],
        [0.1, 1.1, 0.85, 0],
      ])
        k.add(k.box(w, h, 0.1), { pos: [x, y, 0], color: "#8a5a34" });
    },
  },

  "little-book": {
    turntable: false,
    tiltLock: true,
    pictures: { sample: () => "assets/toys/picture-lab/article.pdf", accept: ["pdf"] },
    input: { title: "Your own book", media: { accept: ["pdf"] }, note: "Open a PDF." },
    controls: [{ key: "turn", label: "Turn the page", type: "pulse", ease: 1.2 }],
    action: { key: "turn", label: "Turn the page" },
    drive(t, c, out, info) {
      const pics = info.data?.pictures; // { page, count, go(n), next(), prev(), ... }
      // The page changes when the turn ends, and the turning page lands on the left.
      const turning = c.turn > 0;
      if (BOOK.turning && !turning && pics) pics.go(pics.page + 1);
      BOOK.turning = turning;
      const page = pics?.page ?? 0;
      // The pulse falls from 1 to 0: the page swings from 0 to a half turn (pi)
      // about the spine, and its free edge lags behind, like paper.
      const s = turning ? smoothstep(0, 1, 1 - c.turn) : 0;
      out.leaves = [{ angle: Math.PI * s, curl: -1.2 * Math.sin(Math.PI * s) }];
      out.sheets = {
        // Once the turn starts, the left page is the one that is about to land on it.
        left: { page: turning ? page : page - 1 }, // a page out of range shows nothing
        under: { page: page + 1 }, // built ahead, and uncovered as the page lifts
        front: { page }, // the turning page (its far side shows in mirror image)
      };
      // It is built, but hidden, until the turning page lands on it.
      out.parts.leftPage = { visible: turning ? 0 : 1 };
    },
    build(k) {
      BOOK.turning = false;
      k.spine({ at: [0, 0, 0], axis: [0, 1, 0], dir: [1, 0, 0] });
      const W = 1.4;
      const H = 1.9;
      const leftPage = k.part("leftPage");
      const page = { width: W, height: H };
      k.sheet({ id: "left", ...page, part: leftPage, center: [-W / 2, 0, 0], align: [1, 0] });
      k.sheet({ id: "under", ...page, center: [W / 2, 0, 0], align: [-1, 0] });
      // The turning page: a sheet on leaf slot 0, a hair in front of the others.
      k.sheet({ id: "front", ...page, center: [W / 2, 0, 0.008], align: [-1, 0], leaf: 0 });
      // The cover, behind the pages.
      k.add(k.box(2 * W + 0.1, H + 0.1, 0.03), { pos: [0, 0, -0.03], color: "#7a2f2f" });
    },
  },
};

// Whether the page was turning in the last frame.
const BOOK = { turning: false };
