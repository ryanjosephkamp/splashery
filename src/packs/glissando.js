// Lane UI r4: a glissando. Press a key and drag along the keyboard: each key
// the finger crosses goes down and plays once, in order, at the speed of the
// drag; dragging back plays them again; letting go stops. The recipe's
// `drag` (src/player.js) follows the pointer across the horizontal plane the
// press started on, and returns the taps to fire.
//
// keyOf(point) gives the key (a tap's pick) under a point in the recipe's
// own coordinates, or null off the keys. Between two pointer samples the
// path is walked in short steps, so a fast drag skips no key.

const STEP = 0.004; // recipe units between samples along the path

export function glissando(keyOf, { key = "strike" } = {}) {
  let last = null; // the key under the finger (null off the keys)
  let from = null; // the last point
  return {
    at: (p) => keyOf(p) !== null,
    start(p) {
      from = p;
      last = keyOf(p);
      return last === null ? null : { key, pick: last };
    },
    move(p) {
      if (!from) return null;
      const d = Math.hypot(p[0] - from[0], p[2] - from[2]);
      const n = Math.min(400, Math.max(1, Math.ceil(d / STEP)));
      const taps = [];
      for (let s = 1; s <= n; s++) {
        const f = s / n;
        const q = [from[0] + (p[0] - from[0]) * f, p[1], from[2] + (p[2] - from[2]) * f];
        const k = keyOf(q);
        if (k !== null && k !== last) taps.push({ key, pick: k });
        last = k;
      }
      from = p;
      return taps;
    },
    end() {
      from = null;
      last = null;
    },
  };
}

// The taps a drive() should handle this frame: every tap since the last
// frame (info.taps), or, from an older engine, the latest tap once.
export function newTaps(info, m) {
  const tap = info?.tap;
  if (info?.taps) {
    if (tap) m.tapN = tap.n;
    return info.taps;
  }
  if (!tap || tap.n === m.tapN) return [];
  m.tapN = tap.n;
  return [tap];
}
