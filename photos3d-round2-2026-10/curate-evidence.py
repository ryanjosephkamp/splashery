#!/usr/bin/env python3
"""MIT. Task 104 evidence curation. Only writes inside .cache/photos3d/round2.
Raw diagnostic bytes are never rewritten. No network, tests, browsers, or solvers run.
"""
from __future__ import annotations
import argparse, copy, datetime, gzip, hashlib, io, json, math, os, re, shutil, subprocess, sys, zipfile
from pathlib import Path
from PIL import Image, ImageChops

VERSION = 1
LIMIT = 1_000_000
KNOWN_TRACE_SHA256 = '27641822c02538de8bef8637a03a01159b91e975227e2cb6538f54b650b245af'
ORDER_PAIRS = tuple((f'buddha{count}-{profile}-sorted-final',f'buddha{count}-{profile}-shuffled-final') for count in (24,60) for profile in ('phone','high'))
REAL = {
 'alicevision-buddha-24': '.cache/photos3d/buddha',
 'alicevision-buddha-60': '.cache/photos3d/round2/buddha60',
 'alansartlog-dice-watercolors-24': '.cache/photos3d/round2/dice-watercolors',
 'alansartlog-skull-flash-24': '.cache/photos3d/round2/skull-flash',
}
SYNTH = ('burger-double', 'cake-birthday', 'donut-sprinkles')
PUBLIC = 'https://github.com/ryanjosephkamp/splashery'
# Only these two fully audited evaluator versions are equivalent for trained pixel values.
# git diff 2742c4b6b..26dcf20fa changes planned-fold bookkeeping and zero-solve reporting only.
# Unknown future evaluator hashes remain distinct. Every raw hash is still audited at its commit.
EVALUATOR_EQUIVALENCE = {
 'path': 'tools/photos3d-evaluate.mjs',
 'hashes': ['27de0862aff1cd1812fa74c44fe5ff124bdf7545d64db97af276c74e843591a1',
            'de30e761fbc1a8027bd4c5ac013e31292d350429b9b85c7299ca26e6cd36afdb'],
 'canonicalTrainingSha256': '27de0862aff1cd1812fa74c44fe5ff124bdf7545d64db97af276c74e843591a1',
 'basis': 'Static review of git diff 2742c4b6b..26dcf20fa: fold plan moved before solving, missing-camera bookkeeping added; seed/train/render/readback/mask/metric logic unchanged.',
}
def sha(b): return hashlib.sha256(b).hexdigest()
def encode(value): return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
def load(p): return json.loads(p.read_bytes())
def canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
def under(path, root):
 try: path.resolve().relative_to(root.resolve()); return True
 except ValueError: return False

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--repo', type=Path, default=Path.cwd())
 ap.add_argument('--output', type=Path, help='Default: <repo>/.cache/photos3d/round2/payload')
 ap.add_argument('--run', action='append', default=[], help='Explicit primary receipt basename or .json path')
 ap.add_argument('--exploratory-run', action='append', default=[], help='Explicit nonprimary receipt; mismatches remain flagged')
 ap.add_argument('--file-list', type=Path, help='JSON {primaryRuns:[], exploratoryRuns:[], files:[]} or text receipt paths')
 ap.add_argument('--include-results', action='store_true', help='Include only selected receipts\' paired trained PNG/PLY results')
 ap.add_argument('--audit-only', action='store_true', help='Print audit report; create no payload')
 ap.add_argument('--allow-interrupted', action='store_true', help='Explicitly allow verified derived partial receipts; unfinished counts and recovery warnings remain visible')
 args=ap.parse_args();repo=args.repo.resolve();cache=repo/'.cache/photos3d';base=cache/'round2';runs=base/'runs';out=(args.output or base/'payload').resolve()
 if not (repo/'tools/assets.json').is_file(): ap.error('--repo must name the source checkout')
 if not under(out,base) or out==base: ap.error('--output must be strictly inside .cache/photos3d/round2')
 assets_bytes=(repo/'tools/assets.json').read_bytes();assets=json.loads(assets_bytes)
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
 inventory=[];issues=[];audit_runs=[];dataset_audits=[];source_audits={};snapshots={};hash_cache={};input_hashes=set();raw_input_paths=set();primary_fold_ledger={};trace_audits=[];selected_primary_receipts={}
 stage=out.with_name(out.name+'.building')
 if not args.audit_only:
  if stage.exists():
   if not (stage/'.curation-owned').is_file(): raise RuntimeError('Refusing to remove an unowned staging directory')
   shutil.rmtree(stage)
  stage.mkdir(parents=True);(stage/'.curation-owned').write_text('Task 104 evidence curation staging\n')
 def issue(severity,context,message): issues.append({'severity':severity,'context':str(context),'message':message})
 def require(ok,context,message):
  if not ok: issue('error',context,message)
  return bool(ok)
 def relative(p):
  try:return str(p.resolve().relative_to(repo))
  except ValueError:return str(p)
 def read(p):
  p=p.resolve();before=p.stat();b=p.read_bytes();after=p.stat()
  if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise RuntimeError('Source changed during read: '+relative(p))
  snapshots[str(p)]={'bytes':len(b),'sha256':sha(b),'mtimeNs':after.st_mtime_ns};return b
 def filehash(p):
  p=p.resolve();st=p.stat();key=(str(p),st.st_size,st.st_mtime_ns)
  if key not in hash_cache:hash_cache[key]=sha(p.read_bytes())
  return hash_cache[key]
 def record_bytes(data,dest,role,source=None,attribution=None,compression=False):
  dest=Path(dest)
  if dest.is_absolute() or '..' in dest.parts:raise RuntimeError('Unsafe payload path')
  original=data;compressed=compression and len(data)>LIMIT
  if compressed:
   # Explicit empty gzip filename and mtime=0 preserve a deterministic archive header.
   buf=io.BytesIO()
   with gzip.GzipFile(fileobj=buf,mode='wb',filename='',mtime=0,compresslevel=9) as z:z.write(data)
   data=buf.getvalue();dest=Path(str(dest)+'.gz')
   if gzip.decompress(data)!=original:raise RuntimeError('Archive round-trip differs')
  item={'path':dest.as_posix(),'role':role,'source':source,'originalBytes':len(original),'originalSha256':sha(original),'archiveBytes':len(data),'archiveSha256':sha(data),'encoding':'gzip; original bytes unchanged; mtime=0' if compressed else 'identity'}
  if attribution:item['attribution']=attribution
  if any(r['path']==item['path'] for r in inventory):raise RuntimeError('Duplicate payload destination: '+str(dest))
  inventory.append(item)
  if not args.audit_only:
   target=stage/dest;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  return item
 def add_file(p,dest,role,attribution=None,compression=False):
  p=p.resolve()
  if p in raw_input_paths:raise RuntimeError('Refusing input photo: '+relative(p))
  b=read(p)
  if sha(b) in input_hashes:raise RuntimeError('Refusing bytes matching an input photo: '+relative(p))
  known_trace=role=='verification-trace' and p==(base/'preflight-first-failure/trace.zip').resolve()
  if p.suffix.lower() in ('.glb','.gltf','.jpg','.jpeg','.heic','.exr') or (p.suffix.lower()=='.zip' and not known_trace):raise RuntimeError('Forbidden source/model/image payload: '+relative(p))
  if role=='verification-trace':
   if not known_trace or sha(b)!=KNOWN_TRACE_SHA256:raise RuntimeError('Only the exact known graph-plotter failure trace is allowed')
   members=[];seen=set()
   with zipfile.ZipFile(io.BytesIO(b)) as archive:
    for member in archive.infolist():
     name=member.filename
     if name in seen or name.startswith('/') or '\\' in name or '..' in Path(name).parts or (member.external_attr>>16)&0o170000==0o120000:raise RuntimeError('Unsafe/duplicate trace ZIP member: '+name)
     seen.add(name);data=archive.read(member);digest=sha(data)
     if digest in input_hashes:raise RuntimeError('Trace ZIP contains bytes matching a frozen input photo: '+name)
     members.append({'path':name,'uncompressedBytes':len(data),'uncompressedSha256':digest})
   trace_audits.append({'source':relative(p),'archiveSha256':sha(b),'members':members,'checkedAgainstAllFrozenInputPhotoHashes':True,'scope':'One explicitly allowed, SHA-pinned preflight graph-plotter UI trace; UI screenshots and test/resource snapshots may occur inside it. No arbitrary source/model archives are allowed.'})
  if p.suffix.lower()=='.png' and role not in ('evaluation-mask','synthetic-mask','trained-result'):raise RuntimeError('PNG role is not explicitly allowed')
  if re.search(r'contact[-_]?sheet|reference[-_]?rgb|beauty',p.name,re.I):raise RuntimeError('Forbidden reference/contact artifact')
  return record_bytes(b,dest,role,relative(p),attribution,compression)
 def generated(value,dest,role):return record_bytes(encode(value),dest,role,'curation-generated metadata')
 def verify_sources(prov,context):
  commit=prov.get('commit') if isinstance(prov,dict) else None;entries=prov.get('sourceHashes') if isinstance(prov,dict) else None
  if not require(bool(re.fullmatch(r'[a-f0-9]{40}',commit or '')),context,'Missing/invalid originating Git commit'):return False
  if not require(isinstance(entries,list) and bool(entries),context,'Missing source hashes'):return False
  ok=True;seen=set()
  for pair in entries:
   if not isinstance(pair,list) or len(pair)!=2:issue('error',context,'Malformed source hash entry');ok=False;continue
   file,want=pair;key=(commit,file,want)
   if file in seen:issue('error',context,'Duplicate source hash path: '+file);ok=False
   seen.add(file)
   if key not in source_audits:
    entry={'commit':commit,'path':file,'recordedSha256':want,'publicSource':PUBLIC+'/blob/'+commit+'/'+file}
    try:
     b=subprocess.check_output(['git','show',commit+':'+file],cwd=repo,stderr=subprocess.PIPE)
     entry.update(actualSha256=sha(b),matches=sha(b)==want)
    except subprocess.CalledProcessError:entry.update(matches=False,error='Git object/path unavailable locally')
    source_audits[key]=entry
   if not source_audits[key]['matches']:
    issue('error',context,'Source hash differs from recorded commit: '+file);ok=False
  return ok
 def mask_audit(record,path,context):
  b=read(path);doc=json.loads(b);require(sha(b)==record.get('evaluationMasks',{}).get('sha256'),context,'Mask JSON differs from frozen tools/assets.json hash')
  expected={f['name']:f['sha256'] for f in record['files']};require(set(doc.get('photos',{}))==set(expected),context,'Mask photo identities differ from selection')
  for name,row in doc.get('photos',{}).items():
   require(row.get('sourceSha256')==expected.get(name),context,'Mask input hash mismatch: '+name)
   for p in row.get('polygons',[])+row.get('holes',[]):require(len(p)>=3 and all(len(v)==2 and all(isinstance(t,(int,float)) and math.isfinite(t) and 0<=t<=1 for t in v) for v in p),context,'Invalid normalized polygon: '+name)
   png=path.parent/row['rasterMask'];require(filehash(png)==row.get('rasterSha256'),context,'Mask PNG hash mismatch: '+name)
   with Image.open(png) as im:require(im.mode in ('1','L','P') and set(im.getdata())<={0,1,255},context,'Mask PNG contains non-mask data: '+name)
  return doc
 def mask_only(im, allowed):
  # Task 105 writes an object-index mask into equal RGB channels with opaque alpha.
  # Preserve that original PNG encoding and checksum; do not rewrite it as a photo.
  if im.mode in ('1','L','P'):
   return all(not n or i in allowed for i,n in enumerate(im.histogram()))
  if im.mode in ('RGB','RGBA'):
   bands=im.split();r,g,b=bands[:3]
   return (ImageChops.difference(r,g).getbbox() is None and
           ImageChops.difference(r,b).getbbox() is None and
           all(not n or i in allowed for i,n in enumerate(r.histogram())) and
           (len(bands)==3 or bands[3].getextrema()==(255,255)))
  return False
 # Freeze the input denylist first; source images are verified but never copied.
 all_records={r['id']:r for r in assets.get('photos3dBenchmarks',[])+assets.get('photos3dSynthetic',[])}
 input_hashes.update(f['sha256'] for r in all_records.values() for f in r['files'])
 roots={k:repo/v for k,v in REAL.items()}
 roots.update({'photos3d-synthetic-'+slug:base/'synthetic'/slug/'input' for slug in SYNTH})
 for ident,folder in roots.items():
  record=all_records.get(ident)
  if not require(bool(record),ident,'Missing frozen assets record'):continue
  for f in record['files']:input_hashes.add(f['sha256']);raw_input_paths.add((folder/f['name']).resolve())
 for ident,folder in roots.items():
  record=all_records.get(ident)
  if not record:continue
  before=len(issues);verified=0
  for f in record['files']:
   p=folder/f['name']
   try:
    good=require(p.stat().st_size==f['bytes'] and filehash(p)==f['sha256'],ident,'Frozen input SHA/bytes mismatch: '+f['name']);verified+=int(good)
   except OSError:issue('error',ident,'Missing original input for hash audit: '+f['name'])
  dataset_audits.append({'id':ident,'inputFiles':len(record['files']),'verifiedInputFiles':verified,'newIssues':len(issues)-before})
  generated(record,Path('datasets')/ident/'assets-record.json','frozen-dataset-record')
  if ident in REAL:
   mask_audit(record,folder/'final-masks.json',ident)
   add_file(folder/'final-masks.json',Path('datasets')/ident/'final-masks.json','manual-evaluation-annotations')
   for p in sorted((folder/'final-mask-png').glob('*.png')):add_file(p,Path('datasets')/ident/'final-mask-png'/p.name,'evaluation-mask',record.get('attribution') or record['author']+' / '+record['license'])
   if ident.startswith('alicevision'):
    src=repo/REAL['alicevision-buddha-24'];pin=record['revision'];receipt={'checked':record['checked'],'source':record['source'],'licenseSource':record['licenseSource'],'includedReceipts':[],'note':'Pinned README and license text are included. Full source HTML is retained privately in the local cache and is not republished.'}
    for name in ('README.md','LICENSE.md'):
     item=add_file(src/name,Path('datasets')/ident/'receipts'/name,'source-license-receipt');receipt['includedReceipts'].append({'path':'receipts/'+name,'sha256':item['originalSha256'],'url':f'https://github.com/alicevision/dataset_buddha/blob/{pin}/{name}'})
   else:
    candidate=load(folder/'candidate-assets-record.json');receipt={'checked':record['checked'],'sourceReceipts':candidate.get('sourceReceipts',[]),'includedReceipts':['readme-raw.md','tree.json'],'note':'HTML page checks are preserved as receipt metadata; page-session HTML is not copied. The CC deed returned 403, while pinned dataset READMEs explicitly state CC BY 4.0.'}
    for name in ('readme-raw.md','tree.json'):add_file(folder/'receipts'/name,Path('datasets')/ident/'receipts'/name,'source-license-receipt')
   generated(receipt,Path('datasets')/ident/'receipts'/'receipt-index.json','source-receipt-index')
  else:
   slug=ident.removeprefix('photos3d-synthetic-');src=base/'synthetic'/slug;manifest=load(src/'manifest.json');checks=load(src/'checksums.json');truth=load(src/'truth.json')
   require(filehash(src/'manifest.json')==record['manifestSha256'],ident,'Synthetic manifest differs from assets hash')
   renderer={'commit':record['rendererCommit'],'sourceHashes':[['tools/'+p,h] for p,h in manifest['source_sha256'].items()]};verify_sources(renderer,ident+' renderer')
   for p,want in [(base/'synthetic'/(slug+'-embedded.glb'),record['model']['sha256']),(base/'synthetic'/(slug+'.glb'),record['model']['originalModelSha256'])]:require(filehash(p)==want,ident,'Model source SHA mismatch (model will not be copied): '+p.name)
   expected={f['name'] for f in record['files']};require({c['name'] for c in truth['cameras']}==expected,ident,'Exact-camera truth identities differ')
   for view,camera in zip(manifest['views'],truth['cameras']):
    require(view['rgb']==camera['name'],ident,'Truth/manifest camera order differs')
    wtc=view['world_to_camera'];require(max(abs(a-b) for a,b in zip(camera['R'],sum([row[:3] for row in wtc[:3]],[])))<1e-10 and max(abs(camera['t'][i]-wtc[i][3]) for i in range(3))<1e-10,ident,'Truth pose differs from renderer: '+camera['name'])
   for name in ['manifest.json','checksums.json','asset-record.json','truth.json']+[f'view-{i:03d}.json' for i in range(24)]:
    p=src/name
    if name in checks:require(filehash(p)==checks[name]['sha256'] and p.stat().st_size==checks[name]['bytes'],ident,'Synthetic metadata checksum mismatch: '+name)
    add_file(p,Path('datasets')/ident/name,'synthetic-camera-metadata')
   for p in sorted(src.glob('view-*.mask.png')):
    require(filehash(p)==checks[p.name]['sha256'],ident,'Synthetic mask checksum mismatch: '+p.name)
    with Image.open(p) as im:require(mask_only(im,{0,1,3,255}),ident,'Synthetic mask is not mask-only: '+p.name)
    add_file(p,Path('datasets')/ident/p.name,'synthetic-mask','Kenney / CC0 1.0; calibrated renders made by Ryan with Codex (GPT-6)')
   generated({'renderer':renderer,'omitted':'All beauty/reference RGB, panorama RGB, depth rasters, source GLBs, textures, and archives are deliberately omitted; filenames/checksums remain in renderer manifests.','truthSceneSize':truth.get('sceneSize')},Path('datasets')/ident/'curation-notes.json','synthetic-provenance')
 # A source/license page text extraction, with the original HTML receipt SHA, carries no photos.
 receipt=base/'synthetic/food-kit.receipt.txt'
 if receipt.exists():
  from html.parser import HTMLParser
  class TextOnly(HTMLParser):
   def __init__(self):super().__init__();self.parts=[];self.skip=0
   def handle_starttag(self,tag,attrs):
    if tag in ('script','style'):self.skip+=1
   def handle_endtag(self,tag):
    if tag in ('script','style') and self.skip:self.skip-=1
   def handle_data(self,data):
    if not self.skip and data.strip():self.parts.append(data.strip())
  b=read(receipt);parser=TextOnly();parser.feed(b.decode());record_bytes(('Source: https://kenney.nl/assets/food-kit\nChecked: October 17, 2026\nOriginal HTML SHA256: '+sha(b)+'\nExtraction: text only; original HTML retained in local cache.\n\n'+'\n'.join(parser.parts)+'\n').encode(),'receipts/kenney-food-kit-source-text.txt','source-license-receipt',relative(receipt))
 # Explicit run/file selection; never glob every cache receipt into a publication payload.
 primary=list(args.run);exploratory=list(args.exploratory_run);extra=[]
 if args.file_list:
  text=args.file_list.read_text()
  if text.lstrip().startswith(('{','[')):
   spec=json.loads(text)
   if isinstance(spec,list):primary+=spec
   else:
    primary+=spec.get('primaryRuns',[]);exploratory+=spec.get('exploratoryRuns',[]);extra+=spec.get('files',[])
    for field in ('includeResults','allowInterrupted'):
     if field in spec and not isinstance(spec[field],bool):raise ValueError(field+' must be a JSON boolean')
    args.include_results=args.include_results or spec.get('includeResults',False)
    args.allow_interrupted=args.allow_interrupted or spec.get('allowInterrupted',False)
  else:primary += [line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith('#')]
 def resolve_run(name):
  p=Path(name)
  if len(p.parts)==1:p=runs/(p.name if p.suffix=='.json' else p.name+'.json')
  elif not p.is_absolute():p=repo/p
  p=p.resolve()
  if not under(p,cache) or under(p,out):raise RuntimeError('Receipt must be in the input cache, outside payload')
  return p
 def audit_input_rows(row,path):
  sources=row.get('sources')
  if sources is None:
   require('exact-correspondence' in row.get('kind',''),path,'Photo receipt lacks frozen input sources');return None
  require(len(sources)==len({s['name'] for s in sources}),path,'Duplicate input identity')
  matched=[r for r in all_records.values() if {f['name']:f['sha256'] for f in r['files']}=={s['name']:s['sha256'] for s in sources}]
  require(len(matched)==1,path,'Input SHA/name set does not match exactly one frozen assets selection')
  return matched[0] if len(matched)==1 else None
 def audit_recovery(row,path):
  recovery=row.get('recovery',{})
  require(row.get('status')=='interrupted' and recovery.get('schema')==1,path,'Interrupted receipt lacks explicit supported recovery metadata')
  specs=recovery.get('rawInputs',{})
  if not require(set(specs)=={'header','folds','checkpoint'},path,'Recovery needs exactly header, JSONL, and checkpoint inputs'):return {}
  originals={}
  for role,spec in specs.items():
   p=(repo/spec['path']).resolve()
   if not require(under(p,base) and not under(p,out),path,'Recovery input lies outside source cache'):continue
   b=read(p);require(len(b)==spec['bytes'] and sha(b)==spec['sha256'],path,'Recovery original byte/hash mismatch: '+role);originals[role]=(p,b)
  if set(originals)!=set(specs):return originals
  header=json.loads(originals['header'][1]);cp=json.loads(originals['checkpoint'][1]);lines=originals['folds'][1].splitlines(keepends=True)
  require(header.get('status')=='running',path,'Recovery header was not an interrupted running receipt')
  require(canonical(row.get('provenance'))==canonical(header.get('provenance')),path,'Recovery changed original runtime provenance')
  require(canonical(row.get('geometryProvenance'))==canonical(cp.get('geometryProvenance')),path,'Recovery changed original geometry provenance')
  require(canonical(row.get('sources'))==canonical(cp.get('sources')),path,'Recovery changed input identities')
  for field in ('settings','lenses','rejected','graph'):
   require(canonical(row.get(field))==canonical(cp.get(field)),path,'Recovery changed checkpoint '+field)
  require(canonical(row.get('cameras'))==canonical(cp['recon']['cams']),path,'Recovery camera data differs from original checkpoint')
  require(row.get('points')==len(cp['recon']['points']) and row.get('rmsBA')==cp['recon'].get('rmsBA'),path,'Recovery changed saved geometry measurements')
  core={k:v for k,v in cp.items() if k not in ('sources','geometryProvenance','originalCheckpoint')}
  require(canonical(row.get('checkpoint'))==canonical(core),path,'Recovery checkpoint differs from the original core')
  require(canonical([{'name':n} for n in cp['frameNames']])==canonical(row.get('decoded')),path,'Recovery invented decoded-frame identities or dimensions')
  folds=[json.loads(line) for line in lines if line.strip()]
  require(len(folds)==len(lines) and canonical(folds)==canonical(row.get('folds',[])),path,'Recovery changed, omitted, or reordered raw fold values')
  expected=[{'line':i+1,'bytes':len(line),'sha256':sha(line),'heldOut':folds[i].get('heldOut'),'status':folds[i].get('status')} for i,line in enumerate(lines)]
  require(canonical(expected)==canonical(recovery.get('rawFoldLineHashes')),path,'Recovery raw JSONL line hashes differ')
  require(row.get('error',{}).get('name')=='InterruptedError' and bool(recovery.get('method')),path,'Recovery does not explicitly identify interruption/method')
  context=recovery.get('maskContext',{})
  if context:
   mask=(repo/context.get('path','')).resolve()
   require(under(mask,cache) and filehash(mask)==context.get('sha256'),path,'Recovery frozen-mask context hash differs')
   try:
    b=subprocess.check_output(['git','show',context['assetsCommit']+':tools/assets.json'],cwd=repo,stderr=subprocess.PIPE)
    require(sha(b)==context.get('assetsFileSha256'),path,'Recovery mask-context asset-file hash differs')
    records=json.loads(b).get('photos3dBenchmarks',[]);record=next(r for r in records if r['id']==context['dataset'])
    require(record.get('evaluationMasks',{}).get('sha256')==context.get('sha256'),path,'Recovery mask context differs from committed asset record')
   except (KeyError,StopIteration,subprocess.CalledProcessError):issue('error',path,'Recovery mask-context committed asset record is unavailable')
  chronology=recovery.get('filesystemChronology',{})
  if chronology:
   require(chronology.get('maskModifiedBeforeHeader') is True,path,'Recovery chronology does not place the mask before the header')
   for role in ('header','folds'):
    require(originals[role][0].stat().st_mtime_ns==chronology.get(role,{}).get('mtimeNs'),path,'Recovery original filesystem chronology changed: '+role)
   require((repo/context['path']).stat().st_mtime_ns==chronology.get('mask',{}).get('mtimeNs'),path,'Recovery mask filesystem chronology changed')
  issue('warning',path,'Explicit interrupted partial receipt: unfinished folds are unmeasured; frozen-mask context is not a final mask hash recorded by the interrupted runtime')
  return originals
 def fold_protocol(row,path):
  prov=row.get('provenance',{});options=prov.get('options',{});hashes=dict(prov.get('sourceHashes',[]));commit=prov.get('commit')
  profile=row.get('settings',{}).get('profile') or row.get('checkpoint',{}).get('settings',{}).get('profile')
  # Resolve defaults from each receipt's own historical tier source, never the live checkout.
  tier_source=subprocess.check_output(['git','show',commit+':src/video3d/frames.js'],cwd=repo,text=True)
  tier_match=re.search(r'\b'+re.escape(profile or '')+r'\s*:\s*\{([^}]+)\}',tier_source)
  if not require(bool(tier_match),path,'Cannot resolve recorded training profile'):return {}
  tier={k:int(v) for k,v in re.findall(r'(\w+)\s*:\s*(\d+)',tier_match.group(1))}
  iterations=int(options.get('iterations') or 0);seed_limit=int(options['seed']) if options.get('seed') else tier.get('seed',60000)
  run_source=subprocess.check_output(['git','show',commit+':src/photos3d/run.js'],cwd=repo,text=True)
  rng=re.search(r'trainer:\s*\{\s*seed:\s*(\d+)',run_source)
  require(bool(rng),path,'Cannot resolve fixed trainer RNG seed from recorded source')
  relevant=[]
  for file,raw_hash in sorted(hashes.items()):
   if (file.startswith('vendor/splatjs/src/') or file in ('src/photos3d/run.js','src/photos3d/appearance.js','src/video3d/frames.js','src/video3d/run.js','src/video3d/surface-seed.js','src/video3d/scene.js','tools/photos3d-evaluate.mjs','tools/studio-truth/metrics.mjs')):
    effective=EVALUATOR_EQUIVALENCE['canonicalTrainingSha256'] if file==EVALUATOR_EQUIVALENCE['path'] and raw_hash in EVALUATOR_EQUIVALENCE['hashes'] else raw_hash
    relevant.append([file,effective])
  required={'src/photos3d/run.js','src/photos3d/appearance.js','src/video3d/frames.js','src/video3d/run.js','src/video3d/surface-seed.js','src/video3d/scene.js','tools/photos3d-evaluate.mjs','tools/studio-truth/metrics.mjs','vendor/splatjs/src/session.js','vendor/splatjs/src/gs/trainer.js'}
  require(required<=set(hashes),path,'Missing a source hash needed to group training/metric protocols')
  mask=row.get('maskSha256') or row.get('recovery',{}).get('maskContext',{}).get('sha256')
  host_source=subprocess.check_output(['git','show',commit+':tools/photos3d-probe.mjs'],cwd=repo,text=True)
  dispatch=re.search(r'page\.evaluate\(options\.round2 \? browserRound2 : browserProbe, \{[\s\S]*?\n      \}\),',host_source)
  require(bool(dispatch),path,'Cannot fingerprint the recorded host-to-browser option mapping')
  return {'schema':1,'hostBrowserOptionsSha256':sha(dispatch.group(0).encode()) if dispatch else None,'targetIterations':iterations,'resolvedProfile':profile,'resolvedTier':tier,'initialSeedBudget':min(tier['splats'],seed_limit),'trainerRngSeed':int(rng.group(1)) if rng else None,'evaluationMaskSha256':mask,'trainingMetricSources':relevant,'backend':'forced SwiftShader host' if '--use-webgpu-adapter=swiftshader' in host_source else row.get('adapter')}
 def audit_receipt(row,path):
  start=len(issues);verify_sources(row.get('provenance'),relative(path)+' runtime');record=audit_input_rows(row,path)
  if record and row.get('maskSha256') is not None:require(row['maskSha256']==record.get('evaluationMasks',{}).get('sha256'),path,'Runtime annotation hash differs from frozen assets record')
  if row.get('geometryProvenance'):verify_sources(row['geometryProvenance'],relative(path)+' geometry-origin')
  sources={s['name'] for s in row.get('sources',[])};cameras=row.get('cameras',[]);registered=[c['name'] for c in cameras]
  require(len(registered)==len(set(registered)),path,'Duplicate returned camera identity')
  if sources:
   require(set(registered)<=sources,path,'Camera identities outside input selection')
   decoded=row.get('decoded',[]);decoded_names=[f['name'] for f in decoded]
   require(len(decoded_names)==len(set(decoded_names)),path,'Duplicate decoded identity')
   for c in cameras:
    if decoded:require(isinstance(c.get('imgIdx'),int) and 0<=c['imgIdx']<len(decoded) and decoded[c['imgIdx']]['name']==c['name'],path,'Camera imgIdx/name differs from decoded frame identity')
   graph=row.get('graph')
   if graph:
    photos=graph.get('photos',[]);graph_names={p['name'] for p in photos};rejected={p['name'] for p in row.get('rejected',[])}
    require(graph_names|rejected==sources,path,'Graph/rejection identities do not account for all inputs')
    require({p['name'] for p in photos if p.get('registered')}==set(registered),path,'Graph registration flags differ from returned cameras')
    require(all(p.get('registered') or p.get('reason') for p in photos),path,'An unregistered graph photo lacks a reason')
   elif not row.get('error'):require(bool(row.get('solveError') or row.get('rejected')),path,'No graph/accounting or explicit solve failure')
   if row.get('missing') is not None:require({p['name'] for p in row['missing']}==sources-set(registered),path,'Missing-view identities differ from registration complement')
  folds=row.get('folds',[]);planned=row.get('plannedFolds');names=[f.get('heldOut') for f in folds]
  if planned is not None:
   require(len(planned)==len(set(planned)),path,'Duplicate planned fold identity');require(len(names)==len(set(names)) and set(names)<=set(planned),path,'Duplicate/unplanned fold receipt')
   if row.get('provenance',{}).get('options',{}).get('folds')=='all':require(set(planned)==sources,path,'All-fold plan omits input identities')
  for fold in folds:
   held=fold.get('heldOut');status=fold.get('status');training=fold.get('trainingNames')
   if training is not None:require(len(training)==len(set(training)) and set(training)==set(registered)-({held} if held else set()),path,'Fold training identities differ from registered other cameras: '+str(held))
   if held:require(held in sources,path,'Held-out identity absent from inputs')
   if status=='complete':
    if held:
     require(held in registered and training is not None,path,'Completed held-out fold lacks solved camera or training identities')
     metrics=fold.get('metrics',{});require(isinstance(metrics.get('ssim'),(int,float)) and math.isfinite(metrics['ssim']) and metrics.get('ssimWindows',0)>0,path,'Completed held-out fold lacks finite SSIM windows')
   elif status=='unregistered':require(held not in registered and bool(fold.get('reason')),path,'Invalid unregistered fold receipt')
   elif status not in ('failed','running'):issue('error',path,'Unknown fold status: '+str(status))
  counts=row.get('foldCounts')
  if counts:
   expected={'planned':len(planned or []),'complete':sum(f.get('status')=='complete' for f in folds),'failed':sum(f.get('status')=='failed' for f in folds),'unregistered':sum(f.get('status')=='unregistered' for f in folds),'unfinished':len(planned or [])-sum(f.get('status')!='running' for f in folds)};require(counts==expected,path,'Fold counters differ from receipts')
  elif planned is None and folds:issue('warning',path,'Legacy receipt has no explicit planned-fold accounting; coverage must be read from input/graph identities')
  return record,len(issues)-start
 selected=[]
 for role,names in [('primary',primary),('exploratory',exploratory)]:
  for name in names:
   p=resolve_run(name)
   if p in [v[1] for v in selected]:raise RuntimeError('Duplicate run selection: '+str(p))
   selected.append((role,p))
 selected_stems=set()
 for role,p in selected:
  start=len(issues);inventory_start=len(inventory);raw=read(p);row=json.loads(raw);entry={'name':p.stem,'role':role,'source':relative(p),'originalSha256':sha(raw),'originalBytes':len(raw)}
  if row.get('status')=='running' or any(f.get('status')=='running' for f in row.get('folds',[])):
   issue('error',p,'Running receipt refused; raw cache left untouched');entry.update(included=False,reason='running');audit_runs.append(entry);continue
  recovery_inputs={}
  if row.get('status')=='interrupted':
   if not args.allow_interrupted:
    issue('error',p,'Interrupted primary receipts require explicit --allow-interrupted');entry.update(included=False,reason='interrupted not explicitly enabled');audit_runs.append(entry);continue
   recovery_inputs=audit_recovery(row,p)
  record,_=audit_receipt(row,p);errors=[x for x in issues[start:] if x['severity']=='error'];entry['issues']=issues[start:]
  if errors and role=='primary':entry.update(included=False,reason='primary audit errors');audit_runs.append(entry);continue
  stem=p.stem;selected_stems.add(stem);dest=Path('runs')/role/stem;attr=(record.get('attribution') or record['author']+' / '+record['license']) if record else 'Analytic correspondence control; code MIT, procedural control made by Ryan with Codex (GPT-6)'
  add_file(p,dest/p.name,role+'-raw-receipt',attr,True);entry.update(included=True,dataset=record['id'] if record else None)
  if recovery_inputs:
   for source_role,(original,b) in recovery_inputs.items():record_bytes(b,dest/'recovery-inputs'/original.name,'recovery-source-'+source_role,relative(original),attr,True)
   add_file(base/'recover-interrupted.py',dest/'recover-interrupted.py','recovery-script')
  # Matching prefixes only; legacy external checkpoints inherit origin only after exact comparison.
  for cp in sorted(p.parent.glob(stem+'.geometry*.json')):
   data=read(cp);obj=json.loads(data);before=len(issues);origin=obj.get('geometryProvenance')
   if origin:verify_sources(origin,relative(cp)+' geometry-origin')
   elif row.get('checkpoint'):
    core={k:v for k,v in obj.items() if k not in ('sources','geometryProvenance','originalCheckpoint')}
    require(canonical(core)==canonical(row['checkpoint']),cp,'Legacy checkpoint does not exactly match its parent receipt')
    verify_sources(row.get('geometryProvenance') or row.get('provenance'),relative(cp)+' inherited origin')
    issue('warning',cp,'Legacy origin is inherited in this audit from exact-matching parent raw receipt; artifact bytes remain unchanged')
   else:issue('error',cp,'Checkpoint lacks verifiable origin provenance')
   if obj.get('sources') is not None:require(obj['sources']==row.get('sources'),cp,'Checkpoint input sources differ from parent receipt')
   if obj.get('originalCheckpoint'):
    original=cp.parent/obj['originalCheckpoint']['name'];require(filehash(original)==obj['originalCheckpoint']['sha256'],cp,'Enriched checkpoint original-receipt hash mismatch')
   if not any(i['severity']=='error' for i in issues[before:]) or role=='exploratory':record_bytes(data,dest/cp.name,'geometry-checkpoint',relative(cp),attr,True)
  log=p.with_suffix('.log')
  if log.exists():add_file(log,dest/log.name,'diagnostic-log')
  folds=p.with_name(stem+'.folds.jsonl')
  if folds.exists():
   b=read(folds);lines=[json.loads(v) for v in b.splitlines() if v.strip()]
   require(canonical(lines)==canonical(row.get('folds',[])),folds,'Incremental JSONL differs from final raw fold receipts')
   record_bytes(b,dest/folds.name,'incremental-fold-receipts',relative(folds),attr,True)
  if args.include_results:
   valid_folds={f.get('heldOut') or 'preview':f for f in row.get('folds',[]) if f.get('status')=='complete'}
   result_stem=row.get('recovery',{}).get('resultsStem',stem)
   if Path(result_stem).name!=result_stem:raise RuntimeError('Unsafe recovered result stem')
   for result in sorted(p.parent.glob(result_stem+'.*.render.png')):
    view=result.name[len(result_stem)+1:-len('.render.png')]
    if not require(view in valid_folds,result,'Trained render lacks matching completed fold receipt'):continue
    add_file(result,dest/result.name,'trained-result',attr+'; derived partial reconstruction, not an input photograph or acceptance proof')
   ply=p.with_suffix('.ply')
   if ply.exists():
    expected={f.get('plySha256') for f in valid_folds.values() if f.get('plySha256')};require(filehash(ply) in expected,ply,'PLY SHA does not match a completed export receipt');add_file(ply,dest/ply.name,'trained-result',attr+'; derived partial reconstruction')
  # A primary receipt cannot retain publication files if a linked checkpoint/result audit fails.
  if role=='primary' and any(i['severity']=='error' for i in issues[start:]):
   for item in inventory[inventory_start:]:
    if not args.audit_only:(stage/item['path']).unlink(missing_ok=True)
   del inventory[inventory_start:];entry.update(included=False,reason='primary linked-artifact audit errors')
  if role=='primary' and entry.get('included'):
   geometry=row.get('checkpoint',{}).get('recon');origin=row.get('geometryProvenance') or row.get('provenance',{})
   geometry_hash=sha(canonical(geometry).encode()) if geometry else None
   protocol=fold_protocol(row,p) if any(f.get('heldOut') for f in row.get('folds',[])) else {}
   protocol_hash=sha(canonical(protocol).encode())
   input_hash=sha(canonical(sorted(row.get('sources',[]),key=lambda s:s['name'])).encode())
   for fold in row.get('folds',[]):
    if not fold.get('heldOut'):continue
    key=(input_hash,origin.get('commit'),geometry_hash,protocol_hash,fold['heldOut']);fold_hash=sha(canonical(fold).encode());reference={'run':relative(p),'status':fold.get('status'),'rawFoldValueSha256':fold_hash,'runtimeCommit':row.get('provenance',{}).get('commit'),'rawTrainingMetricSourceHashes':[[file,dict(row['provenance']['sourceHashes'])[file]] for file,_ in protocol.get('trainingMetricSources',[])],'maskIdentityBasis':'later frozen context only; missing final runtime SHA' if row.get('recovery') else 'runtime receipt; consult recorded host source for hash capture timing'}
    if key in primary_fold_ledger:
     existing=primary_fold_ledger[key]
     if existing['rawFoldValueSha256']==fold_hash:existing['identicalDuplicateReferences'].append(reference)
     else:issue('error',p,'Conflicting primary fold for the same frozen inputs, exact geometry, geometry-origin commit, training/metric protocol, and heldOut: '+fold['heldOut']+'; no score-based selection is permitted')
    else:primary_fold_ledger[key]={'inputIdentitySha256':input_hash,'geometryCommit':origin.get('commit'),'geometryDataSha256':geometry_hash,'protocolSha256':protocol_hash,'protocol':protocol,'heldOut':fold['heldOut'],'status':fold.get('status'),'rawFoldValueSha256':fold_hash,'firstReference':reference,'identicalDuplicateReferences':[]}
  if role=='primary' and entry.get('included') and any(i['severity']=='error' for i in issues[start:]):
   for item in inventory[inventory_start:]:
    if not args.audit_only:(stage/item['path']).unlink(missing_ok=True)
   del inventory[inventory_start:];entry.update(included=False,reason='conflicting primary fold receipt')
   for key,value in list(primary_fold_ledger.items()):
    if value['firstReference']['run']==relative(p):del primary_fold_ledger[key]
    else:value['identicalDuplicateReferences']=[v for v in value['identicalDuplicateReferences'] if v['run']!=relative(p)]
  if role=='primary' and entry.get('included'):selected_primary_receipts[p.stem]={'row':row,'source':relative(p),'rawSha256':sha(raw),'rawBytes':len(raw)}
  entry['issues']=issues[start:];audit_runs.append(entry)
 for item in extra:
  item={'path':item,'role':'verification-log'} if isinstance(item,str) else item;p=Path(item['path']);p=p if p.is_absolute() else repo/p
  if not under(p,cache) or under(p,out):raise RuntimeError('Extra file must be in the input cache outside payload')
  role=item.get('role')
  if role=='verification-log' and p.suffix in ('.log','.txt'):dest=Path('verification')/p.name
  elif role=='verification-trace' and p.resolve()==(base/'preflight-first-failure/trace.zip').resolve():dest=Path('verification/preflight-first-failure/trace.zip')
  elif role=='verification-context' and p.resolve()==(base/'preflight-first-failure/error-context.md').resolve():dest=Path('verification/preflight-first-failure/error-context.md')
  else:raise RuntimeError('Extra files accept verification-log .log/.txt, or the exact known preflight trace/context; select raw JSONs through primaryRuns')
  add_file(p,dest,role)
 # Compare only explicitly selected and individually valid primary receipts, never discover runs by glob.
 order_comparisons=[]
 for sorted_name,shuffled_name in ORDER_PAIRS:
  if sorted_name not in selected_primary_receipts or shuffled_name not in selected_primary_receipts:continue
  left=selected_primary_receipts[sorted_name];right=selected_primary_receipts[shuffled_name];a=left['row'];b=right['row'];context=sorted_name+' vs '+shuffled_name
  def inputs(row):return sorted([[source['name'],source['sha256']] for source in row.get('sources',[])])
  input_left=inputs(a);input_right=inputs(b);order_left=a.get('inputOrder');order_right=b.get('inputOrder')
  same_inputs=input_left==input_right;changed_order=isinstance(order_left,list) and isinstance(order_right,list) and order_left!=order_right
  input_names=[name for name,_ in input_left]
  valid_orders=(isinstance(order_left,list) and isinstance(order_right,list) and sorted(order_left)==input_names and sorted(order_right)==input_names)
  seed_ok=b.get('shuffleSeed')==104
  require(same_inputs,context,'Order comparison inputs differ by frozen name/hash identity')
  require(valid_orders,context,'Order comparison inputOrder is not an exact permutation of frozen input identities')
  require(changed_order,context,'Order comparison does not contain an actual changed input order')
  require(seed_ok,context,'Shuffled order comparison does not record shuffleSeed104')
  comparisons={}
  for field in ('graph','cameras','points','rmsBA'):
   value_left={'present':field in a,'value':a.get(field)};value_right={'present':field in b,'value':b.get(field)}
   equal=canonical(value_left)==canonical(value_right)
   comparisons[field]={'equal':equal,'sortedPresent':field in a,'shuffledPresent':field in b,'sortedValueSha256':sha(canonical(value_left).encode()),'shuffledValueSha256':sha(canonical(value_right).encode())}
   require(equal,context,'Order comparison differs in '+field+'; measurements retained unchanged')
  order_comparisons.append({'sorted':{k:v for k,v in left.items() if k!='row'},'shuffled':{k:v for k,v in right.items() if k!='row'},'sortedFrozenInputsSha256':sha(canonical(input_left).encode()),'shuffledFrozenInputsSha256':sha(canonical(input_right).encode()),'sameFrozenInputs':same_inputs,'sortedInputOrder':order_left,'shuffledInputOrder':order_right,'actualOrderChanged':changed_order,'ordersAreExactInputPermutations':valid_orders,'shuffleSeed':b.get('shuffleSeed'),'shuffleSeed104':seed_ok,'comparisons':comparisons,'equal':same_inputs and valid_orders and changed_order and seed_ok and all(v['equal'] for v in comparisons.values()),'scope':'Exact parsed graph, camera array, point count, and RMS equality. Timing fields, progress-stage callback order, and source/provenance metadata are excluded. Absent geometry fields are explicitly marked absent; equality does not imply successful registration or any acceptance gate.'})
 report={'schema':VERSION,'curator':'Codex GPT-6','assetsSha256':sha(assets_bytes),'sourceCheckoutCommit':head,'datasetAudits':dataset_audits,'runAudits':audit_runs,'sourceAudits':list(source_audits.values()),'primaryFoldLedger':list(primary_fold_ledger.values()),'trainingEvaluatorEquivalence':EVALUATOR_EQUIVALENCE,'verificationTraceAudits':trace_audits,'orderComparisons':order_comparisons,'issues':issues,'summary':{'errors':sum(i['severity']=='error' for i in issues),'warnings':sum(i['severity']=='warning' for i in issues),'includedPrimaryRuns':sum(r.get('included') and r['role']=='primary' for r in audit_runs),'includedExploratoryRuns':sum(r.get('included') and r['role']=='exploratory' for r in audit_runs),'uniquePrimaryHeldOutFolds':len(primary_fold_ledger),'uniquePrimaryTrainingProtocols':len({v['protocolSha256'] for v in primary_fold_ledger.values()}),'orderComparisonPairs':len(order_comparisons),'unequalOrderComparisonPairs':sum(not v['equal'] for v in order_comparisons),'identicalDuplicateFoldReferences':sum(len(v['identicalDuplicateReferences']) for v in primary_fold_ledger.values())},'scope':'Local Git object content checks against each recorded public commit URL; no network reachability check, no new performance/quality measurements. Primary fold identities are deduplicated by frozen input set, exact geometry, originating commit, target training/configuration/source protocol, and heldOut; nonidentical duplicate receipts are errors, never selected by score.'}
 if args.audit_only:print(json.dumps(report,indent=2));return 2 if report['summary']['errors'] else 0
 # Recheck every copied source after curation to detect concurrent receipt changes.
 for name,snapshot in snapshots.items():
  p=Path(name)
  if filehash(p)!=snapshot['sha256']:issue('error',relative(p),'Copied source changed during curation')
 report['summary']['errors']=sum(i['severity']=='error' for i in issues);report['summary']['warnings']=sum(i['severity']=='warning' for i in issues)
 generated(report,'audit-report.json','curation-audit')
 generated({'schema':1,'primaryRuns':primary,'exploratoryRuns':exploratory,'files':extra,'includeResults':args.include_results,'allowInterrupted':args.allow_interrupted},'selection.json','explicit-selection')
 generated({'photos3dBenchmarks':assets.get('photos3dBenchmarks',[]),'photos3dSynthetic':assets.get('photos3dSynthetic',[]),'originalToolsAssetsSha256':sha(assets_bytes)},'assets-excerpt.json','frozen-assets-excerpt')
 add_file(Path(__file__),'curate-evidence.py','curation-script')
 add_file(base/'recover-interrupted.py','recover-interrupted.py','recovery-script')
 readme='''# Photos to 3D — round-two evidence\n\nThis directory is prepared for `codex/photos-to-3d-clips`, under `photos3d-round2-2026-10/`. It must never be merged into the product branch. Codex (GPT-6) prepared this evidence.\n\nNo acceptance gate is claimed here. The final report and explicit primary run selection determine which measurements support conclusions. See `selection.json`, `audit-report.json`, and `inventory.json`. An initial metadata-only payload intentionally contains no selected primary runs. Exploratory runs, if explicitly selected, remain separate and retain all audit failures. Running receipts are refused.\n\nThe real corpus contains three independent captures: AliceVision Buddha, alansartlog's textured die, and alansartlog's skull. Buddha24 and Buddha60 are overlapping selections of the same object capture and count once. Original photographs remain outside git. The synthetic corpus contains three distinct Kenney Food Kit objects rendered with the pinned task 105 renderer: burger-double, cake-birthday, and donut-sprinkles, each with 24 960×720 views and exact cameras. Synthetic views are not real captures.\n\nStandalone image artifacts are limited to mask PNGs and explicitly selected trained-result PNG/PLY files. Beauty/reference RGB inputs, original photos, contact sheets, source GLBs, source textures, source archives, and depth rasters are omitted. One explicit exception is the SHA-pinned preflight failure `verification/preflight-first-failure/trace.zip`, when selected with role `verification-trace`; its graph-plotter UI screenshots and test/resource snapshots are verification evidence, not photo inputs. The curator checks every uncompressed ZIP member against every frozen input-photo SHA-256 and records the member hashes. Arbitrary source archives remain forbidden. The matching `error-context.md` may be selected as `verification-context`. Renderer manifests retain filenames and checksums of deliberately omitted data; those references do not imply that the data is included. There are no vendored code snapshots: source audits link to recorded public Git commits. No network reachability check was performed by curation.\n\n## Protocol\n\nThe photo module proposes every unordered pair for 8–60 inputs, canonicalizes identities, reports graph support/components and unplaced views, checks lens metadata, and uses normalized per-photo camera intrinsics. Geometry may use every image's grayscale. Each appearance fold physically excludes the held-out RGB/mask/camera from sparse color rebuilding, surface seeding, trainer targets, loss, and environment fitting, and starts a fresh trainer. The final photo split disables the vendor's additional automatic holdout and blur exclusions. Older receipts retain their recorded implementation; never silently interpret them as later code. In particular, the legacy `ad6ca88f4` B24 phone preview PNGs used canvas readback that returned black, and their appearance training also had an extra automatic split. Those previews are not used for SSIM or appearance acceptance. Their independently computed geometry remains valid. The measured held-out appearance folds use [115f8ee79](https://github.com/ryanjosephkamp/splashery/commit/115f8ee79) and later fixes, which read actual GPU raster output and honor the explicit photo split; each receipt retains its exact source versions.\n\nReal-capture evaluation masks are approximate manual full-object silhouettes placed from input images alone; supports and background openings are excluded conservatively. Full methodology, limitations, source hashes, and normalized polygons remain in each `final-masks.json`. A uniform two-pixel Chebyshev erosion is applied at the annotation scale; stored real mask PNGs already include it. They are evaluation-only annotations, not ground truth and not training inputs. SSIM uses local unweighted 7×7 luma windows entirely within the mask; PSNR uses all masked RGB pixels. Missing, failed, and unregistered views must remain in coverage denominators. Conditional metrics on registered views cannot establish complete-scene acceptance. Synthetic mask PNGs are the renderer's object-index outputs; the manual tracing and erosion procedure applies to real-capture annotations.\n\nInput-photo hashes and each annotation's source-photo identity are checked before browser evaluation. Older probes recorded the annotation-file hash only after completion. The interrupted Buddha LOO200 batch did not reach that write: its recovered receipt has later frozen-mask hash context and supporting pre-run filesystem chronology, which do not prove the exact mask bytes consumed at runtime. That limitation stays attached to its measured folds.\n\nThe host-probe changes in [8032fda01](https://github.com/ryanjosephkamp/splashery/commit/8032fda01) hash the exact JSON buffers parsed for annotations, resumed geometry, and camera truth before browser work. For a known frozen dataset, the loaded annotation buffer must match its asset-record SHA-256. These loaded identities are written to the running header and retained in final/browser-error results. [de8ea7238](https://github.com/ryanjosephkamp/splashery/commit/de8ea7238) also retains those identities in pre-browser validation-error receipts. These changes strengthen future receipts; they do not retroactively provide missing hashes for earlier runs. Each selected receipt remains attributable to its own recorded host source.\n\nSoftware WebGPU, emulated viewport sizes, and brief training probes do not establish physical-phone latency, thermals, peak memory, or full training completion. Exact-correspondence controls bypass image features and do not count as rendered-set benchmarks.\n\n## Attribution\n\nBuddha photographs: Simone Gasparini, Fabien Castan, and Yann Lanthony / CC BY 4.0. Source: https://github.com/alicevision/dataset_buddha ; pinned license and README receipts accompany each selection.\n\n\"Photogrammetry Test Set: Dice - Turntable - Strong Lights - Heavily Textured w Watercolors\" and \"Photogrammetry Test Set: Skull - Cameramoves - Flash - No Background\" by alansartlog / CC BY 4.0. Author: https://alansartlog.com ; exact pinned project/license URLs and preferred attribution are in dataset records. Individual-image attribution appends its image number to the title. The CC deed returned HTTP 403; the pinned source READMEs explicitly state CC BY 4.0. The skull's manufacture is unspecified; no identifiable people or readable logos were observed in the inspected inputs.\n\nKenney Food Kit: https://kenney.nl/assets/food-kit / CC0 1.0. Calibrated synthetic renders and manual annotations made by Ryan with Codex (GPT-6). Renderer code and this curation script are MIT. Input-derived real reconstructions retain the corresponding CC BY 4.0 attribution; copying a trained result does not change its source license.\n\n## Reproduction\n\nRun this script from the main source checkout, with the original ignored cache present. It only writes under `.cache/photos3d/round2`. Example:\n\n```sh\npython .cache/photos3d/round2/curate-evidence.py --run buddha24-phone-sorted-final --run buddha24-phone-shuffled-final --include-results\npython .cache/photos3d/round2/curate-evidence.py --file-list .cache/photos3d/round2/selected-evidence.json\npython .cache/photos3d/round2/curate-evidence.py --run <receipt-name> --audit-only\n```\n\nA JSON file list accepts `{\"primaryRuns\":[],\"exploratoryRuns\":[],\"files\":[{\"path\":\".cache/photos3d/round2/diagnostics-final.log\",\"role\":\"verification-log\"}]}`. To add the promised graph-plotter failure evidence, append `{"path":".cache/photos3d/round2/preflight-first-failure/trace.zip","role":"verification-trace"}` and optionally `{"path":".cache/photos3d/round2/preflight-first-failure/error-context.md","role":"verification-context"}` to `files`. This trace documents the first preflight attempt only; its inclusion does not assert that a later rerun passed. A plain text list accepts one primary receipt path/name per line. JSON selections also accept explicit `includeResults` and `allowInterrupted` booleans and can be replayed directly. Results are opt-in through `--include-results` or `includeResults: true`. An interrupted derived partial receipt is opt-in through `--allow-interrupted` or `allowInterrupted: true`; enabling this never treats unfinished folds as measured or declares the original running header complete. Existing payloads are moved into `.payload-history/`; all original cache evidence remains untouched.\n\nRaw JSON/checkpoint files larger than 1,000,000 bytes are gzip-compressed with an empty filename and timestamp 0. Original raw receipts and checkpoints are never reformatted. Decompression yields byte-for-byte original content, including original whitespace and numeric spellings. Derived recovery envelopes and generated metadata are separately labeled; they do not replace the raw inputs. Inventory entries record both original and archive SHA-256/byte counts. `inventory.json` cannot hash itself; its own hash is in `inventory.sha256`. Audit errors must be resolved by choosing valid receipts or preserving them explicitly as exploratory; curation never edits raw evidence.\n'''
 readme+='''\n## Interrupted receipt recovery and duplicate accounting\n\n`recover-interrupted.py` creates an explicit derived partial envelope from a saved running header, completed geometry checkpoint, and finished JSONL rows. Original receipts are not rewritten. The recovered envelope retains runtime and geometry-origin provenance, all planned identities, unfinished counts, original artifact SHA-256 values, and exact raw-line hashes. Recovery does not invent total duration, missing scores, or completion. A missing final runtime mask hash remains an explicit limitation; later frozen-mask context and supporting filesystem chronology do not substitute for that missing runtime hash.\n\nSelecting such an envelope as primary additionally requires `--allow-interrupted` (or the explicit JSON selection field `"allowInterrupted": true`). Its original running header is included only as a hashed recovery source, never represented as a completed run. Original JSONL bytes and checkpoint bytes are retained, with deterministic gzip where needed.\n\nThe audit's primary-fold ledger deduplicates exact identical raw fold rows by frozen input identities, exact geometry, originating geometry commit, target iterations, resolved profile/tier and seed budget, fixed trainer RNG seed, annotation identity, training/metric source signature, backend, and held-out identity. All duplicate references remain visible. When both explicit sorted/shuffled primary receipts are selected for Buddha24 or Buddha60 at phone or high settings, the audit requires identical frozen input hashes, an actual changed input order, and shuffle seed 104. It compares graph, camera array, point count, and RMS exactly, while excluding timings, progress callback order, and provenance metadata. Pair input/raw hashes and equality results remain in the audit; differences are flagged without changing measurements. Unselected or unfinished companion runs are never discovered automatically. Nonidentical duplicates are errors; no fold is selected by its score. Different training horizons and configurations form distinct experiments. Host-only provenance changes do not split an otherwise identical protocol; the actual host-to-browser option mapping is fingerprinted separately. Each reference retains its actual source hashes and commit. Only the two explicitly listed, statically reviewed evaluator hashes share a training signature: their differences affect fold accounting only; unknown future hashes remain distinct. The recovered batch uses its later frozen annotation hash as grouping context, with the missing runtime-hash caveat retained; grouping does not resolve that limitation.\n\n```sh\npython .cache/photos3d/round2/recover-interrupted.py --stem buddha24-phone-loo200\npython .cache/photos3d/round2/curate-evidence.py --run buddha24-phone-loo200-recovered --allow-interrupted --audit-only\n```\n'''
 record_bytes(readme.encode(),'README.md','artifact-readme','curation-authored protocol/credits')
 manifest={'schema':VERSION,'destination':'codex/photos-to-3d-clips:photos3d-round2-2026-10/','assetsSha256':sha(assets_bytes),'sourceCheckoutCommit':head,'compressionThresholdBytes':LIMIT,'files':sorted(inventory,key=lambda r:r['path']),'note':'Inventory omits its own bytes; inventory.sha256 authenticates this JSON. Original input images and models are deliberately absent.'}
 (stage/'.curation-owned').unlink();ib=encode(manifest);(stage/'inventory.json').write_bytes(ib);(stage/'inventory.sha256').write_text(sha(ib)+'  inventory.json\n')
 # Final boundary check: every published file is inventoried, apart from inventory's two files.
 actual={p.relative_to(stage).as_posix() for p in stage.rglob('*') if p.is_file()};expected={r['path'] for r in inventory}|{'inventory.json','inventory.sha256'}
 if actual!=expected:raise RuntimeError('Unexpected payload file escaped the allowlist')
 if out.exists():
  if not (out/'inventory.json').is_file():raise RuntimeError('Existing output is not a curation-owned payload')
  history=base/'.payload-history';history.mkdir(exist_ok=True);name=out.name+'-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');out.rename(history/name)
 stage.rename(out)
 print(json.dumps({'payload':relative(out),'files':len(actual),'bytes':sum(p.stat().st_size for p in out.rglob('*') if p.is_file()),'datasets':len(dataset_audits),'selectedRuns':len(audit_runs),**report['summary']},indent=2))
 return 2 if report['summary']['errors'] else 0
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as e:print('Curation stopped: '+str(e),file=sys.stderr);sys.exit(2)
