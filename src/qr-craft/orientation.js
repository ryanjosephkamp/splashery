// Rotate the encoded grid while the source picture stays upright.
import { squareSample } from "./picture.js";
export function rotateGrid(data, n, stride, turns) {
  let out = data;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const next = new data.constructor(data.length);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        for (let c = 0; c < stride; c++)
          next[(x * n + n - 1 - y) * stride + c] = out[(y * n + x) * stride + c];
    out = next;
  }
  return out;
}
export function rotateCode(code, turns) {
  let pieces = code.pieces;
  for (let t = 0; t < turns; t++)
    pieces = pieces.map((p) => ({ ...p, row: p.col, col: code.size - p.row - p.n }));
  return {
    ...code,
    dark: rotateGrid(code.dark, code.size, 1, turns),
    role: rotateGrid(code.role, code.size, 1, turns),
    piece: rotateGrid(code.piece, code.size, 1, turns),
    pieces,
    rotation: turns,
  };
}
export function inversePicture(pic, n, turns) {
  return { w: n, h: n, data: rotateGrid(squareSample(pic, n), n, 3, -turns) };
}
