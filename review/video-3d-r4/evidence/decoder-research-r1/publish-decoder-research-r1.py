#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Preserve rejected research without relabeling references."""
import datetime
import hashlib
import json
import pathlib
import shutil

ROOT = pathlib.Path('/workspace/v3d-r4-media')
DEST = pathlib.Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/evidence/decoder-research-r1')
NAMES = [
    'mp4-decode-research-r1', 'mp4-decode-research-r2', 'mp4-browser-probe-r1',
    'mp4-video-bridge-research-r1', 'fast-extract-integration-r1',
    'fast-extract-integration-r2', 'fast-extract-rejected-r1',
    'html-playback-extraction-research-r1',
]
OMITTED_URLS = {
    'mp4-decode-research-r1/mdn-encodedvideochunk.html': 'https://developer.mozilla.org/en-US/docs/Web/API/EncodedVideoChunk',
    'mp4-decode-research-r1/webcodecs-avc-registration.html': 'https://www.w3.org/TR/webcodecs-avc-codec-registration/',
    'mp4-decode-research-r1/docs/1.html': 'https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder',
    'mp4-decode-research-r1/docs/2.html': 'https://developer.mozilla.org/en-US/docs/Web/API/VideoFrame',
    'mp4-decode-research-r1/docs/3.html': 'https://www.w3.org/TR/mse-byte-stream-format-isobmff/',
    'mp4-browser-probe-r1/configure-doc.html': 'https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder/configure',
}
for name in ['media-filters-ffmpeg_video_decoder.cc', 'media-base-video_color_space.cc',
             'media-ffmpeg-ffmpeg_common.cc', 'media-filters-ffmpeg_demuxer.cc']:
    OMITTED_URLS['mp4-browser-probe-r1/' + name + '.txt'] = (
        'https://chromium.googlesource.com/chromium/src/+/refs/heads/main/' +
        name.replace('-', '/', 2))

def digest(data):
    return hashlib.sha256(data).hexdigest()

def inventory(folder):
    rows = []
    for f in sorted(folder.rglob('*')):
        if f.is_symlink():
            raise RuntimeError('Refusing symlink: ' + str(f))
        if f.is_file():
            data = f.read_bytes()
            rows.append({'file': f.relative_to(folder).as_posix(), 'bytes': len(data), 'sha256': digest(data)})
    return rows

if DEST.exists():
    raise RuntimeError('Never overwrite existing publication: ' + str(DEST))
DEST.mkdir(parents=True)
receipts = []
for name in NAMES:
    source = ROOT / name
    original = inventory(source)
    copied, omitted = [], []
    for row in original:
        relative = name + '/' + row['file']
        if relative in OMITTED_URLS:
            omitted.append({**row, 'url': OMITTED_URLS[relative],
                            'reason': 'Third-party reference bytes retained outside Git; original rights apply. URL and original hash preserved.'})
            continue
        f = source / row['file']
        # Frozen source reports are raw evidence, including their original spelling. Keep
        # that report verbatim as text; new public Markdown remains in American English.
        published_file = ('README.original.md.txt' if relative ==
                          'mp4-decode-research-r2/README.md' else row['file'])
        target = DEST / name / published_file
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(f, target)
        data = target.read_bytes()
        if digest(data) != row['sha256'] or len(data) != row['bytes']:
            raise RuntimeError('Copy differs: ' + relative)
        copied.append({**row, 'publishedFile': published_file})
    if inventory(source) != original:
        raise RuntimeError('Research changed while publishing: ' + name)
    receipts.append({'source': str(source), 'directory': name,
                     'originalInventory': original, 'copied': copied, 'omitted': omitted,
                     'notice': 'Copied files retain exact original bytes. publishedFile explicitly maps the original report retained as raw .md.txt text; no source spelling or proof was edited. Original freeze records remain unchanged; explicitly omitted references mean this is a documented subset of the outside archive.'})

manifest = json.loads(pathlib.Path('/workspace/splashery-r4-public/tools/v3d-corpus.json').read_text())
clips = manifest if isinstance(manifest, list) else manifest['clips']
credits = ['Code and original diagnostic reports made by Ryan with Codex (GPT-6), MIT.',
           'Original procedural test patterns are labeled synthetic controls, CC0; they are never corpus inputs.',
           'All corpus-derived photographs, pixel arrays, model outputs, and FFprobe source-byte dumps retain their individual source license. Separate sources are not relicensed or combined into one asset.', '']
for clip in clips:
    credits.append(f"{clip['id']}: {clip['author']}; {clip['license']}; {clip['source']}; {clip['licenseUrl']}; source SHA-256 {clip['sha256']}.")
(DEST / 'ATTRIBUTION.txt').write_text('\n'.join(credits) + '\n')
shutil.copyfile(__file__, DEST / pathlib.Path(__file__).name)
(DEST / 'publication.json').write_text(json.dumps({
    'created': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'Rejected or incomplete decoder/extraction research. No production integration and no native corpus acceptance claim.',
    'outcomes': {
        'demuxR2': '17/20 corpus timelines independently matched FFprobe; three complex edits rejected. Parsing alone does not prove decoder picture identity.',
        'cpuWebCodecs': 'Predeclared CPU/no-GPU anchors matched with explicit color metadata; actual native GPU context did not match the canonical HTML decoder.',
        'nativeWebCodecs': 'Rejected because original picture pixels differed; failed fast-path work plus fallback was slower.',
        'nativeBridge': 'All12 predeclared HTML bridge pictures failed exact RGBA/JPEG identity; frame timestamps alone matched.',
        'htmlSequentialR1': 'Only two of six profile/case pairs returned complete exact pictures; startup misses, cross-window frames, and skipped targets remain. Missing mandatory per-trial ceil guard prevents integration.',
        'next': 'A separate all20 phone-only R2 is in progress; it is not included or predicted here.'},
    'directories': receipts,
}, indent=2) + '\n')
(DEST / 'README.md').write_text('''# Decoder and extraction experiments, including failures

Made by Ryan with Codex (GPT-6). Original code and reports are MIT. Corpus derivatives retain their source-specific licenses in `ATTRIBUTION.txt` and the copied source-credit records.

None of these experiments is enabled in the product. The native software-GPU decoder produced different colors and geometry from the CPU-only controls. Every measured native bridge picture failed exact pixel identity. Failed probes, rejected gates, archived source patches, original raw logs, and successful CPU controls remain beside one another.

`publication.json` inventories each original outside directory, every byte-exact copied file, and each omitted third-party reference. Its `publishedFile` mapping identifies one verbatim frozen source report retained as raw `.md.txt` evidence, including its original spelling. No report bytes or language-check rules were changed. Original freeze files are unchanged. Full third-party HTML and Chromium reference-source downloads remain outside Git under their original rights; their opened URLs and hashes are recorded explicitly. This publication is a documented subset of those outside archives, not a claim that omitted files were copied.

The sequential HTML experiment R1 preserved pictures in two phone cases, but failed four other cases. It lacked the mandatory exact source-frame ceiling check needed to protect held-out frame exclusion. Its timing comparisons are separate extraction diagnostics under shared load, not bake timing, physical-device results, or goal acceptance. A separate all20 phone R2 remains in progress.
''')
files = inventory(DEST)
(DEST / 'publication-freeze.json').write_text(json.dumps({
    'created': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'Final public subset and additive rights/omission receipts; this freeze excludes itself.',
    'files': files,
}, indent=2) + '\n')
print(json.dumps({'publication': str(DEST), 'files': len(files),
                  'copiedResearchFiles': sum(len(x['copied']) for x in receipts),
                  'explicitReferenceOmissions': sum(len(x['omitted']) for x in receipts)}))
