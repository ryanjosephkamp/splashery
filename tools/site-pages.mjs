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
    headline: "Splats you can play with.",
    lead: "Toys made of soft 3D splats that run right in your browser. Poke one, blow on it, paint it, break it apart, then share it.",
    // Three short reasons, each with a small drawing (an id in ICONS in site-build.mjs).
    features: [
      { icon: "capture", title: "Real things, captured", text: "Hundreds of thousands of tiny, soft, colored splats make a photoreal scan of a real strawberry, a bee or a cactus." }, // prettier-ignore
      { icon: "move", title: "Every splat can move", text: "So a toy can peel, ripple, shatter and come back together, not just spin." }, // prettier-ignore
      { icon: "recipe", title: "A recipe for each toy", text: "A few lines say which parts move and how. The same recipes run the atoms, the planets and the games, and you can write your own." }, // prettier-ignore
    ],
    // A row of toys to start with, in this order (public toys only).
    featured: ["grape", "solar-system", "dna", "toy-piano", "chess-set", "newtons-cradle", "black-hole", "puzzle-cube", "atom", "rubber-duck", "earth", "graph-plotter"], // prettier-ignore
    doors: [
      { nav: "toys", href: "../", label: "Toys", text: "The gallery: every toy on its shelf, ready to play.", art: ["rubber-duck", "grape", "chess-set"] }, // prettier-ignore
      { nav: "tools", text: "Poke, paint, magnet and clay, and ways to share what you make.", art: ["blob", "knot", "torus"] }, // prettier-ignore
      { nav: "science", text: "Atoms, planets, the body, math and computing, as toys.", art: ["atom", "saturn", "dna"] }, // prettier-ignore
      { nav: "studio", text: "Turn your own photos, pages and sounds into splats.", art: ["photo-3d", "song-landscape", "picture-frame"] }, // prettier-ignore
      { id: "worlds", href: "../worlds/?labs=1", label: "Worlds", text: "Walk around small worlds made of splats.", labs: true, art: [] }, // prettier-ignore
      { nav: "learn", text: "How splats work, and how to program your own toys.", art: ["fourier-circles", "unit-circle", "graph-plotter"] }, // prettier-ignore
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
    description: "Every Splashery tool in one place: make and convert, open your own files, scan and measure, QR codes, sound and light.", // prettier-ignore
    lead: "Splashery is also a workshop. Each of these opens in the gallery and works on your own things, on your device; nothing is uploaded.", // prettier-ignore
    styles: ["hubs.css"],
    // Each group lists toy ids from src/toys.js (the build stops on an unknown id): the
    // toy's own picture is the drawing, `text` is the line shown, and an item with an
    // `href` instead of a toy opens that page (relative to site/).
    hub: [
      {
        id: "make",
        icon: "make",
        title: "Make and convert",
        text: "Turn a photo, a video, a model or a song into splats you can play with.",
        items: [
          { toy: "photo-3d", text: "A photo becomes a relief with real depth; tap to lift it out of the picture." }, // prettier-ignore
          { toy: "moving-photo-3d", text: "A GIF or a short video, with depth, still moving and still making its sound." }, // prettier-ignore
          { toy: "video-3d", text: "Film a scene and fly through it as splats, solved and trained on your device." }, // prettier-ignore
          { toy: "model-splats", text: "A 3D model (glTF, OBJ or STL) becomes splats that lift off and settle back." }, // prettier-ignore
          { toy: "song-landscape", text: "A song becomes a landscape you fly over: a real spectrogram, in 3D." }, // prettier-ignore
        ],
      },
      {
        id: "files",
        icon: "files",
        title: "Open your own files",
        text: "Pages, pictures, molecules and crystals, opened right in your browser.",
        items: [
          { name: "Splat files", href: "../", icon: "files", open: "Open the gallery", text: "Drop a .ply, .sog, .splat or .spz file in the gallery's Toy tab to look at it, play with it and share it." }, // prettier-ignore
          { toy: "picture-lab", text: "A PDF, a picture, a GIF or a video, drawn in splats with the figures lifted off the page." }, // prettier-ignore
          { toy: "your-book", text: "Any PDF as a book with pages that turn, curl and pop their pictures out." }, // prettier-ignore
          { toy: "photo-album", text: "A set of photos as an album: tap to turn a page, pull one over, pop a photo out." }, // prettier-ignore
          { toy: "picture-frame", text: "Put your own photo, GIF or video in a frame that swings on its nail." }, // prettier-ignore
          { toy: "molecule", text: "Type a name, a formula or a SMILES string, or open a MOL, SDF, XYZ or PDB file." }, // prettier-ignore
          { toy: "thermal-ellipsoids", text: "Open a crystal file (CIF) and see each atom's jiggle as a soft ellipsoid." }, // prettier-ignore
        ],
      },
      {
        id: "scan",
        icon: "scan",
        title: "Scan and measure",
        text: "See inside things, and look closer than an eye can: X-ray, CT, MRI and microscopes.",
        items: [
          { toy: "airport-xray", text: "Send bags through the scanner and watch their X-ray pictures build up." }, // prettier-ignore
          { toy: "how-ct", text: "A CT scan, step by step: scan a shell, then cut into it." }, // prettier-ignore
          { toy: "walnut-ct", text: "A real CT scan of a walnut: drag to cut into it, slice by slice." }, // prettier-ignore
          { toy: "fruit-mri", text: "Scroll through an MRI of a fruit, or play through every slice." }, // prettier-ignore
          { toy: "electron-microscope", text: "Zoom in on a sample, step by step, the way an electron microscope does." }, // prettier-ignore
          { toy: "smlm-microscope", text: "Real super-resolution microscopy data, down to single molecules." }, // prettier-ignore
          { toy: "thermal-camera", text: "A thermal camera that watches a cup of tea cool." }, // prettier-ignore
          { toy: "room-echo", text: "Clap once, and the microphone measures how long your room echoes." }, // prettier-ignore
        ],
      },
      {
        id: "qr",
        icon: "qr",
        title: "QR codes",
        text: "Make one, see how it works, break it on purpose, and hide three in one.",
        items: [
          { toy: "qr-code", text: "Type a link, pick a style, and check that the code still scans." }, // prettier-ignore
          { toy: "qr-anatomy", text: "Light up each part of a code, or encode your own text step by step." }, // prettier-ignore
          { toy: "qr-damage", text: "Scratch, smudge and cover a code, and watch how much it can lose." }, // prettier-ignore
          { toy: "qr-three", text: "Three codes in one picture: pull them apart and read each." }, // prettier-ignore
        ],
      },
      {
        id: "sound",
        icon: "sound",
        title: "Sound and light",
        text: "Hear a toy, see a sound, and see yourself in splats. These ask for the microphone or the camera only when you tap.", // prettier-ignore
        items: [
          { toy: "chladni-plate", text: "Bow a plate, or sing to it, and sand finds the still lines of the sound." }, // prettier-ignore
          { toy: "song-landscape", text: "Play a song and fly over its sound; or use the microphone to see it live." }, // prettier-ignore
          { toy: "splat-mirror", text: "Tap Start camera and see yourself made of splats; turn it to see the depth." }, // prettier-ignore
          { toy: "room-echo", text: "Measure your room's echo with one clap." }, // prettier-ignore
          { toy: "screen", text: "A screen that plays your own picture or video, with a real off switch." }, // prettier-ignore
        ],
      },
    ],
    // The tools every toy has (the gallery's toolbar), after the groups.
    groups: [
      {
        title: "In every toy",
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
  },
  {
    path: "share/",
    type: "embed",
    nav: "tools",
    title: "Embed and share",
    description: "Put a Splashery toy on your own page with an iframe or one script tag, and how scene links carry a toy and its settings.", // prettier-ignore
    lead: "Put a live toy on your own page, with every option, or send someone a link to a toy exactly as you set it.", // prettier-ignore
    styles: ["hubs.css"],
    scripts: ["hubs.js"],
    // [the iframe's query option, the element's attribute, what it does]
    options: [
      ["toy=cactus", 'toy="cactus"', "A shelf toy by its id. Used when there is no scene."],
      [
        "#s=PAYLOAD",
        'scene="PAYLOAD"',
        "A scene from a share link: the toy with its settings, camera and look.",
      ],
      [
        "theme=light | dark",
        'theme="auto | light | dark"',
        "The color theme. The element's auto follows your page.",
      ],
      [
        "bg=transparent",
        'background="transparent | page | #rrggbb"',
        "A see-through or colored background.",
      ],
      ["autoplay=breeze", "autoplay=\"breeze\"", "One gentle effect while it sits idle: <code>breeze</code>, <code>pokes</code>, <code>twist</code> or <code>dissolve</code>."], // prettier-ignore
      ["turntable=off", 'turntable="off"', "Hold the toy still instead of turning it slowly."],
      ["zoom=1.5", "zoom=\"1.5\"", "From 0.5 to 2. At 1 the toy fills about 80% of the shorter side; 2 comes twice as close."], // prettier-ignore
      ["controls=0", 'controls="0"', "Hide the + and − zoom buttons."],
      ["", 'label="A cactus"', "The accessible name read by a screen reader."],
    ],
  },
  {
    path: "science/",
    type: "science",
    nav: "science",
    title: "Science",
    description: "Every science, math and computing toy on Splashery, with the data it comes from, its license and what it shows.", // prettier-ignore
    lead: "Science, math and computing toys: things you can turn over, take apart and run. Where a toy shows real data, its source and license are listed here.", // prettier-ignore
    styles: ["hubs.css"],
    shelves: [
      "science",
      "imaging",
      "atoms",
      "space",
      "tiny",
      "anatomy",
      "maths",
      "computing",
      "lab",
    ],
    dataLead: "Some toys show published data: each splat is a real measurement, or a real structure. This is where each comes from.", // prettier-ignore
    dataNote: "The other science toys are built from recipes written for Splashery; each toy's About tab, in the gallery, says what it simplifies.", // prettier-ignore
    evidenceLead: "Every toy that claims to show something true about the world is meant to have an evidence file: what it claims, how the code does it, the sources, and where it simplifies. They live in @@, and each toy's own page will show its file.", // prettier-ignore
    // One row per dataset: the toys that show it, what it shows, and its sources and licenses.
    datasets: [
      {
        name: "Thermal ellipsoids",
        toys: ["thermal-ellipsoids"],
        shows: "How each atom in a crystal or protein jiggles, as a soft ellipsoid: the measured size and direction of its vibration.", // prettier-ignore
        sources: [
          { label: "Crystallography Open Database", url: "https://www.crystallography.net/cod/" },
          { label: "RCSB Protein Data Bank", url: "https://www.rcsb.org/" },
        ],
        licenses: [
          { label: "Public domain (COD)" },
          { label: "CC0 1.0 (PDB)", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
        ],
      },
      {
        name: "Super-resolution microscope",
        toys: ["smlm-microscope"],
        shows: "Single-molecule localization microscopy: the positions of hundreds of thousands of molecules inside a cell, measured to a few nanometers.", // prettier-ignore
        sources: [{ label: "ShareLoc.XYZ (Zenodo)", url: "https://shareloc.xyz/" }],
        licenses: [{ label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" }],
      },
      {
        name: "Galaxy in a box",
        toys: ["galaxy-box"],
        shows: "Gas in a simulated Milky Way-like galaxy: 300,000 of the simulation's 2.37 million gas particles.", // prettier-ignore
        sources: [{ label: "FIRE-2 simulations, m12i (FlatHUB)", url: "https://flathub.flatironinstitute.org/fire" }], // prettier-ignore
        licenses: [{ label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" }],
      },
      {
        name: "Walnut CT scan",
        toys: ["walnut-ct", "how-ct"],
        shows: "A real X-ray CT scan of a walnut (100 µm voxels), cut open slice by slice.",
        sources: [{ label: "Cone-beam CT data collection, CWI Amsterdam (Zenodo)", url: "https://doi.org/10.5281/zenodo.2686726" }], // prettier-ignore
        licenses: [{ label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" }],
      },
      {
        name: "Protein",
        toys: ["protein", "dna"],
        shows: "Real protein and DNA structures: ubiquitin, insulin, green fluorescent protein, hemoglobin and the B-DNA double helix.", // prettier-ignore
        sources: [{ label: "RCSB Protein Data Bank", url: "https://www.rcsb.org/" }],
        licenses: [{ label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" }],
      },
      {
        name: "Atom",
        toys: ["atom", "periodic-table", "molecule"],
        shows: "All 118 elements (mass, electron configuration, spectral color), and molecules from water to caffeine.", // prettier-ignore
        sources: [
          { label: "NIST atomic data", url: "https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses" }, // prettier-ignore
          { label: "PubChem", url: "https://pubchem.ncbi.nlm.nih.gov/" },
          { label: "IUPAC periodic table", url: "https://iupac.org/what-we-do/periodic-table-of-elements/" }, // prettier-ignore
        ],
        licenses: [{ label: "Public data; PubChem conformers are public domain" }],
      },
      {
        name: "Word vectors",
        toys: ["word-vectors"],
        shows: "24,000 real English words placed by meaning, from the GloVe word vectors.",
        sources: [
          { label: "GloVe, Stanford NLP", url: "https://nlp.stanford.edu/projects/glove/" },
        ],
        licenses: [{ label: "PDDL 1.0", url: "https://opendatacommons.org/licenses/pddl/1.0/" }],
      },
      {
        name: "Convolutional network",
        toys: ["cnn"],
        shows: "A small network that reads the digit you draw, trained on real handwritten digits.",
        sources: [{ label: "Handwritten digits, UCI Machine Learning Repository", url: "https://archive.ics.uci.edu/dataset/80/optical+recognition+of+handwritten+digits" }], // prettier-ignore
        licenses: [{ label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" }],
      },
    ],
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
    type: "learn",
    nav: "learn",
    title: "Learn",
    description: "How 3D Gaussian splats work, the Tinkerer's Manual, the lab notebook and how Splashery is made.", // prettier-ignore
    lead: "How the toys work, how to make your own, and how Splashery itself is made.",
    styles: ["hubs.css"],
    cards: [
      { main: true, icon: "book", href: "../manual/", title: "The Tinkerer's Manual", text: "How to program splats, from the math of one splat to your own equations, toys and pictures. Start here if you want to make something.", also: [{ href: "../manual/tinkerers-manual.pdf", label: "Download the PDF" }] }, // prettier-ignore
      { icon: "splat", href: "learn/splats/", title: "How 3D Gaussian splats work", text: "A soft colored blob, hundreds of thousands of them, sorted and blended: what a splat is and what a recipe is, with small drawings." }, // prettier-ignore
      { icon: "notebook", href: "learn/notebook/", title: "The lab notebook", text: "What each lane built, which model built it, and what the team learned along the way." }, // prettier-ignore
      { icon: "made", href: "learn/made/", title: "How Splashery is made", text: "Lanes, the Operator, the reviews and the rules, in plain words." }, // prettier-ignore
      { icon: "share", href: "share/", title: "Embed and share", text: "Put a toy on your own page, and how a scene link carries a toy and its settings." }, // prettier-ignore
    ],
    links: [
      { href: "https://github.com/ryanjosephkamp/splashery/blob/main/docs/PACKS.md", label: "Writing toy recipes", text: "How a toy's recipe says which parts move, and how." }, // prettier-ignore
      { href: "https://github.com/ryanjosephkamp/splashery/blob/main/docs/SCENE-SCHEMA.md", label: "The scene format", text: "What a shared link or a saved scene holds." }, // prettier-ignore
    ],
  },
  {
    path: "learn/splats/",
    type: "article",
    article: "splats",
    nav: "learn",
    title: "How 3D Gaussian splats work",
    description: "What a 3D Gaussian splat is, how hundreds of thousands of them are sorted and blended into a picture, and what a toy recipe is.", // prettier-ignore
    lead: "A soft colored blob, a lot of them, and a recipe: the whole idea, with pictures.",
    styles: ["hubs.css"],
  },
  {
    path: "learn/made/",
    type: "article",
    article: "made",
    nav: "learn",
    title: "How Splashery is made",
    description:
      "The lanes, the Operator, the reviews and the rules behind Splashery, in plain words.",
    lead: "Many Claude sessions, one person with ideas, and a lot of watching clips.",
    styles: ["hubs.css"],
  },
  {
    path: "learn/notebook/",
    type: "markdown",
    nav: "learn",
    title: "The lab notebook",
    description: "What each lane of Splashery built, which model built it, how long it took and what the team learned.", // prettier-ignore
    lead: "A running record of how Splashery is built, one entry per lane.",
    styles: ["hubs.css"],
    files: [{ file: "docs/NOTEBOOK.md", title: "" }],
  },
  {
    path: "new/",
    type: "news",
    nav: "new",
    title: "What's new",
    description: "What changed in Splashery, day by day, in plain words, with every merged change listed underneath.", // prettier-ignore
    lead: "What changed, day by day, in plain words. Under each day is the full list of merged changes.", // prettier-ignore
    styles: ["hubs.css"],
    count: 700,
  },
  {
    path: "about/",
    type: "about",
    nav: "about",
    title: "About",
    description: "What Splashery is, who makes it and why, and where to find the credits, the terms and the privacy page.", // prettier-ignore
    lead: "Splashery is a free toy box of 3D Gaussian splats that runs in your browser.",
    styles: ["hubs.css"],
  },
  {
    path: "about/credits/",
    type: "markdown",
    nav: "about",
    title: "Credits and licenses",
    description: "Every scan, model, sound, dataset and library in Splashery, with its author and license, built from the project's CREDITS.md and LICENSES.md.", // prettier-ignore
    lead: "Everything in Splashery that someone else made, who made it, and the license it comes under.", // prettier-ignore
    styles: ["hubs.css"],
    files: [
      { file: "CREDITS.md", title: "Credits", note: "Scans, models, sounds, data and everything else that is not our own code." }, // prettier-ignore
      { file: "LICENSES.md", title: "Third-party licenses", note: "The code libraries and tools Splashery uses, with their license texts.", demote: true }, // prettier-ignore
    ],
  },
  {
    path: "about/terms/",
    type: "terms",
    nav: "about",
    title: "Terms of use",
    description: "The terms of using Splashery: your files stay on your device, you are responsible for what you open and share, and the licenses.", // prettier-ignore
    lead: "Short and plain.",
    styles: ["hubs.css"],
  },
  {
    path: "about/privacy/",
    type: "privacy",
    nav: "about",
    title: "Privacy",
    description: "Nothing you open leaves your device. What the live feeds and the protein fetch read, and when; no tracking, no cookies.", // prettier-ignore
    lead: "Nothing you open leaves your device. No accounts, no tracking.",
    styles: ["hubs.css"],
  },
  {
    path: "search/",
    type: "search",
    nav: null,
    title: "Search",
    description: "Search Splashery's toys, tools and pages.",
    // Shown before anything is typed; the build checks each finds something.
    suggest: ["planet", "peel", "piano", "DNA", "chess", "atom", "magnet", "share"],
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
