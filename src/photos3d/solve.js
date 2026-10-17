// MIT. Made by Ryan with Codex (GPT-6). Photo graph policy around the unchanged Splat.js math.
import {
  I3,
  ransacE,
  decomposeE,
  selectPose,
  triangulateN,
  parallaxAngle,
  pnpRansac,
  refinePose,
  reprojError,
  projectPoint,
  makeRng,
} from "../../vendor/splatjs/src/sfm/geometry.js";
import { bundleAdjust } from "../../vendor/splatjs/src/sfm/ba.js";
import { buildTracks, normalized, tick } from "./graph.js";

const VIRTUAL_FOCAL = 960;

// Each observation is mapped through ITS camera's intrinsics to a common virtual sensor.
// Fixed-intrinsics BA then supports portrait images and differing feature dimensions without
// modifying Splat.js's shared-intrinsics optimizer. Only an unknown single-lens group refines f.
export async function solvePhotoGraph(
  frames,
  features,
  edges,
  initialK,
  { signal, unknownFocal = false, onProgress = () => {} } = {},
) {
  const connected = edges.filter((e) => e.accepted);
  if (!connected.length) throw new Error("No geometrically verified photo pair");
  const baseTracks = buildTracks(features, edges);
  const scales = unknownFocal ? [1, 0.8, 0.65, 0.575, 1.16, 1.3] : [1];
  let best = null;
  for (const scale of scales) {
    signal?.throwIfAborted();
    const K = initialK.map((k) => ({ ...k, f: k.f * scale }));
    const candidates = [];
    for (const e of connected) {
      const a = e.matches.map(([f]) => normalized(features[e.i], K[e.i], f));
      const b = e.matches.map(([, f]) => normalized(features[e.j], K[e.j], f));
      const estimate = ransacE(
        a,
        b,
        2.5 / VIRTUAL_FOCAL,
        makeRng(104 + e.i * 7919 + e.j * 104729),
        1200,
      );
      if (!estimate) continue;
      const pose = selectPose(decomposeE(estimate.U, estimate.V), a, b, estimate.inliers);
      if (pose?.goodFrac >= 0.8 && pose.medianAngle > Math.PI / 180)
        candidates.push({
          ...e,
          pose,
          score: estimate.inliers.length * Math.min(0.2, pose.medianAngle),
        });
    }
    candidates.sort((a, b) => b.score - a.score || a.i - b.i || a.j - b.j);
    for (const seed of candidates.slice(0, 3)) {
      signal?.throwIfAborted();
      const localK = K.map((k) => ({ ...k }));
      const xy = (o) => normalized(features[o.img], localK[o.img], o.feat);
      const tracks = baseTracks.map((t) => ({ obs: t.obs, X: null }));
      const poses = new Map([
        [seed.i, { R: Array.from(I3()), t: [0, 0, 0] }],
        [seed.j, { R: Array.from(seed.pose.R), t: [...seed.pose.t] }],
      ]);
      const error = (o, X) => reprojError(poses.get(o.img).R, poses.get(o.img).t, X, xy(o));
      const triangulate = () => {
        for (const track of tracks) {
          const obs = track.obs.filter((o) => poses.has(o.img));
          if (obs.length < 2) continue;
          const cams = obs.map((o) => poses.get(o.img));
          const X = triangulateN(cams, obs.map(xy));
          if (!X || !X.every(Number.isFinite)) continue;
          const good = obs.filter(
            (o) =>
              projectPoint(poses.get(o.img).R, poses.get(o.img).t, X)[2] > 0 &&
              error(o, X) < 3 / VIRTUAL_FOCAL,
          );
          if (good.length < 2) continue;
          const anchor = poses.get(good[0].img);
          if (!good.some((o) => parallaxAngle(anchor, poses.get(o.img), X) > Math.PI / 180))
            continue;
          const refined = triangulateN(
            good.map((o) => poses.get(o.img)),
            good.map(xy),
          );
          if (refined?.every(Number.isFinite)) track.X = refined;
        }
      };
      const adjust = async (iterations) => {
        const reg = [...poses.keys()].sort((a, b) => a - b);
        const camMap = new Map(reg.map((img, i) => [img, i]));
        const selected = tracks.filter((t) => t.X);
        const points = [],
          active = [],
          obs = [];
        for (const track of selected) {
          const valid = track.obs.filter(
            (o) => poses.has(o.img) && error(o, track.X) < 4 / VIRTUAL_FOCAL,
          );
          if (valid.length < 2) continue;
          const pi = points.length;
          points.push([...track.X]);
          active.push(track);
          for (const o of valid) {
            const p = xy(o);
            obs.push({
              ci: camMap.get(o.img),
              pi,
              u: p[0] * VIRTUAL_FOCAL,
              v: p[1] * VIRTUAL_FOCAL,
            });
          }
        }
        if (points.length < 25) return null;
        const cams = reg.map((i) => ({ R: [...poses.get(i).R], t: [...poses.get(i).t] }));
        const result = await bundleAdjust(
          { cams, points, obs, f: VIRTUAL_FOCAL, cx: 0, cy: 0 },
          {
            maxIters: iterations,
            huberPx: 1.5,
            refineF: unknownFocal,
            refineDistortion: false,
            refineAspect: false,
            yieldFn: async () => {
              await tick();
              signal?.throwIfAborted();
            },
          },
        );
        reg.forEach((img, i) => poses.set(img, cams[i]));
        active.forEach((t, i) => {
          t.X = points[i];
        });
        if (unknownFocal) for (const k of localK) k.f *= result.fScale;
        return result;
      };
      triangulate();
      let rms = null;
      for (let pass = 0; pass < 4; pass++) {
        const tried = new Set();
        let added = 0;
        while (poses.size + tried.size < frames.length) {
          signal?.throwIfAborted();
          const support = frames
            .map((_, img) => ({
              img,
              tracks: tracks.filter((t) => t.X && t.obs.some((o) => o.img === img)),
            }))
            .filter((r) => !poses.has(r.img) && !tried.has(r.img))
            .sort((a, b) => b.tracks.length - a.tracks.length || a.img - b.img);
          const row = support[0];
          if (!row || row.tracks.length < 8) break;
          tried.add(row.img);
          const obj = row.tracks.map((t) => t.X);
          const im = row.tracks.map((t) => xy(t.obs.find((o) => o.img === row.img)));
          let pose = null;
          // A poor first DLT sample can terminate the vendored PnP routine early. Independent
          // deterministic attempts keep that numerical failure from permanently omitting a view.
          for (let attempt = 0; attempt < 4; attempt++) {
            const candidate = pnpRansac(
              obj,
              im,
              4 / VIRTUAL_FOCAL,
              makeRng(104 + row.img + 7919 * (attempt + 4 * pass)),
              1000,
            );
            if (candidate && (!pose || candidate.inliers.length > pose.inliers.length))
              pose = candidate;
            if (pose?.inliers.length >= Math.max(8, obj.length * 0.75)) break;
          }
          if (!pose || pose.inliers.length < Math.max(8, obj.length * 0.25)) continue;
          const refined = refinePose(
            pose.R,
            pose.t,
            pose.inliers.map((i) => obj[i]),
            pose.inliers.map((i) => im[i]),
            15,
          );
          poses.set(row.img, { R: Array.from(refined.R), t: [...refined.t] });
          added++;
          triangulate();
          onProgress({
            stage: "register",
            name: frames[row.img].name,
            done: poses.size,
            total: frames.length,
          });
          if (added % 5 === 0) {
            const ba = await adjust(10);
            if (ba) rms = ba.rmsAfter;
          }
          await tick();
        }
        const ba = await adjust(pass === 3 || !added ? 25 : 10);
        if (ba) rms = ba.rmsAfter;
        triangulate();
        if (!added) break;
      }
      const retained = tracks.flatMap((t) => {
        if (!t.X) return [];
        const obs = t.obs.filter(
          (o) =>
            poses.has(o.img) &&
            error(o, t.X) < 3 / VIRTUAL_FOCAL &&
            projectPoint(poses.get(o.img).R, poses.get(o.img).t, t.X)[2] > 0,
        );
        return obs.length >= 2 ? [{ X: t.X, obs }] : [];
      });
      const solution = {
        cams: [...poses]
          .sort(([a], [b]) => a - b)
          .map(([imgIdx, pose]) => ({
            imgIdx,
            name: frames[imgIdx].name,
            ...pose,
            ...localK[imgIdx],
          })),
        tracks: retained,
        points: retained.map((t) => ({ X: [...t.X], rgb: [0.5, 0.5, 0.5], nObs: t.obs.length })),
        features,
        k1: 0,
        k2: 0,
        fFeat: localK[0].f,
        rmsBA: rms,
        calibration: unknownFocal
          ? "single-lens shared focal search, no distortion model"
          : "per-photo EXIF, fixed intrinsics in normalized BA",
      };
      if (
        !best ||
        solution.cams.length > best.cams.length ||
        (solution.cams.length === best.cams.length &&
          (solution.rmsBA ?? Infinity) < (best.rmsBA ?? Infinity))
      )
        best = solution;
      onProgress({
        stage: "trial",
        focalScale: scale,
        cameras: solution.cams.length,
        points: retained.length,
        rmsBA: rms,
      });
      await tick();
    }
  }
  if (!best || best.cams.length < 3 || best.points.length < 8)
    throw new Error(
      "Verified photo graph did not produce three cameras and eight triangulated points",
    );
  return best;
}
