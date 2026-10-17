// Picture matching using padding after the payload terminator. Payload bytes and ECC stay intact.
import qrcodegen from "../../vendor/qrcodegen/qrcodegen.js";
import { ECC } from "./encode.js";
import { squareSample, gray, plainModules } from "../qr-craft/picture.js";
const { QrCode, QrSegment } = qrcodegen;
function dataBytes(code) {
  const capacity = QrCode.getNumDataCodewords(code.version, ECC[code.ecc]) * 8,
    bits = [];
  const push = (v, n) => {
    for (let j = n - 1; j >= 0; j--) bits.push((v >>> j) & 1);
  };
  for (const seg of QrSegment.makeSegments(code.text)) {
    push(seg.mode.modeBits, 4);
    push(seg.numChars, seg.mode.numCharCountBits(code.version));
    bits.push(...seg.getData());
  }
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const start = bits.length / 8;
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = new Array(bits.length / 8).fill(0);
  for (let i = 0; i < bits.length; i++) data[i >>> 3] |= bits[i] << (7 - (i & 7));
  return { data, start };
}
// Correction blocks are independent. Small local systems use every free byte
// without constructing a large dense system for the complete QR code.
const layouts = new Map(),
  bases = new Map();
function remember(cache, key, value, limit = 16) {
  if (cache.size >= limit) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}
function blockBasis(length, ecc) {
  const key = `${length}/${ecc}`;
  if (bases.has(key)) return bases.get(key);
  const variables = length * 8,
    words = Math.ceil(variables / 32),
    rows = Array.from({ length: (length + ecc) * 8 }, () => new Uint32Array(words)),
    divisor = QrCode.reedSolomonComputeDivisor(ecc);
  for (let col = 0; col < variables; col++) {
    const data = new Array(length).fill(0);
    data[col >>> 3] = 1 << (7 - (col & 7));
    const encoded = data.concat(QrCode.reedSolomonComputeRemainder(data, divisor));
    for (let bit = 0; bit < rows.length; bit++)
      if ((encoded[bit >>> 3] >>> (7 - (bit & 7))) & 1) rows[bit][col >>> 5] |= 1 << (col & 31);
  }
  return remember(bases, key, { rows, words });
}
function blockLayout(code) {
  const key = `${code.version}/${code.ecc}/${code.rotation || 0}`;
  if (layouts.has(key)) return layouts.get(key);
  const n = code.size,
    ecl = ECC[code.ecc],
    count = Math.floor(QrCode.getNumRawDataModules(code.version) / 8),
    blocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][code.version],
    ecc = QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][code.version],
    shortCount = blocks - (count % blocks),
    shortLength = Math.floor(count / blocks) - ecc;
  let start = 0;
  const layout = Array.from({ length: blocks }, (_, block) => {
    const length = shortLength + (block < shortCount ? 0 : 1),
      item = { start, length, ecc, modules: new Int32Array((length + ecc) * 8) };
    start += length;
    return item;
  });
  const interleaved = [];
  for (let word = 0; word < shortLength + 1 + ecc; word++)
    for (let block = 0; block < blocks; block++) {
      if (word === shortLength && block < shortCount) continue;
      interleaved.push([block, word - (block < shortCount && word > shortLength ? 1 : 0)]);
    }
  const qr = Object.create(QrCode.prototype);
  Object.assign(qr, {
    version: code.version,
    size: n,
    errorCorrectionLevel: ecl,
    modules: Array.from({ length: n }, () => new Array(n).fill(false)),
    isFunction: Array.from({ length: n }, () => new Array(n).fill(false)),
  });
  qr.drawFunctionPatterns();
  let bit = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < n; v++)
      for (let j = 0; j < 2; j++) {
        let x = right - j,
          y = ((right + 1) & 2) === 0 ? n - 1 - v : v;
        if (qr.isFunction[y][x] || bit >= count * 8) continue;
        for (let turn = 0; turn < (code.rotation || 0); turn++) [x, y] = [n - 1 - y, x];
        const [block, word] = interleaved[bit >>> 3];
        layout[block].modules[word * 8 + (bit & 7)] = y * n + x;
        bit++;
      }
  }
  if (bit !== count * 8 || interleaved.length !== count)
    throw Error("Invalid padding block layout");
  return remember(layouts, key, layout);
}
export function fitPadding(code, pic, { maxBits = Infinity } = {}) {
  const { data, start } = dataBytes(code),
    source = squareSample(pic, code.size),
    plain = plainModules(code),
    end = Math.min(data.length, start + Math.floor(maxBits / 8));
  let variables = 0,
    rank = 0;
  for (const block of blockLayout(code)) {
    const first = Math.max(0, start - block.start) * 8,
      last = Math.min(block.length, end - block.start) * 8;
    if (last <= first) continue;
    variables += last - first;
    const { rows, words } = blockBasis(block.length, block.ecc),
      order = [];
    for (let bit = 0; bit < block.modules.length; bit++) {
      const i = block.modules[bit];
      if (plain[i]) continue;
      const g = gray(source.subarray(i * 3, i * 3 + 3));
      order.push({ i, bit, weight: Math.abs(g - 0.5), rhs: code.dark[i] ^ (g < 0.5 ? 1 : 0) });
    }
    order.sort((a, b) => b.weight - a.weight || a.i - b.i);
    const equations = new Array(last),
      rhsValues = new Uint8Array(last);
    let localRank = 0;
    for (const item of order) {
      const row = rows[item.bit].slice();
      let rhs = item.rhs;
      for (let col = first; col < last; col++) {
        if (!((row[col >>> 5] >>> (col & 31)) & 1)) continue;
        if (equations[col]) {
          for (let j = col >>> 5; j < words; j++) row[j] ^= equations[col][j];
          rhs ^= rhsValues[col];
        } else {
          equations[col] = row;
          rhsValues[col] = rhs;
          localRank++;
          break;
        }
      }
      if (localRank === last - first) break;
    }
    rank += localRank;
    const solution = new Uint32Array(words);
    for (let col = last - 1; col >= first; col--) {
      if (!equations[col]) continue;
      let rhs = rhsValues[col];
      for (let j = col + 1; j < last; j++)
        if (((equations[col][j >>> 5] & solution[j >>> 5]) >>> (j & 31)) & 1) rhs ^= 1;
      if (rhs) solution[col >>> 5] |= 1 << (col & 31);
    }
    for (let col = first; col < last; col++)
      if ((solution[col >>> 5] >>> (col & 31)) & 1)
        data[block.start + (col >>> 3)] ^= 1 << (7 - (col & 7));
  }
  if (!variables) return code;
  const qr = new QrCode(code.version, ECC[code.ecc], data, code.mask),
    dark = new Uint8Array(code.size * code.size);
  for (let y = 0; y < code.size; y++)
    for (let x = 0; x < code.size; x++) {
      let xx = x,
        yy = y;
      for (let turn = 0; turn < (code.rotation || 0); turn++) [xx, yy] = [code.size - 1 - yy, xx];
      dark[yy * code.size + xx] = qr.getModule(x, y) ? 1 : 0;
    }
  return { ...code, dark, padding: { variables, rank, blocks: blockLayout(code).length } };
}
