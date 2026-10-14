// Startup observations stay in memory. They use the renderer's own calls,
// never extra GPU probes, browser flags, storage, or network requests.
// Made by Ryan with Codex (GPT-6), under Splashery's MIT license.
const startups = new WeakMap();
const methods = new WeakMap();

export function errorReport(error, seen = new Set()) {
  if (error == null) return null;
  if (seen.has(error)) return { message: "[Circular cause]" };
  seen.add(error);
  const report = { name: error.name || "Error", message: String(error.message ?? error) };
  if (error.cause != null) report.cause = errorReport(error.cause, seen);
  return report;
}

// Share observation wrappers when embedded players start together. Return the
// original value/promise and restore the original property when the last
// observer leaves. A locked browser API is reported as unobservable.
function observeMethod(target, name, observer) {
  if (!target || typeof target[name] !== "function") return null;
  let map = methods.get(target);
  if (!map) methods.set(target, (map = new Map()));
  let entry = map.get(name);
  if (!entry) {
    const original = target[name];
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    entry = { observers: new Set(), original, descriptor };
    entry.wrapper = function (...args) {
      const listeners = [...entry.observers];
      for (const listener of listeners) listener.start?.(args);
      let result;
      try {
        result = Reflect.apply(original, this, args);
      } catch (error) {
        for (const listener of listeners) listener.end?.(args, null, error);
        throw error;
      }
      if (result && typeof result.then === "function") {
        result.then(
          (value) => listeners.forEach((listener) => listener.end?.(args, value, null)),
          (error) => listeners.forEach((listener) => listener.end?.(args, null, error)),
        );
      } else {
        for (const listener of listeners) listener.end?.(args, result, null);
      }
      return result;
    };
    try {
      Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: entry.wrapper,
      });
    } catch {
      return null;
    }
    map.set(name, entry);
  }
  entry.observers.add(observer);
  return () => {
    entry.observers.delete(observer);
    if (entry.observers.size) return;
    if (target[name] === entry.wrapper) {
      if (entry.descriptor) Object.defineProperty(target, name, entry.descriptor);
      else delete target[name];
    }
    map.delete(name);
  };
}

export function beginRendererDiagnostics(canvas, preference, nav = navigator) {
  const report = {
    preference,
    webgpuApi: !!nav.gpu,
    requestedBackends: [],
    attemptedBackends: [],
    adapter: { outcome: "not requested", calls: [] },
    webgpuDevice: { outcome: "not requested", errors: [] },
    webgl2: { outcome: "not attempted", contextErrors: [] },
    backend: null,
    finalError: null,
    observationLimits: [],
  };
  const cleanup = [];
  let finished = false;
  const diagnostics = {
    report,
    originalError: null,
    error: null,
    observedErrors: [],
    creating: false,
    finish(error = null) {
      diagnostics.error = error;
      finished = true;
      for (const stop of cleanup.reverse()) stop();
      startups.delete(canvas);
      report.finalError = errorReport(error);
    },
  };
  startups.set(canvas, diagnostics);
  const attempt = (backend) => {
    if (!report.attemptedBackends.includes(backend)) report.attemptedBackends.push(backend);
  };
  const observe = (target, name, observer) => {
    const stop = observeMethod(target, name, observer);
    if (stop) cleanup.push(stop);
    else report.observationLimits.push(`${name} could not be observed`);
  };
  if (nav.gpu) {
    observe(nav.gpu, "requestAdapter", {
      start() {
        if (diagnostics.creating && report.requestedBackends.includes("webgpu")) attempt("webgpu");
        report.adapter.outcome = "pending";
      },
      end(args, adapter, error) {
        if (finished) return;
        const outcome = error ? "error" : adapter ? "available" : "no adapter";
        report.adapter.outcome = outcome;
        report.adapter.calls.push({ outcome, error: errorReport(error) });
        if (error) diagnostics.observedErrors.push(error);
        if (adapter) {
          observe(adapter, "requestDevice", {
            start() {
              report.webgpuDevice.outcome = "pending";
            },
            end(args, device, error) {
              if (finished) return;
              report.webgpuDevice.outcome = error ? "error" : device ? "created" : "no device";
              if (error) {
                diagnostics.observedErrors.push(error);
                report.webgpuDevice.errors.push(errorReport(error));
              }
            },
          });
        }
      },
    });
  }
  observe(canvas, "getContext", {
    start([type]) {
      if (type === "webgl2") attempt("webgl2");
    },
    end([type], context, error) {
      if (type !== "webgl2") return;
      report.webgl2.outcome = error ? "error" : context ? "created" : "unavailable";
      if (error) {
        diagnostics.observedErrors.push(error);
        report.webgl2.error = errorReport(error);
      }
    },
  });
  const contextError = (event) =>
    report.webgl2.contextErrors.push(event.statusMessage || "Context creation failed");
  canvas.addEventListener("webglcontextcreationerror", contextError);
  cleanup.push(() => canvas.removeEventListener("webglcontextcreationerror", contextError));
  return diagnostics;
}

// Called only by the existing pc.js device-creation entry point.
export function observeGraphicsDevice(create, canvas, options) {
  const diagnostics = startups.get(canvas);
  // Worlds and direct Stage users do not register diagnostics. Preserve the
  // factory's exact return value, promise, and synchronous throw for them.
  if (!diagnostics) return create(canvas, options);
  diagnostics.report.requestedBackends = [...(options?.deviceTypes || [])];
  diagnostics.creating = true;
  return (async () => {
    try {
      const device = await create(canvas, options);
      diagnostics.report.backend = device?.deviceType || null;
      return device;
    } catch (error) {
      diagnostics.originalError = error;
      throw error;
    } finally {
      diagnostics.creating = false;
    }
  })();
}

export function setStartupState(canvas, name, value) {
  canvas.dataset[name] = String(value);
  // A custom element's canvas lives in a shadow root; don't mark its host page.
  if (canvas.ownerDocument.getElementById("stage") === canvas) {
    canvas.ownerDocument.body.dataset[name] = String(value);
  }
}

export function watchFirstToyFrame(player) {
  const app = player.stage.app;
  let rendered = false;
  const postrender = () => {
    // frameend alone also fires on ticks that do not render. Require an actual
    // render with a loaded toy, splats in the renderer, and submitted draw calls.
    rendered =
      !!player.toyInfo &&
      !player.loading &&
      app.renderer._gsplatCount > 0 &&
      player.stage.device._drawCallsPerFrame > 0;
  };
  const frameend = () => {
    if (!rendered || player.stage.device.contextLost) return;
    setStartupState(player.canvas, "firstToyFrame", true);
    player.emit("first-toy-frame");
    stop();
  };
  const stop = () => {
    app.off("postrender", postrender);
    app.off("frameend", frameend);
  };
  app.on("postrender", postrender);
  app.on("frameend", frameend);
  return stop;
}

export function rendererReportText(report) {
  return [
    "Splashery renderer startup report",
    "Local to this page. Nothing is sent or stored.",
    "WebGPU calls observed during startup may be shared by players starting together.",
    "Not requested/not attempted means no result was observed, not that an API works.",
    "",
    JSON.stringify(report, null, 2),
  ].join("\n");
}

export function showRendererDetails(fallback, error, diagnostics) {
  const doc = fallback.ownerDocument;
  // An initialized device can still fail later in Player.init or Viewer.start.
  // Preserve that startup error too, without claiming the renderer is ready.
  if (diagnostics) {
    diagnostics.error = error;
    diagnostics.report.finalError = errorReport(error);
  }
  doc.getElementById("fallback-reason").textContent =
    "Splashery could not finish starting 3D, so the splat toys cannot be drawn here. " +
    "A recent browser and hardware acceleration may help. Some managed or cloud browsers " +
    "have no graphics device available.";
  fallback.style.overflow = "auto";
  const details = doc.createElement("details");
  details.id = "renderer-details";
  details.style.cssText = "width:min(100%,52rem);min-width:0;text-align:left;margin:0 auto";
  const summary = doc.createElement("summary");
  summary.textContent = "Details";
  summary.style.cursor = "pointer";
  const label = doc.createElement("label");
  label.textContent = "Local startup report";
  label.htmlFor = "renderer-report";
  label.style.cssText = "display:block;margin-top:12px";
  const text = doc.createElement("textarea");
  text.id = "renderer-report";
  text.readOnly = true;
  text.spellcheck = false;
  text.value = rendererReportText(diagnostics?.report || { finalError: errorReport(error) });
  text.style.cssText =
    "box-sizing:border-box;width:100%;height:220px;resize:vertical;font:12px/1.4 monospace";
  const copy = doc.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy report";
  const status = doc.createElement("span");
  status.setAttribute("role", "status");
  status.style.marginLeft = "8px";
  copy.addEventListener("click", async () => {
    try {
      await doc.defaultView.navigator.clipboard.writeText(text.value);
      status.textContent = "Copied.";
    } catch {
      text.focus();
      text.select();
      status.textContent = "Select and copy the report.";
    }
  });
  details.addEventListener("toggle", () => {
    // An expanded report must scroll from its top on a short screen.
    fallback.style.alignContent = details.open ? "start" : "center";
  });
  details.append(summary, label, text, copy, status);
  fallback.querySelector("#renderer-details")?.remove();
  fallback.append(details);
}
