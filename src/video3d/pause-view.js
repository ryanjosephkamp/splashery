// MIT. Made by Ryan with Codex (GPT-6).
// Hold the previous scene still while the local video decoder and trainer use the GPU.
// Preserve pause requests from the embed/visibility host, including overlapping file loads.
const holds = new WeakMap();
export function pausePreviousView(player, { signal } = {}) {
  if (typeof player?.setPaused !== "function" || signal?.aborted) return () => {};
  let state = holds.get(player);
  if (state && player.setPaused !== state.wrapper) return () => {};
  if (!state) {
    state = {
      setPaused: player.setPaused,
      wanted: !!player.paused,
      members: new Set(),
      releaseRender: player.stage?.holdRendering?.(),
    };
    state.wrapper = function (paused) {
      state.wanted = !!paused;
      return state.setPaused.call(this, true);
    };
    holds.set(player, state);
    player.setPaused = state.wrapper;
    state.setPaused.call(player, true);
  }
  const token = {};
  state.members.add(token);
  const release = () => {
    signal?.removeEventListener("abort", release);
    if (!state.members.delete(token) || state.members.size) return;
    holds.delete(player);
    state.releaseRender?.();
    if (player.setPaused === state.wrapper) {
      player.setPaused = state.setPaused;
      state.setPaused.call(player, state.wanted);
    }
  };
  signal?.addEventListener("abort", release, { once: true });
  if (signal?.aborted) release();
  return release;
}
