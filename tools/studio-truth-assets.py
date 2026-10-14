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
            assert seq['fps']==30
            assert seq['duration_seconds']==(0 if kind=='still' else expected/30)
            for i,p in enumerate(seq['frames']):
                assert p['frame'] == i and p['time'] == i/30
                k,c2w,w2c = map(np.asarray, [p['K'],p['camera_to_world'],p['world_to_camera']])
                np.testing.assert_allclose(c2w@w2c,np.eye(4),atol=1e-6)
                np.testing.assert_allclose(c2w[:3,:3].T@c2w[:3,:3],np.eye(3),atol=1e-6)
                assert np.linalg.det(c2w[:3,:3]) > .99999
                assert k[0,0] == k[1,1] and k[0,2] == p['width']/2 and k[1,2] == p['height']/2
                with Image.open(root/p['rgb']) as image:
                    assert image.size == (p['width'],p['height'])
                assert ('depth' in p) == ('mask' in p), 'Depth and mask must occur together'
                if kind in ['still','handheld']:
                    assert 'depth' in p, f'{scene["id"]}/{kind}: missing required truth'
                if 'depth' in p:
                    raw = gzip.decompress((root/p['depth']).read_bytes())
                    assert len(raw) == p['width']*p['height']*4
                    z = np.frombuffer(raw,dtype='<f4')
                    with Image.open(root/p['mask']) as image:
                        mask = np.array(image)[:,:,0].ravel()
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
                assert [info['width'],info['height']]==[p['width'],p['height']]
        training_file=folder/scene['id']/'train-frames.json'
        if full and training_file.exists():
            training=json.loads(training_file.read_text())
            indices={p['source_frame'] for p in training['frames']}
            held_out=set(training['held_out'])
            assert len(indices)==262 and len(held_out)==37
            assert not indices & held_out and 0 not in indices
            assert indices | held_out | {0} == set(range(300))
            assert held_out=={p['frame'] for p in seq['frames'] if p.get('held_out')}
            assert all('depth' in seq['frames'][i] for i in held_out)
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
                '-show_entries','stream=nb_frames,r_frame_rate,duration','-of','json',str(folder/scene['id']/'train.mp4')]))['streams'][0]
            assert int(info['nb_frames'])==262 and info['r_frame_rate']=='30/1'
            assert abs(float(info['duration'])-262/30)<.001
    if full:
        checksums=json.loads((folder/'checksums.json').read_text())
        recorded={r['path'] for r in checksums}
        actual={str(f.relative_to(folder)) for f in folder.rglob('*') if f.is_file() and f.name!='checksums.json'}
        assert len(recorded)==len(checksums) and recorded==actual, 'Incomplete checksum inventory'
        for record in checksums:
            file=folder/record['path']
            assert file.stat().st_size==record['bytes'], record['path']
            assert digest(file)==record['sha256'], record['path']
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
        with archive.open('wb') as raw:
            with gzip.GzipFile(filename='',mode='wb',fileobj=raw,compresslevel=6,mtime=0) as compressed:
                with tarfile.open(fileobj=compressed,mode='w') as tar:
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
