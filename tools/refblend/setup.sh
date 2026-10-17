#!/usr/bin/env bash
# Opt-in, build-time only. Blender is GPL-3.0-or-later and is never served.
set -euo pipefail
if [[ "${1:-}" != "--blender" || $# != 1 ]]; then
  echo 'Usage: tools/refblend/setup.sh --blender' >&2
  exit 2
fi
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { echo 'Requires Linux x86_64' >&2; exit 2; }
version=4.5.3
sha=975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845
cache="${REFBLEND_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/splashery-refblend}"
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
mkdir -p "$cache"
cache="$(cd "$cache" && pwd -P)"
case "$cache/" in "$repo/"*) echo 'REFBLEND_CACHE must be outside the repository' >&2; exit 2;; esac
archive="$cache/blender-$version-linux-x64.tar.xz"
target="$cache/blender-$version-linux-x64"
start=$SECONDS
if [[ ! -f "$archive" ]]; then
  curl --fail --location --retry 3 --output "$archive.partial" "https://download.blender.org/release/Blender4.5/blender-$version-linux-x64.tar.xz"
  mv "$archive.partial" "$archive"
fi
printf '%s  %s\n' "$sha" "$archive" | sha256sum --check --status || { echo 'Blender SHA-256 mismatch' >&2; exit 1; }
if [[ ! -x "$target/blender" ]]; then
  tar -xJf "$archive" -C "$cache"
fi
"$target/blender" --version | head -1
printf 'Install seconds: %s\n' "$((SECONDS-start))"
du -sk "$target" "$archive"
printf 'BLENDER_BIN=%s/blender\n' "$target"
