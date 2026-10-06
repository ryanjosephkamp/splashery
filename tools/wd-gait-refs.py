#!/usr/bin/env python3
# Builds the character lab's reference gait (docs/WORLDS.md, "The character
# lab"): measured human joint angles over one stride, walking and running, as
# means and standard deviations, so the lab can draw them beside the
# character's own and a clip can show the match.
#
#   assets/worlds/lab/gait-reference.json
#
# Sources (numbers are facts; the datasets are CC BY 4.0, credited in
# CREDITS.md):
#   - Walking: Fukuchi, Fukuchi and Duarte (2018), "A public dataset of
#     overground and treadmill walking kinematics and kinetics in healthy
#     individuals", PeerJ 6:e4640; data on figshare (doi 10.6084/m9.figshare.
#     5722711), CC BY 4.0. Treadmill trials nearest 1.3 m/s, joint angles
#     (Visual3D, sagittal = Z) normalized to 101 points from heel strike.
#   - Running: Fukuchi, Fukuchi and Duarte (2017), "A public dataset of
#     running biomechanics and the effects of running speed on lower
#     extremity kinematics and kinetics", PeerJ 5:e3298; data on figshare
#     (doi 10.6084/m9.figshare.4543435), CC BY 4.0. The 2.5 m/s trials'
#     processed angles (101 points from foot strike) and, for the pelvis's
#     bob and sway, the markers of the first twelve runners.
#   - Arms and the walking pelvis, published values:
#     Kang et al. (2023), Clin Shoulder Elb 26(2):126-130 (treadmill walking
#     at 1.11 m/s: shoulder flexion-extension range 56.4 +/- 12.7 degrees,
#     elbow 29.7 +/- 10.2 degrees);
#     Tartaruga et al., cited in Wilk et al. (2024), Shoulder & Elbow 17(6):
#     825-830 (running: elbow range 38.8 +/- 12.6 degrees);
#     Pontzer et al. (2009), J Exp Biol 212:523-534 (shoulder rotation 8
#     degrees walking at 1.5 m/s, 24 running at 3 m/s; the arms swing
#     opposite the legs);
#     Orendurff et al. (2004), J Rehabil Res Dev 41(6A):829-834 (center of
#     mass: vertical 4.0-4.8 cm and side to side 3.9-4.6 cm at 1.2-1.6 m/s).
#
#   python3 tools/wd-gait-refs.py   (numpy; the data in .cache/worlds/r4/)

import csv
import collections
import glob
import json
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache/worlds/r4")
OUT = os.path.join(ROOT, "assets/worlds/lab/gait-reference.json")
STEP = 2  # every 2% of the stride (51 samples)


def table(path):
    rows = open(path).read().strip().split("\n")
    head = rows[0].split("\t")
    a = np.array([[float(x) if x not in ("", "NaN") else np.nan for x in r.split("\t")] for r in rows[1:]])
    return dict(zip(head, a.T)), a.shape[0]


def stats(curves):
    c = np.array(curves)
    return {"mean": np.round(np.nanmean(c, 0)[::STEP], 1).tolist(), "sd": np.round(np.nanstd(c, 0)[::STEP], 1).tolist()}


def walking():
    info = list(csv.DictReader(open(os.path.join(CACHE, "WBDSinfo.csv"))))
    by = collections.defaultdict(list)
    for r in info:
        fn, v = r["FileName"], r["GaitSpeed(m/s)"]
        if "walkT" in fn and fn.endswith("ang.txt") and v != "--":
            by[fn[:6]].append((abs(float(v) - 1.3), fn, float(v)))
    picked = [min(l) for l in by.values() if l]
    curves = collections.defaultdict(list)
    speeds = []
    for _, fn, v in picked:
        d, n = table(os.path.join(CACHE, "wbds/51subjs", fn))
        if n != 101:
            continue
        speeds.append(v)
        for side in "RL":
            curves["hip"].append(d[f"{side}HipAngleZ"])
            curves["knee"].append(d[f"{side}KneeAngleZ"])
            curves["ankle"].append(d[f"{side}AnkleAngleZ"])
    return {k: stats(v) for k, v in curves.items()}, len(speeds), float(np.mean(speeds))


def running():
    curves = collections.defaultdict(list)
    n = 0
    for f in sorted(glob.glob(os.path.join(CACHE, "rbds/RBDS0*processed.txt"))):
        d, rows = table(f)
        if rows != 101 or "RhipAngZ25" not in d:
            continue
        n += 1
        for side in "RL":
            curves["hip"].append(d[f"{side}hipAngZ25"])
            curves["knee"].append(d[f"{side}kneeAngZ25"])
            curves["ankle"].append(d[f"{side}ankleAngZ25"])
    # The pelvis's bob and sway, from the markers (2-second detrend; the
    # 3rd to 97th percentile range).
    bob, sway = [], []
    for f in sorted(glob.glob(os.path.join(CACHE, "rbds/RBDS0*runT25markers.txt"))):
        d, _ = table(f)
        t = d["Time"]
        dt = float(np.nanmedian(np.diff(t)))
        w = int(2 / dt)
        cen = {ax: np.nanmean(np.stack([d[f"{m}{ax}"] for m in ("R.ASIS", "L.ASIS", "R.PSIS", "L.PSIS")]), 0) for ax in "YZ"}
        for ax, out in (("Y", bob), ("Z", sway)):
            x = cen[ax] - np.convolve(cen[ax], np.ones(w) / w, "same")
            x = x[w:-w]
            out.append(float(np.nanpercentile(x, 97) - np.nanpercentile(x, 3)) / 10)
    return {k: stats(v) for k, v in curves.items()}, n, (float(np.mean(bob)), float(np.mean(sway)), len(bob))


def main():
    walk, nw, vw = walking()
    run, nr, (bob, sway, nm) = running()
    ref = {
        "about": "Measured human gait for the character lab (tools/wd-gait-refs.py): sagittal joint angles in degrees over one stride (0 = this leg's heel or foot strike), every 2%, mean and standard deviation; positive is flexion (hip, knee) and dorsiflexion (ankle). Arms and the walking pelvis are published values.",
        "walk": {
            "speed": round(vw, 2),
            "subjects": nw,
            "toeOff": 62,
            "joints": walk,
            "pelvis": {"bobCm": [4.0, 4.8], "swayCm": [3.9, 4.6]},
            "arms": {"shoulderRange": [56.4, 12.7], "elbowRange": [29.7, 10.2], "shoulderRotation": 8.1},
            "source": "Fukuchi et al. 2018, PeerJ 6:e4640 (CC BY 4.0); Orendurff et al. 2004; Kang et al. 2023; Pontzer et al. 2009",
        },
        "run": {
            "speed": 2.5,
            "subjects": nr,
            "toeOff": 40,
            "joints": run,
            "pelvis": {"bobCm": round(bob, 1), "swayCm": round(sway, 1), "subjects": nm},
            "arms": {"elbowRange": [38.8, 12.6], "shoulderRotation": 23.8},
            "source": "Fukuchi et al. 2017, PeerJ 5:e3298 (CC BY 4.0); Wilk et al. 2024 citing Tartaruga et al.; Pontzer et al. 2009",
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(ref, f, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {OUT}: walking {nw} subjects at {vw:.2f} m/s, running {nr} at 2.5 m/s, pelvis bob {bob:.1f} cm, sway {sway:.1f} cm")


if __name__ == "__main__":
    main()
