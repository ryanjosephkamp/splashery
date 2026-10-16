"""Build small portable PNG derivatives; preserve the full-size captures."""
import argparse
import base64
import io
import json
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--captures', type=Path, default=here / 'captures')
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
samples = []
for toy in ['grapes', 'orange', 'strawberry']:
    directory = args.captures / toy
    metadata = json.loads((directory / 'capture.json').read_text())
    paths = sorted(directory.glob('frame-*.png'))
    assert len(paths) == metadata['frameCount'] == 40
    frames = []
    for file in paths:
        with Image.open(file) as image:
            assert image.size == (420, 420)
            small = image.resize((210, 210), Image.Resampling.BOX)
            buffer = io.BytesIO()
            small.save(buffer, format='PNG', optimize=True)
            frames.append('data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii'))
    samples.append({
        **metadata,
        'embeddedSize': [210, 210],
        'embeddedChanges': 'The 420x420 lossless source captures are area-averaged to 210x210 PNGs for the portable demo. Full-size captures are retained in the local source package.',
        'frames': frames,
    })
# Choose a fresh output file; the PNG originals and supplied demo are preserved.
with args.out.open('x') as target:
    target.write(json.dumps(samples, separators=(',', ':')) + '\n')
print(json.dumps({'sourceFrames': 120, 'bytes': args.out.stat().st_size, 'output': str(args.out)}))
