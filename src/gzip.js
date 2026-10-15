// Exact static gzip files, including servers that already decoded Content-Encoding.
export async function gzipBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${new URL(url, location.href).pathname}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
