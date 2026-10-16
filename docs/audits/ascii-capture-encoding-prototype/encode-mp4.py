"""Exact-frame reference MP4s using the already installed FFmpeg, two threads."""
import json
import subprocess
import os
import argparse
from pathlib import Path

here = Path(__file__).resolve().parent
ffmpeg = os.environ.get('ASCII_FFMPEG', '/opt/homebrew/bin/ffmpeg')
ffprobe = os.environ.get('ASCII_FFPROBE', '/opt/homebrew/bin/ffprobe')
parser = argparse.ArgumentParser()
parser.add_argument("--exports", type=Path, required=True)
parser.add_argument("--receipt", type=Path, required=True)
args = parser.parse_args()
receipts = []
for directory in sorted(args.exports.glob('*/*')):
    sequence = json.loads((directory / 'frames.json').read_text())
    metadata = {'toy': sequence['toy'], 'credit': sequence.get('credit'), 'settings': sequence['settings'], 'fps': sequence['fps'], 'changes': 'Fresh capture, downsampled PNG source, ASCII conversion, H.264 encoding.'}
    subprocess.run([
        ffmpeg, '-hide_banner', '-loglevel', 'error', '-n',
        '-threads', '2', '-framerate', str(sequence['fps']), '-i', str(directory / 'frame-%03d.png'),
        '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-crf', '18', '-threads', '2', '-movflags', '+faststart',
        '-metadata', 'comment=' + json.dumps(metadata), str(directory / 'animation.mp4')
    ], check=True)
    probe = json.loads(subprocess.check_output([
        ffprobe, '-v', 'error', '-count_frames', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height,nb_read_frames,r_frame_rate,duration:format_tags=comment',
        '-of', 'json', str(directory / 'animation.mp4')
    ]))
    stream = probe['streams'][0]
    assert int(stream['nb_read_frames']) == len(sequence['frames'])
    assert abs(float(stream['duration']) - len(sequence['frames']) / sequence['fps']) < .001
    assert json.loads(probe['format']['tags']['comment'])['credit'] == sequence.get('credit')
    receipts.append({'path': str(directory.relative_to(args.exports)), 'stream': stream, 'metadataRetained': True})
with args.receipt.open('x') as target:
    target.write(json.dumps(receipts, indent=2) + '\n')
print(json.dumps(receipts))
