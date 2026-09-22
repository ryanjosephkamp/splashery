// Scene <-> URL hash codec used by the embed player and the main app.
// Format: "d." + base64url(deflate-raw(JSON)) when CompressionStream exists,
// otherwise "j." + base64url(JSON) so the reader knows nothing is compressed.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToBase64Url(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(str) {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const canCompress = typeof CompressionStream !== "undefined";
export const canDecompress = typeof DecompressionStream !== "undefined";

export async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeSceneHash(scene) {
  const json = enc.encode(JSON.stringify(scene));
  if (canCompress) return "d." + bytesToBase64Url(await deflateRaw(json));
  return "j." + bytesToBase64Url(json);
}

export async function decodeSceneHash(value) {
  if (!value || value.length < 3 || value[1] !== ".") throw new Error("Malformed scene hash.");
  const kind = value[0];
  const bytes = base64UrlToBytes(value.slice(2));
  let json;
  if (kind === "d") {
    if (!canDecompress) throw new Error("This browser cannot decompress the embedded scene.");
    json = dec.decode(await inflateRaw(bytes));
  } else if (kind === "j") {
    json = dec.decode(bytes);
  } else {
    throw new Error("Unknown scene hash format.");
  }
  return JSON.parse(json);
}

// Reads "#s=..." (plus optional "&key=value" pairs) from a hash string.
export function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  return { s: params.get("s"), theme: params.get("theme"), params };
}
