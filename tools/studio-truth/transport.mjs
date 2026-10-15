// MIT. Preserve product bytes; avoid large decimal arrays over the browser protocol.
export function encodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export function decodeNear(encoded) {
  return Float32Array.from(atob(encoded), (c) => c.charCodeAt(0) / 255);
}
