#!/usr/bin/env bash
# MIT. Verified pinned Blender, headless CPU defaults, no user startup or auto-run scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY="$(python3 "$ROOT/tools/blender/install.py")"
export PYTHONDONTWRITEBYTECODE=1
export PYTHONHASHSEED=0
export OMP_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=1
export LC_ALL=C.UTF-8
exec "$BINARY" --background --factory-startup --disable-autoexec --threads 4 --python-exit-code 1 --python-expr "import sys; sys.dont_write_bytecode = True" "$@"
