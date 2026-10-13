// Exact static gzip files, including servers that already decoded Content-Encoding.
export async function gzipBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${new URL(url, location.href).pathname}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Standalone source modules retain their complete native namespace. Original
// modules remain the fallback for unsupported decompression or a restrictive CSP.
export async function importGzipModule(compressed, original) {
  if (typeof DecompressionStream === "function" && typeof document !== "undefined") {
    let blob;
    try {
      blob = URL.createObjectURL(
        new Blob([await gzipBytes(compressed)], { type: "text/javascript" }),
      );
      return await import(blob);
    } catch {
      // The original module's URL and behavior remain available.
    } finally {
      if (blob) URL.revokeObjectURL(blob);
    }
  }
  return import(original.href || original);
}
