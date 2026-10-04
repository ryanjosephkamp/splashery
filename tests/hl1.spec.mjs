// Codex task 12: Level 1 receipts from the real player and HandsOn world.
// Run the 40-toy regression sample normally, or HL1_ALL=1 for the strict
// whole shelf audit. Measurements are attached even when the audit fails.
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TOYS } from "../src/toys.js";

const ALL = process.env.HL1_ALL === "1";
// These checks use engine receipts. Avoid expensive failure screenshots
// and traces for a complete shelf; the JSON attachment is the evidence.
test.use({ screenshot: "off", trace: "off" });
const SAMPLE = [
  "cactus",
  "strawberry",
  "marble-bust",
  "cookie",
  "heart-donut",
  "mushroom", // lane Hands engine C: the jelly blob stretches in Hands-on, so it is never lifted whole
  "knot",
  "basketball",
  "bowling-ball",
  "medicine-ball",
  "bouncy-ball",
  "hockey-puck",
  "planet",
  "virus",
  "bacterium",
  "atom",
  "diamond",
  "heart",
  "oak",
  "campfire",
  "cupcake",
  "teddy-bear",
  "chest",
  "running-shoe",
  "shield",
  "jellyfish",
  "lorenz",
  "neural-network",
  "picture-frame",
  "song-landscape",
  "splat-field",
  "galaxy-box",
  "snowman",
  "drum",
  "bus",
  "eiffel-tower",
  "watermelon",
  "beach-ball",
  "waterfall",
  "solar-system",
];

// The picture shelf explicitly disables Hands-on on the audited main.
// This exact capability gap is tracked, not counted as successful Level 1.
// All mode has no exceptions; delete this entry when the lane fixes it.
const KNOWN = { "picture-frame": ["unavailable"] };
const selected = ALL ? TOYS : SAMPLE.map((id) => TOYS.find((t) => t.id === id));

test("the Level 1 sample covers every shelf and material family", () => {
  expect(SAMPLE).toHaveLength(40);
  expect(new Set(SAMPLE).size).toBe(SAMPLE.length);
  expect(selected.every(Boolean)).toBe(true);
  expect([...new Set(TOYS.map((t) => t.category))].sort()).toEqual(
    [...new Set(SAMPLE.map((id) => TOYS.find((t) => t.id === id)?.category))].sort(),
  );
  for (const kind of ["captured", "kit", "procedural"])
    expect(SAMPLE.some((id) => TOYS.find((t) => t.id === id)?.kind === kind)).toBe(true);
});

test("Hands-on: lift, toss, land, settle and Reset", async ({ page }, testInfo) => {
  test.setTimeout(180_000 + selected.length * 30_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const startupErrors = errors.splice(0);
  const rows = [];
  for (const toy of selected) {
    await test.step(`${toy.category}: ${toy.id}`, async () => {
      const row = { id: toy.id, category: toy.category, kind: toy.kind, labs: !!toy.labs };
      try {
        await page.evaluate(
          async ({ id, camera }) => {
            const { app, player } = window.__splashery;
            player.setPaused(false);
            await app.chooseToy(id);
            if (player.toyInfo?.id !== id)
              throw new Error(`Requested ${id}, loaded ${player.toyInfo?.id}`);
            player.opts.idleDelay = 1e9;
            player.camera.turntable = false;
            player.camera.follow = [0, 0, 0];
            // Shelf changes normally ease from the previous view. Snap to
            // this toy's default before computing the center pick ray.
            player.camera.setState(camera, { asHome: true, snap: true });
            player.update(1 / 60);
            player.setPaused(true);
            player.stage.requestRender();
          },
          { id: toy.id, camera: toy.camera },
        );
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        Object.assign(
          row,
          await page.evaluate(async () => {
            const { app, player } = window.__splashery;
            const h = player.handsOn;
            const info = player.toyInfo;
            const issues = [];
            if (!h.on) app.toggleHands();
            const capability = { on: h.on, own: h.own, canGrab: h.canGrab() };
            if (!h.on) return { capability, issues: ["unavailable"] };
            if (!h.canGrab()) return { capability, issues: ["own-controls"] };

            // Use the GPU pick at the projected center, as phy-engine does.
            // A center miss is a pickup failure. Continue diagnostically
            // with a center press, as phy-engine's grab test does, so the
            // floor and Reset measurements are still available.
            const c = player.stage.toScreen(info.center);
            player.pickDirty = true;
            const picked = await player.pickAt(c[0], c[1]);
            if (!picked) issues.push("center-miss");
            const hit = picked || info.center.slice();
            player.setPaused(true); // no render-loop time between manual steps
            const tick = () => h.step(1 / 60);
            const advance = (n) => {
              for (let i = 0; i < n; i++) tick();
            };
            if (!h.pressAt(hit, ...c)) return { capability, issues: ["press-rejected"] };
            h.moveTo(c[0], c[1] - 30);
            if (!h.hold || h.mode !== "toy")
              return { capability, mode: h.mode, issues: ["whole-pickup"] };
            const b = h.body;
            const w = h.world;
            const R = h.R();
            const floor = w.planes[0];
            const rotate = (q, v) => {
              const [x, y, z, s] = q;
              const cx = y * v[2] - z * v[1] + s * v[0];
              const cy = z * v[0] - x * v[2] + s * v[1];
              const cz = x * v[1] - y * v[0] + s * v[2];
              return [
                v[0] + 2 * (y * cz - z * cy),
                v[1] + 2 * (z * cx - x * cz),
                v[2] + 2 * (x * cy - y * cx),
              ];
            };
            const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
            const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
            const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(dot(a, b))));
            // Independent exterior check: sampled rendered splat centers in
            // body-local coordinates, not the collision points' own bounds.
            const res = player.stage.toy.entity.gsplat.resource;
            const count = Math.min(res.numSplats, Math.floor(res.centers.length / 3));
            const exterior = [];
            for (let i = 0, n = Math.min(count, 6000); i < n; i++) {
              const j = Math.floor((i * count) / n) * 3;
              exterior.push(
                b.toLocal(player.stage.modelToWorld(Array.from(res.centers.slice(j, j + 3)))),
              );
            }
            const gap = (plane) => {
              // Minimum signed clearance of the complete collision shape.
              const localN = rotate([-b.q[0], -b.q[1], -b.q[2], b.q[3]], plane.n);
              let extent = 0;
              if (b.solid?.type === "sphere") extent = b.solid.r;
              else if (b.solid?.type === "ellipsoid")
                extent = Math.hypot(...localN.map((v, i) => v * b.solid.r[i]));
              else if (b.solid?.type === "box")
                extent = localN.reduce((sum, v, i) => sum + Math.abs(v) * b.solid.half[i], 0);
              else if (b.solid?.type === "cylinder")
                extent =
                  b.solid.r * Math.hypot(localN[0], localN[2]) + b.solid.h * Math.abs(localN[1]);
              const points = b.points.length
                ? Math.min(...b.points.map((p) => dot(localN, p))) - b.radius
                : -extent;
              return (dot(plane.n, b.pos) - plane.d + Math.min(-extent, points)) / R;
            };
            let minFloor = Infinity,
              minWall = Infinity,
              finite = true;
            const observe = () => {
              finite &&= [...b.pos, ...b.q, ...b.vel, ...b.omega].every(Number.isFinite);
              minFloor = Math.min(minFloor, gap(floor));
              for (const pl of w.planes.slice(1)) minWall = Math.min(minWall, gap(pl));
            };
            // Observe after every XPBD substep, including while held.
            const substep = w.substep;
            w.substep = function (dt) {
              substep.call(this, dt);
              observe();
            };
            try {
              const startY = b.pos[1];
              for (let i = 1; i <= 16; i++) {
                h.moveTo(c[0], c[1] - 30 - 6 * i);
                advance(3);
              }
              advance(18);
              const lift = (b.pos[1] - startY) / R;
              if (lift < 0.15) issues.push("lift");
              for (let i = 1; i <= 6; i++) {
                h.moveTo(c[0] + 12 * i, c[1] - 126);
                tick();
              }
              const released = h.release();
              const throwR = Math.hypot(b.vel[0], b.vel[2]) / R;
              if (!released || h.holding || throwR < 0.4) issues.push("sideways-throw");
              let land = null,
                sleep = null,
                squish = 0,
                bounce = 0;
              const tail = [];
              for (let i = 1; i <= 480; i++) {
                tick();
                const t = i / 60;
                if (land === null && gap(floor) <= 0.01) land = t;
                if (sleep === null && w.asleep) sleep = t;
                if (land !== null) bounce = Math.max(bounce, b.vel[1] / R);
                squish = Math.max(squish, Math.abs(h.squishUniforms()?.amount ?? 0));
                if (i > 450) tail.push({ p: b.pos.slice(), q: b.q.slice() });
              }
              const jitterR = Math.max(...tail.map((x) => distance(x.p, tail[0].p) / R));
              const jitterAngle = Math.max(...tail.map((x) => angle(x.q, tail[0].q)));
              const ys = exterior.map((p) => b.toWorld(p)[1] - floor.d).sort((a, b) => a - b);
              const exteriorGapR = ys[Math.floor(ys.length * 0.005)] / R;
              const restGapR = gap(floor);
              if (land === null || land > 4) issues.push("land");
              if (sleep === null || jitterR > 0.01 || jitterAngle > 0.02) issues.push("settle");
              if (!finite) issues.push("finite");
              if (minFloor < -0.01 - 1e-6) issues.push("floor");
              if (minWall < -0.01 - 1e-6) issues.push("stage");
              if (restGapR < -0.01 || restGapR > 0.03 || exteriorGapR < -0.05 || exteriorGapR > 0.1)
                issues.push("rest-height");
              if (h.soft > 0 && squish < 0.005) issues.push("squish");
              const heightR = (b.pos[1] - floor.d) / R;
              app.resetHands(); // same handler as the Reset button
              let reset = null;
              for (let i = 1; i <= 120; i++) {
                tick();
                if (
                  reset === null &&
                  !h.moved &&
                  distance(b.pos, b.home.pos) / R < 0.001 &&
                  angle(b.q, b.home.q) < 0.001
                )
                  reset = i / 60;
              }
              const resetR = distance(b.pos, b.home.pos) / R;
              const resetAngle = angle(b.q, b.home.q);
              const poseCleared = !player.stage.toy.entity.spBase;
              if (reset === null || resetR >= 0.001 || resetAngle >= 0.001 || !poseCleared)
                issues.push("reset");
              return {
                capability,
                picked: !!picked,
                mode: h.mode,
                R,
                lift,
                throwR,
                land,
                sleep,
                minFloor,
                minWall,
                heightR,
                restGapR,
                exteriorGapR,
                jitterR,
                jitterAngle,
                soft: h.soft,
                mass: 1 / b.invMass,
                squish,
                bounce,
                reset,
                resetR,
                resetAngle,
                poseCleared,
                issues,
              };
            } finally {
              w.substep = substep;
            }
          }),
        );
      } catch (e) {
        row.issues = ["load-or-measurement"];
        row.error = e.message;
      } finally {
        row.errors = errors.splice(0);
        if (row.errors.length) row.issues.push("console");
        rows.push(row);
      }
    });
  }
  const receipt = testInfo.outputPath("hl1-measurements.json");
  await writeFile(
    receipt,
    JSON.stringify(
      { all: ALL, viewport: [390, 844], profile: "mid", renderer: "webgl2", startupErrors, rows },
      null,
      2,
    ),
  );
  await testInfo.attach("hl1-measurements", {
    path: receipt,
    contentType: "application/json",
  });
  console.log(
    `HL1: ${rows.length} toys, ${rows.filter((r) => r.issues.length).length} with Level 1 gaps`,
  );
  const failures = rows.flatMap((row) => {
    const expected = ALL ? [] : KNOWN[row.id] || [];
    return JSON.stringify(row.issues.slice().sort()) === JSON.stringify(expected.slice().sort())
      ? []
      : [`${row.id}: ${row.issues.join(", ")} (expected ${expected.join(", ") || "no gaps"})`];
  });
  expect(startupErrors).toEqual([]);
  expect(failures, "Level 1 gaps; full receipts are attached").toEqual([]);
});
