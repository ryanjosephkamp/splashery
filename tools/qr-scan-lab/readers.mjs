// The two independent QR readers: jsQR and zxing-js. Each returns the decoded text or null.
import jsQR from "jsqr";
import {
  BinaryBitmap,
  InvertedLuminanceSource,
  DecodeHintType,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";

export function readJsqr(img) {
  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
  return r ? r.data : null;
}

export function readJsqrInverted(img) {
  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
  return r ? r.data : null;
}

function zxingDecode(img, invert) {
  const lum = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4)
    lum[i] = (img.data[j] * 306 + img.data[j + 1] * 601 + img.data[j + 2] * 117) >> 10;
  let source = new RGBLuminanceSource(lum, img.width, img.height);
  if (invert) source = new InvertedLuminanceSource(source);
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  try {
    return new QRCodeReader()
      .decode(new BinaryBitmap(new HybridBinarizer(source)), hints)
      .getText();
  } catch {
    return null;
  }
}

export const readZxing = (img) => zxingDecode(img, false);
// zxing's inverted pass: the plain pass first, then the same image inverted.
export const readZxingInverted = (img) => zxingDecode(img, false) ?? zxingDecode(img, true);

export const readers = { jsqr: readJsqr, zxing: readZxing };
export const invertedReaders = { jsqr: readJsqrInverted, zxing: readZxingInverted };
