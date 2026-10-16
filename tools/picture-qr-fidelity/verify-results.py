"""Independently check the frozen review corpus CSVs and native phone gallery."""

import argparse
import collections
import csv
import hashlib
import json
import math
import pathlib
import struct

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--gallery", default=".cache/picture-qr-fidelity/review-export")
parser.add_argument("--out")
args = parser.parse_args()
root = pathlib.Path("tools/picture-qr-fidelity/results/review-pass")
summary = json.loads((root / "summary.json").read_text())
timing = json.loads((root / "timing.json").read_text())
corpus = json.loads((root / "corpus.json").read_text())
assert summary["complete"] and timing["complete"]

with (root / "per-code.csv").open() as file:
    rows = list(csv.DictReader(file))
with (root / "timing.csv").open() as file:
    times = list(csv.DictReader(file))
expected = {
    f"{picture['id']}/{link}/{shape}"
    for picture in corpus
    for link in range(10)
    for shape in ["square", "circle"]
}
assert len(rows) == len(times) == len(expected) == 2000
assert {row["key"] for row in rows} == expected
assert {row["key"].rsplit("/", 1)[0] for row in times} == expected

groups = collections.defaultdict(list)
for row in rows:
    picture, link, shape = row["key"].rsplit("/", 2)
    groups[(picture, shape)].append(row)
    for scale in ["phone", "print"]:
        gain = float(row[scale + "DetailSSIM"]) - float(row[scale + "MainSSIM"])
        assert math.isclose(gain, float(row[scale + "Gain"]), abs_tol=1e-12)
    for reader in ["jsqr", "zxingcpp"]:
        assert 0 <= int(row["detail" + reader + "Passes"]) <= 24
assert len(groups) == 200 and all(len(values) == 10 for values in groups.values())

for scale in ["phone", "print"]:
    gain = sum(float(row[scale + "Gain"]) for row in rows) / len(rows)
    assert math.isclose(gain, summary["fidelity"][scale]["meanGain"], abs_tol=1e-12)
    for picture in summary["pictures"]:
        selected = groups[(picture["picture"], picture["shape"])]
        gain = sum(float(row[scale + "Gain"]) for row in selected) / 10
        assert math.isclose(gain, picture["scores"][scale]["gain"], abs_tol=1e-12)

readers = ["jsqr", "zxingcpp"]
reads = sum(int(row["detail" + reader + "Passes"]) for row in rows for reader in readers)
assert reads == sum(c["detail"][r]["pass"] for c in summary["conditions"] for r in readers)
assert len(summary["conditions"]) == 24
assert all(c["detail"][r]["tested"] == 2000 for c in summary["conditions"] for r in readers)
for row in times:
    difference = float(row["detail"]) - float(row["main"])
    assert math.isclose(float(row["difference"]), difference, abs_tol=1e-6)
assert sum(float(row["difference"]) > 0 for row in times) == timing["all"]["slowerCases"]
assert timing["inactiveRenderViolations"] == 0

images = list((pathlib.Path(args.gallery) / "images").glob("*.png"))
expected_images = {
    f"{mode}-{picture['id']}-{shape}-0-390x844.png"
    for picture in corpus
    for mode in ["main", "detail"]
    for shape in ["square", "circle"]
}
assert len(images) == 400 and {p.name for p in images} == expected_images
for file in images:
    header = file.read_bytes()[:24]
    assert header[:8] == b"\x89PNG\r\n\x1a\n", str(file)
    assert struct.unpack(">II", header[16:24]) == (390, 844), str(file)

result = {
    "independentCSVCheck": "passed",
    "checkerSHA256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    "codesPerMode": 2000,
    "groups": 200,
    "readerPasses": reads,
    "readerAttempts": 96000,
    "scanRegressions": len(summary["scanRegressions"]),
    "failedCodes": len(summary["detail"]["failedCodes"]),
    "failedGates": len(summary["detail"]["failedGate"]),
    "fallbacks": len(summary["detail"]["fallbacks"]),
    "nonImprovingMeans": {
        scale: len(summary["fidelity"][scale]["nonImprovingPictures"])
        for scale in ["phone", "print"]
    },
    "meanGain": {
        scale: summary["fidelity"][scale]["meanGain"] for scale in ["phone", "print"]
    },
    "minGain": {
        scale: min(p["scores"][scale]["gain"] for p in summary["pictures"])
        for scale in ["phone", "print"]
    },
    "slower": timing["all"]["slowerCases"],
    "nativePhoneImages": len(images),
}
text = json.dumps(result, indent=2) + "\n"
if args.out:
    pathlib.Path(args.out).write_text(text)
print(text, end="")
