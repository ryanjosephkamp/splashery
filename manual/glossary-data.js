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
    body: "Tilt is the off-diagonal terms of <var>Σ</var>: zero when a splat's axes line up with\n          <var>x</var>, <var>y</var>, and <var>z</var>. Rotation is a splat's own turn. \"Tilt lock\"\n          is a different thing: the camera control in Level 5.",
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
};
