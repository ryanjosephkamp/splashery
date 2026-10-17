// Loaded only by Most detail's scan workers (or its local fallback).
// All assets stay on this origin; no reader fetches code from a CDN.
let ready;
export async function loadSecondReader(bytes = null) {
  if (!ready)
    ready = (async () => {
      const reader = await import("./vendor/zxing/reader/index.js");
      const wasmBinary =
        bytes ||
        (await (
          await fetch(new URL("./vendor/zxing/reader/zxing_reader.wasm", import.meta.url))
        ).arrayBuffer());
      await reader.prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
      return async (image) => {
        const results = await reader.readBarcodes(
          { data: image.data, width: image.width, height: image.height, colorSpace: "srgb" },
          { formats: ["QRCode", "MicroQRCode", "RMQRCode"], maxNumberOfSymbols: 4 },
        );
        return results.find((result) => result.isValid)?.text ?? null;
      };
    })();
  return ready;
}
