"""MIT. Validate, compact, contact-sheet, and archive the CC0 truth set."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile

import numpy as np
from PIL import Image, ImageDraw


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024*1024), b''): h.update(block)
    return h.hexdigest()


def validate(folder, full):
    manifest = json.loads((folder/'manifest.json').read_text())
    assert len(manifest['scenes']) >= 12, 'Incomplete scene set'
    count = 0
    for scene in manifest['scenes']:
        assert not scene['smoke_only'], 'Smoke build cannot be archived as complete'
        kinds = ['still','handheld','walk'] if full else ['still']
        for kind in kinds:
            root = folder/scene['id']/kind
            seq = json.loads((root/'poses.json').read_text())
            expected = {'still':1,'handheld':120,'walk':300}[kind]
            assert len(seq['frames']) == expected, f'{scene["id"]}/{kind}: frame count'
            for i,p in enumerate(seq['frames']):
                assert p['frame'] == i and p['time'] == i/30
                k,c2w,w2c = map(np.asarray, [p['K'],p['camera_to_world'],p['world_to_camera']])
                np.testing.assert_allclose(c2w@w2c,np.eye(4),atol=1e-6)
                np.testing.assert_allclose(c2w[:3,:3].T@c2w[:3,:3],np.eye(3),atol=1e-6)
                assert np.linalg.det(c2w[:3,:3]) > .99999
                assert k[0,0] == k[1,1] and k[0,2] == p['width']/2 and k[1,2] == p['height']/2
                assert Image.open(root/p['rgb']).size == (p['width'],p['height'])
                if kind!='walk':
                    raw = gzip.decompress((root/p['depth']).read_bytes())
                    assert len(raw) == p['width']*p['height']*4
                    z = np.frombuffer(raw,dtype='<f4')
                    mask = np.asarray(Image.open(root/p['mask']))[:,:,0].ravel()
                    assert set(np.unique(mask)) <= {0,1,3}
                    assert np.all(np.isnan(z[mask==0]))
                    assert np.all(np.isfinite(z[mask!=0])) and np.all(z[mask!=0] > 0)
                count += 1
            if kind!='still':
                import subprocess
                info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
                    '-show_entries','stream=width,height,nb_frames,r_frame_rate,duration', '-of','json',str(folder/scene['id']/f'{kind}.mp4')]))['streams'][0]
                assert int(info['nb_frames']) == expected
                assert info['r_frame_rate'] == '30/1'
                assert abs(float(info['duration'])-expected/30)<.001
    print(f'Validated {len(manifest["scenes"])} scenes, {count} frames, full={full}',flush=True)
    return manifest


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',default='.cache/studio-truth/full')
    ap.add_argument('--compact',action='store_true')
    ap.add_argument('--full',action='store_true')
    ap.add_argument('--archive',action='store_true')
    args=ap.parse_args()
    folder=Path(args.input)
    manifest=validate(folder,args.full or args.archive)
    if args.compact:
        out=Path('tests/fixtures/truth')
        for scene in manifest['scenes']:
            shutil.copytree(folder/scene['id']/'still',out/scene['id']/'still',dirs_exist_ok=True)
        manifest['coverage'] = 'stills only; full sequences are in the separate archive'
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        subprocess.run(['node','node_modules/prettier/bin/prettier.cjs','--write',
                        *map(str,sorted(out.rglob('poses.json'))),str(out/'manifest.json')],check=True)
        sheet=Image.new('RGB',(4*320,3*206),'#ece9e1')
        draw=ImageDraw.Draw(sheet)
        for i,scene in enumerate(manifest['scenes']):
            image=Image.open(folder/scene['id']/'still/still.jpg')
            image.thumbnail((320,180))
            x,y = (i%4)*320,(i//4)*206
            sheet.paste(image,(x,y))
            draw.text((x+7,y+185),scene['label'],fill='#242424')
        sheet.save(out/'contact-sheet.jpg',quality=93)
        records=[]
        for file in sorted(out.rglob('*')):
            if file.is_file() and file.name not in ['assets.json','README.md']:
                records.append({'path':str(file.relative_to(out)),'bytes':file.stat().st_size,'sha256':digest(file)})
        total=sum(r['bytes'] for r in records)
        assert total < 40_000_000, 'Compact fixture exceeds task budget'
        (out/'assets.json').write_text(json.dumps({'credit':'made by Ryan with Codex (GPT-6)',
            'license':'CC0-1.0','source':'tools/studio-truth-generate.py','date_checked':'2026-10-14',
            'changes':'original seeded procedural geometry, CPU render, pixel-center BVH depth, and camera calibration',
            'total_bytes':total,'files':records},indent=2)+'\n')
        print(f'Compact fixtures: {total} bytes')
    if args.archive:
        archive=folder.parent/'studio-truth-2026-10.tar.gz'
        with tarfile.open(archive,'w:gz',compresslevel=6) as tar:
            for file in sorted(folder.rglob('*')):
                if not file.is_file(): continue
                info=tar.gettarinfo(str(file),arcname='truth/'+str(file.relative_to(folder)))
                info.uid=info.gid=0
                info.uname=info.gname=''
                info.mtime=0
                with file.open('rb') as handle: tar.addfile(info,handle)
        sha=digest(archive)
        archive.with_suffix(archive.suffix+'.sha256').write_text(f'{sha}  {archive.name}\n')
        print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha}))


if __name__=='__main__': main()
