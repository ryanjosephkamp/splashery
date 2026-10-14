"""MIT. Add exact masks/depth at every eighth walk frame (excluding frame 0).

Run only after full sequence generation finishes. This uses the same original
geometry and stored camera poses; it does not rerender or alter the RGB frames.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import shutil
import subprocess
import tempfile

import numpy as np
import bpy

source=Path(__file__).resolve().parent/'studio-truth-generate.py'
spec=importlib.util.spec_from_file_location('truth_generator',source)
generator=importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',default='.cache/studio-truth/full-v1')
    ap.add_argument('--camera-helper-sha256',help='Expected helper identity for a legacy manifest without its startup hash')
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    opt=ap.parse_args(argv)
    root=Path(opt.input)
    manifest=json.loads((root/'manifest.json').read_text())
    assert len(manifest['scenes'])==12, 'Finish full generation first'
    assert manifest['generator']['source_sha256']==hashlib.sha256(source.read_bytes()).hexdigest()
    helper_hash=hashlib.sha256((source.parent/'studio_truth_camera.py').read_bytes()).hexdigest()
    expected=manifest['generator'].get('camera_helper_sha256') or manifest.get('verified_build_inputs',{}).get('camera_helper_sha256') or opt.camera_helper_sha256
    assert expected==helper_hash, 'An expected matching camera-helper SHA-256 is required'
    # Retain the exact build sources with the archive, even after tooling revisions.
    copies=root/'source'
    copies.mkdir(exist_ok=True)
    for file in [source,source.parent/'studio_truth_camera.py',Path(__file__).resolve()]:
        shutil.copyfile(file,copies/file.name)
    for index,(name,label,stress) in enumerate(generator.SCENES):
        folder=root/name/'walk'
        sequence=json.loads((folder/'poses.json').read_text())
        assert len(sequence['frames'])==300
        cam,eye,target=generator.build(index,name)
        tree,flags=generator.geometry()
        for i in range(8,300,8):
            pose=sequence['frames'][i]
            stem=f'{i:06d}'
            if not (folder/f'{stem}.depth.f32.gz').exists():
                generator.depth(tree,flags,pose,folder,stem)
            pose['depth']=f'{stem}.depth.f32.gz'
            pose['mask']=f'{stem}.mask.png'
            pose['held_out']=True
        generator.save_json(folder/'poses.json',sequence)
        # No held-out RGB enters the training encoder, including frame zero.
        training=[i for i in range(300) if i%8!=0]
        with tempfile.TemporaryDirectory(prefix='truth-train-',dir=root.parent) as temp:
            temp=Path(temp)
            for n,i in enumerate(training):shutil.copyfile(folder/f'{i:06d}.jpg',temp/f'{n:06d}.jpg')
            subprocess.run(['ffmpeg','-v','error','-y','-framerate','30','-i',str(temp/'%06d.jpg'),
                '-c:v','libx264','-threads','2','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(root/name/'train.mp4')],check=True)
        generator.save_json(root/name/'train-frames.json',{'fps':30,'held_out':list(range(8,300,8)),
            'reserved_first_frame':0,'frames':[{'frame':n,'time':n/30,'source_frame':i,'source_time':i/30} for n,i in enumerate(training)]})
        print(f'NOVEL TRUTH {name}: 37 held-out frames',flush=True)
    manifest['held_out']={'frames':list(range(8,300,8)),
        'use':'evaluation only; Photo uses the still and Moving photo uses the separate handheld clip',
        'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    manifest['verified_build_inputs']={
        'camera_helper_sha256':helper_hash,
        'python':sys.version.split()[0],'numpy':np.__version__,'blender':bpy.app.version_string,
        'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],
        'source_directory':'source',
        'note':'Driver hash is recorded by generation; unchanged camera-helper identity is verified before supplemental truth generation.'}
    generator.save_json(root/'manifest.json',manifest)
    files=[]
    for file in sorted(root.rglob('*')):
        if file.is_file() and file.name!='checksums.json':
            files.append({'path':str(file.relative_to(root)),'bytes':file.stat().st_size,
                          'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    generator.save_json(root/'checksums.json',files)


if __name__=='__main__': main()
