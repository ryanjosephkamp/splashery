// Lane QR lab r2, the study of splat QR codes: the three readers.
//   jsqr     jsQR 1.4.0 (the scan lab's reader, tools/qr-scan-lab/readers.mjs)
//   zxing    zxing-js 0.21.3, QRCodeReader with TRY_HARDER (the scan lab's)
//   zxingcpp zxing-cpp through zxing-wasm 3.1.4 (WebAssembly), its own
//            defaults (try harder, rotate, invert, downscale) over the QR
//            family: QR Code, Micro QR Code and rMQR
// Each takes an RGBA image { width, height, data } and returns the text it
// read, or null. A read counts in the study only when the text is exactly
// the one encoded.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/full";
import { readJsqr, readZxing } from "../qr-scan-lab/readers.mjs";

export const READERS = ["jsqr", "zxing", "zxingcpp"];
export const READER_NAMES = { jsqr: "jsQR", zxing: "zxing-js", zxingcpp: "zxing-cpp" };

let ready = null;
export function initZxingCpp() {
  if (!ready) {
    const path = fileURLToPath(new URL("../../node_modules/zxing-wasm/dist/full/zxing_full.wasm", import.meta.url)); // prettier-ignore
    const buf = fs.readFileSync(path);
    const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    ready = prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
  }
  return ready;
}

export const QR_FAMILY = ["QRCode", "MicroQRCode", "RMQRCode"];

// zxing-cpp: every symbol it finds, as [{ format, text }].
export async function zxingCppAll(img, formats = QR_FAMILY) {
  await initZxingCpp();
  const res = await readBarcodes(
    { data: img.data, width: img.width, height: img.height, colorSpace: "srgb" },
    { formats, maxNumberOfSymbols: 4 },
  );
  return res.filter((r) => r.isValid).map((r) => ({ format: r.format, text: r.text }));
}
export async function readZxingCpp(img) {
  const all = await zxingCppAll(img);
  return all.length ? all[0].text : null;
}

const safe = (f) => (img) => {
  try {
    return f(img);
  } catch {
    return null;
  }
};

// All three on one image: { jsqr, zxing, zxingcpp } (texts or null).
export async function readAll(img) {
  return {
    jsqr: safe(readJsqr)(img),
    zxing: safe(readZxing)(img),
    zxingcpp: await readZxingCpp(img).catch(() => null),
  };
}
export const readerFns = {
  jsqr: async (img) => safe(readJsqr)(img),
  zxing: async (img) => safe(readZxing)(img),
  zxingcpp: (img) => readZxingCpp(img).catch(() => null),
};
