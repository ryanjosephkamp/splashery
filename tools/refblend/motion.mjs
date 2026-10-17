// One rigid entity transform per moving part. Distances inside a part never change.
export function pose(motion, progress, radiusMeters) {
  const axis = { x: 0, y: 1, z: 2 }[motion.axis || "y"];
  const t = Math.max(0, Math.min(1, progress));
  const envelope = Math.sin(Math.PI * t);
  const rotation = [0, 0, 0],
    translation = [0, 0, 0];
  const amount =
    motion.amount ?? { slide: 0.1, bounce: 0.08, hinge: 90, spin: 360, wobble: 12 }[motion.how];
  if (motion.how === "slide" || motion.how === "bounce")
    translation[axis] = (amount * envelope) / radiusMeters;
  else
    rotation[axis] =
      amount *
      (motion.how === "spin"
        ? t
        : motion.how === "wobble"
          ? Math.sin(t * Math.PI * 6) * envelope
          : envelope);
  return { rotation, translation };
}
