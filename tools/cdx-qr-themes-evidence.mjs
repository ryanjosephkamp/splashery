// Cached evidence is reusable only for the current payloads and complete trial definitions.
import { LINKS } from "./cdx-qr-themes-links.mjs";

export const TRIALS = {
  layout: ["phone", "small"],
  browser: ["phone-330", "print-900-focus", "stage-scale-8", "stage-scale-4"],
};

export function validMatrix(row, kind) {
  const ids = TRIALS[kind];
  if (!ids || !Array.isArray(row?.links) || !row.links.length || row.links.length > LINKS.length)
    return false;
  if (kind === "layout" && row.links.length !== LINKS.length) return false;
  return row.links.every((link, index) => {
    if (
      link.text !== LINKS[index] ||
      link.characters !== LINKS[index].length ||
      !Array.isArray(link.scans) ||
      link.scans.length !== ids.length ||
      !link.scans.every((scan, i) => scan.trial === ids[i] && typeof scan.ok === "boolean")
    )
      return false;
    if (kind === "layout") return Number.isFinite(link.score);
    const o = link.options;
    return (
      o?.text === link.text &&
      o.shape === "square" &&
      o.level === "H" &&
      o.contrast === 0.5 &&
      o.center === "small" &&
      o.style === "color" &&
      o.size === "more" &&
      link.scans[0].pixels === 330 &&
      link.scans[1].pixels === 900 &&
      link.scans[1].blurModules === 0.2 &&
      link.scans[2].pixels === (link.codeSize + 8) * 8 &&
      link.scans[3].pixels === (link.codeSize + 8) * 4 &&
      link.eligible === link.scans.every((scan) => scan.ok) &&
      typeof link.raw900 === "boolean"
    );
  });
}

export function passedMatrix(row, kind) {
  return (
    validMatrix(row, kind) &&
    row.links.length === LINKS.length &&
    row.links.every((link) => link.scans.every((scan) => scan.ok))
  );
}

export function reusableMatrix(row, kind) {
  return (
    validMatrix(row, kind) &&
    row.eligible === passedMatrix(row, kind) &&
    (row.links.length === LINKS.length || !row.links.at(-1).eligible)
  );
}

export function requirePassedMatrix(row, kind) {
  if (!row?.eligible || !passedMatrix(row, kind))
    throw Error(`${row?.id || "Missing candidate"}: incomplete or failed ${kind} evidence`);
  const scans = row.links.flatMap((link) => link.scans);
  return `${scans.filter((scan) => scan.ok).length}/${scans.length}`;
}
