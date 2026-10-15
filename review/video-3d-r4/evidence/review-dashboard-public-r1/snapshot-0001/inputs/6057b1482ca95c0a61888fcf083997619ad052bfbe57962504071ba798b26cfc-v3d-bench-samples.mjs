// MIT. Recheck the fixed task-55 sample inventory through the production viewer.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { fingerprint } from "./v3d-bench-metrics.mjs";

export const SAMPLE_IDS = ["liberty", "edinburgh", "adjara", "lihula", "toolse", "poltsamaa"];
const PROFILES = ["phone", "desktop"];
const key = (r) => `${r.id}/${r.profile}`;

export function assertSampleCase(record, reference = null) {
  if (
    !SAMPLE_IDS.includes(record.id) ||
    !PROFILES.includes(record.profile) ||
    !record.heldOut?.length ||
    new Set(record.heldOut).size !== record.heldOut.length ||
    !record.cams?.length
  )
    throw new Error("Missing or invalid sample held-out inventory.");
  for (const i of record.heldOut)
    if (!Number.isInteger(i) || !Number.isFinite(record.cams[i]?.time))
      throw new Error("Invalid sample held-out camera.");
  if (
    record.tier?.role !== record.profile ||
    record.info?.uid !== record.id ||
    record.info?.stats?.exportedSplats !== record.tier?.splats ||
    !(record.info?.splats > 0)
  )
    throw new Error(`The intended sample tier did not load: ${key(record)}.`);
  if (
    reference &&
    (fingerprint(record.cams) !== fingerprint(reference.cams) ||
      fingerprint(record.heldOut) !== fingerprint(reference.heldOut))
  )
    throw new Error(`Sample camera inventory or times changed: ${key(record)}.`);
}

export function assertSampleInventory(records) {
  const expected = SAMPLE_IDS.flatMap((id) => PROFILES.map((profile) => `${id}/${profile}`));
  if (
    !Array.isArray(records) ||
    records.length !== expected.length ||
    new Set(records.map(key)).size !== expected.length ||
    expected.some((k) => !records.some((r) => key(r) === k))
  )
    throw new Error("Expected all six samples at both profiles.");
  for (const record of records) {
    assertSampleCase(record);
    if (
      record.frames?.length !== record.heldOut.length ||
      record.errors?.length ||
      record.frames.some(
        (f, i) =>
          f.index !== record.heldOut[i] || f.time !== record.cams[f.index].time || !f.sha256,
      )
    )
      throw new Error(`Missing or changed sample frame evidence: ${key(record)}.`);
  }
  return new Map(records.map((r) => [key(r), r]));
}

export function identicalPixels(a, b) {
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    !Buffer.from(a.data).equals(Buffer.from(b.data))
  )
    return false;
  // Two failed, uniformly blank renders must not certify sample preservation.
  let varied = false;
  for (let i = 4; i < a.data.length; i += 4)
    if (a.data[i] !== a.data[0] || a.data[i + 1] !== a.data[1] || a.data[i + 2] !== a.data[2]) {
      varied = true;
      break;
    }
  return varied;
}

export async function checkSamples(outputArg, { url, reference }) {
  const output = path.resolve(outputArg),
    repo = path.resolve(import.meta.dirname, "..");
  if (output === repo || output.startsWith(repo + path.sep))
    throw new Error("Keep sample review media outside the product branch.");
  if (reference && output === path.resolve(reference))
    throw new Error("Do not overwrite the frozen sample reference.");
  fs.mkdirSync(output, { recursive: true });
  if (fs.readdirSync(output).length)
    throw new Error("Use a fresh sample output directory; prior evidence must be preserved.");
  const referenceRecords = reference
    ? JSON.parse(fs.readFileSync(path.join(reference, "samples.json")))
    : null;
  const frozen = referenceRecords ? assertSampleInventory(referenceRecords) : null;
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  if (referenceRecords)
    for (const r of referenceRecords)
      for (const f of r.frames)
        if (
          hash(fs.readFileSync(path.join(reference, `${r.id}-${r.profile}`, `${f.index}.png`))) !==
          f.sha256
        )
          throw new Error(`Frozen sample reference pixels changed: ${key(r)}/${f.index}.`);
  const results = [];
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    for (const id of SAMPLE_IDS)
      for (const profile of PROFILES) {
        const phone = profile === "phone";
        const context = await browser.newContext({
          viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
          deviceScaleFactor: 1,
          isMobile: phone,
          hasTouch: phone,
          ...(phone
            ? {
                userAgent:
                  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
              }
            : {}),
        });
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${url}?labs=1&renderer=webgl2&profile=${phone ? "low" : "high"}`);
        await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 180000 });
        const metadata = await page.evaluate(
          async ({ id, profile }) => {
            const { app, player } = window.__splashery;
            await app.chooseToy("video-3d");
            await app.setToyOptions({ source: id, navigation: "walk" });
            player.opts.idleDelay = 1e9;
            player.idle.weight = 0;
            const meta = await (await fetch(`/assets/toys/video-3d/${id}.json`)).json();
            const manifest = await (
              await fetch(`/assets/toys/video-3d/${id}-baked/manifest.json`)
            ).json();
            const tier = manifest.tiers.find((t) => t.role === profile),
              active = profile === "desktop" ? meta.desktop : meta;
            return {
              cams: active.cams,
              heldOut: active.bake.clarity.heldOut,
              tier: { role: tier?.role, splats: tier?.splats },
              sourcePlySha256: tier?.sourcePlySha256,
              files: tier?.files,
              info: player.proc.ctx.kit.data.video,
            };
          },
          { id, profile },
        );
        const beforeRecord = frozen?.get(`${id}/${profile}`);
        assertSampleCase({ id, profile, ...metadata }, beforeRecord);
        const folder = path.join(output, `${id}-${profile}`);
        fs.mkdirSync(folder, { recursive: true });
        const frames = [],
          camera = metadata.cams[0];
        const width = Math.round((camera.w * 960) / Math.max(camera.w, camera.h)),
          height = Math.round((camera.h * 960) / Math.max(camera.w, camera.h));
        // Candidate camera lists never choose which frozen reference views are evaluated.
        const inventory =
          beforeRecord?.frames ||
          metadata.heldOut.map((index) => ({ index, time: metadata.cams[index].time }));
        for (const { index, time } of inventory) {
          const data = await page.evaluate(
            async ({ time, width, height }) => {
              const { player } = window.__splashery;
              player.stage.setFixedSize([width, height]);
              const k = player.proc.ctx.kit;
              k.data.walk.resumeAt(k.data.flight.path.at(time));
              for (let i = 0; i < 8; i++) await player.stage.captureFrame();
              return (await player.stage.captureFrame()).toDataURL("image/png");
            },
            { time, width, height },
          );
          const bytes = Buffer.from(data.split(",")[1], "base64"),
            decoded = PNG.sync.read(bytes);
          if (!identicalPixels(decoded, decoded))
            throw new Error(`Blank sample render: ${id}/${profile}/${index}.`);
          fs.writeFileSync(path.join(folder, `${index}.png`), bytes);
          const before =
            reference && fs.readFileSync(path.join(reference, `${id}-${profile}`, `${index}.png`));
          frames.push({
            index,
            time,
            sha256: hash(bytes),
            identicalToMain: before ? identicalPixels(decoded, PNG.sync.read(before)) : null,
          });
        }
        const result = {
          id,
          profile,
          browser: browser.version(),
          ...metadata,
          frames,
          errors,
          preserved: reference
            ? frames.length === inventory.length &&
              frames.every((f) => f.identicalToMain) &&
              !errors.length
            : null,
        };
        results.push(result);
        fs.writeFileSync(
          path.join(output, "samples.json"),
          JSON.stringify(results, null, 2) + "\n",
        );
        console.log(
          `${id} ${profile}: ${frames.length} held-out views; preserved=${result.preserved}`,
        );
        await context.close();
      }
  } finally {
    await browser.close();
  }
  assertSampleInventory(results);
  if (reference && results.some((r) => !r.preserved)) throw new Error("A task-55 sample changed.");
}
