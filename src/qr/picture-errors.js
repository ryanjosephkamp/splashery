// Spend a bounded share of H-level codeword correction on picture agreement.
import qrcodegen from "../../vendor/qrcodegen/qrcodegen.js";
import { ECC } from "./encode.js";
import { plainModules, squareSample, gray } from "../qr-craft/picture.js";
const { QrCode } = qrcodegen;
const cache = new Map();
function wordMap(code) {
  const key = `${code.version}/${code.ecc}/${code.rotation || 0}`;
  if (cache.has(key)) return cache.get(key);
  const n = code.size,
    level = ECC[code.ecc],
    blocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[level.ordinal][code.version],
    ecc = QrCode.ECC_CODEWORDS_PER_BLOCK[level.ordinal][code.version],
    count = Math.floor(QrCode.getNumRawDataModules(code.version) / 8),
    shortBlocks = blocks - (count % blocks),
    shortLength = Math.floor(count / blocks);
  const blockOf = [];
  for (let i = 0; i <= shortLength; i++)
    for (let block = 0; block < blocks; block++)
      if (i !== shortLength - ecc || block >= shortBlocks) blockOf.push(block);
  const qr = Object.create(QrCode.prototype);
  Object.assign(qr, {
    version: code.version,
    size: n,
    errorCorrectionLevel: level,
    modules: Array.from({ length: n }, () => new Array(n).fill(false)),
    isFunction: Array.from({ length: n }, () => new Array(n).fill(false)),
  });
  qr.drawFunctionPatterns();
  const words = Array.from({ length: count }, () => []),
    at = new Int32Array(n * n).fill(-1);
  let bit = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < n; v++)
      for (let j = 0; j < 2; j++) {
        let x = right - j,
          y = ((right + 1) & 2) === 0 ? n - 1 - v : v;
        if (qr.isFunction[y][x] || bit >= count * 8) continue;
        for (let t = 0; t < (code.rotation || 0); t++) [x, y] = [n - 1 - y, x];
        const m = y * n + x,
          word = bit++ >>> 3;
        words[word].push(m);
        at[m] = word;
      }
  }
  if (blockOf.length !== count || bit !== count * 8) throw Error("Invalid picture codeword map");
  const result = { words, at, blockOf, blocks, maxErrors: Math.floor(ecc / 2) };
  if (cache.size >= 8) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

export function fitPictureErrors(code, pic, fraction = 0.4) {
  if (code.ecc !== "H" || !pic || fraction <= 0) return code;
  const { words, at, blockOf, blocks, maxErrors } = wordMap(code),
    n = code.size,
    source = squareSample(pic, n),
    forbidden = plainModules(code);
  if (code.rotation)
    for (let i = 0; i < forbidden.length; i++) forbidden[i] = code.role[i] !== 0 ? 1 : 0;
  for (const p of code.pieces.filter((p) => p.kind === "finder"))
    for (let y = Math.max(0, p.row - 3); y < Math.min(n, p.row + 10); y++)
      for (let x = Math.max(0, p.col - 3); x < Math.min(n, p.col + 10); x++)
        forbidden[y * n + x] = 1;
  const reserved = Array.from({ length: blocks }, () => new Set()),
    alignment = code.pieces
      .filter((p) => p.kind === "alignment")
      .sort((a, b) => b.row + b.col - a.row - a.col)[0];
  if (alignment)
    for (let y = alignment.row - 1; y <= alignment.row + 5; y++)
      for (let x = alignment.col - 1; x <= alignment.col + 5; x++) {
        if (
          x < 0 ||
          y < 0 ||
          x >= n ||
          y >= n ||
          (y >= alignment.row &&
            y < alignment.row + 5 &&
            x >= alignment.col &&
            x < alignment.col + 5)
        )
          continue;
        const m = y * n + x,
          word = at[m];
        forbidden[m] = 1;
        if (word >= 0 && code.dark[m]) reserved[blockOf[word]].add(word);
      }
  const ranked = Array.from({ length: blocks }, () => []);
  for (let word = 0; word < words.length; word++) {
    let benefit = 0;
    const flips = [];
    for (const m of words[word]) {
      if (forbidden[m]) continue;
      const g = gray(source.subarray(m * 3, m * 3 + 3)),
        desired = g < 0.5 ? 1 : 0;
      if (desired !== code.dark[m]) {
        benefit += Math.abs(g - 0.5);
        flips.push(m);
      }
    }
    if (flips.length) ranked[blockOf[word]].push({ word, benefit, flips });
  }
  fraction = Math.min(0.6, fraction);
  const limit = Math.floor(maxErrors * fraction);
  if (reserved.some((set) => set.size > limit)) return code;
  const dark = code.dark.slice(),
    used = reserved.map((set) => new Set(set));
  let flipped = 0;
  for (let block = 0; block < blocks; block++) {
    ranked[block].sort(
      (a, b) =>
        Number(reserved[block].has(b.word)) - Number(reserved[block].has(a.word)) ||
        b.benefit - a.benefit,
    );
    for (const item of ranked[block]) {
      if (!used[block].has(item.word) && used[block].size >= limit) continue;
      used[block].add(item.word);
      for (const m of item.flips) {
        dark[m] ^= 1;
        flipped++;
      }
    }
  }
  return {
    ...code,
    dark,
    encodedDark: code.dark,
    intentionalErrors: {
      fraction,
      maxErrors,
      limit,
      usedByBlock: used.map((set) => set.size),
      flipped,
    },
  };
}
