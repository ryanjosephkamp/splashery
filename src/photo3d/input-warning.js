// A photo's asynchronous read can overlap a rebuild of its input panel.
// Keep the same warning on the replacement panel after that rebuild finishes.
export function preserveInputWarning(panel, message, current) {
  if (!panel || !current()) return () => {};
  const root = panel.parentElement || document.getElementById("toy-options");
  if (!root) return () => {};
  const restore = () => {
    if (!current()) return;
    const error = document.querySelector("#toy-input .warning");
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  };
  if (!panel.isConnected) {
    restore();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (!current() || !panel.isConnected) {
      observer.disconnect();
      restore();
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
