"""Record the Operator's review: final subject pictures, five-link scans, and credits."""
import hashlib, json, re, subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/audits/sample-pictures-2026-10'
CACHE = ROOT / '.cache/cdx-pics/round2'
model = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {QR_PICTURES} from './src/qr-craft/codex-pictures.js';process.stdout.write(JSON.stringify(QR_PICTURES));"],cwd=ROOT))
rows = json.loads((OUT/'qr-review-scores.json').read_text())
browser = {r['id']:r for r in json.loads((OUT/'qr-review-browser.json').read_text())}
visual = json.loads((OUT/'qr-subject-review.json').read_text())
kept = [r for r in rows if r['kept']]
assert len(model)==len(kept)==24
byid = {r['id']:r for r in rows}
manifest = json.loads((ROOT/'tools/cdx-pics-qr-ai-prompts.json').read_text())
records = [r for r in json.loads((OUT/'asset-records.json').read_text()) if r['toy']=='photo-3d']
qrrecords=[]
for sample in model:
    r=byid[sample['id']]
    record={k:sample[k] for k in ['id','file','author','page','license','ai']}
    record.update(toy='qr-picture',name=sample['label'],checked='October 13, 2026',sha256=hashlib.sha256((ROOT/sample['file']).read_bytes()).hexdigest(),score=r['score'],testedLinks=[x['text'] for x in browser[r['id']]['links']])
    if sample['ai']:
        record.update(prompt=sample['prompt'],note='AI-made by the owner with an AI image tool, on his instruction. Fictional subject; no people, faces, logos, readable text, or real landmarks. Native square image resized to 960×960, JPEG quality 88. Full prompt: tools/cdx-pics-qr-ai-prompts.json. No payload-specific image conditioning.')
    else:
        record['note']='Original procedural picture, made by Ryan with Codex (GPT-6), CC0 1.0. No payload-specific image conditioning. Original family/variant and five-link measurements are in the scored audit.'
    qrrecords.append(record)
records+=qrrecords
(OUT/'asset-records.json').write_text(json.dumps(records,indent=2,ensure_ascii=False)+'\n')
assets=json.loads((ROOT/'tools/assets.json').read_text());assets['pictureQrSamples']=qrrecords
(ROOT/'tools/assets.json').write_text(json.dumps(assets,indent=2,ensure_ascii=False)+'\n')
credits=(ROOT/'CREDITS.md').read_text(); marker='\nThe following 24 Picture QR backgrounds'
assert marker in credits
prefix=credits.split(marker)[0]
credit="\nThe following 24 Picture QR backgrounds show clear subjects and have no URL-specific carriers. All 24 are **AI-made by the owner with an AI image tool**, on his instruction, labeled **AI-made** in the picker and in-app credit. Checked October 13, 2026:\n\n"
for r in model:credit+=f"- {r['label']} ({'AI-made by the owner' if r['ai'] else 'CC0, Ryan with Codex'}): `{r['file']}`.\n"
credit+='\nThe full prompts, hashes, scores, five-link scan rates, and phone-size contact sheet are in [the sample-pictures audit](docs/audits/sample-pictures-2026-10.md). No new asset loads before it is picked.\n'
(ROOT/'CREDITS.md').write_text(prefix+credit)
(OUT/'asset-credits.md').write_text(credit.strip().replace('(docs/audits/sample-pictures-2026-10.md)','(../sample-pictures-2026-10.md)')+'\n')

def sheet(items,file,cols=3,side=330):
    canvas=Image.new('RGB',(cols*side,((len(items)+cols-1)//cols)*(side+38)),'#f0ede7');draw=ImageDraw.Draw(canvas)
    for i,(label,path) in enumerate(items):
        im=Image.open(path).convert('RGB');im.thumbnail((side,side));x=i%cols*side;y=i//cols*(side+38);canvas.paste(im,(x,y));draw.text((x+5,y+side+3),label,fill='#222222')
    canvas.save(file,quality=86,optimize=True)
sheet([(r['label']+'\n'+f"{r['score']:.2f} · 5/5 links",CACHE/f"phone/{r['id']}-browser.png") for r in sorted(kept,key=lambda x:-x['score'])],OUT/'qr-final-phone.jpg')
sheet([(r['label']+'\n'+('AI-made' if r['ai'] else 'CC0'),ROOT/r['file']) for r in sorted(kept,key=lambda x:-x['score'])],OUT/'qr-final-sources.jpg',cols=4,side=240)

old=(ROOT/'docs/audits/sample-pictures-2026-10.md').read_text()
photo_start=old.index('## Photo to 3D method')
photo_end=old.index('## QR experiment') if '## QR experiment' in old else old.index('## Original QR experiment')
photo=old[photo_start:photo_end]
intro=f'''# Sample pictures: October 13, 2026

Made by Ryan with Codex (GPT-6). Implemented on `codex/sample-pictures`, draft [PR #582](https://github.com/ryanjosephkamp/splashery/pull/582). Main `4b0127da` was merged into the branch, without rebasing, including #585's 20 hard-case samples and #586's site rebuild. The later task-document-only update `c66a49e9` was also merged; it leaves application, tests, and assets unchanged. Both main's complete records/credit block and this task's records/credit block were preserved. Nothing is merged into main.

The accepted Photo to 3D set is unchanged: 20 AI-made samples from 40 measured candidates, with their original JPEGs, depth maps, labels, and records. The final Picture QR set has **24 recognizable AI-made subjects**. The 21 AI pictures accepted in the previous review are retained, and the three remaining procedural panels/silhouette are replaced by the best three eligible single subjects from ten new AI candidates. The combined history contains 42 AI candidates and six procedural subject pictures. All 18 URL-specific carriers from the first selection are removed from the picker, asset records, and shipping folder. Neither toy's default picture changed; new pictures load only when selected.

## Scope and rules

Main's AI-sample policy explicitly permits labeled AI-made Picture QR backgrounds (A3, #580). The new AI pictures are fictional still lifes with no people, faces, logos, readable text, or real landmarks. The complete native-candidate contact sheet was visually inspected. The Photo to 3D images remain under their accepted owner AI policy. The owner authorized registry additions in the first round; this review replaces only this task's QR entries and credit block, preserving all main and accepted Studio records. No renderer, encoder, depth model, manual page, or existing test assertion was edited. `tests/taps.spec.mjs` is untouched.

![Final 24: actual 330-pixel phone renders, score, and five-link scan rate](sample-pictures-2026-10/qr-final-phone.jpg)

![The same 24 AI-made source pictures](sample-pictures-2026-10/qr-final-sources.jpg)

'''
review='''## Revised QR selection and five-link protocol

The Operator's reviews called for recognizable phone-size subjects, payload-independent backgrounds, and finally stronger single objects in place of Pebble pool soft 6, Leaf canopy soft 6, and Ceramic vase 7. All procedural variants are retired from the shipping set. The 42 AI candidates use large, distinct silhouettes, restrained colors, quiet corners, and broad surfaces. The ten final-round objects add clearer volume, handles, rims, and shaded surfaces. The source pictures contain no QR pattern, grid, or payload-derived luminance carrier. Their prompts are recorded in [the scene manifest](../../tools/cdx-pics-qr-ai-prompts.json). Native images are retained locally; the shipping JPEGs are 960×960 at quality 88, made with the repository's licensed Pillow.

![The first 32 AI candidates](sample-pictures-2026-10/qr-ai-candidates.jpg)

![Ten final-round single-object candidates](sample-pictures-2026-10/qr-replacement-candidates.jpg)

![Actual 330-pixel renders of all ten replacements](sample-pictures-2026-10/qr-replacement-phone.jpg)

Five unrelated links, from 20 to 130 characters, are fixed in [cdx-pics-links.mjs](../../tools/cdx-pics-links.mjs). Every candidate uses H correction, Contrast 0.5, small center, color style, and More detail. The production encoder's built-in adaptive reliability nudge remains enabled, as in the toy; its resulting margin is recorded per link. No source image is conditioned on any payload.

'''
for text in rows[0]['links']:review+=f"- {text['characters']} characters: `{text['text']}`\n"
review+='''
The two standard production layout checks (4 and 8 pixels/module) are checked for each link. Screening then loads each JPEG through the toy's actual local-file decoder and builds its actual splats in Chromium/WebGL2. The front-camera capture follows `savePNG(900)` with two render frames and an 80 ms sort wait. Only the private measurement page's visible cover screenshot is omitted. The screening RGBA was byte-identical to `savePNG(900)` for the blue-vase default and 130-character cases; see [review-protocol-check.json](sample-pictures-2026-10/review-protocol-check.json). Final tests call the production scan check and `savePNG` as well.

Each link has four rendered qualifying checks: the raw 330-pixel phone reduction, rendered reductions at 4 and 8 pixels/module, and the 900-pixel printed-size **camera simulation with 0.2-module Gaussian focus blur**. The last is a simulation applied to real rendered pixels, not a physical print or camera measurement. The raw, unfiltered 900-pixel decode is separately reported below. It does not achieve 100% across links; a source can pass phone and focused-camera checks while its unresolved high-resolution halftone dots confuse jsQR. Standalone fixed-pixel CPU rasters at 330/900 and softer focus are also retained as diagnostics, including their failures. They are not substituted for the actual splat render.

All retained backgrounds pass 5/5 links and 20/20 rendered qualifying checks. That is a finite test result, not a guarantee for every possible link, size, lighting condition, or physical camera. Arbitrarily long links can exceed practical phone resolution. Raw-export rates are not hidden or claimed to be perfect.

The detail measure is the original RGB-fidelity/gradient-cosine metric applied to the production woven layout, averaged to one color per module: `100 × (0.55 × (1 − RGB_MAE) + 0.45 × max(0, gradient_cosine))`. **The minimum of the five link scores** ranks a candidate. It includes forced finder areas and is not a semantic-recognition percentage. Separately, the actual 330-pixel render is visually reviewed for a clear subject. The final review retains the accepted 21 AI pictures and selects the three highest worst-link scores among the ten new, fully scan-qualified, visually clear single objects. The visual subject gate takes priority over a procedural panel's numerically higher RGB-fidelity score; the detail metric is not a measure of object recognition. Every cut has a reason. [qr-review-scores.json](sample-pictures-2026-10/qr-review-scores.json), [qr-review-browser.json](sample-pictures-2026-10/qr-review-browser.json), and [qr-subject-review.json](sample-pictures-2026-10/qr-subject-review.json) contain the complete measurements and visual dispositions.

| Candidate | Subject | Origin | Worst-link detail | Rendered links | Raw 900px links | Decision |
| --- | --- | --- | ---: | ---: | ---: | --- |
'''
for r in rows:
    br=browser[r['id']];passed=sum(x['eligible'] for x in br['links']);raw=sum(x['raw900'] for x in br['links'])
    review+=f"| {r['id']} | {r['label']} | {'AI-made' if r['ai'] else 'CC0'} | {r['score']:.3f} | {passed}/5 | {raw}/5 | {'Keep' if r['kept'] else r['reason']} |\n"
history=json.loads((OUT/'qr-scores.json').read_text())
legacy='''
## Original QR experiment: retained as rejected-candidate history

Before the review, a 16-picture controlled study crossed tone range, detail location, edge density, and color, at L/M/Q/H and Fit/More/Most (384 trials). [qr-probes.json](sample-pictures-2026-10/qr-probes.json) retains all factors, properties, scans, and scores. This is a small exploratory sweep, not a population-level claim. It led to 216 procedural candidates in three 72-picture batches. The first-round CPU and browser scan histories remain in [qr-scores.json](sample-pictures-2026-10/qr-scores.json) and [qr-browser-scores.json](sample-pictures-2026-10/qr-browser-scores.json).

The third batch encoded a default-URL luminance carrier. Every carrier is now rejected. Its source-reference detail metric excluded the carrier, but that did not ensure recognizable subjects in the final phone render. The revised selection therefore adds a visual subject gate and five-link checks. The original default-URL selection and procedural contact sheet below are **superseded**, not the shipping set.

![All 216 first-round procedural candidates](sample-pictures-2026-10/qr-candidates.jpg)

| Original candidate | Original detail score | Current decision |
| --- | ---: | --- |
'''
for r in history:
    decision='Rejected: payload-specific carrier' if r.get('carrier') else 'Kept after five-link/subject review' if any(k['id']==r['id'] for k in kept) else 'Cut: first-round scan failure' if not r.get('rasterEligible',r['eligible']) else 'Cut: no clear-subject/five-link advantage over final selection'
    legacy+=f"| {r['id']} | {r['score']:.3f} | {decision} |\n"
record='''
## Clean-main failures and verification

The assertions are [`tests/qr4-craft.spec.mjs:153`](../../tests/qr4-craft.spec.mjs) and [`tests/p3d.spec.mjs:194`](../../tests/p3d.spec.mjs). Both were reproduced in a clean, detached checkout of main `574a68d3125c6ef8f0f5951b53a7da7b6124a341`, with the same pinned dependencies and Chromium. The hash failed 3/3 fresh runs; the warning failed 3/8 valid repeated runs and passed 5/8. No production or test code was altered in that checkout. See [main-hash-failure.txt](sample-pictures-2026-10/main-hash-failure.txt), [main-warning-failure.txt](sample-pictures-2026-10/main-warning-failure.txt), and [the failure screenshot](sample-pictures-2026-10/main-warning-failure.jpg). The warning is a panel-refresh race: its error appears after upload, then a rebuilt panel replaces it with a hidden warning. The hash expected/actual strings are in the attached log. The original clean-main `555e8f5c` observations also remain in the first verification record.

Current run results and required checks are recorded in [final-review-verification.md](sample-pictures-2026-10/final-review-verification.md). The prior [review-verification.md](sample-pictures-2026-10/review-verification.md) describes the 21-AI/3-procedural round only. The original [verification.md](sample-pictures-2026-10/verification.md) describes the first-round checks only. Neither existing assertion was weakened, and `tests/taps.spec.mjs` is untouched.

## Reproduction and record

Made by Ryan with Codex (GPT-6), October 13, 2026. Status: implemented; one draft PR, not merged. Toy IDs: `photo-3d` and `qr-picture`. Existing recipe hooks, units, axes, pivots, part IDs, host APIs, and quaternion order are unchanged. Only selected picture data/imports and this task's evidence/tests/tools changed beyond the requested main merge.

1. Generate the 42 individual square QR pictures from their complete manifest prompts with the image tool. Keep `{id,path,prompt}` local mappings in `.cache/cdx-pics/round2/ai/*.json`; preserve native originals.
2. Run `python3 tools/cdx-pics-qr-prepare.py`, then `node tools/cdx-pics-review.mjs`. The six earlier procedural subjects remain only as measurement history; none ships in the final set. CPU scoring resumes recorded candidates. Delete qr-review-scores.json to measure all candidates again.
3. With the local server on 4173, run `SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-pics-review-browser.mjs`; it resumes completed subjects. Delete the review browser score file for a complete new measurement.
4. Inspect all actual phone renders and record each subject decision in qr-subject-review.json. Run `node tools/cdx-pics-review-select.mjs`, then `python3 tools/cdx-pics-review-report.py`. Format the resulting code, JSON, and Markdown with Prettier.
5. Run the tests and pre-push checks listed in final-review-verification.md. The accepted Studio assets and scores need no regeneration.

AI generation is nondeterministic; procedural families/variants are deterministic. Shipping asset SHA-256 hashes, source pages, owner/agent credits, licenses, dates, and transformations are in [asset-records.json](sample-pictures-2026-10/asset-records.json) and tools/assets.json. Code is MIT; procedural pictures are CC0 1.0; AI pictures follow the owner's A3 sample policy. Node 24.19.0, Python 3, jpeg-js 0.4.4, Pillow 12.3.0, pinned Playwright, Chromium 151, the vendored depth model/WASM, and vendored jsQR are reused; no dependency was added. The [jpeg-js source](https://github.com/eugeneware/jpeg-js), [Pillow page](https://pillow.readthedocs.io/en/stable/about.html), and [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) were opened in the original round.

The depth maps remain baked monocular estimates, not physical reconstructions. Camera-focus effects above are mathematical simulations on actual browser pixels, not paper or hardware measurements. Real-phone memory, frame rate, load time, physical scanning, and printed-paper performance are unmeasured. The report folder remains below 8 MB; rejected full-size pictures stay in ignored local cache.

Rule check: none. The owner's registry exception remains limited to this task's records. All other protected open-PR files, manual/, and tests/taps.spec.mjs are unchanged relative to main.
'''
(ROOT/'docs/audits/sample-pictures-2026-10.md').write_text(intro+review+photo+legacy+record)
print(f'Recorded final 24: {sum(r["ai"] for r in model)} AI-made, {sum(not r["ai"] for r in model)} CC0.')
