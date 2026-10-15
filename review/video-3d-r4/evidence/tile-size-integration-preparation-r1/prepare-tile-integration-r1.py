#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Prepare/test source outside the active checkout."""
from pathlib import Path
import shutil
import hashlib
import json
import datetime

BASE = Path('/workspace/splashery-v3d-bench-tools-r10/vendor/splatjs')
OUT = Path('/workspace/v3d-r4-media/tile-size-integration-preparation-r1')
if OUT.exists():
    raise RuntimeError('Fresh preparation required')
OUT.mkdir()
shutil.copytree(BASE, OUT / 'vendor' / 'splatjs')
p = OUT / 'vendor/splatjs/src/gs/shaders.js'
s = p.read_text()
anchor = 'export const TILE = 16;'
assert s.count(anchor) == 1
helper = '''

// The established tile16 kernels stay byte-identical by default. Direct-gradient software
// rasterization can use tile8 to avoid testing so many irrelevant splats at each pixel.
// Image-wide SSIM/SSAA kernels keep their own workgroup dimensions; only tile rasters change.
export function tileShaderSource(source, tileSize = TILE, raster = false) {
  if (tileSize === TILE) return source;
  if (tileSize !== 8) throw new RangeError('Raster tile size must be 8 or 16');
  const marker = `const TILEF = ${TILE}.0;`;
  if (raster && !source.includes(marker)) throw new Error('Raster tile constant is missing');
  const result = source.replace(marker, `const TILEF = ${tileSize}.0;`);
  if (!raster) return result;
  const workgroup = '@compute @workgroup_size(16, 16)';
  if (result.split(workgroup).length !== 2) throw new Error('Raster workgroup is ambiguous');
  return result.replace(workgroup, `@compute @workgroup_size(${tileSize}, ${tileSize})`);
}
'''
p.write_text(s.replace(anchor, anchor + helper))
p = OUT / 'vendor/splatjs/src/gs/trainer.js'
s = p.read_text()
assert s.count('  STRIDE, TILE, ENTRIES_CAP,') == 1
s = s.replace('  STRIDE, TILE, ENTRIES_CAP,', '  STRIDE, TILE, tileShaderSource, ENTRIES_CAP,')
anchor = '    this.tileGrad = opts.tileGrad ?? true;'
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + '''
    this.tileSize = opts.tileSize ?? TILE;
    if (this.tileSize !== TILE && this.tileSize !== 8)
      throw new RangeError('Raster tile size must be 8 or 16');
    if (this.tileSize !== TILE && this.tileGrad !== false)
      throw new Error('Tile8 requires direct gradients (tileGrad: false)');''')
anchor = 'const mk = (code, label) => d.createShaderModule({ code, label });'
assert s.count(anchor) == 1
s = s.replace(anchor, "const mk = (code, label) => d.createShaderModule({ code: tileShaderSource(code, this.tileSize, label.startsWith('render')), label });")
count = s.count('/ TILE')
assert count == 18, count
s = s.replace('/ TILE', '/ this.tileSize')
p.write_text(s)
files = []
for name in ['src/gs/shaders.js', 'src/gs/trainer.js']:
    before = (BASE / name).read_bytes()
    after = (OUT / 'vendor/splatjs' / name).read_bytes()
    files.append({'file': 'vendor/splatjs/' + name,
                  'beforeSha256': hashlib.sha256(before).hexdigest(),
                  'afterSha256': hashlib.sha256(after).hexdigest()})
(OUT / 'source-preparation.json').write_text(json.dumps({
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'Outside-only explicit opt-in implementation. Product remains unchanged during the active284-case regression run. Tile8 requires direct gradients. Default shader sources remain unchanged.',
    'replacedTileDivisions': count, 'files': files,
}, indent=2) + '\n')
shutil.copyfile(__file__, OUT / Path(__file__).name)
print(json.dumps({'preparation': str(OUT), 'tileDivisions': count}))
