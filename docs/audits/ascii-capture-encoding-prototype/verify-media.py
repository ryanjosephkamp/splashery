"""Independently decode the shipped GIFs and MP4s, using existing Pillow/FFmpeg."""
import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--receipt', type=Path, required=True)
args = parser.parse_args()
ffmpeg = os.environ.get('ASCII_FFMPEG', '/opt/homebrew/bin/ffmpeg')
ffprobe = os.environ.get('ASCII_FFPROBE', '/opt/homebrew/bin/ffprobe')
samples = {sample['toy']: sample for sample in json.loads((here / 'sources.json').read_text())}
receipts = []
for toy in ['grapes', 'orange', 'strawberry']:
    for mode in ['mono', 'color']:
        directory = here / 'exports' / toy / ('96-' + mode)
        sample = samples[toy]
        with Image.open(directory / 'animation.gif') as gif:
            metadata = json.loads(gif.info['comment'])
            assert metadata['credit'] == sample['credit']
            assert metadata['revision'] == sample['revision']
            assert metadata['settings']['columns'] == 96
            assert metadata['settings']['contrast'] == 1.3
            assert metadata['settings']['color'] == (mode == 'color')
            assert metadata['fps'] == sample['fps'] == 10
            duration, hashes = 0, set()
            for i in range(gif.n_frames):
                gif.seek(i)
                hashes.add(hashlib.sha256(gif.convert('RGB').tobytes()).hexdigest())
                duration += gif.info['duration']
            assert gif.n_frames == len(sample['frames']) == 40
            assert duration == 4000 and len(hashes) > 1
            dimensions = gif.size
            receipts.append({'path': str((directory / 'animation.gif').relative_to(here)), 'frames': 40, 'durationMs': duration, 'distinctDecodedFrames': len(hashes), 'metadataVerified': True})
        for name in ['animation.mp4', 'browser.mp4']:
            video = directory / name
            probe = json.loads(subprocess.check_output([
                ffprobe, '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                '-show_entries', 'stream=codec_name,width,height,nb_read_frames,duration:format_tags=comment',
                '-of', 'json', str(video),
            ]))
            stream = probe['streams'][0]
            assert stream['codec_name'] == 'h264'
            assert stream['width'] == dimensions[0] + dimensions[0] % 2
            assert stream['height'] == dimensions[1] + dimensions[1] % 2
            if name == 'animation.mp4':
                assert int(stream['nb_read_frames']) == 40
                assert abs(float(stream['duration']) - 4) < .001
                comment = json.loads(probe['format']['tags']['comment'])
                assert comment['credit'] == sample['credit']
                assert comment['settings'] == metadata['settings']
            else:
                assert 3.7 < float(stream['duration']) < 4.5
                assert 35 <= int(stream['nb_read_frames']) <= 45
            decoded = subprocess.check_output([
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-threads', '2',
                '-i', str(video), '-map', '0:v:0', '-pix_fmt', 'rgb24', '-threads', '2', '-f', 'framemd5', '-',
            ], text=True)
            hashes = {line.split(',')[-1].strip() for line in decoded.splitlines() if not line.startswith('#')}
            assert len(hashes) > 1
            receipts.append({'path': str(video.relative_to(here)), 'stream': stream, 'distinctDecodedFrames': len(hashes), 'containerMetadataVerified': name == 'animation.mp4'})
with args.receipt.open('x') as target:
    target.write(json.dumps(receipts, indent=2) + '\n')
print(json.dumps({'passed': True, 'decodedMediaFiles': len(receipts), 'allMoving': True}))
