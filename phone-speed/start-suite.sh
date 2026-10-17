#!/usr/bin/env bash
set -euo pipefail
cd /workspace/splashery
export PATH="/workspace/splashery/.cache/apt/root/usr/bin:$PATH"
export LD_LIBRARY_PATH=/workspace/splashery/.cache/apt/root/usr/lib/x86_64-linux-gnu
export FONTCONFIG_FILE=/workspace/splashery/.cache/phone-speed/test-fontconfig/fonts.conf
export SPLASHERY_CHROMIUM=/usr/bin/chromium
exec node tools/suite.mjs --gl=llvmpipe --jobs=2 --out=.cache/phone-speed/suite "$@"
