// An MP3's frames (lane Live input r2), so a long song can be decoded for
// measuring in pieces cut exactly between frames: the page then never waits
// on one long decode. Pure functions, used by song-stream.js and the tests.

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG-2 and 2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// The frame header at byte i: { length, rate, samples } or null.
function header(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 3; // 3 MPEG-1, 2 MPEG-2, 0 MPEG-2.5
  const layer = (b[i + 1] >> 1) & 3; // 1 Layer III
  const bi = (b[i + 2] >> 4) & 15;
  const ri = (b[i + 2] >> 2) & 3;
  if (version === 1 || layer !== 1 || bi === 0 || bi === 15 || ri === 3) return null;
  const rate = RATES[version][ri];
  const kbps = BITRATES[version === 3 ? 1 : 2][bi];
  const pad = (b[i + 2] >> 1) & 1;
  const one = version === 3;
  return {
    length: Math.floor(((one ? 144000 : 72000) * kbps) / rate) + pad,
    rate,
    samples: one ? 1152 : 576,
  };
}

// The byte where each frame starts (an ID3v2 tag skipped), and the frames'
// sample rate and samples per frame; null if the bytes aren't a plain MP3
// (other formats are decoded whole).
export function mp3Frames(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    const size = ((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127);
    i = 10 + size + (b[5] & 0x10 ? 10 : 0);
  }
  const start = i;
  const offsets = [];
  let rate = 0;
  let samples = 0;
  let covered = 0;
  while (i < b.length - 4) {
    const h = header(b, i);
    // A frame counts when the next one follows it (or the file ends there).
    const next = h && (i + h.length >= b.length - 4 || header(b, i + h.length));
    if (!h || !next || (rate && (h.rate !== rate || h.samples !== samples))) {
      i++;
      continue;
    }
    rate = h.rate;
    samples = h.samples;
    offsets.push(i);
    covered += h.length;
    i += h.length;
  }
  if (offsets.length < 10 || covered < 0.9 * (b.length - start)) return null;
  return { offsets, rate, samples, end: b.length };
}
