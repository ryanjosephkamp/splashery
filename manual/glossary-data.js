// The glossary's entries, for the pop-ups on pages that do not hold the glossary (written by
// manual/build-pages.mjs from glossary.html).
export default {
  "g-gaussian": {
    title: "Gaussian (peak-one bell)",
    body: "A smooth weight that falls off exponentially with the squared distance from a center,\n          measured in units of the widths. In this manual it peaks at 1.",
  },
  "g-field": {
    title: "Weight field, positive widths",
    body: "A weight field is a number at every point in space: 1 at the center, falling off with\n          distance. The three widths are a splat's sizes along its own axes; they must be above\n          zero.",
  },
  "g-mean": {
    title: "Mean, center <var>μ</var>",
    body: "The position where the bell has its largest weight.",
  },
  "g-width": {
    title: "Standard deviation, axis width <var>s</var>",
    body: "A length that measures distance along one of a splat's own axes. It is a yardstick, not a\n          hard radius: the ideal weight is still about 0.14 at two widths.",
  },
  "g-covariance": {
    title: "Covariance <var>Σ</var>",
    body: "A symmetric 3-by-3 matrix that holds the squared widths and the way the axes are turned,\n          <var>Σ</var> = <var>R</var> <var>S</var> <var>S</var><sup>T</sup> <var>R</var\n          ><sup>T</sup>. Terms off the diagonal mean the axes are tilted.",
  },
  "g-quadratic": {
    title: "Quadratic form",
    body: 'An expression in which every term has two factors of the input. In two dimensions,\n          <var>a</var><var>d</var><sub>1</sub>² + 2<var>b</var><var>d</var><sub>1</sub><var>d</var\n          ><sub>2</sub> + <var>c</var><var>d</var><sub>2</sub>². With 4 and 1 on the diagonal it is\n          4<var>d</var><sub>1</sub>² + <var>d</var><sub>2</sub>², and setting it to 1 draws an\n          ellipse. The exponent of a Gaussian holds one [<a href="references.html#ref-5">5</a>].',
  },
  "g-tilt": {
    title: "Tilt, rotation",
    body: "Tilt is the off-diagonal terms of <var>Σ</var>: zero when a splat's axes line up with\n          <var>x</var>, <var>y</var>, and <var>z</var>. Rotation is a splat's own turn. \"Tilt lock\"\n          is a different thing: the camera control in Chapter 5.",
  },
  "g-aniso": {
    title: "Anisotropic, isotropic",
    body: "Different widths along the axes, or equal widths in every direction. A plain kit splat is\n          isotropic; the flat discs that cover a surface are anisotropic.",
  },
  "g-quaternion": {
    title: "Quaternion <var>q</var>",
    body: "Four numbers that describe a rotation. They only describe a rotation when their length is\n          1, so a reader scales them to length 1 first.",
  },
  "g-affine": {
    title: "Affine",
    body: 'A straight-line map plus a shift, <var>p</var> ↦ <var>A</var><var>p</var> + <var>b</var>.\n          Straight lines stay straight [<a href="references.html#ref-6">6</a>].',
  },
  "g-footprint": {
    title: "Footprint",
    body: "The patch of the screen where one splat can add any color.",
  },
  "g-jacobian": {
    title: "Jacobian <var>J</var>",
    body: "The matrix of the projection's slopes at one point, used as a straight-line stand-in for\n          the projection near the splat's center.",
  },
  "g-opacity": {
    title: "Opacity <var>α</var>, transmittance <var>T</var>",
    body: "Opacity says how much a splat covers. Transmittance is how much of what lies behind still\n          shows after the splats in front: the product of (1 − <var>a</var>) over them.",
  },
  "g-alpha": {
    title: "Alpha compositing",
    body: "Laying colors over one another in order, each weighted by its opacity and by how much of\n          the pixel is still uncovered.",
  },
  "g-sh": {
    title: "Spherical harmonics",
    body: "A compact way to store how a color changes with the direction you look from. Many trained\n          captures store them; a kit splat has one base color.",
  },
  "g-recipe": {
    title: "Recipe, capture",
    body: "A recipe is a program that makes splats. A capture is a file of splats fitted to\n          photographs of a real thing.",
  },
  "g-kit": {
    title: "Kit, kit toy",
    body: "The kit is Splashery's toy-building library. A recipe names shapes, colors, and moving\n          parts, and the kit fills them with splats in the browser, spreading the budget evenly by\n          area. A kit toy is built this way; a scan or capture is loaded from a file.",
  },
  "g-smoothstep": {
    title: "Smoothstep",
    body: 'The curve 3<var>g</var>² − 2<var>g</var>³, an S-shaped ramp from 0 to 1 that is flat at\n          both ends, used to start and stop a motion gently [<a href="references.html#ref-7">7</a>].',
  },
  "g-grammar": {
    title: "Grammar, atom",
    body: 'A grammar is a list of rules for what counts as a valid program. In it, <code>=</code> is\n          "is made of", <code>|</code> is "or", <code>{ }</code> repeats, <code>[ ]</code> is\n          optional, and quotes mark text typed exactly. An atom is the smallest piece of an\n          expression that can stand alone [<a href="references.html#ref-8">8</a>].',
  },
  "g-uvt": {
    title: "u, v, t, morph",
    body: "<var>u</var> and <var>v</var> are the coordinates of the flat sheet of points that each\n          splat gets a place on, before the equations bend it into shape. They are parameters of a\n          parametric surface, not a substitution [<a href=\"references.html#ref-9\">9</a>].\n          <var>t</var> is time: 0 to 2π in the equation language, and the toy's running time in a\n          recipe's <code>drive</code>. A morph is a splat sliding from its own place to a target\n          place.",
  },
  "g-kernel": {
    title: "Kernel",
    body: "The rule for how a splat's weight falls off across its patch. The site normally draws a\n          cut-off Gaussian; a labs setting can use a sharper one. Neither is the ideal bell.",
  },
  "g-part": {
    title: "Part, token",
    body: "A <b>part</b> is a group of a toy's splats that moves as one solid piece, such as a lid or\n          a sail. Every splat carries the number of its part; number 0 is the body, so a toy has up\n          to 15 more (Chapter 2). A <b>token</b> is one of up to 48 separate pieces, such as a game\n          piece, that a recipe moves by its own offset.",
  },
  "g-drive": {
    title: "Drive",
    body: "The function in a recipe that runs every frame and says how the toy looks now: the angle\n          of each part, the glow, the page of a sheet. It does not move splats itself; it hands\n          numbers to the graphics chip.",
  },
  "g-budget": {
    title: "Splat budget, tier",
    body: "The number of splats the toy is asked to draw. It depends on the device: a tier (low, mid,\n          high, or max) sets a default count and a ceiling, and a recipe may ask for more or fewer\n          per base budget with its <code>density</code>. The counts run from 60,000 up to 400,000.",
  },
  "g-pack": {
    title: "Pack",
    body: "A file under <code>src/packs/</code> that holds the recipes of a group of toys.",
  },
  "g-labs": {
    title: "Labs switch",
    body: "The setting that shows the toys and tools not yet ready for everyone. Add\n          <code>?labs=1</code> to the site's address to turn it on (the browser remembers it) and\n          <code>?labs=0</code> to turn it off. A link to a labs toy opens it either way; the switch\n          only decides what the shelf shows.",
  },
  "g-seed": {
    title: "Seed",
    body: "A number that starts a repeatable stream of pseudo-random numbers. The same seed gives the\n          same toy every time, which is why a link can rebuild it.",
  },
  "g-sorting": {
    title: "Sorting, back to front",
    body: "Splats are partly see-through, so they must be drawn from the farthest to the nearest for\n          the blending to come out right. The engine sorts them for the camera; a toy that moves its\n          splats may need them sorted again where they stand.",
  },
  "g-uniform": {
    title: "Uniform, shader",
    body: "A <b>shader</b> is a small program that runs on the graphics chip for every splat. A\n          <b>uniform</b> is a value the page hands it once a frame, the same for every splat, such\n          as a part's rotation. Hands-on play, a recipe's drive, and the controls all reach the\n          screen as uniforms.",
  },
  "g-lod": {
    title: "Level of detail",
    body: "Drawing less where little shows: a big structure gets fewer splats per atom, and a page\n          far away gets a coarser sheet.",
  },
  "g-worker": {
    title: "Web worker",
    body: "A background thread of a page. Heavy jobs (reading a file, turning a page into splats,\n          training) run in one so the page stays smooth.",
  },
  "g-sheet": {
    title: "Sheet, leaf, spine",
    body: "A <b>sheet</b> is a flat place in a toy where a picture shows (Chapter 5). A\n          <b>leaf</b> is a sheet that turns like a page, about a <b>spine</b>.",
  },
  "g-handson": {
    title: "Hands-on, rigid body",
    body: "Hands-on is the ✋ switch: a drag picks up the toy and a let-go tosses it. A\n          <b>rigid body</b> is a thing that never changes shape, described by its place and its\n          turn; most toys play as one (Chapter 6).",
  },
  "g-xpbd": {
    title: "Position-based dynamics (XPBD)",
    body: 'A way to simulate physics by moving things to where they would be if nothing overlapped\n          and every joint held, then working out their speeds from how far they moved. Splashery\'s\n          own engine uses an extended form of it [<a href="references.html#ref-11">11</a>,\n          <a href="references.html#ref-12">12</a>].',
  },
  "g-joint": {
    title: "Joint: hinge, slider, dial, socket, break",
    body: "The ways a part may move in hands-on play. A <b>hinge</b> swings about an axis, a\n          <b>slider</b> moves along a line, a <b>dial</b> turns round and round, a\n          <b>socket</b> lets a loose piece click back into its place, and a <b>break</b> lets a\n          piece snap off when pulled hard. Each of the first three is moved by one number, an angle\n          or a distance.",
  },
  "g-node": {
    title: "Node, skin",
    body: "A <b>node</b> is one point of a rope or a cloth, held to its neighbors by links. A splat\n          that follows two nodes (or four, for cloth) is called a <b>skin</b> splat: the rope bends\n          and the splat stays whole.",
  },
  "g-restitution": {
    title: "Restitution (bounce)",
    body: "The share of its speed a thing keeps after a bounce: a basketball dropped on a hard floor\n          keeps about 0.82 to 0.88.",
  },
  "g-radius": {
    title: "Toy radius",
    body: "The unit of length hands-on play uses: the toy's own radius. Gravity, throws, and the play\n          area are given in toy radii, so every toy falls the same way whatever its size on screen.",
  },
  "g-angstrom": {
    title: "Ångström, B-factor",
    body: "An <b>ångström</b> is a tenth of a nanometer; atoms in a bond are about 1 to 2 of them\n          apart. A <b>B-factor</b> says how much an atom's place is blurred in a crystal, by motion\n          or disorder.",
  },
  "g-voxel": {
    title: "Voxel",
    body: "A volume pixel: one little cube of a 3D scan, with one number for how dense the material\n          is there.",
  },
  "g-window": {
    title: "Window and level, Hounsfield unit",
    body: "A <b>window</b> picks the range of values that show, from a lower to an upper level, and\n          the rest is hidden or faded. In a CT scan the values are in <b>Hounsfield units</b>, on\n          which water is 0 and air is about −1000.",
  },
  "g-pointcloud": {
    title: "Point cloud, lidar, LAS and LAZ",
    body: "A <b>point cloud</b> is a list of points with places and sometimes colors.\n          <b>Lidar</b> makes one by timing laser pulses. <b>LAS</b> is the standard file for them;\n          <b>LAZ</b> is the same file compressed.",
  },
  "g-magnitude": {
    title: "Magnitude",
    body: "A scale on which each step is a fixed ratio. An earthquake's magnitude goes up by one for\n          about 32 times the energy. A star's magnitude goes the other way: the smaller (or more\n          negative) the number, the brighter the star, and 6 is about the faintest the unaided eye\n          sees under a dark sky.",
  },
  "g-sky": {
    title: "Precession, sidereal time, J2000",
    body: "<b>Precession</b> is the slow wobble of the Earth's axis, one turn in about 26,000 years,\n          which shifts where the stars are. <b>Sidereal time</b> is time measured by the stars\n          instead of the Sun, and tells which part of the sky is overhead. <b>J2000</b> is the\n          moment (January 1, 2000, noon) a star catalog's positions are given for.",
  },
  "g-snapshot": {
    title: "Snapshot, feed",
    body: "A <b>feed</b> is a web address that serves current data, such as the earthquakes of the\n          past week. A <b>snapshot</b> is a dated copy of that data that ships with the site, for\n          when the feed cannot be reached.",
  },
  "g-depth": {
    title: "Depth map, relative depth",
    body: "A picture the same size as a photo whose every pixel holds how far away that part is. A\n          depth model's map is <b>relative</b>: it says which parts are nearer than which, not how\n          many meters. Often it is stored as <i>disparity</i>, which is large for near things.",
  },
  "g-sharp": {
    title: "Sharp view, relief",
    body: "A second view of the photo toys that lays the photo, at its full resolution, on a\n          <b>relief</b>: a surface lifted by the same depth the splats use. It is a textured\n          surface, not splats.",
  },
  "g-training": {
    title: "Training, gradient descent",
    body: '<b>Gradient descent</b> nudges numbers again and again in the direction that lowers an\n          error. <b>Training</b> a splat scene is gradient descent on the splats\' places, sizes,\n          colors, and opacities until pictures drawn from them match the photos [<a\n            href="references.html#ref-1"\n            >1</a\n          >].',
  },
  "g-sfm": {
    title: "Structure from motion",
    body: "Working out where the camera was for each of many overlapping photos, and where the points\n          they show lie in space.",
  },
  "g-webgpu": {
    title: "WebGPU, WebAssembly",
    body: "<b>WebGPU</b> is the browser's newer way to use the graphics chip for general computation,\n          which Video to 3D needs for training. <b>WebAssembly</b> is a compact code format that\n          runs at near native speed; the depth model runs on it through ONNX Runtime Web.",
  },
  "g-formats": {
    title: "PLY, SOG, SPZ, .splat",
    body: "Splat file formats. <b>PLY</b> is the plain one that every tool reads and that keeps\n          everything. <b>SPZ</b> is about a tenth of its size and keeps view-dependent color.\n          <b>SOG</b> is the smallest and keeps base colors only. <b>.splat</b> is simple and keeps\n          base colors only.",
  },
  "g-qrmodule": {
    title: "Module, finder pattern, quiet zone",
    body: "A <b>module</b> is one cell of a QR code. The three big squares in the corners are the\n          <b>finder patterns</b>, which let a reader find and orient the code. The\n          <b>quiet zone</b> is the blank border, four modules wide.",
  },
  "g-ecc": {
    title: "Error correction, Reed–Solomon, codeword",
    body: 'A QR code holds extra <b>codewords</b> (8 modules each) made with a\n          <b>Reed–Solomon</b> code [<a href="references.html#ref-19">19</a>], so a reader can\n          rebuild the text if some are lost. The level (L, M, Q, or H) sets how many: about 7, 15,\n          25, or 30 percent of the codewords.',
  },
  "g-version": {
    title: "QR version",
    body: "The size of a QR code, from 1 (21 modules on a side) to 40 (177). A longer text needs a\n          higher version.",
  },
  "g-halftone": {
    title: "Halftone, error diffusion",
    body: "Showing a picture with only dark and light dots. <b>Error diffusion</b> decides each dot\n          by passing the error of the last choice on to the pixels beside it.",
  },
  "g-checkdigit": {
    title: "Check digit",
    body: "A digit of a barcode worked out from the others, so a reader can tell when it has misread\n          one.",
  },
  "g-fragment": {
    title: "Fragment, deflate, base64url",
    body: "The <b>fragment</b> of a link is everything after the <code>#</code>; a browser never\n          sends it to a server. <b>Deflate</b> is the compression of zip files and PNG pictures; a\n          Splashery link uses its raw form. <b>Base64url</b> spells bytes with the 64 letters,\n          digits, <code>-</code>, and <code>_</code> that are safe in an address.",
  },
  "g-scene": {
    title: "Scene",
    body: "Everything needed to rebuild a view: the toy, its options, the look, the camera, and any\n          paint, written as JSON. A link is a scene; a scene file is the same scene saved as a file.",
  },
};
