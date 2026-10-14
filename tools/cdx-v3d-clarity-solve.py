#!/usr/bin/env python3
"""MIT. Offline COLMAP solve at the frozen source timestamps.

Install pycolmap==4.2.1, then run: <scratch> <id> [--reuse]
Held-out photographs contribute camera features, never Gaussian seed colors or fitting targets.
The solve uses its own world coordinates; it does not move images to improve an evaluation score.
"""
import argparse
import hashlib
import json
from pathlib import Path

import pycolmap

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("scratch", type=Path)
parser.add_argument("id")
parser.add_argument("--reuse", action="store_true")
args = parser.parse_args()
if pycolmap.__version__ != "4.2.1":
    raise RuntimeError("Use the recorded COLMAP 4.2.1 bindings.")
folder = args.scratch.resolve() / args.id
meta = json.loads((folder / "main.json").read_text())
images = folder / "frames"
for camera in meta["cams"]:
    if hashlib.sha256((images / camera["frame"]).read_bytes()).hexdigest() != camera["frameSha256"]:
        raise RuntimeError("Changed frozen photograph.")
out = folder / "sfm-native"
database = out / "database.db"
models = out / "models"
if not args.reuse:
    if database.exists():
        raise RuntimeError("Refusing to overwrite a solve. Use --reuse to export its existing model.")
    models.mkdir(parents=True)
    first = meta["cams"][0]
    scale = 960 / max(first["w"], first["h"])
    reader = pycolmap.ImageReaderOptions()
    reader.camera_model = "SIMPLE_PINHOLE"
    reader.camera_params = f'{first["f"] * scale},{first["w"] * scale / 2},{first["h"] * scale / 2}'
    features = pycolmap.FeatureExtractionOptions()
    features.num_threads = 1
    features.sift.max_num_features = 4096
    pycolmap.extract_features(database, images, image_names=[c["frame"] for c in meta["cams"]],
                             camera_mode=pycolmap.CameraMode.SINGLE, reader_options=reader,
                             extraction_options=features, device=pycolmap.Device.cpu)
    matching = pycolmap.FeatureMatchingOptions()
    matching.num_threads = 1
    pairing = pycolmap.SequentialPairingOptions()
    pairing.overlap = 8
    pycolmap.match_sequential(database, matching_options=matching, pairing_options=pairing,
                             device=pycolmap.Device.cpu)
    options = pycolmap.IncrementalPipelineOptions()
    options.num_threads = 1
    options.random_seed = 55
    options.mapper.init_min_tri_angle = 4
    options.mapper.abs_pose_max_error = 4
    pycolmap.incremental_mapping(database, images, models, options=options)
reconstructions = [pycolmap.Reconstruction(p) for p in models.iterdir() if p.is_dir()]
reconstruction = max(reconstructions, key=lambda r: len(r.images))
by_name = {im.name: im for im in reconstruction.images.values()}
if any(c["frame"] not in by_name for c in meta["cams"]):
    raise RuntimeError("Every frozen camera must register before this solve is used.")
index = {c["frame"]: i for i, c in enumerate(meta["cams"])}
points = []
for point in reconstruction.points3D.values():
    observations = []
    for track in point.track.elements:
        image = reconstruction.images[track.image_id]
        i = index.get(image.name)
        if i is not None and not meta["cams"][i]["heldOut"]:
            observations.append({"image": i, "xy": image.points2D[track.point2D_idx].xy.tolist()})
    if observations:
        points.append({"xyz": point.xyz.tolist(), "trainObservations": observations})
for c in meta["cams"]:
    image = by_name[c["frame"]]
    pose = image.cam_from_world()
    camera = reconstruction.cameras[image.camera_id]
    f, cx, cy = camera.params
    c.update(R=pose.rotation.matrix().reshape(-1).tolist(), t=pose.translation.tolist(),
             w=camera.width, h=camera.height, f=float(f), fy=float(f), cx=float(cx), cy=float(cy),
             poseSource="COLMAP 4.2.1 native sparse reconstruction")
meta["cameraSolve"] = {"name": "COLMAP 4.2.1", "registered": len(reconstruction.images),
                       "points": len(reconstruction.points3D), "samePhysicalFrameTimes": True,
                       "heldOutUse": "camera features only; excluded from seed colors and Gaussian fitting"}
meta["stats"] = {**meta.get("stats", {}), "iters": 0, "registered": len(reconstruction.images)}
(folder / "native-cameras.json").write_text(json.dumps(meta, indent=2) + "\n")
(folder / "native-points.json").write_text(json.dumps(points) + "\n")
print(json.dumps({"registered": len(reconstruction.images), "points": len(points)}))
