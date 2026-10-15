import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { PNG } from "pngjs";
import { shareCode } from "../../src/qr/share-code.js";
const dir = ".cache/advisor-route-mask/long-link";
const sha = (x) => createHash("sha256").update(x).digest("hex");
const assert = (x, m) => {
  if (!x) throw new Error(m);
};
const read = (n) => fs.readFile(path.join(dir, n));
const json = async (n) => JSON.parse(await read(n));
const inputs = await json("inputs.json");
assert(inputs.length === 50, "inputs count");
assert(new Set(inputs.map((s) => s.createdAt)).size === 50, "timestamps");
assert(
  new Set(inputs.map(({ createdAt, ...s }) => JSON.stringify(s))).size === 1,
  "only timestamp differs",
);
function bundle(file) {
  return fs.readFile(file, "utf8").then((source) => {
    const module = { exports: {} };
    new Function("module", "exports", source)(module, module.exports);
    return module.exports;
  });
}
const J = await bundle("vendor/jsqr/jsQR.js");
const jsqr = J.default || J;
const Z = await bundle("vendor/zxing-js/zxing.min.js");
function decode(img) {
  const pixels = new Uint8ClampedArray(img.data),
    lum = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0; i < lum.length; i++) {
    const j = i * 4;
    lum[i] = (pixels[j] * 306 + pixels[j + 1] * 601 + pixels[j + 2] * 117) >> 10;
  }
  const result = { jsqr: jsqr(pixels, img.width, img.height)?.data ?? null, zxing: null };
  try {
    result.zxing = new Z.QRCodeReader()
      .decode(
        new Z.BinaryBitmap(
          new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, img.width, img.height)),
        ),
        new Map([[Z.DecodeHintType.TRY_HARDER, true]]),
      )
      .getText();
  } catch {}
  return result;
}
const records = {
  before: await json("before-records.json"),
  after: await json("after-records.json"),
};
const totals = {};
let files = 0,
  maxPNG = 0;
for (const phase of ["before", "after"]) {
  assert(records[phase].length === 50, phase + " count");
  const counts = { native: { jsqr: 0, zxing: 0 }, phone: { jsqr: 0, zxing: 0 } };
  for (const r of records[phase]) {
    assert(r.createdAt === inputs[r.i].createdAt, "input timestamp");
    assert(r.sceneSha256 === sha(JSON.stringify(inputs[r.i])), "scene hash");
    const inflated = JSON.parse(
      inflateRawSync(Buffer.from(r.payload.split("#s=d.")[1], "base64url")),
    );
    assert(JSON.stringify(inflated) === JSON.stringify(inputs[r.i]), "actual URL scene");
    const made = shareCode(r.payload);
    assert(made.code.mask === r.defaultMask, "penalty mask");
    assert(made.code.version === 22 && r.version === 22, "version22");
    if (phase === "before") assert(r.export === null, "original export path");
    else {
      assert(r.payload === records.before[r.i].payload, "paired exact payload");
      assert(r.export.ok === true, "new export success");
      const attempts = r.export.attempts;
      assert(attempts.length >= 1 && attempts.length <= 8, "bounded trials");
      assert(new Set(attempts.map((a) => a.mask)).size === attempts.length, "unique masks");
      const last = attempts.at(-1);
      assert(last.mask === r.export.mask, "selected mask");
      assert(
        last.phone.jsqr === r.payload &&
          last.phone.zxing === r.payload &&
          last.native.jsqr === r.payload &&
          last.native.zxing === r.payload,
        "selected independent reads",
      );
    }
    const code = shareCode(r.payload, { mask: phase === "before" ? -1 : r.export.mask }).code;
    for (const size of ["native", "phone"]) {
      const info = r.images[size],
        bytes = await read(info.file),
        image = PNG.sync.read(bytes);
      assert(sha(bytes) === info.sha256 && bytes.length === info.bytes, "PNG hash");
      assert(bytes.length <= 1_000_000, "PNG size limit");
      assert(
        image.width === (size === "native" ? 1130 : 390) && image.width === image.height,
        "image size",
      );
      if (size === "native") {
        for (let y = 0; y < 1130; y++)
          for (let x = 0; x < 1130; x++) {
            const mx = Math.floor(x / 10) - 4,
              my = Math.floor(y / 10) - 4;
            const dark =
              mx >= 0 &&
              my >= 0 &&
              mx < code.size &&
              my < code.size &&
              code.dark[my * code.size + mx];
            const expected = dark ? 0 : 255,
              i = (y * 1130 + x) * 4;
            assert(
              image.data[i] === expected &&
                image.data[i + 1] === expected &&
                image.data[i + 2] === expected &&
                image.data[i + 3] === 255,
              "native pixels match actual selected mask",
            );
          }
      }
      const decoded = decode(image);
      assert(
        JSON.stringify(decoded) === JSON.stringify(info.decoded),
        "independent unassisted decode",
      );
      for (const reader of ["jsqr", "zxing"]) {
        const exact = decoded[reader] === r.payload;
        assert(exact === info.exact[reader], "recorded rate");
        if (exact) counts[size][reader]++;
      }
      files++;
      maxPNG = Math.max(maxPNG, bytes.length);
    }
  }
  totals[phase] = counts;
  const summary = await json(`${phase}-summary.json`);
  assert(JSON.stringify(counts) === JSON.stringify(summary.totals), "summary totals");
  assert(summary.errors.length === 0, "browser errors");
}
const after = records.after;
const result = {
  files,
  maxPNG,
  uniqueTimestamps: 50,
  pairedPayloads: 50,
  onlyCreatedAtDiffers: true,
  independentUnassistedReads: 400,
  allNativeRastersMatchMasks: true,
  totals,
  changedMasks: after.filter((r) => r.export.mask !== r.defaultMask).length,
  maxTrials: Math.max(...after.map((r) => r.export.attempts.length)),
};
await fs.writeFile(
  ".cache/advisor-route-mask/validation.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
