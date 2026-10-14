"""Review round: resize generated QR subjects; preserve all native originals."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
cache = root / '.cache/cdx-pics/round2/ai'
for record in sorted(cache.glob('*.json')):
    row = json.loads(record.read_text())
    output = record.with_suffix('.jpg')
    if output.exists():
        continue
    with Image.open(row['path']) as image:
        image = image.convert('RGB')
        assert image.width == image.height, row['id']
        image.resize((960, 960), Image.Resampling.LANCZOS).save(output, quality=88, optimize=True)
    print(output.name)
