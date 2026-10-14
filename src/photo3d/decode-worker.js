// Local decoding, orientation, scaling, and pixel readback, off the UI thread.
self.onmessage = async ({ data: { id, blob, maxSide, pixels } }) => {
  let bitmap;
  try {
    if (pixels) {
      const canvas = new OffscreenCanvas(pixels.w, pixels.h);
      canvas
        .getContext("2d", { willReadFrequently: true })
        .putImageData(
          new ImageData(
            new Uint8ClampedArray(
              pixels.data.buffer,
              pixels.data.byteOffset,
              pixels.data.byteLength,
            ),
            pixels.w,
            pixels.h,
          ),
          0,
          0,
        );
      self.postMessage({
        id,
        preview: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 }),
      });
      return;
    }
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const f = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(2, Math.round(bitmap.width * f)),
      h = Math.max(2, Math.round(bitmap.height * f));
    const canvas = new OffscreenCanvas(w, h);
    const g = canvas.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = "high";
    g.drawImage(bitmap, 0, 0, w, h);
    const data = new Uint8Array(g.getImageData(0, 0, w, h).data.buffer);
    const preview = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    self.postMessage({ id, photo: { w, h, data, preview } }, [data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error.message || "Could not decode the photo." });
  } finally {
    bitmap?.close();
  }
};
