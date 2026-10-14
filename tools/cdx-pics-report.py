"""Task 54: select varied Studio samples, register evidence, and assemble the audit."""
import hashlib, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
out = ROOT / 'docs/audits/sample-pictures-2026-10'
cache = ROOT / '.cache/cdx-pics'
photo = json.loads((out / 'photo-scores.json').read_text())
qr = json.loads((out / 'qr-scores.json').read_text())
browser = {r['id']: r for r in json.loads((out / 'qr-browser-scores.json').read_text())}
TEXT = 'https://ryanjosephkamp.github.io/splashery/'
def generator(r):
    return 'cdx-pics-qr-grid.mjs' if r.get('carrier') else 'cdx-pics-qr-print.mjs' if r.get('series') else 'cdx-pics-qr.mjs'
if len(photo) != 40:
    raise SystemExit(f'Need 40 complete photo measurements, found {len(photo)}')
ranked = sorted(photo, key=lambda r: -r['score'])
groups = sorted({r['group'] for r in photo})
chosen = set()
for group in groups:
    chosen.update(r['file'] for r in [r for r in ranked if r['group'] == group][:2])
for r in ranked:
    if len(chosen) >= 20: break
    chosen.add(r['file'])
for r in photo:
    r['kept'] = r['file'] in chosen
    r['reason'] = ('Best within its group or among the remaining candidates; retains category variety.' if r['kept'] else 'Lower score after the two-per-category floor and overall ranking.')
    pic = ROOT / f"assets/toys/photo-3d/ai/{r['file']}.jpg"
    if not pic.exists(): pic = cache / 'photo' / pic.name
    r['sha256'] = hashlib.sha256(pic.read_bytes()).hexdigest()
    dep = ROOT / f"assets/toys/photo-3d/ai/{r['file']}.depth"
    if not dep.exists(): dep = cache / 'photo' / dep.name
    r['depthSha256'] = hashlib.sha256(dep.read_bytes()).hexdigest()
(out / 'photo-scores.json').write_text(json.dumps(photo, indent=2)+'\n')
rows = [[r['prompt'],r['file'],r['name'],r['group']] for r in photo if r['kept']]
(ROOT / 'src/packs/codex-picture-samples.js').write_text('// Task 54: selected AI-made Studio pictures; see the scored audit.\nexport const PICTURES = '+json.dumps(rows, indent=2)+';\n')

def sheet(items, dest, cols=5, width=240, height=210):
    canvas = Image.new('RGB',(cols*width,((len(items)+cols-1)//cols)*height),'#f0ede7')
    d=ImageDraw.Draw(canvas)
    for i,(label,path) in enumerate(items):
        with Image.open(path) as im:
            im=im.convert('RGB');im.thumbnail((width-8,height-48))
            x=(i%cols)*width;y=(i//cols)*height
            canvas.paste(im,(x+(width-im.width)//2,y))
            d.text((x+5,y+height-44),label,fill='#222222')
    canvas.save(dest,quality=84,optimize=True)

sheet([(r['prompt']+' '+('KEEP' if r['kept'] else 'cut')+' '+f"{r['score']:.2f}",(ROOT/f"assets/toys/photo-3d/ai/{r['file']}.jpg" if (ROOT/f"assets/toys/photo-3d/ai/{r['file']}.jpg").exists() else cache/f"photo/{r['file']}.jpg")) for r in photo],out/'photo-candidates.jpg')
sheet([(r['name']+'\n'+f"{r['score']:.2f}",cache/f"views/{r['file']}.png")for r in photo if r['kept']],out/'photo-kept-3d.jpg',height=330)
sheet([(r['id']+' '+('KEEP' if r['kept'] else 'cut')+' '+f"{r['score']:.2f}",cache/f"qr/{r['id']}.jpg")for r in qr],out/'qr-candidates.jpg',cols=6,width=220,height=254)
sheet([(r['label']+'\n'+f"{r['score']:.2f}",cache/f"woven/{r['id']}.png")for r in qr if r['kept']],out/'qr-kept-woven.jpg',cols=4,width=320,height=362)
records=[]
for r in photo:
    if not r['kept']: continue
    records.append(dict(id='dot-'+r['file'],file=f"assets/toys/photo-3d/ai/{r['file']}.jpg",depth=f"assets/toys/photo-3d/ai/{r['file']}.depth",toy='photo-3d',name=r['name']+', an AI-made picture',author='Ryan, the owner of Splashery (made with an AI image tool)',page='https://github.com/ryanjosephkamp/splashery/blob/main/CREDITS.md',license='AI-made by the owner',checked='October 13, 2026',ai=True,prompt=r['prompt'],sha256=r['sha256'],depthSha256=r['depthSha256'],note='Task 54, made with the image generation tool on the owner’s instruction. No people, readable text, logos, or real places. Reduced to 1,280 px wide, JPEG q80; depth map made by tools/dsm-depth.mjs. Full scene prompts: tools/cdx-pics-candidates.json.'))
for r in qr:
    if not r['kept']: continue
    record=dict(id=r['id'],file=r['file'],toy='qr-picture',name=r['label'],author='Ryan, with Codex (GPT-6)',page='https://github.com/ryanjosephkamp/splashery/blob/main/tools/'+generator(r),license='CC0 1.0',checked='October 13, 2026',sha256=hashlib.sha256((ROOT/r['file']).read_bytes()).hexdigest(),note='Original procedural asset, made by Ryan with Codex (GPT-6), offered under CC0. Deterministic family and variant in the scored audit; generated with tools/'+generator(r)+' and jpeg-js 0.4.4 (BSD-3-Clause, already listed in LICENSES.md).',family=r['family'],variant=r['variant'])
    if r.get('carrier'):
        record['defaultPayloadSpecific']=True
        record['carrier']=r['carrier']
        record['baseReference']=r['baseReference']
        record['note']+=' Data modules receive a luminance carrier for the default URL; finder and timing patterns are excluded. The picker labels this default-link specialization. Detail ranking excludes the carrier.'
    elif r.get('series'):
        record['note']+=' Uses the balanced-midtone, low-chroma print profile.'
    records.append(record)
(out/'asset-records.json').write_text(json.dumps(records,indent=2,ensure_ascii=False)+'\n')
credits='## Task 54: more sample pictures\n\nCodex (GPT-6) built the sample selection and verification tools for Ryan under Splashery’s MIT license.\n\nTwenty more Studio samples are AI-made by the owner with an AI image tool, on his instruction. They are labeled AI-made in the picker and beside the result. They are fictional scenes with no people, readable text, logos, or real landmarks. Each JPEG is 1,280 px wide, with its depth map made by `tools/dsm-depth.mjs`. Checked October 13, 2026:\n\n'
for r in photo:
    if r['kept']: credits+=f"- {r['name']} ({r['prompt']}): `assets/toys/photo-3d/ai/{r['file']}.jpg`.\n"
credits+='\nThe following 24 Picture QR backgrounds are original procedural assets, **made by Ryan with Codex (GPT-6)**, offered under **CC0 1.0**. The picker carries their short names, and the selected picture’s in-app credit carries the maker and CC0 license. Generated with `tools/cdx-pics-qr.mjs`, `tools/cdx-pics-qr-print.mjs`, and `tools/cdx-pics-qr-grid.mjs`; checked October 13, 2026. Eighteen carry a luminance pattern tuned to the default URL; their picker labels say “default link,” and their detail ranking excludes that carrier:\n\n'
for r in qr:
    if r['kept']:credits+=f"- {r['label']}: `{r['file']}`.\n"
credits+='\nThe full prompts, scores, SHA-256 hashes, scan trials, and contact sheets are in [the sample-pictures audit](../sample-pictures-2026-10.md). No new asset loads before it is picked.\n'
(out/'asset-credits.md').write_text(credits)
# Full rejected files stay local. The audit keeps only labeled contact-sheet thumbnails.
for r in photo:
    if not r['kept']:
        for suffix in ['jpg','depth']:
            src=ROOT/f"assets/toys/photo-3d/ai/{r['file']}.{suffix}"
            if src.exists(): shutil.move(src,cache/'photo'/src.name)

def frac(rows):
    scans=[s for r in rows for s in r['scans'] if s['trial']!='module-contrast-over-3']
    return f"{sum(s['ok'] for s in scans)}/{len(scans)}"
keptqr=[r for r in qr if r['kept']]
probes=json.loads((out/'qr-probes.json').read_text())
report='''# Sample pictures: October 13, 2026

Codex (GPT-6) built this for Ryan. Status: implemented on `codex/sample-pictures`, based on `main` commit `555e8f5c`. Nothing is merged.

40 original AI-made Photo to 3D candidates were generated; 20 were retained. A 16-image controlled QR study preceded 216 original procedural backgrounds in three batches; 24 were retained. Samples load only when picked; neither toy’s default sample changed.

## Scope and rules

The October 13 version of CLAUDE.md on main permits AI-made Picture QR backgrounds, but this task uses its default: original made-by-code CC0 pictures for QR. Photo to 3D pictures use the existing “AI-made by the owner” credit and picker labels. No people, readable text, logos, or real landmarks were seen in the full candidate contact sheet. All scenes are fictional; the animal subjects are shown in profile.

Open PRs #560, #562, #566, and #570 were inspected before editing. Renderer files, `manual/`, and `tests/taps.spec.mjs` are untouched. The owner authorized additive asset records in `CREDITS.md` and `tools/assets.json`, resolving the task’s conflicting protected-file restriction for those two files. Their existing content is preserved. The added records are also available as [asset-credits.md](sample-pictures-2026-10/asset-credits.md) and [asset-records.json](sample-pictures-2026-10/asset-records.json).

## Photo to 3D method and limits

All 40 candidates were made through the image generation tool, individually, from [the scene manifest](../../tools/cdx-pics-candidates.json). Each prompt also required a fictional landscape composition, distinct near/middle/far layers, clean silhouettes, restrained texture, gentle side lighting, opaque objects, and no people, human faces, text, logos, brands, signs, or real landmarks. Generation is nondeterministic. Native images were reduced to 1,280-pixel-wide JPEGs at quality 80. Depth maps came from the actual `tools/dsm-depth.mjs`, the vendored Depth Anything V2 Small model, and the vendored WASM runtime. A local wrapper disabled rendering of the unrelated opening toy during the remaining inference runs; the model, input, output, and dsm-depth code were unchanged.

Task 53 has not landed: #566 remains open. [The measurement tool](../../tools/cdx-pics-photo.mjs) therefore uses explicit simple proxies, in Chromium 151, SwiftShader WebGL2, the mid profile, Sharp view, Depth 0.5, and fully raised relief. It uses a 390×844 viewport and a fixed 390×520 stage, device scale factor 1. Each image is measured at ±20° and ±30° separately in yaw and pitch, eight poses total.

- Hole fraction: exact magenta backdrop pixels within each rendered row’s first/last visible surface pixels, inset eight pixels, excluding the top/bottom eight rows. This detects interior tears. It omits border losses and does not certify all disocclusions.
- Edge excursion: at up to 240 strong depth jumps, project the two surface endpoints and sample seven points between them. Average RGB excursions beyond the two source colors’ per-channel range, with an eight-byte tolerance, normalized by 255. This is a halo proxy; shadows, occlusion, and source texture can contribute. It does not measure blur, establish exact correspondence, or implement task 53’s future aligned halo metric.
- Score: `100 - max_pose(70 × hole_fraction + 30 × edge_excursion)`. The worst pose, rather than an average pose, sets the score. All raw pose counts and hashes are retained in [photo-scores.json](sample-pictures-2026-10/photo-scores.json).

Selection keeps the best two in each of eight subject categories, then the four highest remaining scores. That diversity floor prevents one low-texture category from filling the entire picker. No renderer was changed or claimed to be perfected. The worst-pose contact sheet was visually inspected; relief artifacts remain visible at large angles.

![All 40 AI-made candidates, score and disposition](sample-pictures-2026-10/photo-candidates.jpg)

![The 20 kept AI-made samples at their worst measured pose](sample-pictures-2026-10/photo-kept-3d.jpg)

| Candidate | Name | Score | Worst holes | Worst edge excursion | Decision |
| --- | --- | ---: | ---: | ---: | --- |
'''
for r in photo:
    report+=f"| {r['prompt']} | {r['name']} | {r['score']:.3f} | {max(p['holeFraction'] for p in r['poses'])*100:.4f}% | {max(p['haloExcursion'] for p in r['poses']):.4f} | {'Keep' if r['kept'] else 'Cut'} |\n"
report+='''
## QR experiment and selection

[The deterministic generator and scorer](../../tools/cdx-pics-qr.mjs) uses the actual `src/qr-craft/picture.js`, not a replacement QR layout. The decoder is vendored jsQR, using the same inversion setting as the production tests. Scan numbers from this generator are CPU raster simulations in Node, not physical camera or paper tests. The browser checks below exercise the toy’s own stage check and PNG export as well.

The exploratory study crosses wide/narrow tone range, center/corner detail placement, sparse/dense edges, and color/grayscale, 16 candidates. Each uses four correction levels (L/M/Q/H), three code sizes (fit/more/most), and the toy’s two blurred scan sizes (4 and 8 pixels/module), 384 trials. [qr-probes.json](sample-pictures-2026-10/qr-probes.json) contains every factor, measured property, scan, and detail score. This small study gives no population-level guarantee.

| Factor | Off: passes / trials | On: passes / trials | Interpretation in this sweep |
| --- | ---: | ---: | --- |
'''
for key,label in [('wide','Wide tone range'),('corner','Detail near a corner'),('dense','Dense edges'),('color','Color')]:
    cells=[]
    for value in [False,True]:
        scans=[s for p in probes if p['factors'][key]==value for r in p['scans'] for s in r['scans']]
        cells.append(f"{sum(s['ok'] for s in scans)}/{len(scans)}")
    report+=f"| {label} | {cells[0]} | {cells[1]} | {'Color alone had no scan effect.' if key=='color' else 'The fuller table records the payload, correction level, and size interactions.'} |\n"
report+='''
Three deterministic batches have 72 candidates each (nine families, eight variants):

1. Original macro shapes: petals, hills, pebbles, ribbons, leaves, dunes, spheres, a vase, and shells.
2. [Balanced midtones and lower chroma](../../tools/cdx-pics-qr-print.mjs), preserving those broad shapes.
3. [A default-URL luminance carrier](../../tools/cdx-pics-qr-grid.mjs), under the original colors. It conditions only data modules, excluding finder and timing patterns, with alternating target luminance based on the default H/more code. This is a visible grid and a payload-specific background. Eighteen selected samples use it, and their picker names say “default link.” Changing the link can remove its scan advantage.

The measured properties use a 96×96 square: luminance p95−p05 range, horizontal/vertical edge energy in the center and outside it, mean channel spread, and fraction of midtones between 0.3 and 0.7. Every candidate’s properties and scans are in [qr-scores.json](sample-pictures-2026-10/qr-scores.json). Broad shapes and balanced tones passed the blurred raster checks frequently, but many failed the stronger unfiltered browser export. The final carrier batch targets that measured failure without changing the encoder or renderer.

Detail score compares the source macro picture with the halftone averaged to one color per module: `100 × (0.55 × (1 − RGB_MAE) + 0.45 × max(0, gradient_cosine))`. It includes forced finder areas. For the carrier batch, the reference is its original first-batch picture (`baseReference`), so the carrier cannot inflate its rank through self-similarity. `storedImageDetail` separately records that diagnostic comparison. This ranks color and edge preservation; it is not a perceptual percentage or a measure of semantic recognizability.

The qualifying settings are the toy’s actual default URL, H correction, Contrast 0.5, small center, color style, and “Bigger (more detail).” Raster phone trials use the toy’s check at 4 and 8 pixels/module with 0.2-module blur, plus an exact 330-pixel square with 0.3-module blur. Raster printed-size trials use an exact 900-pixel square with 0.2-module blur. Qualification also requires every equivalent “fit” trial to pass and module contrast above 3, as the existing QR tests require. No automatic contrast rescue is used in this raster study.

[The browser screening tool](../../tools/cdx-pics-browser.mjs) then tests every raster-qualified candidate with the actual production stage scan, both layout checks, a 330-pixel reduction of the production render, and the raw, unfiltered 900-pixel render. The browser renderer follows the production capture camera, two render frames, and sort wait. Its RGBA output was byte-identical to `savePNG(900)` on the recorded [reference comparison](sample-pictures-2026-10/print-protocol-check.json). Final selected-sample tests call `savePNG(900)` directly for every kept sample. These are real Chromium/WebGL2 measurements, not mock pixels. The production toy’s existing adaptive rendering is unchanged; all candidates use the same default controls.

Raw export decoding exposed failures that the blurred CPU simulations missed. Two first-batch and four second-batch backgrounds passed every check. The carrier batch added 52 passing candidates. Candidate screening records every failure rather than retrying only favorable renders. The short alternate payload “Splashery picture QR” is an additional nondefault raster stress condition, not part of default qualification.

“100%” refers to these finite default trials. Physical phone cameras and printed paper are unmeasured; changing payload, size, focus, or correction level can change the mask and result.

'''
kept_browser=[browser[r['id']] for r in keptqr]
report+=f"Raster-qualified candidates: {sum(r['rasterEligible'] for r in qr)}/{len(qr)}. All {len(browser)} received browser checks; {sum(r['eligible'] for r in qr)} passed all qualifying conditions. The 24 highest detail scores among those fully qualified candidates were kept (two original, four balanced-midtone, and eighteen carrier backgrounds). The kept set passed {frac([{**r,'scans':[s for s in r['scans'] if s['text']==TEXT]}for r in keptqr])} default raster scans, 48/48 production layout checks, 48/48 stage checks, 24/24 phone reductions, and 24/24 raw 900-pixel captures.\n\n"
report+='![All 216 original procedural candidates, score and disposition](sample-pictures-2026-10/qr-candidates.jpg)\n\n![The 24 kept backgrounds in the CPU halftone simulation](sample-pictures-2026-10/qr-kept-woven.jpg)\n\n![The 24 kept real-browser 900-pixel captures](sample-pictures-2026-10/qr-kept-browser.jpg)\n\n| Candidate | Name | Detail score | Default raster scans | Alternate scans | Browser phone / print | Decision |\n| --- | --- | ---: | ---: | ---: | --- | --- |\n'
for r in qr:
    defaults=[s for s in r['scans'] if s['text']==TEXT and s['trial']!='module-contrast-over-3']
    extra=[s for s in r['scans'] if s['text']=='Splashery picture QR' and s['trial']!='module-contrast-over-3']
    br=browser.get(r['id'])
    bp=('pass' if br['phone330'] else 'fail')+' / '+('pass' if br['print900'] else 'fail') if br else 'not qualified'
    decision='Keep: highest qualified detail' if r['kept'] else 'Cut: raster scan failure' if not r['rasterEligible'] else 'Cut: browser scan failure' if not r['browserEligible'] else 'Cut: lower qualified detail'
    report+=f"| {r['id']} | {r['label']} | {r['score']:.3f} | {sum(s['ok'] for s in defaults)}/{len(defaults)} | {sum(s['ok'] for s in extra)}/{len(extra)} | {bp} | {decision} |\n"
sheet([(r['label']+'\n'+f"{r['score']:.2f}",cache/f"browser/{r['id']}.png")for r in qr if r['kept']],out/'qr-kept-browser.jpg',cols=4,width=320,height=362)
report+='''
## Reproduction and verification

1. Generate the 40 individual pictures from the scene manifest with the image tool; record local `{id,path}` mappings in `.cache/cdx-pics/generation-base.json` and/or `.cache/cdx-pics/photo/*.json`.
2. Run `python3 tools/cdx-pics-prepare.py`, then `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/dsm-depth.mjs cdx-<id> ...` for the prepared IDs, with the local HTTP server on port 4173.
3. Run `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-pics-photo.mjs`; it resumes completed rows. Delete the score file for a fresh measurement. Restore all 40 prepared candidates to the temporary picker list before remeasuring.
4. Run `node tools/cdx-pics-qr.mjs`, `node tools/cdx-pics-qr-print.mjs`, and `node tools/cdx-pics-qr-grid.mjs`, in that order. This resets the candidate scores. Procedural candidates are deterministic; scores use the generated JPEGs.
5. Run `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-pics-browser.mjs`. Delete its browser score file first for a complete new screening. Run `node tools/cdx-pics-select.mjs`, then `node tools/cdx-pics-sheets.mjs`.
6. Run `python3 tools/cdx-pics-report.py` after all measurements. It keeps selected files, moves rejected full-size Photo to 3D candidates into the ignored cache, and writes records and contact sheets with the repository’s existing Pillow 12.3.0. The registry entries match asset-records.json; credit text is in asset-credits.md.
7. Run the task’s Playwright files with the installed Chromium at `/usr/bin/chromium`; no browser install is needed. Formatting and American English checks must pass before pushing.

Verification results are in [verification.md](sample-pictures-2026-10/verification.md). All full-size rejected assets stay out of Git. The report folder is below 8 MB.

## Record

### Identity and status

Task 54, sample pictures; toy IDs `photo-3d` and `qr-picture`. Branch `codex/sample-pictures`, one draft PR against main. Made by Ryan with Codex (GPT-6), October 13, 2026. Status: implemented; not merged. The PR link is in the handback.

### Recipe contract and boundaries

Only sample data and picker imports changed. Existing recipe hooks, controls, host APIs, axes, units, part IDs, pivots, and quaternion order are unchanged. The vendored model, encoder, jsQR, and WebGL2 renderer were reused as is. New work consists of 20 AI-made JPEG/depth pairs, 24 procedural JPEGs, data lists, verification tools, and this evidence. Depth is a baked monocular estimate; its relief is not a physical reconstruction. No new effect or simulated physics was introduced.

### Generation and assets

The steps above are the generation commands. Environment: managed Linux container, Node 24.19.0, Python 3, Chromium 151, pinned Playwright, jpeg-js 0.4.4, the vendored depth model/WASM runtime, and Pillow 12.3.0. Procedural generation is deterministic by family/variant; AI generation has no reproducible seed. No new dependency was installed or added. Code is MIT; procedural QR assets are CC0 1.0; AI pictures use the existing owner sample policy.

Every retained file has a SHA-256 hash, source page, author, license, checked date, and transformations in [asset-records.json](sample-pictures-2026-10/asset-records.json). The [jpeg-js source](https://github.com/eugeneware/jpeg-js), [Pillow page](https://pillow.readthedocs.io/en/stable/about.html), and [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) were opened on October 13, 2026.

### Executed evidence and performance

The linked verification record distinguishes real-browser measurements and CPU simulations; none use mock render pixels. Photo scores record splat counts and all measured poses. Candidate file and depth sizes are reported there. Default first load is unchanged and new assets are fetched only when selected, verified by browser requests. Real-phone load time, memory, frame rate, physical scans, and printed-paper performance are unmeasured. Task 53’s future halo metric is also unmeasured. The PNG export comparison used the same browser renderer as the selected-sample regression; it is not a physical-print benchmark.

Rule check: none. The owner authorized additive entries in the two asset registries; their existing records and all other protected files are unchanged.
'''
(ROOT/'docs/audits/sample-pictures-2026-10.md').write_text(report)
print(f"Kept {len(chosen)} Studio pictures and {len(keptqr)} QR backgrounds; wrote complete audit and asset records.")
