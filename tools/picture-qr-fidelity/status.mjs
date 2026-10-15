import fs from "node:fs";
const root = ".cache/picture-qr-fidelity";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const before = arg("before", "main-area"),
  after = arg("after", "detail-raw");
const sets = {};
for (const name of [before, after]) {
  sets[name] = fs
    .readdirSync(root)
    .filter((f) => new RegExp(`^${name}-[0-9]+.jsonl$`).test(f))
    .flatMap((f) =>
      fs
        .readFileSync(`${root}/${f}`, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((s) => JSON.parse(s)),
    );
  const rows = sets[name],
    failed = rows.filter((r) => r.scans.some((s) => !s.jsqr || !s.zxingcpp));
  console.log(name, {
    codes: rows.length,
    complete: rows.length === 1040,
    failedCodes: failed.length,
    failedReads: rows.flatMap((r) => r.scans.flatMap((s) => [s.jsqr, s.zxingcpp])).filter((x) => !x)
      .length,
  });
  if (name === after)
    console.log(
      "failures",
      failed.slice(0, 15).map((r) => ({
        key: r.key,
        margin: r.margin,
        fails: r.scans.filter((s) => !s.jsqr || !s.zxingcpp),
      })),
    );
}
const baseline = new Map(sets[before].map((r) => [r.key, r]));
const matched = sets[after].filter((r) => baseline.has(r.key));
for (const scale of ["phone", "print"]) {
  const gains = matched.map((r) => ({
    key: r.key,
    ssim: r.scores[scale].ssim - baseline.get(r.key).scores[scale].ssim,
    rmse: baseline.get(r.key).scores[scale].rmse - r.scores[scale].rmse,
  }));
  console.log(scale, {
    matched: gains.length,
    meanSSIMGain: gains.reduce((s, r) => s + r.ssim, 0) / gains.length,
    worseSSIM: gains.filter((r) => r.ssim <= 0).length,
    worseRMSE: gains.filter((r) => r.rmse <= 0).length,
    worst: gains.sort((a, b) => a.ssim - b.ssim).slice(0, 8),
  });
}
const regressions = [];
for (const r of matched)
  for (const s of r.scans) {
    const b = baseline.get(r.key).scans.find((x) => x.condition === s.condition);
    if ((b.jsqr && !s.jsqr) || (b.zxingcpp && !s.zxingcpp)) regressions.push({ key: r.key, ...s });
  }
console.log("regressions", regressions.length, regressions.slice(0, 8));
