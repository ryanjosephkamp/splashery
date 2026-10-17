#!/usr/bin/env python3
"""MIT. Install a verified Blender archive without root or a Python wheel."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

VERSION = '4.5.3'
ARCHIVE = f'blender-{VERSION}-linux-x64.tar.xz'
SHA256 = '975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845'
URL = f'https://mirrors.ocf.berkeley.edu/blender/release/Blender4.5/{ARCHIVE}'
ROOT = Path(__file__).resolve().parents[2]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify(path, expected):
    if digest(path) != expected:
        raise ValueError(f'SHA-256 mismatch: {path}; remove the corrupt cache file and retry')


def inventory(root):
    return {str(p.relative_to(root)): digest(p) for p in sorted(root.rglob('*')) if p.is_file()}


def install(cache):
    if platform.system() != 'Linux' or platform.machine() != 'x86_64':
        raise ValueError('Pinned build requires Linux x86_64')
    cache.mkdir(parents=True, exist_ok=True)
    # Serialize extraction and validation, including calls made by concurrent render jobs.
    with (cache / '.install.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        archive = cache / ARCHIVE
        target = cache / f'blender-{VERSION}-linux-x64'
        receipt = cache / 'install.json'
        reused = target.exists()
        if not archive.exists():
            with tempfile.NamedTemporaryFile(dir=cache, suffix='.download', delete=False) as stream:
                pending = Path(stream.name)
                try:
                    with urllib.request.urlopen(URL, timeout=120) as response:
                        shutil.copyfileobj(response, stream)
                    stream.close()
                    verify(pending, SHA256)
                    pending.replace(archive)
                finally:
                    pending.unlink(missing_ok=True)
        verify(archive, SHA256)
        if target.exists():
            if not receipt.exists():
                raise ValueError('Unverified install directory; remove it and retry')
            record = json.loads(receipt.read_text())
            if record.get('archive_sha256') != SHA256 or record.get('files') != inventory(target):
                raise ValueError('Installed Blender integrity mismatch; remove the install directory and retry')
        else:
            with tempfile.TemporaryDirectory(dir=cache, prefix='.extract-') as tmp:
                with tarfile.open(archive, 'r:xz') as bundle:
                    # Python's data filter rejects traversal and links outside the extraction root.
                    bundle.extractall(tmp, filter='data')
                extracted = Path(tmp) / target.name
                if not (extracted / 'blender').is_file():
                    raise ValueError('Archive does not contain the pinned Blender executable')
                record = {'version': VERSION, 'archive_sha256': SHA256,
                          'files': inventory(extracted)}
                extracted.replace(target)
                receipt.write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
        return target / 'blender', reused


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/blender-cloud')
    parser.add_argument('--report', type=Path, help='Separate operational timing JSON (not dataset metadata)')
    opt = parser.parse_args()
    if sys.version_info < (3,12):
        parser.error('Installer requires Python 3.12 or newer for safe tar extraction')
    started = time.monotonic()
    binary, reused = install(opt.cache.resolve())
    result = subprocess.run([str(binary), '--background', '--factory-startup', '--disable-autoexec',
                             '--python-exit-code', '1', '--python-expr',
                             "import sys; sys.dont_write_bytecode=True; import bpy, numpy; "
                             "assert bpy.app.version == (4,5,3); print('Blender 4.5.3 headless Python OK')"],
                            capture_output=True, text=True, check=True)
    if f'Blender {VERSION}' not in result.stdout:
        raise ValueError('Installed binary version differs from pin')
    report = {'version': VERSION, 'archive_sha256': SHA256, 'url': URL,
              'archive_bytes': (opt.cache / ARCHIVE).stat().st_size,
              'reused': reused, 'seconds': round(time.monotonic() - started, 4),
              'binary_sha256': digest(binary), 'platform': platform.platform()}
    if opt.report:
        opt.report.parent.mkdir(parents=True, exist_ok=True)
        opt.report.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Blender {VERSION}: verified; {report["seconds"]:.2f}s; reused={reused}', file=sys.stderr)
    print(binary)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError, tarfile.TarError) as error:
        sys.exit(f'blender-cloud install failed: {error}')
