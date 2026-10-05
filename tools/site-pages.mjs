// The preview site's pages (lane Site): the menu, and one entry per page with its
// type, its path under site/ and its words. Every link (menu, doors, Learn's
// links) is written relative to site/ itself; the build adds the way back up. tools/site-build.mjs turns each entry
// into site/<path>index.html with the shared header, menu and footer.
//
// A page entry:
//   { path: "toys/", type: "shelves", nav: "toys", title, description, ...type's own fields }
//
// `path` is relative to site/ and ends in "/" (or is "" for the home page);
// `nav` is the menu item it lights up; `type` is a key of PAGE_TYPES in
// tools/site-build.mjs. Text fields are plain HTML (written here, never user input).

export const SITE = {
  name: "Splashery",
  tagline: "splats you can play with",
  // Where the site will live. During the preview the pages stay under site/.
  origin: "https://ryanjosephkamp.github.io",
  base: "/splashery/site/",
  github: "https://github.com/ryanjosephkamp/splashery",
  // While the site is a preview: pages ask search engines not to list them.
  // Set to false when the owner makes the site the front door.
  preview: true,
};

// The one menu, in order. `href` is relative to site/.
export const MENU = [
  { id: "home", label: "Home", href: "" },
  { id: "toys", label: "Toys", href: "toys/" },
  { id: "tools", label: "Tools", href: "tools/" },
  { id: "science", label: "Science", href: "science/" },
  { id: "studio", label: "Studio", href: "studio/" },
  { id: "learn", label: "Learn", href: "learn/" },
  { id: "new", label: "What's new", href: "new/" },
  { id: "about", label: "About", href: "about/" },
];

// The toy on the home page: light to load, lovely to look at, on the public shelf.
export const HOME_TOY = { id: "strawberry", autoplay: "breeze" };

export const PAGES = [
  {
    path: "",
    type: "home",
    nav: "home",
    title: "Splashery · splats you can play with",
    description:
      "Toys made of 3D Gaussian splats that run in your browser: poke them, blow on them, paint them, drop them, then share them as a link or an embed.",
    lead: "Toys made of soft 3D splats that run right in your browser. Poke one, blow on it, paint it, break it apart, then share it.",
    why: [
      "A splat is a tiny, soft, colored blob. Hundreds of thousands of them together make a photoreal scan of a real strawberry or a ball you can squash. Because every splat can move on its own, a toy can peel, ripple, shatter and come back together, not just spin.",
      "Each toy is a short recipe: a few lines that say which parts move and how. The same recipes run the atoms, the planets and the games, and you can write your own.",
    ],
    doors: [
      { nav: "toys", href: "../", label: "Toys", text: "The gallery: every toy on its shelf, ready to play." }, // prettier-ignore
      { nav: "tools", text: "Poke, paint, magnet and clay, and ways to share what you make." },
      { nav: "science", text: "Atoms, planets, the body, math and computing, as toys." },
      { nav: "studio", text: "Turn your own photos, pages and sounds into splats." },
      { id: "worlds", href: "../worlds/?labs=1", label: "Worlds", text: "Walk around small worlds made of splats.", labs: true }, // prettier-ignore
      { nav: "learn", text: "How splats work, and how to program your own toys." },
    ],
  },
  {
    path: "toys/",
    type: "shelves",
    nav: "toys",
    title: "Toys",
    description: "Every toy on Splashery's shelves, from photoreal scans to atoms and games.",
    lead: "Every toy on the shelves. Tap one to play with it in the gallery.",
    shelves: "all",
  },
  {
    path: "tools/",
    type: "tools",
    nav: "tools",
    title: "Tools",
    description: "What you can do to a Splashery toy, and the ways to share it.",
    lead: "Every toy answers to the same tools. Pick one in the gallery's toolbar, then drag on the toy.",
    groups: [
      {
        title: "Play",
        items: [
          ["Orbit", "Drag to turn the toy; pinch or scroll to zoom. Double-tap to reset the view."],
          ["Poke", "Tap or drag to push splats in; they spring back."],
          ["Paint", "Brush color onto the toy, splat by splat."],
          ["Magnet", "Pull splats toward your finger and let them fly back."],
          ["Clay", "Push and pull the surface like soft clay."],
          ["Tap", "Each toy has its own tap: a peel, a hop, a song, a shatter."],
        ],
      },
      {
        title: "Make and share",
        items: [
          ["Make", "Build your own toy from a shape, a palette and a seed."],
          ["Link", "A link carries the toy and every setting, so others see what you see."],
          ["Embed", "Put a live toy on your own page with an iframe or one script tag."],
          ["GIF and video", "Save a turntable or a short effect loop as a file."],
        ],
      },
    ],
    shelves: ["studio", "pictures"],
    shelvesTitle: "Open your own files",
  },
  {
    path: "science/",
    type: "shelves",
    nav: "science",
    title: "Science",
    description: "Atoms, planets, the body, math and computing on Splashery, as toys you can play with.", // prettier-ignore
    lead: "Science, math and computing toys: things you can turn over, take apart and run.",
    shelves: ["science", "atoms", "space", "tiny", "anatomy", "maths", "computing", "lab"],
  },
  {
    path: "studio/",
    type: "shelves",
    nav: "studio",
    title: "Studio",
    description: "Turn your own photos, pages, songs and files into splats on Splashery.",
    lead: "Bring your own: photos, pages, songs and splat files, turned into toys on your device. Nothing is uploaded.", // prettier-ignore
    shelves: ["studio", "pictures"],
  },
  {
    path: "learn/",
    type: "links",
    nav: "learn",
    title: "Learn",
    description: "How splats work, and how to program your own Splashery toys.",
    lead: "How the toys work, and how to make your own.",
    links: [
      { href: "../manual/", label: "The Tinkerer's Manual", text: "How to program splats, from the math of one splat to your own equations." }, // prettier-ignore
      { href: "../manual/tinkerers-manual.pdf", label: "The Manual as a PDF", text: "The same manual, to read offline or print." }, // prettier-ignore
      { href: "https://github.com/ryanjosephkamp/splashery/blob/main/docs/PACKS.md", label: "Writing toy recipes", text: "How a toy's recipe says which parts move, and how." }, // prettier-ignore
      { href: "https://github.com/ryanjosephkamp/splashery/blob/main/docs/SCENE-SCHEMA.md", label: "The scene format", text: "What a shared link or a saved scene holds." }, // prettier-ignore
      { href: "https://github.com/ryanjosephkamp/splashery#embedding", label: "Embedding a toy", text: "The iframe and the custom element, with every option." }, // prettier-ignore
    ],
  },
  {
    path: "new/",
    type: "changelog",
    nav: "new",
    title: "What's new",
    description: "The latest changes to Splashery, newest first.",
    lead: "The latest changes, newest first.",
    count: 40,
  },
  {
    path: "about/",
    type: "about",
    nav: "about",
    title: "About",
    description: "What Splashery is, who makes it, the terms of use and the credits.",
    lead: "Splashery is a free toy box of 3D Gaussian splats that runs in your browser.",
  },
  {
    path: "search/",
    type: "search",
    nav: null,
    title: "Search",
    description: "Search Splashery's toys, tools and pages.",
  },
];

// Pages built at a fixed file name instead of <path>index.html.
export const NOT_FOUND = {
  file: "404.html",
  type: "notFound",
  nav: null,
  title: "Page not found",
  description: "This page isn't here.",
};
