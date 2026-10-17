// A single owned worker. Replacing input or leaving the toy releases the ONNX heap.
export function createPanoramaClient(
  makeWorker = () => new Worker(new URL("./worker.js", import.meta.url), { type: "module" }),
) {
  let worker, rejectPending;
  function dispose() {
    worker?.terminate();
    worker = null;
    rejectPending?.(new Error("Panorama canceled."));
    rejectPending = null;
  }
  function run(photo, onStatus, side = 294) {
    dispose();
    return new Promise((resolve, reject) => {
      rejectPending = reject;
      const current = (worker = makeWorker());
      const finish = (error, result) => {
        if (worker !== current) return;
        current.terminate();
        worker = null;
        rejectPending = null;
        if (error) reject(new Error(error));
        else resolve(result);
      };
      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        if (data.status) onStatus?.(data.status);
        else finish(data.error, data.result);
      };
      current.onerror = (e) => {
        e.preventDefault?.();
        finish("The depth worker couldn't finish. Try a smaller panorama.");
      };
      current.onmessageerror = () => finish("The depth worker returned an unreadable panorama.");
      try {
        current.postMessage({ photo, side });
      } catch (e) {
        finish(e.message);
      }
    });
  }
  return { run, dispose };
}
