// Loaded only when someone saves a scene QR. Both readers must locate the
// code in the actual raster: no module count, corners, or payload hints.
import { loadJsQR } from "./scan.js";

let zxing = null;
function loadZXing() {
  if (globalThis.ZXing) return Promise.resolve(globalThis.ZXing);
  if (!zxing) {
    zxing = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("../../vendor/zxing-js/zxing.min.js", import.meta.url).href;
      script.onload = () =>
        globalThis.ZXing
          ? resolve(globalThis.ZXing)
          : reject(new Error("The QR reader didn't load."));
      script.onerror = () => {
        script.remove();
        reject(new Error("The QR reader didn't load."));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      zxing = null;
      throw error;
    });
  }
  return zxing;
}

export async function readExportCode(canvas) {
  const [jsQR, Z] = await Promise.all([loadJsQR(), loadZXing()]);
  const { width, height } = canvas;
  const pixels = canvas
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, width, height);
  const result = { jsqr: jsQR(pixels.data, width, height)?.data ?? null, zxing: null };
  const lum = new Uint8ClampedArray(width * height);
  for (let i = 0; i < lum.length; i++) {
    const j = i * 4;
    lum[i] = (pixels.data[j] * 306 + pixels.data[j + 1] * 601 + pixels.data[j + 2] * 117) >> 10;
  }
  try {
    const bitmap = new Z.BinaryBitmap(
      new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, width, height)),
    );
    result.zxing = new Z.QRCodeReader()
      .decode(bitmap, new Map([[Z.DecodeHintType.TRY_HARDER, true]]))
      .getText();
  } catch {
    // A failed location or decode rejects this mask; the next may scan.
  }
  return result;
}
