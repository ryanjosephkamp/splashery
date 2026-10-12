// Stream decoded bytes without trusting a compressed Content-Length header.
export async function fetchBytes(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the depth model.");
  const total = Number(r.headers.get("content-length")) || 0;
  if (!r.body) {
    const bytes = new Uint8Array(await r.arrayBuffer());
    onProgress?.(1);
    return bytes;
  }
  const reader = r.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress?.(Math.min(0.99, got / total));
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  onProgress?.(1);
  return out;
}
