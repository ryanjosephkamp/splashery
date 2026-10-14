// Lane AsciiCapture: the credit every output frame shows (and the GIF carries
// as a comment block), read from the toy's `credit` in src/toys.js. A kit toy
// has none: Splashery made it, under the MIT license.

import { findToy } from "../toys.js";

export const LABEL = "Fresh toy animation";

function wrap(text, limit) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
}

// The toy's credit as stored, or null for a kit toy.
export function toyCredit(toyId) {
  const credit = findToy(toyId)?.credit;
  if (!credit) return null;
  const { title, author, source, license, licenseUrl, changes } = credit;
  return { title, author, source, license, licenseUrl, changes };
}

// The footer lines under each frame: at most 8, each well under 200 characters.
export function creditFooter(toyId, label, columns) {
  const credit = toyCredit(toyId);
  const limit = Math.max(42, Math.min(80, columns));
  const tail = `${LABEL}, converted to ASCII by Splashery.`;
  if (!credit) return [`${label}: Splashery, MIT`, tail];
  return [
    `${credit.title} - ${credit.author} - ${credit.license}`,
    credit.source,
    credit.licenseUrl,
    ...wrap(`Changes: ${credit.changes.replace(/recentred/g, "recentered")}`, limit),
    tail,
  ]
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => line.slice(0, 160));
}

// What the GIF's comment block says.
export function creditMetadata(toyId, label, settings) {
  const credit = toyCredit(toyId);
  return {
    app: "Splashery",
    kind: LABEL,
    toy: toyId,
    label,
    credit: credit ?? { author: "Splashery", license: "MIT" },
    settings,
  };
}
