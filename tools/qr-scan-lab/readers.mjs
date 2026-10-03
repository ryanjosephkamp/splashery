// The two independent QR readers: jsQR and zxing-js. Each returns the decoded text or null.
import jsQR from "jsqr";
import {
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";

export function readJsqr(img) {
  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
  return r ? r.data : null;
}

export function readZxing(img) {
  const lum = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4)
    lum[i] = (img.data[j] * 306 + img.data[j + 1] * 601 + img.data[j + 2] * 117) >> 10;
  const bitmap = new BinaryBitmap(
    new HybridBinarizer(new RGBLuminanceSource(lum, img.width, img.height)),
  );
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  try {
    return new QRCodeReader().decode(bitmap, hints).getText();
  } catch {
    return null;
  }
}

export const readers = { jsqr: readJsqr, zxing: readZxing };
