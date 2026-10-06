// Lane Powers of ten: where the zoom goes, and the aerial pictures it uses.
// Shared by the toy (src/packs/powers-of-ten.js), its tools (tools/pot-*.mjs)
// and its evidence test (docs/evidence/powers-of-ten.json).

// The zoom's target: a small tree in the Enid A. Haupt Garden, beside the
// Smithsonian Castle on the National Mall, Washington, D.C.
export const TARGET = { lat: 38.888321, lon: -77.025649, name: "the Enid A. Haupt Garden, Washington, D.C." }; // prettier-ignore

// The aerial pictures, every half decade: e is log10 of the width in meters.
export const AERIAL = [];
for (let e = 6; e >= 1.5 - 1e-9; e -= 0.5) {
  const r = Math.round(e * 10) / 10;
  AERIAL.push({
    e: r,
    width: 10 ** r,
    px: 1024,
    source: r <= 3 ? "dc" : r <= 3.5 ? "usgs" : "s2",
    file: `aerial-${r.toFixed(1).replace(".", "_")}.jpg`,
  });
}

// The zoom's range: z is log10 of the view's height in meters.
export const Z_HOME = 0.3;
export const Z_MIN = -7.6;
export const Z_MAX = 21.6;

// The stops, smallest last: e is where the stop's label takes over (log10 of
// the view's height in meters), `size` the real size the label gives (meters),
// with its source; docs/evidence/powers-of-ten.json lists the same, and
// tests/pot.spec.mjs checks the labels against it.
export const STOPS = [
  {
    id: "galaxy",
    e: 21,
    size: 9.4607e20,
    label:
      "The Milky Way, about 100,000 light-years across. No one can photograph it from outside: this is M83, a spiral galaxy much like it, set at our galaxy's size and tilt.",
    source:
      "M83: ESO (CC BY 4.0). The galactic center 26,700 light-years away: GRAVITY Collaboration 2019.",
  },
  {
    id: "stars-local",
    e: 19.4,
    size: 1.514e19,
    label: "About 98,000 stars within 1,600 light-years of the Sun, where they really are.",
    source: "HYG database v4.4 (David Nash; Hipparcos, Yale, Gliese), CC BY-SA 4.0.",
  },
  {
    id: "stars-near",
    e: 18,
    size: 6.15e17,
    label: "Every known star within 65 light-years of the Sun: about 2,200.",
    source:
      "Gaia nearby-star catalog, GCNS (ESA/Gaia/DPAC), CC BY-SA 3.0 IGO; HYG v4.4, CC BY-SA 4.0.",
  },
  {
    id: "sun-alone",
    e: 16,
    size: 9.4607e15,
    label:
      "One light-year: the Sun alone. Its Oort cloud of comets may reach this far, too small and dark to see.",
    source: "Light-year: IAU. The Sun's place: JPL's planetary elements (public domain).",
  },
  {
    id: "outer",
    e: 13.3,
    size: 9.0e12,
    label: "The Sun and the planets' orbits out to Neptune's, about 60 AU (9 billion km) across.",
    source:
      "Orbits, and places at 12:54 p.m. EDT on October 7, 2026: JPL, Approximate Positions of the Planets (public domain).",
  },
  {
    id: "inner",
    e: 11.9,
    size: 4.56e11,
    label:
      "Mercury, Venus, the Earth and Mars: Mars's orbit is about 3 AU (456 million km) across.",
    source:
      "JPL, Approximate Positions of the Planets (public domain). The dots mark places: the planets are far smaller.",
  },
  {
    id: "moon",
    e: 9,
    size: 3.844e8,
    label:
      "The Earth and the Moon, about 384,400 km apart on average, and the Moon's path for a month.",
    source:
      "Moon: NASA LRO (public domain); its orbit after Meeus's lunar theory. Earth: NASA Blue Marble.",
  },
  {
    id: "earth",
    e: 7.1,
    size: 12742e3,
    label: "The Earth, about 12,700 km across.",
    source: "NASA Blue Marble: Next Generation (via USGS The National Map), public domain.",
  },
  {
    id: "region",
    e: 6,
    size: 322e3,
    label: "The Chesapeake Bay, about 320 km long, and the Mid-Atlantic coast.",
    source: "Sentinel-2 cloudless 2016 by EOX (contains Copernicus Sentinel data), CC BY 4.0.",
  },
  {
    id: "city",
    e: 4.6,
    size: 16e3,
    label: "Washington, D.C., on the Potomac River, about 16 km across.",
    source: "Sentinel-2 cloudless 2016 by EOX (contains Copernicus Sentinel data), CC BY 4.0.",
  },
  {
    id: "mall",
    e: 3.3,
    size: 3.2e3,
    label: "The National Mall, about 3.2 km from the Capitol to the Lincoln Memorial.",
    source:
      "USGS The National Map (NAIP), public domain; D.C. 2023 aerial photo (OCTO), CC BY 4.0.",
  },
  {
    id: "garden",
    e: 2,
    size: 130,
    label:
      "The Enid A. Haupt Garden beside the Smithsonian Castle, about 130 m across (4.2 acres).",
    source: "District of Columbia 2023 aerial photo, 8 cm (OCTO), CC BY 4.0.",
  },
  {
    id: "bed",
    e: 0.6,
    size: 2,
    label: "A garden bed with a young full-moon maple, about 2 m long.",
    source: "3D capture “Golden Fullmoon Maple” by Joshua Trapani, CC BY 4.0 (made elsewhere).",
  },
  {
    id: "leaf",
    e: -1.2,
    size: 0.07,
    label: "A Japanese maple leaf, about 7 cm across (an estimate: their leaves are 4 to 12 cm).",
    source: "“Japanese maple leaf - Richmond Virginia” by Watts (Flickr), CC BY 2.0.",
  },
  {
    id: "cells",
    e: -4,
    size: 200e-6,
    label:
      "Cells inside a leaf, packed with chloroplasts (red in this false-color confocal picture, 200 µm wide).",
    source:
      "“Arabidopsis thaliana plant cells containing chloroplasts” by Fernán Federici (Wellcome Collection), CC BY 4.0.",
  },
  {
    id: "chloroplast",
    e: -5.6,
    size: 3.5e-6,
    label:
      "A chloroplast, where a leaf turns light into food, about 3.5 µm long: an electron micrograph (false color).",
    source:
      "“Chloroplast in a bean leaf, TEM” by Kevin Mackenzie, University of Aberdeen (Wellcome Collection), CC BY 4.0.",
  },
  {
    id: "ribosome",
    e: -7.4,
    size: 20e-9,
    label:
      "A ribosome, the machine that builds proteins, about 20 nm across: its RNA orange, its proteins blue.",
    source:
      "Cryo-EM map EMD-48329 and model PDB 9MKK (E. coli 70S; Majumdar et al. 2025), public domain.",
  },
];

// The stop whose label shows at zoom z: the nearest.
export function stopAt(z) {
  let best = STOPS[0];
  for (const s of STOPS) if (Math.abs(z - s.e) < Math.abs(z - best.e)) best = s;
  return best;
}

// The pictures under the microscope (tools/pot-micro.mjs cuts them): the
// source, its full width in meters (as its page states), the point the zoom
// goes into (as shares of its width and height) and a square every half
// decade (e: log10 of the square's side in meters).
const micro = (id, e) => ({ e, file: `micro-${id}-${String(e).replace("-", "m").replace(".", "_")}.jpg` }); // prettier-ignore
export const MICRO = [
  {
    id: "leaf",
    url: "https://live.staticflickr.com/65535/53147954324_3eda9187f6_k.jpg",
    page: "https://www.flickr.com/photos/126288307@N05/53147954324",
    // The leaf spans about 1,800 of the picture's 2,048 columns; at 7 cm
    // across (a typical leaf: 4 to 12 cm) the picture is about 7.9 cm wide.
    width: 0.079,
    // On the blade, where the cells sit.
    center: [0.47, 0.45],
    layers: [-1.15, -1.6, -2.1].map((e) => micro("leaf", e)),
  },
  {
    id: "cells",
    url: "https://iiif.wellcomecollection.org/image/B0009986/full/full/0/default.jpg",
    page: "https://wellcomecollection.org/works/gwmfux6b",
    width: 200e-6,
    // A chloroplast near the middle, about 3.6 µm across here.
    center: [0.4795, 0.4445],
    layers: [-3.8, -4.3, -4.8].map((e) => micro("cells", e)),
  },
  {
    id: "chloroplast",
    url: "https://iiif.wellcomecollection.org/image/B0009849/full/full/0/default.jpg",
    page: "https://wellcomecollection.org/works/bx3dctp2",
    width: 4.5e-6,
    // In the chloroplast's stroma, between its stacks of membranes.
    center: [0.6, 0.5],
    layers: [-5.5, -6].map((e) => micro("chloroplast", e)),
  },
];
