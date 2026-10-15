# Task 74 measurement and reproduction record

Made by Ryan with Codex (GPT-6), October 14, 2026. Rule check: none. This appendix documents
research runs; it does not add a tool to the application. Original harness code is offered under
MIT; original report diagrams and figure layouts are CC0. Existing source-photo and AI-made sample
credits are retained in [credits.json](credits.json), with AI-made inputs labeled. No private notes,
uploaded owner photos, newly downloaded dataset images, or third-party demo pictures are included.

## What ran

- Repository source: `e404cf36b60e7509f2cabc21dcd0f9f076fa8ef4`; source, model, runtime, and harness
  hashes in [build.json](build.json).
- Chromium 151.0.7922.173 at `/usr/bin/chromium`, Playwright 1.56.1, WebGL2 through ANGLE
  SwiftShader. Virtual AMD EPYC 9V74 CPU, five logical CPUs, about 18,007 MiB reported RAM. No
  physical phone or hardware GPU, CPU throttling, or Internet-transfer simulation.
- Eight separate browser pages: phone 390×844 / DPR 3 and desktop 1440×900 / DPR 1, each forced to
  low, mid, high, and max. Fixed drawing buffers use each profile's pixel-ratio cap. Profile
  adaptation is disabled. The selected sample is Forest path, Depth 0.5, Sharp, Flat off, Layers
  off, idle disabled, and ground off.
- Geometry stage: one worker request after a separately timed decode, using saved sample depth.
  Returned bytes count unique ArrayBuffers, excluding ImageBitmap and temporary allocations.
  Application readiness is a separate choose/build and two completed captures; stages are not
  additive because the separate geometry result is discarded before the application builds.
- Cadence: 35 orbit requests, first five discarded, 30 retained, at approximately ±30° on both axes.
  Each requests a render, waits for postrender, then a WebGL2 fence polled asynchronously. No
  screenshot readback inside this interval. Player updates stay enabled so Sharp's freshness remains
  valid. Additional asynchronous draws are possible and their count is not recorded by this small
  harness; these are completed-request timings, not standalone GPU kernel times or physical-device
  FPS. Median is the lower middle order statistic; p95 is nearest-rank. Each accepted request
  asserts active Sharp, and each terminal row confirms both Sharp on and foreground splats off.
- Inference: Forest path decoded once, unchanged engine with default 518-long-side input, shape
  518×350, WASM, one thread, one cold session request and two warm requests. Wall time includes
  localhost model loading/init on the first request, preprocessing, and worker messaging.
  `inferenceMs` times only `session.run()`. Neither includes geometry or the initial source decode.
  No new model was installed.
- Comparison: six original CC0 samples and four existing labeled AI-made hard cases, five signed
  controls each, 50 actual Sharp/Depthy pairs. Source/depth hashes and native sizes are in
  [comparison.json](comparison.json). This is qualitative conversion/render evidence, with
  first-order displacement matching and explicitly different camera models. It does not measure
  ground-truth target views or neural model accuracy.
- Depthy commit `6ff99c1eb975e820e7feee988cd0df3978ce0df2`, its original viewer/filter code, PIXI
  fork commit `69f7015c2540d821f2dfcb8a7972630c80bd9180`, and Lodash tag 2.4.1. These dependencies
  live only in the ignored cache. The original Angular app, hosted integrations, analytics, and
  bundled sample imagery were not used to produce the committed figures.
- All 100 accepted native frames passed a nonempty/color-diversity check; every original PNG figure
  region preserved its native RGBA bytes exactly. Browser captures and all ten original figures were
  inspected. The published figures are resized, lossy JPEG previews, separately checked for format,
  dimensions, nonempty content, and hashes. The native frame check in
  [frame-validation.json](frame-validation.json) applies to the originals, not the JPEG pixels; it
  cannot certify geometry accuracy, absence of halos, or hidden-color correctness.

## Published previews and retained originals

The Operator requested smaller Pages downloads. The ten published figures are now progressive JPEGs
at **1,600×725 pixels, quality 85**, produced by uniformly resizing each full PNG sheet with Lanczos
filtering. Only the preview's header note changes before resizing; source scene panels are not
cropped, aligned, or retouched. AI-made labels and all five signed view pairs remain visible. The
whole evidence folder is **under 2.6 MB**, below the requested 5 MB limit.

Raw native captures remain under `.cache/photo-3d-explained/results/`, and the ten original
2472×1120 PNG sheets remain under `.cache/photo-3d-explained/raw-figures/`. They are not committed
in this revision. [build.json](build.json) preserves the original PNG bytes, SHA-256 hashes,
dimensions, and storage scope. Earlier PR commit `7cb11c2b953f8121b1bed8917fb1ec50253e5f06`
contained the former PNGs; that history is preserved, while the revised file tree contains only JPEG
previews. A fresh clone can regenerate the originals with the steps below.

The raw capture dimensions, pixel hashes, and original figure-region checks remain historical
measurement data. JPEG preview hashes describe different files, and the previews are not pixel-exact
substitutes for those raw measurements. [credits.json](credits.json),
[comparison.json](comparison.json), and [frame-validation.json](frame-validation.json) identify both
scopes explicitly.

The first eight-row timing attempt allowed paused Player updates to expire Sharp freshness and used
responsive stage sizes. All retained terminal states show Sharp off. That attempt is **rejected**,
retained in [rejected-runs.json](rejected-runs.json), and absent from the report's performance
table. Its first illustrative frames did not assert mode and were replaced. A second guarded attempt
failed before publishing timing rows when freshness expired during cadence. The accepted harness
below keeps Player updates enabled, fixes buffers, and asserts mode. No production guard or code was
disabled to get those checks to pass.

## Reproduce from the repository root

The repository's existing Node dependencies and `/usr/bin/chromium` must be available. Do not run
`playwright install`. Keep everything below under `.cache/`, and start the normal static server in
another terminal:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Prepare the comparator using its pinned sources, without running its old Grunt/Bower build:

```sh
mkdir -p .cache/photo-3d-explained
git clone https://github.com/panrafal/depthy.git .cache/photo-3d-explained/depthy
git -C .cache/photo-3d-explained/depthy checkout 6ff99c1eb975e820e7feee988cd0df3978ce0df2
curl -fL https://raw.githubusercontent.com/panrafal/pixi.js/69f7015c2540d821f2dfcb8a7972630c80bd9180/bin/pixi.dev.js -o .cache/photo-3d-explained/pixi.js
curl -fL https://raw.githubusercontent.com/lodash/lodash/2.4.1/dist/lodash.js -o .cache/photo-3d-explained/lodash.js
```

The opened primary URLs for the upstream tool and dependencies are recorded in
[sources.json](sources.json). Check downloaded-file hashes against [build.json](build.json).
Existing sample depth is unpacked and normalized, inverted to match Depthy's `1-depth.r`, and saved
as an 8-bit PNG. Splashery keeps its real cleanup path. Depthy's source aspect is fitted within
480×480; Splashery's drawing buffer is exactly 480×480. Native comparison captures have no resizing
or shared crop; the later JPEG publication step resizes their assembled sheets.

Write this minimal viewer page to `.cache/photo-3d-explained/depthy.html`:

<!-- prettier-ignore -->
```html
<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#171e28}#view{position:relative;width:100vw;height:100vh}canvas{position:absolute;left:50%;top:50%}</style><div id="view"></div>
<script>window.Modernizr={webgl:true,isMobile:false,chrome:true};</script>
<script src="lodash.js"></script><script src="pixi.js"></script>
<script src="depthy/app/scripts/pixi/ColorMatrixFilter2.js"></script><script src="depthy/app/scripts/pixi/DepthDisplacementFilter.js"></script><script src="depthy/app/scripts/pixi/DepthPerspectiveFilter.js"></script><script src="depthy/app/scripts/pixi/utils.js"></script><script src="depthy/app/scripts/classes/DepthyViewer.js"></script>
<script>window.viewer=new DepthyViewer(document.getElementById('view'),{size:{width:480,height:480},quality:5,retina:false,enlarge:1,depthBlurSize:0,depthFocus:0.5,depthScale:1,orient:false,hover:false,easeFactor:0,animate:false,pauseRender:true});</script>
```

Write this harness to `.cache/photo-3d-explained/measure.mjs`. It imports existing source modules;
no routes replace production code and no depth result is mocked:

<!-- prettier-ignore -->
```js
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import {ALL_SAMPLES, unpackDepth} from '../../src/packs/photo-3d.js';
import {HARD_CASE_SAMPLES} from '../../src/packs/hard-case-samples.js';
import {normalizeDepth} from '../../src/packs/photo-3d-core.js';
const out='.cache/photo-3d-explained/results';fs.mkdirSync(out,{recursive:true});
const root='http://127.0.0.1:4173/';
const save=(name,data)=>fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(data,null,2));
const writeImage=(name,url)=>fs.writeFileSync(`${out}/${name}.png`,Buffer.from(url.split(',')[1],'base64'));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info']});
const result={date:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),renderer:'ANGLE SwiftShader (software)',cpu:execFileSync('uname',['-m'],{encoding:'utf8'}).trim(),physicalPhone:false,cpuThrottled:false,rows:[]};
const prepare=async(p,profile)=>{await p.goto(root+`?labs=1&renderer=webgl2&profile=${profile}&adapt=off`);await p.waitForSelector("body[data-ready='true']",{timeout:180000});};
try {
 if(process.argv.includes('performance')) {
  for(const layout of [{name:'phone',width:390,height:844,dpr:3},{name:'desktop',width:1440,height:900,dpr:1}]) {
   for(const tier of ['low','mid','high','max']) {
    const p=await browser.newPage({viewport:{width:layout.width,height:layout.height},deviceScaleFactor:layout.dpr});await prepare(p,tier);
    const row=await p.evaluate(async()=>{
     const {app,player:pl}=window.__splashery;
     pl.stage.setFixedSize([Math.round(innerWidth*pl.stage.pixelRatio()),Math.round(innerHeight*pl.stage.pixelRatio())]);
     const stages={};const P=await import('/src/photo3d/prepare.js');
     // Worker-only geometry time, separately from visible application readiness.
     const pack=await import('/src/packs/photo-3d.js');
     const jpeg=await (await fetch('/assets/toys/photo-3d/forest.jpg')).blob();
     const tDecode=performance.now();const photo=await pack.decodePhoto(jpeg);stages.decodeMs=performance.now()-tDecode;
     const bytes=new Uint8Array(await (await fetch('/assets/toys/photo-3d/forest.depth')).arrayBuffer());
     const d=pack.unpackDepth(bytes);const tier=pl.profile;const count=Math.floor(pack.PHOTO_BUDGETS[tier]*0.95);
     const {SHARP_CELLS}=await import('/src/packs/photo-sharp.js');
     const tBuild=performance.now();const surface=await P.prepareSurface(photo,d,{count,depth:0.5,keepFlat:false,bitmap:true},SHARP_CELLS[tier]);stages.workerGeometryMs=performance.now()-tBuild;
     const buffers=new Set();const visit=v=>{if(ArrayBuffer.isView(v))buffers.add(v.buffer);else if(v&&typeof v==='object')for(const x of Object.values(v))visit(x)};visit(surface);
     stages.returnedSurfaceBytes=[...buffers].reduce((n,b)=>n+b.byteLength,0);surface.bitmap?.close();P.cancelSurface();
     const t=performance.now();await app.chooseToy('photo-3d');app.setLook({ground:'none'});pl.idle.weight=0;pl.opts.idleDelay=1e9;
     pl.motion.setControl('flat',0,{snap:true});pl.motion.setControl('layers',0,{snap:true});
     for(let k=0;k<2;k++){pl.toyInfo.recipe.drive(0,{flat:0,layers:0},{parts:{}});await pl.stage.captureFrame();if(!window.__psv.state().on)throw new Error('Sharp inactive at readiness');}stages.sampleReadyMs=performance.now()-t;pl.setPaused(false);
     const times=[];for(let i=0;i<35;i++){
      pl.camera.cur={...pl.camera.home,yaw:Math.PI/6*Math.sin(i/6),pitch:Math.PI/6*Math.cos(i/7)};pl.camera.tgt={...pl.camera.cur};pl.stage.setCameraPose(pl.camera.pose());
      pl.toyInfo.recipe.drive(0,{flat:0,layers:0},{parts:{}});
      pl.stage.aliveUntil=0;const start=performance.now();await new Promise(r=>{pl.stage.app.once('postrender',()=>{if(!window.__psv.state().on)throw new Error('Sharp inactive at postrender');r()});pl.stage.app.renderNextFrame=true});
      pl.stage.aliveUntil=0;pl.stage.app.renderNextFrame=false;const gl=pl.stage.device.gl;const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
      await new Promise((resolve,reject)=>{const check=()=>{const s=gl.clientWaitSync(fence,0,0);if(s===gl.WAIT_FAILED){gl.deleteSync(fence);reject(new Error('GPU fence failed'))}else if(s===gl.ALREADY_SIGNALED||s===gl.CONDITION_SATISFIED){gl.deleteSync(fence);resolve()}else setTimeout(check,0)};check()});
      if(!window.__psv.state().on)throw new Error('Sharp inactive during cadence');
      if(i>=5)times.push(performance.now()-start);
     }
     const sorted=[...times].sort((a,b)=>a-b);const gl=pl.stage.device.gl;const dbg=gl.getExtension('WEBGL_debug_renderer_info');
     return {tier,nominalBudget:pack.PHOTO_BUDGETS[tier],foregroundBudget:count,actualSplats:pl.proc.ctx.buf.count,source:[photo.w,photo.h],depth:[d.w,d.h],stages,sharp:window.__psv.state(),heapBytes:performance.memory?.usedJSHeapSize,buffer:[pl.stage.canvas.width,pl.stage.canvas.height],renderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),times,medianMs:sorted[14],p95Ms:sorted[28],meanMs:times.reduce((a,b)=>a+b,0)/times.length};
    });result.rows.push({layout:layout.name,...layout,...row});save('performance',result);console.log('PERF',layout.name,tier,row.stages,row.medianMs);await p.close();
   }
  }
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});await prepare(p,'low');
  result.inference=await p.evaluate(async()=>{
   const {decodePhoto}=await import('/src/packs/photo-3d.js');const photo=await decodePhoto(await(await fetch('/assets/toys/photo-3d/forest.jpg')).blob());
   const {createDepthClient}=await import('/src/depth/client.js');const c=createDepthClient();const runs=[];
   try {for(let i=0;i<3;i++){const start=performance.now();const r=await c.request('photo',{...photo,options:{}});runs.push({cold:i===0,wallMs:performance.now()-start,inferenceMs:r.ms,provider:r.provider,threads:r.threads,input:[r.w,r.h]})}}finally{c.dispose()}return {profile:'low',runs};
  });save('performance',result);console.log('INFERENCE',result.inference);await p.close();
 }
 if(process.argv.includes('comparison')) {
  const ids=['forest','street','still-life','spiral-stairs','palace-stairs','wildflowers','cdx-hard-glass-jug','cdx-hard-bicycle-spokes','cdx-hard-puddle-reflection','cdx-hard-workshop-bench'];
  const samples=[...ALL_SAMPLES,...HARD_CASE_SAMPLES];
  const p=await browser.newPage({viewport:{width:480,height:480}});await prepare(p,'mid');await p.evaluate(async()=>{await window.__splashery.app.chooseToy('photo-3d');window.__splashery.app.setLook({ground:'none',background:'#171e28'});window.__splashery.player.stage.setFixedSize([480,480]);});
  const q=await browser.newPage({viewport:{width:480,height:480}});q.on('pageerror',e=>console.log('DEPTHY ERROR',e.message));await q.goto(root+'.cache/photo-3d-explained/depthy.html');
  const rows=[];
  for(const id of ids){
   const sample=samples.find(s=>s.id===id);const base=`assets/toys/photo-3d/${sample.dir?sample.dir+'/':''}${sample.file||sample.id}`;
   const dbytes=fs.readFileSync(base+'.depth');const map=unpackDepth(dbytes);const d=normalizeDepth(map.d);const png=new PNG({width:map.w,height:map.h});
   // Depthy's filter internally uses 1-depth: white input is far, black is near.
   for(let i=0;i<d.length;i++){const v=Math.round((1-d[i])*255);png.data.set([v,v,v,255],i*4)}
   fs.writeFileSync(`${out}/${id}-depthy-depth.png`,PNG.sync.write(png));
   await p.evaluate(async({id})=>{const {app,player:pl}=window.__splashery;pl.setPaused(false);await app.setToyOptions({source:id,view:'sharp',detail:'photo',depth:0.5});pl.motion.setControl('flat',0,{snap:true});pl.motion.setControl('layers',0,{snap:true});pl.idle.weight=0;pl.opts.idleDelay=1e9;for(let i=0;i<2;i++){pl.toyInfo.recipe.drive(0,{flat:0,layers:0},{parts:{}});await pl.stage.captureFrame();if(!window.__psv.state().on)throw new Error('Sharp inactive at source selection');}pl.setPaused(false);},{id});
   await q.evaluate(async({image,depth})=>{await viewer.setImage(image);await viewer.setDepthmap(depth);for(let i=0;i<3;i++)viewer.render();},{image:'/'+base+'.jpg',depth:`results/${id}-depthy-depth.png`});
   const shots=[];
   for(const angle of [-30,-20,0,20,30]){
    const image=await p.evaluate(async(angle)=>{const pl=window.__splashery.player;pl.camera.cur={...pl.camera.home,yaw:angle*Math.PI/180,pitch:0};pl.camera.tgt={...pl.camera.cur};pl.stage.setCameraPose(pl.camera.pose());let frame;for(let i=0;i<2;i++){pl.toyInfo.recipe.drive(0,{flat:0,layers:0},{parts:{}});frame=await pl.stage.captureFrame();if(!window.__psv.state().on)throw new Error('Sharp inactive at comparison capture');}if(frame.width!==480||frame.height!==480)throw new Error('Wrong comparison drawing buffer');return frame.toDataURL();},angle);writeImage(`${id}-splashery-${angle}`,image);
    // Shared first-order disparity span in picture-height units, not equal camera poses.
    const scale=angle===0?0:(0.43*Math.sin(Math.abs(angle)*Math.PI/180))/1.5/0.02;
    const meta=await q.evaluate(({scale,sign})=>{viewer.setOptions({depthScale:scale});viewer.setOffset({x:sign,y:0});for(let i=0;i<3;i++)viewer.render();return {size:viewer.getSize(),options:viewer.getOptions(),data:viewer.getCanvas().toDataURL()};},{scale,sign:Math.sign(angle)});writeImage(`${id}-depthy-${angle}`,meta.data);delete meta.data;shots.push({angle,splashery:{view:'sharp',verifiedActive:true,buffer:[480,480]},depthy:meta});
   }
   rows.push({id,label:sample.label,ai:!!sample.ai,source:sample.source,author:sample.author,license:sample.license,imageFile:base+'.jpg',depthFile:base+'.depth',imageHash:crypto.createHash('sha256').update(fs.readFileSync(base+'.jpg')).digest('hex'),depthHash:crypto.createHash('sha256').update(dbytes).digest('hex'),depthShape:[map.w,map.h],shots});save('comparison',{...result,depthyCommit:execFileSync('git',['-C','.cache/photo-3d-explained/depthy','rev-parse','HEAD'],{encoding:'utf8'}).trim(),rows});console.log('COMPARE',id);
  }await p.close();await q.close();
 }
}finally{await browser.close()}
```

Run both measurements, sequentially, with the static server already running:

```sh
node .cache/photo-3d-explained/measure.mjs performance comparison
```

The harness writes raw PNGs and incremental JSON into `.cache/photo-3d-explained/results/`. Inspect
`sharp.on` and `sharp.splatsOff` in all eight timing rows, and the ten complete groups in
`comparison.json`. Timing naturally varies between runs; these data are not thresholds.

## Original figure layout and pixel verification

The following documentation preserves the original layout/verification script. It requires the
existing Pillow installation and DejaVu Sans font at the paths shown. Write it to
`.cache/photo-3d-explained/figures.py` and run it only after all ten groups complete. It produces
raw reports under `docs/audits/photo-3d-explained-2026-10/`; it does not edit application assets.
The pixel checks and native-pixel caption in this historical script describe the original PNG
sheets. Its separate inspection thumbnail is resized. After running it, **also run the preview
publication step below**, which retains the raw originals in the ignored cache, publishes smaller
JPEGs, and updates the records. Do not commit the intermediate PNGs.

<!-- prettier-ignore -->
```python
import json,pathlib,hashlib,shutil
from PIL import Image,ImageDraw,ImageFont,ImageStat
p=pathlib.Path('.cache/photo-3d-explained/results');out=pathlib.Path('docs/audits/photo-3d-explained-2026-10')
a=json.loads((p/'comparison.json').read_text());assert len(a['rows'])==10 and all(len(x['shots'])==5 for x in a['rows'])
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
valid=[];figures=[]
for row in a['rows']:
 board=Image.new('RGBA',(2472,1120),(23,30,40,255));draw=ImageDraw.Draw(board)
 draw.text((12,10),row['label']+' | Shared source JPEG and saved depth; different camera models',fill='white',font=font)
 draw.text((12,40),'Splashery: Sharp picture, mid, Depth 0.5; below: Depthy quality 5, no blur/enlargement. Native pixels; padding only.',fill='white',font=small)
 for j,shot in enumerate(row['shots']):
  angle=shot['angle'];assert shot['splashery']['verifiedActive']
  x=12+j*492
  for tool,y in [('splashery',96),('depthy',626)]:
   file=p/f"{row['id']}-{tool}-{angle}.png";im=Image.open(file).convert('RGBA')
   if tool=='splashery':assert im.size==(480,480)
   rgba=im.tobytes();colors=len(im.convert('RGB').getcolors(im.width*im.height));assert colors>100
   board.paste(im,(x,y));assert board.crop((x,y,x+im.width,y+im.height)).tobytes()==rgba
   valid.append({'sample':row['id'],'tool':tool,'angleControlLabel':angle,'width':im.width,'height':im.height,'distinctColors':colors,'pngSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'rgbaSha256':hashlib.sha256(rgba).hexdigest(),'figureRegion':[x,y,im.width,im.height],'preservedExactly':True})
  draw.text((x,74),f'Splashery yaw {angle:+d} deg' if angle else 'Splashery neutral',fill='white',font=small)
  draw.text((x,604),f"Depthy offset {shot['depthy']['options']['depthScale']:.3f} scale, sign {0 if angle==0 else (1 if angle>0 else -1):+d}",fill='white',font=small)
 file=out/(row['id']+'.png');board.save(file,optimize=True)
 figures.append({'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'maker':'made by Ryan with Codex (GPT-6)','sourceLabel':row['label'],'ai':row['ai'],'sourceAuthor':row['author'],'sourcePage':row['source'],'sourceLicense':row['license'],'inputImage':row['imageFile'],'inputImageSha256':row['imageHash'],'inputDepth':row['depthFile'],'inputDepthSha256':row['depthHash'],'changes':'Local browser relief/parallax renders; captions and padding outside native RGBA frames. No retouching, filtering, cropping, or resampling. AI-made inputs remain labeled.','layoutLicense':'Original caption/layout work CC0; no new license asserted for existing AI-made source pictures.'})
# Unchanged native pixels are retained inside the committed figures; separate raw PNGs stay cached.
shutil.copyfile(p/'comparison.json',out/'comparison.json')
(out/'frame-validation.json').write_text(json.dumps({'expectedSamples':10,'expectedPairs':50,'validatedNativeFrames':len(valid),'method':'Reject empty/uniform captures (distinct RGB colors >100). Assert Sharp for each Splashery capture and 480x480 buffer. Verify each figure region byte-for-byte against source RGBA. Also inspect representative full frames and all captioned figures. These checks do not measure depth accuracy or hidden-view correctness.','frames':valid},indent=2)+'\n')
(out/'credits.json').write_text(json.dumps({'checkedOn':'October 14, 2026','inputAttributionSource':'Existing src/packs/photo-3d.js and src/packs/hard-case-samples.js records; no external input image downloads. Source license records are inherited, not a new live-page license audit.','figures':figures},indent=2)+'\n')
# Inspection thumbnails are separate from the committed, unscaled evidence.
thumb=Image.new('RGB',(1500,1700),'#171e28')
for i,row in enumerate(a['rows']):
 im=Image.open(out/(row['id']+'.png')).convert('RGB');im.thumbnail((750,340));thumb.paste(im,((i%2)*750,(i//2)*340))
thumb.save('.cache/photo-3d-explained/all-figures-inspection.jpg')
print('Validated native frames',len(valid),'minimum RGB colors',min(v['distinctColors'] for v in valid),'figures',len(figures),'PNG bytes',sum((out/x['file']).stat().st_size for x in figures))
```

```sh
python3 .cache/photo-3d-explained/figures.py
```

## Preview publication

Save the following script as `.cache/photo-3d-explained/publish-figures.py` and run it after the
original figure generator. It verifies each original hash, keeps a cache copy, writes the JPEG
preview, removes the large PNG from the report folder, updates the JSON records and report links,
and enforces the whole-folder limit. It can also run again from the retained originals. The JPEG
header identifies the preview, replacing the original PNG's native-pixel caption only in this
published copy. Keep the cache copies out of Git.

<!-- prettier-ignore -->
```python
"""Publish task 74 previews; preserve raw provenance outside the current Git tree."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, shutil

out = Path('docs/audits/photo-3d-explained-2026-10')
raw = Path('.cache/photo-3d-explained/raw-figures')
raw.mkdir(parents=True, exist_ok=True)
credits = json.loads((out / 'credits.json').read_text())
build = json.loads((out / 'build.json').read_text())
comparison = json.loads((out / 'comparison.json').read_text())
validation = json.loads((out / 'frame-validation.json').read_text())
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
originals = {}
published = {}
for record in credits['figures']:
    original = record.get('original', {'file': record['file'], 'sha256': record['sha256']})
    name = original['file']
    assert name.endswith('.png')
    source = out / name
    cached = raw / name
    if source.exists():
        assert hashlib.sha256(source.read_bytes()).hexdigest() == original['sha256']
        shutil.copyfile(source, cached)
    assert hashlib.sha256(cached.read_bytes()).hexdigest() == original['sha256']
    with Image.open(cached) as image:
        original_size = list(image.size)
        preview = image.convert('RGB')
        # Clarify the old native-pixel caption only in the published copy.
        draw = ImageDraw.Draw(preview)
        draw.rectangle((0, 36, preview.width, 62), fill=(23, 30, 40))
        draw.text((12, 40),
            'JPEG preview: 1,600 px wide, quality 85. Native-pixel checks apply to the uncommitted original PNGs.',
            fill='white', font=font)
        size = (1600, round(image.height * 1600 / image.width))
        preview = preview.resize(size, Image.Resampling.LANCZOS)
        dest = out / (Path(name).stem + '.jpg')
        preview.save(dest, 'JPEG', quality=85, optimize=True, progressive=True)
    with Image.open(dest) as check:
        check.load()
        assert check.format == 'JPEG' and check.size == size
        assert len(check.convert('RGB').getcolors(check.width * check.height)) > 100
    originals[name] = {
        'bytes': cached.stat().st_size,
        'sha256': original['sha256'],
        'dimensions': original_size,
        'committedInCurrentTree': False,
    }
    preview_record = {
        'file': dest.name,
        'bytes': dest.stat().st_size,
        'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
        'dimensions': list(size),
        'format': 'JPEG', 'quality': 85, 'resample': 'LANCZOS',
        'original': {'file': name, **originals[name]},
    }
    record.update(preview_record)
    record['changes'] = (
        'Local browser relief/parallax renders assembled as an original native RGBA PNG sheet. '
        'The published copy replaces the header note, uniformly resizes the whole sheet to 1,600 pixels '
        'wide using Lanczos, and uses progressive JPEG quality 85. Scene panels are not cropped, '
        'aligned, or retouched; the published pixels are resampled and lossy. AI-made inputs remain labeled. '
        'Original PNG hashes are preserved in build.json; originals are not committed in this revision.'
    )
    published[Path(name).stem] = preview_record
    if source.exists():
        source.unlink()

publication = {
    'format': 'JPEG', 'width': 1600, 'quality': 85, 'resample': 'LANCZOS',
    'originalFiguresCommittedInCurrentTree': False,
    'originalsStorage': str(raw),
    'originalFiguresBytes': sum(x['bytes'] for x in originals.values()),
    'publishedFiguresBytes': sum(x['bytes'] for x in published.values()),
    'pixelExact': False,
    'note': 'Published previews are resized and lossy. Native capture hashes, dimensions, '
            'and exact-pixel checks describe the original PNGs, not these JPEG previews. '
            'Earlier PR commit 7cb11c2b953f8121b1bed8917fb1ec50253e5f06 contains the former PNGs; '
            'its history is preserved, while the revised file tree contains only previews.',
}
build['originalFigures'] = {
    'committedInCurrentTree': False, 'storage': str(raw),
    'previousPrCommit': '7cb11c2b953f8121b1bed8917fb1ec50253e5f06',
    'note': 'Raw originals are not committed in this revision. The earlier PR history is not rewritten.',
    'files': originals,
}
build['figurePublication'] = publication
credits['publication'] = publication
comparison['figurePublication'] = publication
for row in comparison['rows']:
    row['publishedFigure'] = published[row['id']]
validation['scope'] = (
    'Historical native captures and the original uncommitted PNG sheets. '
    'Original figure coordinates and exact-pixel checks do not apply to resized, lossy published JPEGs.'
)
validation['method'] = (
    'Reject empty/uniform original captures (distinct RGB colors >100). Assert Sharp for each '
    'Splashery capture and a 480x480 buffer. Verify each original PNG figure region byte-for-byte '
    'against source RGBA. The original sheets are kept in the ignored cache; their hashes are '
    'preserved in build.json. Published JPEG previews are separately checked for format, dimensions, '
    'nonempty image content, and file hashes. These checks do not measure depth accuracy or hidden-view correctness.'
)
validation['publishedFigures'] = list(published.values())
for frame in validation['frames']:
    if 'figureRegion' in frame:
        frame['originalFigureRegion'] = frame.pop('figureRegion')
    if 'preservedExactly' in frame:
        frame['preservedExactlyInOriginalFigure'] = frame.pop('preservedExactly')
for name, data in [('build.json', build), ('credits.json', credits),
                   ('comparison.json', comparison), ('frame-validation.json', validation)]:
    (out / name).write_text(json.dumps(data, indent=2) + '\n')
for path in [Path('docs/studio/photo-3d-explained.md'), Path('docs/studio/photo-3d-landscape.md')]:
    text = path.read_text()
    for name in originals:
        text = text.replace('/' + name + ')', '/' + Path(name).stem + '.jpg)')
    path.write_text(text)
assert not list(out.glob('*.png'))
folder_bytes = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
assert folder_bytes < 5_000_000, folder_bytes
print(json.dumps({'originalFigureBytes': publication['originalFiguresBytes'],
                  'publishedFigureBytes': publication['publishedFiguresBytes'],
                  'wholeFolderBytes': folder_bytes, 'count': len(published)}))
```

```sh
python3 .cache/photo-3d-explained/publish-figures.py
```

## Verification scope

The handoff runs the task-required whole-repository Prettier check and American English diff check,
plus whitespace, local-file/code-anchor, primary-source-access, complete matrix, image integrity,
and scope checks. There are three Mermaid diagrams in the two reports. Their source is included as
Markdown for GitHub rendering; no standalone diagram renderer was installed. No application
regression suite is required by task 74 because no application code changed. The real-browser
harness above is research verification, not an altered test suite.
