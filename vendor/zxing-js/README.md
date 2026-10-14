# ZXing for JavaScript (zxing-js) 0.21.3

A barcode library in TypeScript, ported from ZXing by the ZXing for JS authors (Apache License 2.0,
`LICENSE` beside this file), https://github.com/zxing-js/library, copied unchanged from the npm
package `@zxing/library@0.21.3` (`umd/index.min.js`, 332 KB). It sets `window.ZXing`.

The "Other barcodes" toy (lane QR craft, `src/packs/qr-craft.js`) loads it only when that toy opens,
for its Data Matrix and Aztec writers (`DataMatrixWriter`, `AztecCodeWriter`) and to read its codes
back. Code 128, EAN-13 and UPC-A are drawn by the lane's own code (`src/qr-craft/barcodes.js`).
