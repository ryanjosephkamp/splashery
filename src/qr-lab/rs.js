// Lane QR lab r2: Reed–Solomon codes over GF(256), as QR codes use them
// (ISO/IEC 18004, section 7.5; Thonky's QR code tutorial, "Error correction
// coding"). The field is GF(2^8) built on the primitive polynomial
// x^8 + x^4 + x^3 + x^2 + 1 (0x11D) with generator α = 2, and a block's
// generator polynomial is (x - α^0)(x - α^1)…(x - α^(n-1)) for n error
// correction codewords.
//
// Encoding divides the data by the generator; decoding finds the errors from
// the syndromes with Berlekamp–Massey, finds where they are with a Chien
// search and how big they are with Forney's formula, then checks that the
// corrected block has no syndrome left. Pure JavaScript, no DOM: the toys, the
// study's tools and the tests all use it.

export const EXP = new Uint8Array(512);
export const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

export const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
export const div = (a, b) => {
  if (!b) throw new Error("Division by zero in GF(256).");
  return a ? EXP[(LOG[a] + 255 - LOG[b]) % 255] : 0;
};
export const pow2 = (e) => EXP[((e % 255) + 255) % 255]; // α^e

// The generator polynomial for n error correction codewords, highest power
// first, its leading 1 included: [1, g1, …, gn].
export function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], pow2(i));
    }
    g = next;
  }
  return g;
}

// The n error correction codewords for a block of data codewords: the
// remainder of data(x)·x^n divided by the generator.
export function eccFor(data, n) {
  const g = generator(n);
  const rem = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < n; i++) rem[i] ^= mul(g[i + 1], f);
  }
  return rem;
}

// A polynomial's value at x; p is highest power first.
function evalHigh(p, x) {
  let y = 0;
  for (const c of p) y = mul(y, x) ^ c;
  return y;
}
// Lowest power first.
function evalLow(p, x) {
  let y = 0;
  for (let i = p.length - 1; i >= 0; i--) y = mul(y, x) ^ p[i];
  return y;
}

// The syndromes S_j = r(α^j), j = 0 … n-1, of a received block (data then
// error correction, the first codeword the highest power). All zero: no error
// (or one the code can't see).
export function syndromes(block, n) {
  const s = new Array(n);
  for (let j = 0; j < n; j++) s[j] = evalHigh(block, pow2(j));
  return s;
}

// Decodes a received block with n error correction codewords. Returns
// { ok, block, errors, syndromes, reason }:
//   ok        the block now has no syndrome left (it was right, or was fixed)
//   block     the corrected codewords (a copy; the input is untouched)
//   errors    [{ index, was, now }]: each codeword it changed
//   reason    why it failed: "too many" (more errors than it can find)
// `limit` caps how many errors it will fix (the standard's capacity for the
// block, say); by default floor(n / 2), the most n codewords can fix.
export function decode(received, n, { limit = Math.floor(n / 2) } = {}) {
  const block = Array.from(received);
  const L = block.length;
  const s = syndromes(block, n);
  if (s.every((v) => v === 0)) return { ok: true, block, errors: [], syndromes: s };
  // Berlekamp–Massey: the shortest error locator Λ(x) (lowest power first)
  // that generates the syndromes.
  let lam = [1];
  let prev = [1];
  let len = 0;
  let shift = 1;
  let b = 1;
  for (let k = 0; k < n; k++) {
    let d = s[k];
    for (let i = 1; i <= len; i++) d ^= mul(lam[i] || 0, s[k - i]);
    if (d === 0) {
      shift++;
      continue;
    }
    const coef = div(d, b);
    const next = lam.slice();
    for (let i = 0; i < prev.length; i++) {
      while (next.length <= i + shift) next.push(0);
      next[i + shift] ^= mul(coef, prev[i]);
    }
    if (2 * len <= k) {
      prev = lam;
      len = k + 1 - len;
      b = d;
      shift = 1;
    } else shift++;
    lam = next;
  }
  while (lam.length > 1 && lam[lam.length - 1] === 0) lam.pop();
  const nErr = lam.length - 1;
  const fail = (reason) => ({ ok: false, block: Array.from(received), errors: [], syndromes: s, reason, found: nErr }); // prettier-ignore
  if (nErr > limit || nErr * 2 > n) return fail("too many");
  // Chien search: codeword i (from the start) is the coefficient of x^(L-1-i),
  // so its locator is X = α^(L-1-i), a root of Λ at X^-1.
  const where = [];
  for (let i = 0; i < L; i++) if (evalLow(lam, pow2(-(L - 1 - i))) === 0) where.push(i);
  if (where.length !== nErr) return fail("too many");
  // Forney: Ω(x) = S(x)Λ(x) mod x^n, and with the first root α^0 an error's
  // size is X·Ω(X^-1) / Λ'(X^-1).
  const omega = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i && j < lam.length; j++) omega[i] ^= mul(lam[j], s[i - j]); // prettier-ignore
  const dlam = []; // the formal derivative: odd powers survive in GF(2^m)
  for (let i = 1; i < lam.length; i++) dlam.push(i & 1 ? lam[i] : 0);
  const errors = [];
  for (const i of where) {
    const X = pow2(L - 1 - i);
    const Xi = pow2(-(L - 1 - i));
    const den = evalLow(dlam, Xi);
    if (!den) return fail("too many");
    const e = mul(X, div(evalLow(omega, Xi), den));
    errors.push({ index: i, was: block[i], now: block[i] ^ e });
    block[i] ^= e;
  }
  if (syndromes(block, n).some((v) => v !== 0)) return fail("too many");
  return { ok: true, block, errors, syndromes: s };
}
