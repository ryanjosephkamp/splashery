#!/usr/bin/env node
// Builds the word vectors toy's word list (lane AI): the most common plain
// English words from GloVe (Wikipedia 2014 + Gigaword 5, 50 dimensions;
// Pennington, Socher and Manning, Stanford NLP; Public Domain Dedication and
// License), each scaled to unit length and packed as signed bytes.
//
//   curl -L -o .cache/glove/glove.6B.zip https://nlp.stanford.edu/data/glove.6B.zip
//   unzip -p .cache/glove/glove.6B.zip glove.6B.50d.txt | head -n 40000 > .cache/glove/top40k.50d.txt
//   node tools/word-vectors.mjs [--words=24000]
//
// Writes assets/toys/word-vectors/words.txt: line 1 is the words (space
// separated, most common first), line 2 the vectors as base64 (50 signed
// bytes per word, unit length times 127).

import fs from "node:fs";

const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def; // prettier-ignore
const N = Number(arg("words", 24000));
const src = ".cache/glove/top40k.50d.txt";
const out = "assets/toys/word-vectors/words.txt";

// Left out: violence, weapons, sex and slurs, so the toy never lands on them
// (a user can only type words from this list).
const BLOCK = new Set(
  `kill killed killing kills killer killers murder murdered murders murderer dead death deaths die died dies dying
  rape raped bomb bombs bombing bombings bomber bombers bombed gun guns gunman gunmen gunfire rifle rifles pistol
  shoot shot shots shooting shootings shooter suicide terror terrorist terrorists terrorism weapon weapons blood
  bloody sex sexual sexually porn drug drugs abuse abused torture tortured massacre genocide nazi nazis slave
  slaves slavery corpse corpses execution executed executions hanged violence violent assault assaulted wounded
  wounds injured casualties explosion explosions explosive explosives grenade missile missiles ammunition
  militant militants insurgent insurgents hostage hostages kidnapped kidnapping stabbed beheaded victims victim
  prostitution prostitute sexy nude naked gay lesbian homosexual racist racism hitler jihad`
    .split(/\s+/)
    .filter(Boolean),
);

const lines = fs.readFileSync(src, "utf8").split("\n");
const words = [];
const bytes = [];
for (const line of lines) {
  if (words.length >= N) break;
  const parts = line.trim().split(" ");
  const w = parts[0];
  if (!/^[a-z]{2,10}$/.test(w) || BLOCK.has(w)) continue;
  const v = parts.slice(1).map(Number);
  if (v.length !== 50) continue;
  const l = Math.hypot(...v);
  words.push(w);
  for (const x of v) bytes.push(Math.max(-127, Math.min(127, Math.round((x / l) * 127))));
}
fs.mkdirSync("assets/toys/word-vectors", { recursive: true });
const buf = Buffer.from(Int8Array.from(bytes).buffer);
fs.writeFileSync(out, `${words.join(" ")}\n${buf.toString("base64")}\n`);
console.log(`${words.length} words -> ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
