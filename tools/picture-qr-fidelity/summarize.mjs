// Publishable evidence comes from captured splats, never the ranking model.
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { LINKS } from "../cdx-circle-study.mjs";
import { CONDITIONS } from "./captures.mjs";
const arg = (key, fallback) =>
  process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = ".cache/picture-qr-fidelity";
const baseline = arg("baseline", "41b21e74");
const names = {
  main: arg("main", "browser-main-all-low"),
  detail: arg("detail", "browser-detail-v4-low"),
};
const corpusFile = arg("corpus", "");
const corpus = corpusFile
  ? JSON.parse(fs.readFileSync(corpusFile))
  : [...SAMPLES, ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json"))];
const shapes = ["square", "circle"],
  scales = ["phone", "print"],
  readers = ["jsqr", "zxingcpp"];
const expected = corpus.flatMap((p) =>
  LINKS.slice(0, 10).flatMap((_, i) => shapes.map((shape) => `${p.id}/${i}/${shape}`)),
);
const sets = {};
for (const [mode, prefix] of Object.entries(names)) {
  const rows = [0, 1].flatMap((shard) => {
    const file = `${root}/${prefix}-${shard}.jsonl`;
    return fs.existsSync(file)
      ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [];
  });
  const map = new Map(rows.map((r) => [r.key, r]));
  if (map.size !== rows.length) throw Error(`Duplicate ${mode} result keys`);
  if (rows.some((r) => !expected.includes(r.key))) throw Error(`Unexpected ${mode} result key`);
  sets[mode] = map;
}
const readAt = (row, condition, reader) =>
  row?.scans?.find((s) => s.condition === condition)?.[reader] === true;
const cases = expected.map((key) => {
  const before = sets.main.get(key),
    after = sets.detail.get(key);
  const regressions = CONDITIONS.flatMap((c) =>
    readers
      .filter((r) => readAt(before, c.id, r) && after && !readAt(after, c.id, r))
      .map((reader) => ({ condition: c.id, reader })),
  );
  const gains = Object.fromEntries(
    scales.map((scale) => [
      scale,
      before?.scores && after?.scores ? after.scores[scale].ssim - before.scores[scale].ssim : null,
    ]),
  );
  return { key, before, after, gains, regressions };
});
const average = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const pictures = corpus.flatMap((p) =>
  shapes.map((shape) => {
    const rows = cases.filter((r) => r.before?.picture === p.id && r.before.shape === shape);
    const matched = rows.filter((r) => r.before?.scores && r.after?.scores);
    const scores = Object.fromEntries(
      scales.map((scale) => [
        scale,
        {
          main: average(matched.map((r) => r.before.scores[scale].ssim)),
          detail: average(matched.map((r) => r.after.scores[scale].ssim)),
          gain: average(matched.map((r) => r.gains[scale])),
          mainRMSE: average(matched.map((r) => r.before.scores[scale].rmse)),
          detailRMSE: average(matched.map((r) => r.after.scores[scale].rmse)),
        },
      ]),
    );
    const whole = matched.filter((r) => r.before.stickerScores && r.after.stickerScores);
    const sticker =
      shape === "circle"
        ? {
            matched: whole.length,
            scores: Object.fromEntries(
              scales.map((scale) => [
                scale,
                {
                  main: average(whole.map((r) => r.before.stickerScores[scale].ssim)),
                  detail: average(whole.map((r) => r.after.stickerScores[scale].ssim)),
                  gain: average(
                    whole.map(
                      (r) => r.after.stickerScores[scale].ssim - r.before.stickerScores[scale].ssim,
                    ),
                  ),
                  mainRMSE: average(whole.map((r) => r.before.stickerScores[scale].rmse)),
                  detailRMSE: average(whole.map((r) => r.after.stickerScores[scale].rmse)),
                },
              ]),
            ),
          }
        : null;
    return { picture: p.id, label: p.label, shape, matched: matched.length, scores, sticker };
  }),
);
const conditions = CONDITIONS.map((c) => ({
  condition: c.id,
  ...Object.fromEntries(
    Object.keys(sets).map((mode) => [
      mode,
      Object.fromEntries(
        readers.map((reader) => [
          reader,
          {
            pass: [...sets[mode].values()].filter((r) => readAt(r, c.id, reader)).length,
            tested: [...sets[mode].values()].filter((r) =>
              r.scans?.some((s) => s.condition === c.id),
            ).length,
          },
        ]),
      ),
    ]),
  ),
}));
const codeSummary = (mode) => {
  const rows = [...sets[mode].values()];
  return {
    codes: rows.length,
    errors: rows.filter((r) => !r.scores).map((r) => ({ key: r.key, error: r.error })),
    failedCodes: rows
      .filter((r) => CONDITIONS.some((c) => readers.some((reader) => !readAt(r, c.id, reader))))
      .map((r) => r.key),
    failedGate: rows
      .filter(
        (r) =>
          r.check?.ok !== true ||
          r.check?.stage?.length !== 2 ||
          !r.check.stage.every((s) => s.ok) ||
          (mode === "detail" && r.check?.stress?.ok !== true),
      )
      .map((r) => r.key),
    fallbacks: rows.filter((r) => r.fallback).map((r) => ({ key: r.key, fallback: r.fallback })),
    missing: expected.filter((key) => !sets[mode].has(key)),
  };
};
const regressions = cases
  .filter((r) => r.regressions.length)
  .map((r) => ({ key: r.key, reads: r.regressions }));
const complete = Object.values(sets).every((set) => expected.every((key) => set.get(key)?.scores));
const detailSummary = codeSummary("detail");
const summary = {
  baseline,
  generated: new Date().toISOString(),
  inputs: names,
  expectedCodes: expected.length,
  expectedReadsPerMode: expected.length * CONDITIONS.length * readers.length,
  complete,
  main: codeSummary("main"),
  detail: detailSummary,
  scanRegressions: regressions,
  fidelity: Object.fromEntries(
    scales.map((scale) => {
      const matched = cases.filter((r) => r.gains[scale] !== null);
      return [
        scale,
        {
          matched: matched.length,
          meanGain: average(matched.map((r) => r.gains[scale])),
          nonImprovingCodes: matched.filter((r) => r.gains[scale] <= 0).map((r) => r.key),
          nonImprovingPictures: pictures
            .filter((p) => p.matched === 10 && p.scores[scale].gain <= 0)
            .map((p) => `${p.picture}/${p.shape}`),
          picturesBelowOnePointGain: pictures
            .filter((p) => p.matched === 10 && p.scores[scale].gain < 0.01)
            .map((p) => `${p.picture}/${p.shape}`),
        },
      ];
    }),
  ),
  pictures,
  conditions,
};
const out = arg("out", `${root}/summary`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
const f = (value) => (value === null ? "—" : value.toFixed(4));
const lines = [
  "| Picture | Shape | Matched payloads | Phone main | Phone detail | Gain | Print main | Print detail | Gain |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...pictures.map(
    (p) =>
      `| ${p.picture} | ${p.shape} | ${p.matched}/10 | ${f(p.scores.phone.main)} | ${f(p.scores.phone.detail)} | ${f(p.scores.phone.gain)} | ${f(p.scores.print.main)} | ${f(p.scores.print.detail)} | ${f(p.scores.print.gain)} |`,
  ),
  "",
  "| Condition | Main jsQR | Detail jsQR | Main zxing-cpp | Detail zxing-cpp |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...conditions.map(
    (c) =>
      `| ${c.condition} | ${c.main.jsqr.pass}/${c.main.jsqr.tested} | ${c.detail.jsqr.pass}/${c.detail.jsqr.tested} | ${c.main.zxingcpp.pass}/${c.main.zxingcpp.tested} | ${c.detail.zxingcpp.pass}/${c.detail.zxingcpp.tested} |`,
  ),
];
lines.push(
  "",
  "Circle complete-sticker scores are secondary: they include the photo band and quiet square; pixels outside the disk are white in both images.",
  "",
  "| Picture | Matched payloads | Phone main | Phone detail | Gain | Print main | Print detail | Gain |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...pictures
    .filter((p) => p.sticker)
    .map(
      (p) =>
        `| ${p.picture} | ${p.sticker.matched}/10 | ${f(p.sticker.scores.phone.main)} | ${f(p.sticker.scores.phone.detail)} | ${f(p.sticker.scores.phone.gain)} | ${f(p.sticker.scores.print.main)} | ${f(p.sticker.scores.print.detail)} | ${f(p.sticker.scores.print.gain)} |`,
    ),
);
fs.writeFileSync(path.join(out, "tables.md"), lines.join("\n") + "\n");
// Per-code values expose losses that picture means can otherwise obscure.
const csvColumns = [
  "key",
  ...scales.flatMap((scale) => [
    `${scale}MainSSIM`,
    `${scale}DetailSSIM`,
    `${scale}Gain`,
    `${scale}MainRMSE`,
    `${scale}DetailRMSE`,
  ]),
  ...readers.flatMap((reader) => [`main${reader}Passes`, `detail${reader}Passes`]),
];
const csvRows = cases.map((row) => [
  row.key,
  ...scales.flatMap((scale) => [
    row.before?.scores?.[scale]?.ssim ?? "",
    row.after?.scores?.[scale]?.ssim ?? "",
    row.gains[scale] ?? "",
    row.before?.scores?.[scale]?.rmse ?? "",
    row.after?.scores?.[scale]?.rmse ?? "",
  ]),
  ...readers.flatMap((reader) => [
    CONDITIONS.filter((c) => readAt(row.before, c.id, reader)).length,
    CONDITIONS.filter((c) => readAt(row.after, c.id, reader)).length,
  ]),
]);
fs.writeFileSync(
  path.join(out, "per-code.csv"),
  [csvColumns, ...csvRows].map((row) => row.join(",")).join("\n") + "\n",
);
if (arg("bundle", "0") === "1") {
  for (const [mode, set] of Object.entries(sets))
    fs.writeFileSync(
      path.join(out, `${mode}-rendered.jsonl.gz`),
      gzipSync([...set.values()].map(JSON.stringify).join("\n") + "\n"),
    );
  const sources = fs
    .readdirSync("src/qr-craft")
    .map((name) => `src/qr-craft/${name}`)
    .concat([
      "src/packs/qr-craft.js",
      "src/qr/picture-padding.js",
      "src/qr/picture-errors.js",
      "src/qr/circle.js",
      "src/player.js",
      "src/stage.js",
      "src/photo-splats.js",
      "src/qr-craft/vendor/zxing/reader/index.js",
      "src/qr-craft/vendor/zxing/reader/zxing_reader.wasm",
      "tools/qrs-study/readers.mjs",
      "vendor/jsqr/jsQR.js",
      ...corpus.map((p) => p.file),
      ...fs
        .readdirSync("tools/picture-qr-fidelity")
        .filter((name) => /\.(mjs|json)$/.test(name))
        .map((name) => `tools/picture-qr-fidelity/${name}`),
    ]);
  const hashes = Object.fromEntries(
    sources
      .filter((file) => fs.statSync(file).isFile())
      .sort()
      .map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")]),
  );
  fs.writeFileSync(
    path.join(out, "provenance.json"),
    JSON.stringify({ baseline, hashes }, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify(
    {
      complete,
      codes: { main: sets.main.size, detail: sets.detail.size },
      failedDetailCodes: detailSummary.failedCodes.length,
      failedDetailGates: detailSummary.failedGate.length,
      regressions: regressions.length,
      fidelity: summary.fidelity,
    },
    null,
    2,
  ),
);
