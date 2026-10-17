"""MIT; made by Ryan with Codex (GPT-6). Restore the immutable public atlas.

Only public files from task 87 and task 99's calibration are downloaded. Verify
Git blob hashes, source-photo SHA-256 hashes, and the complete 118-input inventory.
No model, private input, old review identity key, or app asset is changed.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
from pathlib import Path
import urllib.request

ATLAS = '0e28cf877598399273199b772e636467788b294b'
NEXT = '9919cdf66f7fe5a875cf5c1e1596b479b8f87995'
REPO = 'ryanjosephkamp/splashery'
PREFIX = 'review/photo-3d-failures/'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='.cache/photo-3d-fill')
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    def tree(revision):
        url = f'https://api.github.com/repos/{REPO}/git/trees/{revision}?recursive=1'
        response = json.loads(urllib.request.urlopen(url, timeout=90).read())
        if response.get('truncated'):
            raise ValueError('Need a complete Git tree')
        return {r['path']: r for r in response['tree'] if r['type'] == 'blob'}

    atlas_tree, next_tree = tree(ATLAS), tree(NEXT)

    def restore(job):
        revision, remote, local, expected = job
        def correct(data):
            return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == expected
        if local.exists() and correct(local.read_bytes()):
            return
        url = f'https://raw.githubusercontent.com/{REPO}/{revision}/{remote}'
        for attempt in range(3):
            try:
                data = urllib.request.urlopen(url, timeout=90).read()
                if not correct(data):
                    raise ValueError('Git blob differs: ' + remote)
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(data)
                return
            except Exception:
                if attempt == 2:
                    raise

    jobs = []
    for remote, row in atlas_tree.items():
        if not remote.startswith(PREFIX):
            continue
        rel = remote[len(PREFIX):]
        local = None
        if rel.startswith('renders/') and rel.endswith('-anchors.json.gz'):
            local = out / 'probes' / Path(rel).name
        elif rel.startswith('inputs/new-'):
            local = out / rel
        elif rel in ['atlas.json.gz', 'sources/additional-photos.json', 'sources/license-verification.json']:
            local = out / Path(rel).name
        if local:
            jobs.append((ATLAS, remote, local, row['sha']))
    calibration = 'review/photo-3d-next/raw/targets-guided--targets.json.gz'
    jobs.append((NEXT, calibration, out / 'truth-calibration.json.gz', next_tree[calibration]['sha']))
    selection = 'review/photo-3d-next/raw/atlas-scout--selection.json.gz'
    jobs.append((NEXT, selection, out / 'review-selection.json.gz', next_tree[selection]['sha']))
    template = 'review/photo-3d-next/index.html'
    jobs.append((NEXT, template, out / 'review-template.html', next_tree[template]['sha']))
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(restore, jobs))
    atlas = json.loads(gzip.decompress((out / 'atlas.json.gz').read_bytes()))
    if not atlas['complete'] or len(atlas['inputs']) != 118:
        raise ValueError('Incomplete atlas')
    extra = json.loads((out / 'additional-photos.json').read_text())
    for row in extra:
        row['file'] = row.pop('photo')
        if hashlib.sha256((out / row['file']).read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Source photo differs: ' + row['id'])
    (out / 'extra-manifest.json').write_text(json.dumps(extra))
    (out / 'atlas.json').write_text(json.dumps(atlas))
    proof = {'atlasCommit': ATLAS, 'calibrationCommit': NEXT,
             'verifiedGitBlobs': len(jobs), 'additionalPhotos': len(extra), 'inputs': 118}
    (out / 'setup.json').write_text(json.dumps(proof, indent=2))
    print(json.dumps(proof), flush=True)


if __name__ == '__main__':
    main()
