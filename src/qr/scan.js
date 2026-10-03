// Lane QR: reading a QR code back from a picture, to check that it scans.
// The browser's own BarcodeDetector where it reads QR codes; otherwise jsQR
// (vendor/jsqr/, Apache-2.0), loaded the first time a check runs. Nothing
// leaves the device.

let detector = null; // a BarcodeDetector, false once known missing
let jsqr = null; // the jsQR function, once loaded

async function nativeDetector() {
  if (detector !== null) return detector;
  detector = false;
  try {
    const BD = globalThis.BarcodeDetector;
    if (BD && (await BD.getSupportedFormats?.())?.includes("qr_code"))
      detector = new BD({ formats: ["qr_code"] });
  } catch {
    detector = false;
  }
  return detector;
}

// jsQR is a classic script (it sets window.jsQR): a script tag, once.
function loadJsQR() {
  if (jsqr) return Promise.resolve(jsqr);
  // The bundle hands back its module: the reader is its default export.
  const pick = (m) => (typeof m === "function" ? m : m?.default);
  if (globalThis.jsQR) return Promise.resolve((jsqr = pick(globalThis.jsQR)));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/jsqr/jsQR.js", import.meta.url).href;
    s.onload = () =>
      pick(globalThis.jsQR) ? resolve((jsqr = pick(globalThis.jsQR))) : reject(new Error("The QR reader didn't load.")); // prettier-ignore
    s.onerror = () => reject(new Error("The QR reader didn't load."));
    document.head.appendChild(s);
  });
}

// Reads a code from a canvas. Returns { text, reader, inverted } or null.
// `inverted`: it read only as light modules on a dark ground.
export async function readCode(canvas, { native = true } = {}) {
  const det = native ? await nativeDetector() : false;
  if (det) {
    try {
      const found = await det.detect(canvas);
      if (found?.length) return { text: found[0].rawValue, reader: "the browser's reader", inverted: false }; // prettier-ignore
    } catch {
      // fall through to jsQR
    }
  }
  const read = await loadJsQR();
  // The picture as it is, then at half size, as a phone's reader tries a
  // code at more than one scale (jsQR alone reads one).
  for (const scale of [1, 0.5]) {
    const img = pixels(canvas, scale);
    const at = scale === 1 ? "" : ", at half size";
    let r = read(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (r) return { text: r.data, reader: `jsQR${at}`, inverted: false };
    // jsQR 1.4's "onlyInvert" never makes the inverted picture; "invertFirst"
    // tries it first (the plain one has already failed above).
    r = read(img.data, img.width, img.height, { inversionAttempts: "invertFirst" });
    if (r) return { text: r.data, reader: `jsQR${at}`, inverted: true };
  }
  return null;
}

function pixels(canvas, scale) {
  let c = canvas;
  if (scale !== 1) {
    c = document.createElement("canvas");
    c.width = Math.round(canvas.width * scale);
    c.height = Math.round(canvas.height * scale);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(canvas, 0, 0, c.width, c.height);
  }
  return c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
}
