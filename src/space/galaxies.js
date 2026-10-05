// Lane Space r2: galaxies from open telescope pictures (CC BY 4.0), for the
// "Real galaxies" toy. tools/sp2-galaxies.mjs crops each picture to a square
// round its galaxy (center and radius below, in the 1,280-pixel "screen"
// version) and writes assets/toys/real-galaxies/<id>.jpg (768 × 768).
//
// A picture shows a galaxy from one side only. The toy keeps every color
// where the picture puts it and guesses only the depth: a thin disk (an
// exponential profile, scale height 3.5% of the galaxy's radius) and a round
// bulge in the middle. Things in front of or behind the galaxy (stars of our
// own Galaxy, galaxies far behind) are drawn in its disk too.

export const GALAXIES = [
  {
    id: "m51",
    name: "Whirlpool Galaxy (M51)",
    url: "https://cdn.esahubble.org/archives/images/screen/heic0506a.jpg",
    page: "https://esahubble.org/images/heic0506a/",
    credit: "NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)",
    center: [502, 432],
    radius: 380,
    bulge: 0.12,
    distanceMly: 31,
  },
  {
    id: "m101",
    name: "Pinwheel Galaxy (M101)",
    url: "https://cdn.esahubble.org/archives/images/screen/heic0602a.jpg",
    page: "https://esahubble.org/images/heic0602a/",
    credit: "European Space Agency & NASA (ESA/Hubble)",
    center: [625, 508],
    radius: 480,
    bulge: 0.08,
    distanceMly: 21,
  },
  {
    id: "m74",
    name: "Phantom Galaxy (M74)",
    url: "https://cdn.esahubble.org/archives/images/screen/heic0719a.jpg",
    page: "https://esahubble.org/images/heic0719a/",
    credit: "NASA, ESA, and The Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration",
    center: [402, 527],
    radius: 400,
    bulge: 0.1,
    distanceMly: 32,
  },
  {
    id: "m83",
    name: "Southern Pinwheel Galaxy (M83)",
    url: "https://cdn.eso.org/images/screen/eso0825a.jpg",
    page: "https://www.eso.org/public/images/eso0825a/",
    credit: "ESO",
    center: [623, 625],
    radius: 440,
    bulge: 0.1,
    distanceMly: 15,
  },
];
