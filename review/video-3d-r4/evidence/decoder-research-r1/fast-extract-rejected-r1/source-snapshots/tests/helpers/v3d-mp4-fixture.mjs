// MIT. Original CC0 container bytes, made by Ryan with Codex (GPT-6). No actual video decoder.
const U = (...xs) => {
    const b = Buffer.alloc(xs.length * 4);
    xs.forEach((x, i) => b.writeUInt32BE(x >>> 0, i * 4));
    return b;
  },
  I = (xs) => U(...xs),
  box = (t, ...parts) => {
    const data = Buffer.concat(parts);
    return Buffer.concat([U(data.length + 8), Buffer.from(t), data]);
  },
  full = (t, ...parts) => box(t, U(0), ...parts);
export function fixture({
  cttsVersion = 0,
  co64 = false,
  edit = true,
  pasp = [1, 1],
  displayWidth = 96,
  displayHeight = 64,
  colrPayload = null,
  rotate = false,
  fragmented = false,
  encrypted = false,
  stss = true,
  zeroLast = false,
} = {}) {
  const ftyp = box("ftyp", Buffer.from("isom"), U(512), Buffer.from("isomavc1")),
    mdat = box("mdat", Buffer.from("abcdefghijkl")),
    off = ftyp.length + 8;
  const mvhd = full("mvhd", U(0, 0, 1000, 50)),
    tk = Buffer.alloc(84);
  tk[3] = 3;
  I([65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]).copy(tk, 40);
  tk.writeUInt32BE(Math.floor(displayWidth * 65536), 76);
  tk.writeUInt32BE(Math.floor(displayHeight * 65536), 80);
  if (rotate) tk.writeUInt32BE(1, 44);
  const tkhd = box("tkhd", tk),
    mdhd = full("mdhd", U(0, 0, 1000, zeroLast ? 30 : 50)),
    hdlr = full("hdlr", U(0), Buffer.from("vide"), Buffer.alloc(12)),
    entry = Buffer.alloc(78);
  entry.writeUInt16BE(1, 6);
  entry.writeUInt16BE(96, 24);
  entry.writeUInt16BE(64, 26);
  const avcc = box("avcC", Buffer.from([1, 100, 0, 31, 255, 225, 0, 1, 103, 1, 0, 1, 104]));
  const stsd = full(
      "stsd",
      U(1),
      box(
        encrypted ? "encv" : "avc1",
        entry,
        avcc,
        ...(pasp ? [box("pasp", U(...pasp))] : []),
        ...(colrPayload ? [box("colr", colrPayload)] : []),
      ),
    ),
    stsz = full("stsz", U(0, 3, 3, 4, 5)),
    stts = full("stts", zeroLast ? U(3, 1, 10, 1, 20, 1, 0) : U(2, 1, 10, 2, 20)),
    ctts = box(
      "ctts",
      U(cttsVersion << 24),
      cttsVersion === 1 ? U(3, 1, 0, 1, 20, 1, -10) : U(3, 1, 20, 1, 30, 1, 0),
    ),
    stsc = full("stsc", U(2, 1, 2, 1, 2, 1, 1));
  let chunks;
  if (co64) {
    const p = Buffer.alloc(16);
    p.writeBigUInt64BE(BigInt(off), 0);
    p.writeBigUInt64BE(BigInt(off + 7), 8);
    chunks = full("co64", U(2), p);
  } else chunks = full("stco", U(2, off, off + 7));
  const sync = stss ? [full("stss", U(1, 1))] : [],
    stbl = box("stbl", stsd, stsz, stts, ctts, stsc, chunks, ...sync),
    mdia = box("mdia", mdhd, hdlr, box("minf", stbl)),
    ed = edit ? [box("edts", full("elst", U(1, 50, cttsVersion === 1 ? 0 : 20, 65536)))] : [];
  return Buffer.concat([
    ftyp,
    mdat,
    box("moov", mvhd, box("trak", tkhd, ...ed, mdia), ...(fragmented ? [box("mvex")] : [])),
  ]);
}
export { box };
