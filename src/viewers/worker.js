// Lane Viewers: the worker both toys use (src/viewers/engine.js does the work). Messages:
// { id, cmd, args } in; { id, progress, text } while it works; { id, result } or { id, error } out.
// Typed arrays in results are transferred, not copied.

import { HANDLERS } from "./engine.js";

const transfers = (v, out = []) => {
  if (!v || typeof v !== "object") return out;
  if (ArrayBuffer.isView(v)) {
    if (!out.includes(v.buffer)) out.push(v.buffer);
  } else for (const k of Object.keys(v)) transfers(v[k], out);
  return out;
};

self.onmessage = async (e) => {
  const { id, cmd, args } = e.data;
  try {
    const fn = HANDLERS[cmd];
    if (!fn) throw new Error(`Unknown command ${cmd}.`);
    const result = await fn(args, (progress, text) => self.postMessage({ id, progress, text }));
    self.postMessage({ id, result }, transfers(result));
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
