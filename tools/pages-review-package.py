#!/usr/bin/env python3
"""Task 95: package inspected phone recordings from pg6-clip.mjs.

python3 tools/pages-review-package.py [work/pages-r2]
Requires the existing Python/Pillow and ffmpeg build tools. Inputs stay in work/;
outputs go only to the separate, never-merged evidence worktree.
Use --motion-only --scenes=r2-book,r2-lab,r2-album to package the required toy pairs first.
Paired videos are the default; --full-width-solos also encodes each revision separately.
Code: MIT, made by Ryan with Codex (GPT-6). Recording contributions: CC0.
"""
from pathlib import Path
import bisect
import json
import math
import os
import re
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
arguments = [a for a in sys.argv[1:] if not a.startswith('--')]
work = (root / (arguments[0] if arguments else 'work/pages-r2')).resolve()
motion_only = '--motion-only' in sys.argv[1:]
benchmark_only = '--benchmark-only' in sys.argv[1:]
paired_only = '--full-width-solos' not in sys.argv[1:]
allow_partial = '--allow-partial' in sys.argv[1:]
out = work / 'clips-tree/docs/audits/pages-r2-2026-10-clips'
out.mkdir(parents=True, exist_ok=True)
scenes = {'r2-book': 'your-book', 'r2-lab': 'picture-lab', 'r2-album': 'photo-album', 'r2-text': 'text', 'r2-chart': 'chart', 'r2-diagram': 'diagram'}
selected = next((a.split('=', 1)[1].split(',') for a in sys.argv[1:] if a.startswith('--scenes=')), list(scenes))
if any(scene not in scenes for scene in selected):
    raise ValueError('Unknown review scene')
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font = ImageFont.truetype(font_path, 22)

def ffmpeg(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', *args], check=True)

def encode(label, scene):
    raw = work / f'clips-{label}' / f'frames-{scene}'
    text = (raw / 'frames.ffconcat').read_text()
    entries = re.findall(r"file '([^']+)'\nduration ([0-9.]+)", text)
    if not entries:
        raise ValueError(f'No full-color frames for {label}/{scene}')
    ends = []
    total = 0
    for name, duration in entries:
        total += float(duration)
        ends.append(total)
    seq = work / 'video-frames' / f'{label}-{scene}'
    seq.mkdir(parents=True, exist_ok=True)
    for stale in seq.glob('[0-9]*.png'):
        stale.unlink()
    for i in range(math.ceil(total * 24)):
        n = min(len(entries) - 1, bisect.bisect_right(ends, (i + .5) / 24))
        target = seq / f'{i:06d}.png'
        os.link(raw / entries[n][0], target)
    movie = work / f'{label}-{scene}.mkv'
    ffmpeg(['-framerate', '24', '-i', str(seq / '%06d.png'), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', '-threads', '2', str(movie)])
    if not paired_only:
        solo = out / f'{scenes[scene]}-{label}.mp4'
        ffmpeg(['-i', str(movie), '-vf', f"pad=iw:ih+44:0:44:color=white,drawtext=fontfile={font_path}:text='{label}':x=8:y=3:fontsize=17:fontcolor=black,drawtext=fontfile={font_path}:text='Stepped animation - preparation waits omitted':x=8:y=26:fontsize=10:fontcolor=black", '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', str(solo)])
    meta = json.loads((work / f'clips-{label}' / f'pg6-{scene}.json').read_text())
    # Keep the launcher's initial tool hash separately when the recorder
    # itself reports the exact version executed for this scene.
    initial_hash = meta.get('recorderSha256')
    if initial_hash:
        meta['orchestratorInitialRecorderSha256'] = initial_hash
        meta['recorderSha256'] = meta.get('executedRecorderSha256', initial_hash)
    if abs(total * 1000 - meta['durationMs']) > .1:
        raise ValueError('Frame durations do not match recorder metadata')
    return movie, raw, entries, meta

if not motion_only:
    # Archive the exact quantitative inputs and crops beside the motion evidence.
    import hashlib
    import shutil

    bench = out / 'benchmark'
    crops = bench / 'crops'
    stills = out / 'stills'
    for directory in [bench, crops, stills]:
        directory.mkdir(parents=True, exist_ok=True)
    data = {}
    artifacts = {}
    for revision in ['main', 'round2']:
        data[revision] = json.loads((work / f'paired-{revision}.json').read_text())
        if len(data[revision]['records']) != 72 and not allow_partial:
            raise ValueError('A final matrix needs 72 records per revision')
        shutil.copyfile(work / f'paired-{revision}.json', bench / f'{revision}.json')
        for record in data[revision]['records']:
            profile, toy, case = [record[k] for k in ['profile', 'toy', 'input']]
            repeat = record['comparisonRepeat']
            original = root / record['artifactDirectory']
            stem = f'{profile}-{toy}-{case}-{record["repeat"]}'
            name = f'{profile}-{toy}-{case}-{repeat}-{revision}'
            artifacts[name] = {}
            for kind in ['source', 'render']:
                target = crops / f'{name}-{kind}.png'
                shutil.copyfile(original / f'{stem}-{kind}.png', target)
                if target.stat().st_size > 1_000_000:
                    raise ValueError(f'A review image exceeds 1 MB: {target}')
                artifacts[name][kind] = {'file': str(target.relative_to(out)), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
            if revision == 'round2' and case == 'sample' and repeat == 1:
                image = Image.open(original / f'{stem}.png').convert('RGB')
                target = stills / f'{profile}-{toy}.jpg'
                for quality in [95, 90, 85, 80]:
                    image.save(target, quality=quality, optimize=True, progressive=True)
                    if target.stat().st_size <= 1_000_000:
                        break
                if target.stat().st_size > 1_000_000:
                    raise ValueError('A whole-page review screenshot exceeds 1 MB')
    for suffix in ['md', 'json']:
        shutil.copyfile(work / f'paired-comparison.{suffix}', bench / f'comparison.{suffix}')
    (bench / 'artifacts.json').write_text(json.dumps(artifacts, indent=2) + '\n')
    comparison = json.loads((bench / 'comparison.json').read_text())
    for toy in ['picture-lab', 'your-book', 'photo-album']:
        name = f'phone-{toy}-text-1'
        paths = [crops / f'{name}-main-source.png', crops / f'{name}-main-render.png', crops / f'{name}-round2-render.png']
        images = [Image.open(p).convert('RGB') for p in paths]
        row = next(r for r in comparison['rows'] if r['profile'] == 'phone' and r['toy'] == toy and r['input'] == 'text')
        width = max(440, *(im.width for im in images))
        height = sum(im.height + 30 for im in images) + 90
        sheet = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(sheet)
        font_small = ImageFont.truetype(font_path, 14)
        draw.text((8, 4), f'{toy}: phone body text', font=font_small, fill='black')
        draw.text((8, 24), 'Native pixels, no crop resizing; repeat 1', font=font_small, fill='black')
        draw.text((8, 44), f'Medians: sharpness +{row["rawEdgeGain"] * 100:.1f}%, SSIM {row["ssimGain"]:+.4f}', font=font_small, fill='black')
        y = 90
        for label, im in zip(['Independent source', 'Main', 'Round 2'], images):
            draw.text((8, y + 3), label, font=font_small, fill='black')
            sheet.paste(im, (0, y + 30))
            y += im.height + 30
        target = stills / f'phone-{toy}-text.png'
        sheet.save(target, optimize=True)
        if target.stat().st_size > 1_000_000:
            raise ValueError('A body-text comparison exceeds 1 MB')
    def whole_link(profile, toy):
        name = f'{profile}-{toy}.jpg'
        return f'[JPEG]({name})' if (stills / name).exists() else 'Not captured'

    (stills / 'README.md').write_text('''# Still comparisons

    These body-text images retain their native framebuffer crop pixels without resizing. All use repeat 1, rather than selecting the best run. Caption scores are three-repeat medians. The independent reference was rendered at width 2,048 and sampled at the displayed pixel grid. The separate main and round 2 reference crops are in the benchmark archive.

    Whole-page images are JPEG review copies of repeat 1 of each toy's sample at 390×844 and 1440×900; quantitative crops remain PNG. All images are below 1 MB. Recording and original comparison contributions are CC0, made by Ryan with Codex (GPT-6); existing photo credits remain in CREDITS.md.

    | Toy | Body text | Phone sample | Desktop sample |
    | --- | --- | --- | --- |
    '''.replace('\n    ', '\n') + '\n'.join(f'| {toy} | [PNG](phone-{toy}-text.png) | {whole_link("phone", toy)} | {whole_link("desktop", toy)} |' for toy in ['your-book', 'picture-lab', 'photo-album']) + '\n')
    count = sum(len(d['records']) for d in data.values())
    coverage = f'{count}/144 planned fresh-browser cases; {len(comparison["rows"])}/24 groups have all three pairs.'
    (bench / 'README.md').write_text(f'''# Matched benchmark evidence

    {coverage} The raw [main records](main.json) and [round 2 records](round2.json) retain every completed case. The [comparison table](comparison.md) and [comparison checks](comparison.json) score only groups with all three pairs. Renderer, fixture, tool, protocol, source commit, and runtime hashes are retained. The [artifact manifest](artifacts.json) maps each case and repeat to its exact source and rendered crop and their SHA-256 hashes.

    See the implementation branch's [audit](https://github.com/ryanjosephkamp/splashery/blob/codex/book-picture-lab-r2/docs/audits/pages-r2-2026-10.md) for definitions, commands, exploratory exclusions, and limits. Copy the archived fixtures into work/pages-r2/fixtures before reproducing the matrix. These are software-renderer browser measurements, not physical-phone measurements. Stepped clips are separate motion evidence.
    '''.replace('\n    ', '\n'))
    print(f'Archived {count} raw records and {count * 2} exact crops.', flush=True)

if benchmark_only:
    sys.exit(0)

metadata_path = out / 'recordings.json'
all_metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
for scene, name in scenes.items():
    if scene not in selected:
        continue
    main, raw_main, frames_main, meta_main = encode('main', scene)
    candidate, raw_candidate, frames_candidate, meta_candidate = encode('round2', scene)
    filters = []
    for index, label in enumerate(['main', 'round 2']):
        filters.append(f"[{index}:v]pad=iw:ih+44:0:44:color=white,drawtext=fontfile={font_path}:text='{label}':x=8:y=3:fontsize=17:fontcolor=black,drawtext=fontfile={font_path}:text='Stepped animation - preparation waits omitted':x=8:y=26:fontsize=10:fontcolor=black[v{index}]")
    filters.append('[v0][v1]hstack=inputs=2:shortest=0,format=yuv420p[v]')
    target = out / f'{name}.mp4'
    ffmpeg(['-i', str(main), '-i', str(candidate), '-filter_complex', ';'.join(filters), '-map', '[v]', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', str(target)])
    sheet = Image.new('RGB', (390 * 6, (844 + 40) * 2), 'white')
    draw = ImageDraw.Draw(sheet)
    for row, (label, raw, entries) in enumerate([('main', raw_main, frames_main), ('round 2', raw_candidate, frames_candidate)]):
        y = row * (844 + 40)
        draw.text((8, y + 5), label, font=font, fill='black')
        for col in range(6):
            index = round(col * (len(entries) - 1) / 5)
            im = Image.open(raw / entries[index][0]).convert('RGB')
            if im.size != (390, 844):
                raise ValueError(f'Unexpected phone frame size {im.size}')
            sheet.paste(im, (col * 390, y + 40))
    strip = out / f'{name}-strip.jpg'
    for quality in [90, 85, 80, 75, 70]:
        sheet.save(strip, quality=quality, optimize=True, progressive=True)
        if strip.stat().st_size <= 1_000_000:
            break
    if strip.stat().st_size > 1_000_000:
        raise ValueError('Review image exceeds 1 MB')
    all_metadata[name] = {'main': meta_main, 'round2': meta_candidate, 'videoBytes': target.stat().st_size, 'stripBytes': strip.stat().st_size}
    print(name, target.stat().st_size, strip.stat().st_size, flush=True)
(out / 'recordings.json').write_text(json.dumps(all_metadata, indent=2) + '\n')
links = '\n'.join(f'<article><h2>{name.replace("-", " ").title()}</h2><video controls muted loop playsinline preload="metadata" src="{name}.mp4"></video><p>' + ('' if paired_only else f'<a href="{name}-main.mp4">Main at full phone width</a> · <a href="{name}-round2.mp4">Round 2 at full phone width</a> · ') + f'<a href="{name}-strip.jpg">Six-frame contact sheet</a></p></article>' for name in all_metadata)
(out / 'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Book and Picture lab round 2: effect review</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1000px;margin:auto;padding:24px;background:#f4f4f4;color:#17202a}video{display:block;max-width:100%;width:780px;background:white}article{margin:40px 0}a{color:#064a91}</style><h1>Phone motion comparisons</h1><p>Main is on the left; round 2 is on the right. These recordings use a stepped animation clock at the per-scene cadence recorded in the metadata, with preparation waits omitted. They show motion and edge quality; the separate real-clock benchmark measures performance.</p><p>390×844 CSS pixels per view, device scale 2, and low detail. See <a href="README.md">the methods, source commits, and limitations</a>. Evidence-only branch: never merge.</p>''' + links + '\n')
