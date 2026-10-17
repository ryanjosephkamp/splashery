#!/usr/bin/env python3
"""Assemble the project's byte-equivalent camera kernels; Wasmtime is a build tool only.

python3 -m pip install --target .cache/qr-build wasmtime==38.0.0
PYTHONPATH=.cache/qr-build python3 tools/picture-qr-fidelity/build-blur.py
"""
from importlib.metadata import version
from pathlib import Path
import wasmtime

if version("wasmtime") != "38.0.0":
    raise SystemExit("Use the pinned Wasmtime 38.0.0 assembler.")
root = Path(__file__).resolve().parents[2]
for name in ("blur", "raster", "raster-simd"):
    source = root / f"src/qr-craft/{name}.wat"
    source.with_suffix(".wasm").write_bytes(wasmtime.wat2wasm(source.read_text()))
