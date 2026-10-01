// Reads a Radiance .hdr file (RGBE, flat or run-length encoded) into linear
// floats: { W, H, data } with three floats per pixel, top row first.

import fs from "node:fs";

export function readHDR(file) {
  const b = fs.readFileSync(file);
  let p = 0;
  const line = () => {
    let s = "";
    while (b[p] !== 10) s += String.fromCharCode(b[p++]);
    p++;
    return s;
  };
  while (line() !== "") {
    // The header ends at an empty line.
  }
  const size = line().split(" ");
  const H = Number(size[1]);
  const W = Number(size[3]);
  const out = new Float32Array(W * H * 3);
  const row = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    if (b[p] === 2 && b[p + 1] === 2) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < W) {
          let n = b[p++];
          if (n > 128) {
            n -= 128;
            const v = b[p++];
            while (n--) row[x++ * 4 + c] = v;
          } else while (n--) row[x++ * 4 + c] = b[p++];
        }
      }
    } else for (let x = 0; x < W * 4; x++) row[x] = b[p++];
    for (let x = 0; x < W; x++) {
      const e = row[x * 4 + 3];
      const f = e ? Math.pow(2, e - 136) : 0;
      for (let c = 0; c < 3; c++) out[(y * W + x) * 3 + c] = row[x * 4 + c] * f;
    }
  }
  return { W, H, data: out };
}

// Writes linear floats ({ W, H, data } as readHDR returns) as a run-length
// encoded Radiance .hdr file.
export function writeHDR(file, { W, H, data }) {
  const parts = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, "latin1")];
  const rgbe = new Uint8Array(W * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      if (m < 1e-32) {
        rgbe.fill(0, x * 4, x * 4 + 4);
        continue;
      }
      const e = Math.ceil(Math.log2(m) + 1e-9);
      const f = 256 / Math.pow(2, e);
      rgbe[x * 4] = Math.min(255, Math.floor(data[i] * f));
      rgbe[x * 4 + 1] = Math.min(255, Math.floor(data[i + 1] * f));
      rgbe[x * 4 + 2] = Math.min(255, Math.floor(data[i + 2] * f));
      rgbe[x * 4 + 3] = e + 128;
    }
    const out = [2, 2, W >> 8, W & 255];
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        // A run of three or more equal bytes, or a literal stretch.
        let run = 1;
        while (x + run < W && run < 127 && rgbe[(x + run) * 4 + c] === rgbe[x * 4 + c]) run++;
        if (run >= 3) {
          out.push(128 + run, rgbe[x * 4 + c]);
          x += run;
          continue;
        }
        let n = 0;
        const start = x;
        while (x < W && n < 128) {
          let r = 1;
          while (x + r < W && r < 3 && rgbe[(x + r) * 4 + c] === rgbe[x * 4 + c]) r++;
          if (r >= 3) break;
          x++;
          n++;
        }
        out.push(n);
        for (let k = start; k < start + n; k++) out.push(rgbe[k * 4 + c]);
      }
    }
    parts.push(Buffer.from(out));
  }
  fs.writeFileSync(file, Buffer.concat(parts));
}
