// Pictures and pages (lane Pictures): toys that show a PDF, a picture, a GIF
// or a video as splats, through the picture sheets of src/pictures.js. For
// now one plain test toy, the Picture lab (labs only); the toy lanes that
// follow add the book, the photo album, the frame and the screens.

// Each toy's tap state (one toy is shown at a time).
const LAB = { tapN: 0 };

export const RECIPES = {
  "picture-lab": {
    // A flat sheet that shows whatever you open, and nothing else. It keeps
    // still (no turntable), facing you.
    turntable: false,
    tiltLock: true, // a drag only spins it left and right (lane Viewer)
    // Few splats of its own (the card); the picture's are the sheet's.
    density: 0.12,
    options: [
      {
        key: "sample",
        label: "Sample",
        type: "select",
        default: "article",
        choices: [
          { id: "article", label: "An article (PDF)" },
          { id: "photo", label: "A photo" },
        ],
      },
    ],
    controls: [{ key: "next", label: "Next page", type: "pulse", ease: 0.35 }],
    action: { key: "next", label: "Next page, or play and pause" },
    // What the toy opens before you open something of your own, and what
    // it accepts.
    pictures: {
      sample: (o) =>
        o.sample === "photo" ? "assets/toys/picture-lab/photo.jpg" : "assets/toys/picture-lab/article.pdf", // prettier-ignore
      accept: ["pdf", "image", "gif", "video"],
    },
    credits: [
      {
        label: "Picture lab",
        title: "Tulip field (the photo sample)",
        source: "https://www.flickr.com/photos/14674348@N04/13825345834",
        author: "DennisM2",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    input: {
      title: "Your own picture",
      media: { accept: ["pdf", "image", "gif", "video"] },
      note: "Open a PDF, a photo, a GIF or a video, or paste a web address. Files stay on this device; nothing is uploaded.",
    },
    drive(t, c, out, info) {
      const pics = info.data?.pictures;
      // A tap turns to the next page (back to the first after the last), or
      // plays and pauses a video.
      const n = info.tap?.n ?? 0;
      if (n < LAB.tapN) LAB.tapN = 0;
      if (n > LAB.tapN) {
        LAB.tapN = n;
        if (pics?.kind === "video") pics.togglePlay();
        else if (pics?.count > 1) pics.go(pics.page + 1 < pics.count ? pics.page + 1 : 0);
      }
      out.sheets = { page: { page: pics?.page ?? 0 } };
    },
    build(k) {
      LAB.tapN = 0;
      k.sheet({ id: "page", center: [0, 0, 0], width: 2, height: 2, normal: [0, 0, 1] });
      // A thin gray card behind it, so a white page has an edge on a white
      // background (and the picture a back): two staggered lattices of flat
      // discs, like a sheet's paper, so it is smooth with no speckle.
      const W = 2.08;
      k.cloud({ share: 1, pattern: false }, (rand, i, n) => {
        const g = Math.max(8, Math.floor(Math.sqrt(n / 2)));
        const step = W / g;
        const second = i >= g * g;
        const j = second ? i - g * g : i;
        if (j >= g * g || (second && (j % g === g - 1 || j >= g * (g - 1)))) return null;
        const off = second ? step : step / 2;
        return {
          p: [-W / 2 + off + (j % g) * step, -W / 2 + off + Math.floor(j / g) * step, -0.03],
          n: [0, 0, 1],
          flat: 0.05,
          size: (0.5 * step) / 0.01,
          color: "#c3c7ce",
          opacity: 0.99,
        };
      });
    },
  },
};
