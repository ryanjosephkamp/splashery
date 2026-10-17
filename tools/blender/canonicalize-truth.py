"""MIT. Rebuild original CC0 truth source snapshots with the pinned Blender.

Run through tools/blender-cloud.sh. This intentionally updates source assets and their hash record;
review the diff and rerun dataset comparisons after doing so. It does not render or update fixtures.
"""
import hashlib
import importlib.util
import inspect
import json
from pathlib import Path
import bpy

TOOLS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('truth', TOOLS/'studio-truth-generate.py')
truth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(truth)
if bpy.app.version != (4,5,3):
    raise RuntimeError('Canonical truth sources require the pinned Blender 4.5.3')
out = TOOLS/'blender/truth-scenes'
out.mkdir(parents=True, exist_ok=True)
record = {'schema':1,'credit':'made by Ryan with Codex (GPT-6)',
          'author':'Ryan with Codex (GPT-6)','license':'CC0-1.0','checked':'October 17, 2026',
          'blender':bpy.app.version_string,
          'generator_sha256':hashlib.sha256((TOOLS/'studio-truth-generate.py').read_bytes()).hexdigest(),
          'canonicalizer_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'source':'tools/studio-truth-generate.py::build_procedural',
          'recipe_sha256':hashlib.sha256(inspect.getsource(truth.build_procedural).encode()).hexdigest(),
          'changes':'Original procedural geometry, materials, and lighting saved as compressed canonical sources to stabilize Cycles sampling. No outside assets.',
          'scenes':{}}
for index,(name,label,stress) in enumerate(truth.SCENES):
    camera,eye,target = truth.build_procedural(index,name)
    file = out/f'{name}.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(file),compress=True,check_existing=False)
    record['scenes'][name] = {'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),
                             'bytes':file.stat().st_size,'seed':5600+index,
                             'eye':eye.tolist(),'target':target.tolist()}
    print('CANONICAL',name,file.stat().st_size,flush=True)
(TOOLS/'blender/truth-scenes.json').write_text(json.dumps(record,indent=2,sort_keys=True)+'\n')
