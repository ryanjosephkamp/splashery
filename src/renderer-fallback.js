// Fallback UI for the app and the embed. Diagnostics stay in the Engine module.
// Made by Ryan with Codex (GPT-6), under Splashery's MIT license.
import { errorReport, rendererReportText } from "./renderer-diagnostics.js";

// Keep the Details styles scoped here: styles.css belongs to protected PR #591.
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
