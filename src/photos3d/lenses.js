// MIT. Made by Ryan with Codex (GPT-6). Labs API; no shelf entry until the gates pass.
import { focalPxFrom35 } from "../../vendor/splatjs/src/io/exif.js";

export function photoSettings(profile = "phone", featureSide) {
  const phone = profile === "phone";
  const side = featureSide ?? (phone ? 960 : 1600);
  if (phone ? side !== 960 : ![1280, 1600].includes(side))
    throw new RangeError("Use 960-pixel phone features, or 1280/1600-pixel desktop features");
  return { profile: phone ? "phone" : "high", featureSide: side };
}

// The first release supports one lens group. EXIF is checked for EVERY photo; a majority
// cannot silently calibrate the outliers. Unknown lenses require an explicit caller assumption.
export function groupLenses(frames, { assumeSingleLens = false, focal35 = null } = {}) {
  if (focal35 != null && (!(focal35 > 0) || !Number.isFinite(focal35)))
    throw new RangeError("focal35 must be positive and finite");
  const rows = frames.map((frame, index) => ({
    index,
    name: frame.name,
    f35: frame.exif?.f35 ?? focal35,
    camera: [frame.exif?.make, frame.exif?.model].filter(Boolean).join(" "),
  }));
  const known = rows.filter((r) => Number.isFinite(r.f35) && r.f35 > 0);
  // Densest 10% focal interval, then lowest focal, independent of caller order.
  const sorted = [...known].sort((a, b) => a.f35 - b.f35 || a.name.localeCompare(b.name));
  const groups = sorted.map((r) =>
    sorted.filter((q) => q.camera === r.camera && q.f35 >= r.f35 && q.f35 <= r.f35 * 1.1),
  );
  groups.sort(
    (a, b) => b.length - a.length || a[0].f35 - b[0].f35 || a[0].name.localeCompare(b[0].name),
  );
  const selected = new Set((groups[0] || []).map((r) => r.index));
  return rows.map((row) => {
    const frame = frames[row.index];
    let reason = null;
    if (known.length && !selected.has(row.index))
      reason =
        row.f35 > 0
          ? "Different camera or focal-length group; separate lens groups are not supported"
          : "Missing usable EXIF focal length in a calibrated set";
    else if (!known.length && !assumeSingleLens)
      reason = "Missing usable EXIF focal length; supply focal35 or explicitly assume one lens";
    return {
      ...row,
      accepted: !reason,
      reason,
      source:
        row.f35 > 0
          ? frame.exif?.f35
            ? "EXIF 35 mm equivalent"
            : "caller calibration"
          : "explicit single-lens assumption; focal searched",
      focalPx: !reason && row.f35 > 0 ? focalPxFrom35(row.f35, frame.fw, frame.fh) : null,
    };
  });
}
