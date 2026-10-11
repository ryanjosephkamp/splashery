// The data behind the diagram on "How Splashery is built" (manual/built.html). To change the
// picture, change this list: manual/demos5.js draws the SVG from it, and tests/man7a.spec.mjs checks
// every file named here exists and every claim in CHECKS is still true of the code.
//
// A layer is a row of boxes with a title; `then` labels the arrow down to the next layer. A box is
// { t: its name, s: a few words about it, file?: a path that must exist }. `lazy` boxes have a dashed
// outline: they ship with the site but load only when a toy needs them. `off` boxes never ship.

export const LAYERS = [
  {
    title: "The page",
    then: "loads",
    boxes: [{ t: "index.html", s: "and styles.css", file: "index.html" }],
  },
  {
    title: "The program (src/)",
    then: "asks for the toy's recipe",
    cols: 3,
    boxes: [
      { t: "app.js", s: "wires it all", file: "src/app.js" },
      { t: "ui.js", s: "the panels", file: "src/ui.js" },
      { t: "player.js", s: "clock, camera, tools", file: "src/player.js" },
      { t: "state.js", s: "the scene", file: "src/state.js" },
      { t: "codec.js", s: "the link", file: "src/codec.js" },
      { t: "toys.js", s: "the shelf", file: "src/toys.js" },
    ],
  },
  {
    title: "The recipes",
    then: "become splats, shown by",
    cols: 2,
    boxes: [
      { t: "packs/*.js", s: "one file per family of toys, loaded when a toy opens", file: "src/packs" },
      { t: "kit.js + generators.js", s: "build the splats from a recipe", file: "src/kit.js" },
    ],
  },
  {
    title: "The drawing",
    then: "runs on",
    cols: 3,
    boxes: [
      { t: "stage.js", s: "the device and the toy on show", file: "src/stage.js" },
      { t: "pc.js", s: "one re-export", file: "src/pc.js" },
      { t: "PlayCanvas", s: "vendor/playcanvas, MIT", file: "vendor/playcanvas" },
    ],
  },
  {
    title: "Your device",
    boxes: [{ t: "WebGPU, or WebGL2", s: "whichever the browser has" }],
  },
  {
    title: "Shipped, but loaded only when a toy needs it",
    lazy: true,
    cols: 3,
    boxes: [
      { t: "PDF.js", s: "PDFs", file: "vendor/pdfjs" },
      { t: "ONNX Runtime", s: "depth models", file: "vendor/onnxruntime-web" },
      { t: "QR code", s: "qrcodegen, jsQR", file: "vendor/qrcodegen" },
      { t: "Shared systems", s: "games, liquids, physics, live input", file: "src/fluids" },
      { t: "assets/", s: "captures, sounds, data", file: "assets" },
    ],
  },
  {
    title: "Not shipped: runs on a build machine",
    off: true,
    cols: 2,
    boxes: [
      { t: "tools/", s: "Node scripts", file: "tools" },
      { t: "tests/", s: "Playwright", file: "tests" },
    ],
  },
];

// Claims the picture makes about the code: [file, a pattern that file must contain, what it says].
export const CHECKS = [
  ["index.html", /src="\.\/src\/app\.js"/, "the page loads src/app.js"],
  ["src/app.js", /from "\.\/ui\.js"/, "app.js uses ui.js"],
  ["src/app.js", /from "\.\/player\.js"/, "app.js uses player.js"],
  ["src/app.js", /from "\.\/state\.js"/, "app.js uses state.js"],
  ["src/app.js", /from "\.\/codec\.js"/, "app.js uses codec.js"],
  ["src/app.js", /from "\.\/toys\.js"/, "app.js uses toys.js"],
  ["src/player.js", /import\(`\.\/packs\/\$\{def\.pack\}\.js`\)/, "player.js loads a toy's pack when it opens"],
  ["src/player.js", /from "\.\/kit\.js"/, "player.js uses kit.js"],
  ["src/player.js", /from "\.\/generators\.js"/, "player.js uses generators.js"],
  ["src/player.js", /from "\.\/stage\.js"/, "player.js shows the toy through stage.js"],
  ["src/stage.js", /from "\.\/pc\.js"/, "stage.js reaches PlayCanvas through pc.js"],
  ["src/pc.js", /vendor\/playcanvas\//, "pc.js re-exports the vendored PlayCanvas"],
  ["src/stage.js", /deviceOrder/, "stage.js picks WebGPU or WebGL2"],
];
