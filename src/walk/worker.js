import { readSource, prepareBuffer } from "./prepare.js";
let source = null;
const transfers = (v, out = new Set()) => {
  if (ArrayBuffer.isView(v)) out.add(v.buffer);
  else if (v && typeof v === "object") for (const x of Object.values(v)) transfers(x, out);
  return [...out];
};
self.onmessage = async ({ data: { id, args } }) => {
  try {
    const started = performance.now();
    // Keep decoded source even when floor fitting or grid allocation fails,
    // so the person can correct its up direction or units and retry.
    source = await readSource(args, source);
    const prepared = prepareBuffer(args, source);
    prepared.result.prepareMs = performance.now() - started;
    self.postMessage({ id, result: prepared.result }, transfers(prepared.result));
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
