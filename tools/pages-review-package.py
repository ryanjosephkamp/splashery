#!/usr/bin/env python3
"""Task 95: package inspected phone recordings from pg6-clip.mjs.

python3 tools/pages-review-package.py [work/pages-r2]
Requires the existing Python/Pillow and ffmpeg build tools. Inputs stay in work/;
outputs go only to the separate, never-merged evidence worktree.
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
work = (root / (sys.argv[1] if len(sys.argv) > 1 else 'work/pages-r2')).resolve()
out = work / 'clips-tree/docs/audits/pages-r2-2026-10-clips'
out.mkdir(parents=True, exist_ok=True)
scenes = {'r2-book': 'your-book', 'r2-lab': 'picture-lab', 'r2-album': 'photo-album', 'r2-text': 'text', 'r2-chart': 'chart', 'r2-diagram': 'diagram'}
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
    for i in range(math.ceil(total * 24)):
        n = min(len(entries) - 1, bisect.bisect_right(ends, (i + .5) / 24))
        target = seq / f'{i:06d}.png'
        if not target.exists():
            os.link(raw / entries[n][0], target)
    movie = work / f'{label}-{scene}.mkv'
    ffmpeg(['-framerate', '24', '-i', str(seq / '%06d.png'), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', '-threads', '2', str(movie)])
    solo = out / f'{scenes[scene]}-{label}.mp4'
    ffmpeg(['-i', str(movie), '-vf', f"pad=iw:ih+44:0:44:color=white,drawtext=fontfile={font_path}:text='{label}':x=8:y=3:fontsize=17:fontcolor=black,drawtext=fontfile={font_path}:text='Stepped animation - preparation waits omitted':x=8:y=26:fontsize=10:fontcolor=black", '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', str(solo)])
    meta = json.loads((work / f'clips-{label}' / f'pg6-{scene}.json').read_text())
    if abs(total * 1000 - meta['durationMs']) > .1:
        raise ValueError('Frame durations do not match recorder metadata')
    return movie, raw, entries, meta

all_metadata = {}
for scene, name in scenes.items():
    main, raw_main, frames_main, meta_main = encode('main', scene)
    candidate, raw_candidate, frames_candidate, meta_candidate = encode('round2', scene)
    filters = []
    for index, label in enumerate(['main', 'round 2']):
        filters.append(f"[{index}:v]pad=iw:ih+44:0:44:color=white,drawtext=fontfile={font_path}:text='{label}':x=8:y=3:fontsize=17:fontcolor=black,drawtext=fontfile={font_path}:text='Stepped at 12 fps - preparation waits omitted':x=8:y=26:fontsize=10:fontcolor=black[v{index}]")
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
links = '\n'.join(f'<article><h2>{name.replace("-", " ").title()}</h2><video controls muted loop playsinline preload="metadata" src="{name}.mp4"></video><p><a href="{name}-main.mp4">Main at full phone width</a> · <a href="{name}-round2.mp4">Round 2 at full phone width</a> · <a href="{name}-strip.jpg">Six-frame contact sheet</a></p></article>' for name in scenes.values())
(out / 'index.html').write_text('''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Book and Picture lab round 2: effect review</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1000px;margin:auto;padding:24px;background:#f4f4f4;color:#17202a}video{display:block;max-width:100%;width:780px;background:white}article{margin:40px 0}a{color:#064a91}</style><h1>Phone motion comparisons</h1><p>Main is on the left; round 2 is on the right. These recordings use a stepped 12 fps animation clock, with preparation waits omitted. They show motion and edge quality; the separate real-clock benchmark measures performance.</p><p>390×844 CSS pixels per view, device scale 2, and low detail. See <a href="README.md">the methods, source commits, and limitations</a>. Evidence-only branch: never merge.</p>''' + links + '\n')
