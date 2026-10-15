"""Build review media from native captures; never recompute a score. Pillow is build-time only."""
import concurrent.futures
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
from PIL import Image, ImageOps

if len(sys.argv) != 4:
    raise SystemExit('Use: python3 slim-gallery.py NATIVE_CAPTURE METADATA_FOLDER NEW_OUTPUT')
source, old_media, out = map(Path, sys.argv[1:])
out.mkdir(exist_ok=False)
data = json.loads((source / 'atlas.json').read_text())
images = {}

def link(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    os.link(src, dst)

for entry in data['inputs']:
    link(source / entry['photo'], out / entry['photo'])
    images[entry['photo']] = ('previews/' + entry['id'] + '-source.webp', False)
    for profile in entry['profiles'].values():
        for row in profile['rows']:
            images[row['image']] = (row['image'].removesuffix('.png') + '.webp', False)
        for key in ['frontPreview', 'worstPreview', 'depthImage']:
            path = profile[key]
            images[path] = (path.removesuffix('.png') + '.webp', key == 'depthImage')

def encode(item):
    name, (target, lossless) = item
    dst = out / target
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source / name) as image:
        original = image.size
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((390, 844), Image.Resampling.LANCZOS)
        image.save(dst, 'WEBP', quality=84, method=5, lossless=lossless)
        size = image.size
    return {'source': name, 'file': target, 'sourceDimensions': original,
            'dimensions': size, 'losslessEncoding': lossless,
            'sha256': hashlib.sha256(dst.read_bytes()).hexdigest(), 'bytes': dst.stat().st_size}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    encoded = []
    for i, result in enumerate(pool.map(encode, images.items()), 1):
        encoded.append(result)
        if i % 300 == 0:
            print('Encoded', i, 'of', len(images), flush=True)

json_proof = []
for pattern in ['atlas.json', 'records/*.json', 'renders/*.json']:
    for file in sorted(source.glob(pattern)):
        raw = file.read_bytes()
        relative = file.relative_to(source).as_posix()
        target = out / (relative + '.gz')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
        assert gzip.decompress(target.read_bytes()) == raw
        json_proof.append({'file': relative + '.gz', 'decompressedSha256': hashlib.sha256(raw).hexdigest()})
for folder in ['sources', 'verification']:
    shutil.copytree(old_media / folder, out / folder, copy_function=os.link)
shutil.copyfile(__file__, out / 'verification/slim-gallery.py')
manifest = {'sourceCapture': data['source'], 'maxReviewDimensions': [390, 844],
            'colorEncoding': 'WebP quality 84, method 5; resized review images, not scoring inputs',
            'originalPhotos': len(data['inputs']), 'colorViews': 2124,
            'omitted': '8,496 native color/mask/UV/reveal PNGs and 2,124 projected-boundary debug files; retained locally, reproducible from capture pin',
            'images': encoded, 'compressedJson': json_proof}
(out / 'verification/slim-package.json').write_text(json.dumps(manifest, indent=2) + '\n')
total = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
print(json.dumps({'files': sum(1 for p in out.rglob('*') if p.is_file()), 'bytes': total,
                  'images': len(encoded), 'compressedJson': len(json_proof)}), flush=True)
assert total < 190_000_000, 'Reserve room for final HTML and review evidence below 200 MB'
