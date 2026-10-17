"""MIT; made by Ryan with Codex (GPT-6). Pin public research inputs in .cache.

No model is installed in vendor/, no application is edited, and no photo is sent.
The model cards and licenses were checked live on October 16, 2026. Recheck the
live cards before promoting a model; this script pins reproducible research bytes.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import urllib.parse
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/photo-3d-next'
MODELS=[
    ('FuryTMP/Distill-Any-Depth-Small-onnx','14b4bdbb7f448a0498e437c32fa6038ca9b2b450','Distill Any Depth Small/model.onnx','FuryTMP--Distill-Any-Depth-Small-onnx.onnx','0584f4af7f7177c4954417b7f5c2990b6f6bd8ee429fea74cd8a4db44333c5e4'),
    ('josazar/da3-small-onnx','44dff770dd15a68e80dc411312f08c8db800fc4b','DA3-SMALL-392.onnx','josazar--da3-small-onnx.onnx','91dcbf4ee137897c64816c45d828f9a24dd61b8c6a25c71bc5f1f6e2c8a876bf'),
    ('Ruicheng/moge-2-vits-normal-onnx','e50ffda41565591092adea54c6ac83d6212e1e23','model.onnx','Ruicheng--moge-2-vits-normal-onnx.onnx','24eacb5dc7a2c54c7bc98f7de085ffbed79ad006ea5b664c2c2cdc02ff3a52f0'),
    ('depth-anything/DA3-BASE','f4a6c9b3c95e41c82048423d3493a81ec3fa810e','model.safetensors','depth-anything--DA3-BASE/model.safetensors','e01067dc1659613083d9145a9a2547ccdbe6ccbbf83c4fe7b3e8a4e2bdae78b5'),
    ('depth-anything/DA3MONO-LARGE','f465978e618db8cc79c83b8bbf24964857db1875','model.safetensors','depth-anything--DA3MONO-LARGE/model.safetensors','7a799a7f95eb8d4c404c2ca8be3dc3276b350a417ddc4420db72ba850cc0e960'),
    ('Ruicheng/moge-2-vitl-normal','cb0e8bbd6b1e243589717c78e750b1ba4c093acf','model.pt','Ruicheng--moge-2-vitl-normal/model.pt','280741fd09bc3f403ccff9967784c2a391b52d2c0742ae3efdb21d9f90cc1a01'),
    ('depth-anything/DA3-SMALL','e08cab65ca0ec38e7826075418411ab90cab4da3','model.safetensors','depth-anything--DA3-SMALL/model.safetensors','364492e38a3a06d221ac75da7f6621ada3f2361cd24fde11ba79091e9f40efcf'),
    ('xingyang1/Distill-Any-Depth-Small-hf','19549fd5fe035af695a10fdcfea28c29662f3446','model.safetensors','xingyang1--Distill-Any-Depth-Small-hf/model.safetensors','6e8233b90eb00ebe71ee6ebba3a7dc1cfe5b5ac0fe11d45069d19bcb4e4ff660'),
    ('Ruicheng/moge-2-vits-normal','26b477f41595707c5db6770294c0d1721e8ed4ed','model.pt','Ruicheng--moge-2-vits-normal/model.pt','79a16621928c2bf0ed04659218c55c01075e950507f40bb3332fb4c873d3e1dc'),
]
SOURCES=[('MoGe','https://github.com/microsoft/MoGe.git','74fbce054ebed49800de42d0ad0e83495065719a'),
         ('DA3','https://github.com/ByteDance-Seed/Depth-Anything-3.git','3d835ec1a5802d64a8b8b15f817a1ab54809bfe4')]


def digest(file):
    value=hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):value.update(block)
    return value.hexdigest()


def download(url,target,expected=None):
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists() or (expected and digest(target)!=expected):
        temp=target.with_name(target.name+'.part')
        urllib.request.urlretrieve(url,temp)
        if expected and digest(temp)!=expected:raise ValueError('Downloaded bytes differ: '+url)
        os.replace(temp,target)
    return {'file':str(target.relative_to(ROOT)),'url':url,'bytes':target.stat().st_size,'sha256':digest(target)}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--verify-only',action='store_true')
    parser.add_argument('--blender-only',action='store_true')
    args=parser.parse_args()
    CACHE.mkdir(parents=True,exist_ok=True)
    if args.blender_only:
        url='https://mirrors.ocf.berkeley.edu/blender/release/Blender4.3/blender-4.3.2-linux-x64.tar.xz'
        target=CACHE/'blender-official.tar.xz';expected='4da1c956673c0485e63054e563ee69198cc8f80d8157dd7592dffc8a6a5592e6'
        if args.verify_only:
            if not target.exists() or digest(target)!=expected:raise ValueError('Official Blender archive differs')
        else:
            download(url,target,expected)
            with tarfile.open(target) as archive:archive.extractall(CACHE,filter='data')
        print('Official Blender 4.3.2 with OpenImageDenoise verified',flush=True)
        return
    records=[]
    for model,revision,file,local,expected in MODELS:
        target=CACHE/'models'/local
        if args.verify_only:
            if not target.exists() or digest(target)!=expected:raise ValueError('Missing or altered model: '+model)
            print(model,'verified',flush=True);continue
        url=f'https://huggingface.co/{model}/resolve/{revision}/{urllib.parse.quote(file)}?download=true'
        records.append(download(url,target,expected))
        if file=='model.safetensors':
            records.append(download(f'https://huggingface.co/{model}/resolve/{revision}/config.json',target.parent/'config.json'))
        print(model,'verified',flush=True)
    for name,url,revision in SOURCES:
        folder=CACHE/name
        if args.verify_only:
            if subprocess.check_output(['git','-C',str(folder),'rev-parse','HEAD'],text=True).strip()!=revision:raise ValueError('Source revision differs: '+name)
            continue
        if not folder.exists():
            folder.mkdir();subprocess.run(['git','init','-q',str(folder)],check=True)
            subprocess.run(['git','-C',str(folder),'remote','add','origin',url],check=True)
            subprocess.run(['git','-C',str(folder),'fetch','-q','--depth=1','origin',revision],check=True)
            subprocess.run(['git','-C',str(folder),'checkout','-q','--detach','FETCH_HEAD'],check=True)
        if subprocess.check_output(['git','-C',str(folder),'rev-parse','HEAD'],text=True).strip()!=revision:raise ValueError('Use a clean pinned source folder: '+name)
    if not args.verify_only:(CACHE/'model-inputs.json').write_text(json.dumps({'models':records,'sources':SOURCES},indent=2))
    # C, E, and F come from their existing local generators; J is shipped.
    inputs=[]
    for scene in json.loads((ROOT/'tests/fixtures/truth/manifest.json').read_text())['scenes']:
        folder=ROOT/'tests/fixtures/truth'/scene['id']/'still'
        inputs.append({'id':'truth-'+scene['id'],'file':str(folder/'still.jpg'),'truth':str(folder/'poses.json'),'category':'truth'})
    for category in 'cefj':
        for row in json.loads((ROOT/'tools/depth-lab'/(category+'.json')).read_text()):
            file=ROOT/('assets/depth-lab' if category=='j' else '.cache/depth-lab')/row['file']
            if not file.exists():raise ValueError('Generate depth-lab '+category.upper()+' first; missing '+str(file))
            inputs.append({'id':row['id'],'file':str(file),'category':category,'expect':row['expect'],'variables':row['variables']})
    (CACHE/'depth-inputs.json').write_text(json.dumps(inputs,indent=2))
    print(len(inputs),'registered research inputs',flush=True)


if __name__=='__main__':main()
