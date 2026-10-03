#!/usr/bin/env bash
# The brass orrery, end to end, on the owner's Mac (lane Fidelity, Stage 2; Codex task 10):
# render every part in Blender, train each part with Brush, pack the SOG files for the toy, and
# measure them against the held-out renders. tools/fidelity/README.md explains each step.
#
#   tools/fidelity/run-orrery.sh [render|train|pack|measure|all] [part ...]
#
# Settings (environment variables, with their defaults):
#   BLENDER=/Applications/Blender.app/Contents/MacOS/Blender   BRUSH=brush
#   WORK=~/splashery-fidelity/orrery   RES=1024 TRAIN=200 TEST=25 SAMPLES=256
#   STEPS=30000 SH=3 MAX_SPLATS=400000 (Brush's cap per part)
#   FULL=400000 LITE=110000 (splats for the whole toy, shared among the parts by their counts)
#   DEVICE=GPU (or CPU, for a test run on a machine without one; then also ST_ARGS="-g cpu")
#   BRUSH_ARGS="" (more flags for Brush; check `brush --help`, its flags change between releases)
set -euo pipefail

STEP="${1:-all}"
shift || true
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
BRUSH="${BRUSH:-brush}"
WORK="${WORK:-$HOME/splashery-fidelity/orrery}"
RES="${RES:-1024}" TRAIN="${TRAIN:-200}" TEST="${TEST:-25}" SAMPLES="${SAMPLES:-256}"
STEPS="${STEPS:-30000}" SH="${SH:-3}" MAX_SPLATS="${MAX_SPLATS:-400000}"
FULL="${FULL:-400000}" LITE="${LITE:-110000}"
BRUSH_ARGS="${BRUSH_ARGS:-}" DEVICE="${DEVICE:-GPU}" ST_ARGS="${ST_ARGS:-}"
OUT="$ROOT/assets/toys/orrery"
ST="$ROOT/node_modules/.bin/splat-transform"
PARTS=(base gear-a gear-b sun mercury venus earth moon mars jupiter saturn)
if [ "$#" -gt 0 ]; then PARTS=("$@"); fi
log() { printf '\n== %s (%s)\n' "$1" "$(date '+%H:%M:%S')"; }
mkdir -p "$WORK/trained" "$WORK/packed" "$OUT"

render() {
  log "Render: ${PARTS[*]} whole"
  local list
  list="$(IFS=,; echo "${PARTS[*]},whole")"
  "$BLENDER" -b --factory-startup --python "$ROOT/tools/fidelity/orrery.py" -- \
    --out "$WORK/data" --cache "$HOME/splashery-fidelity/cache" --res "$RES" --train "$TRAIN" \
    --test "$TEST" --samples "$SAMPLES" --device "$DEVICE" --parts "$list" --blend
}

train() {
  for p in "${PARTS[@]}" whole; do
    log "Train $p"
    local t0=$SECONDS
    # shellcheck disable=SC2086
    "$BRUSH" "$WORK/data/$p" --total-train-iters "$STEPS" --sh-degree "$SH" \
      --max-splats "$MAX_SPLATS" --export-every "$STEPS" --eval-every "$STEPS" \
      --eval-save-to-disk --export-path "$WORK/trained/" --export-name "$p.ply" $BRUSH_ARGS \
      2>&1 | tee "$WORK/trained/$p.log"
    echo "$p $((SECONDS - t0))" >>"$WORK/trained/seconds.txt"
  done
}

count() { LC_ALL=C grep -a -m1 '^element vertex' "$1" | awk '{print $3}'; }

# The part's sphere from parts.json, a little larger, to drop stray splats. splat-transform's
# filters work in PlayCanvas's space, the file turned 180 degrees about z: (-x, -y, z).
sphere() {
  node -e '
    const d = require(process.argv[1]).datasets[process.argv[2]];
    const c = d.center; console.log([-c[0], -c[1], c[2], d.radius * 1.12].join(","));
  ' "$WORK/data/parts.json" "$1"
}

pack() {
  # shellcheck disable=SC2086
  local total=0
  for p in "${PARTS[@]}"; do total=$((total + $(count "$WORK/trained/$p.ply"))); done
  for p in "${PARTS[@]}" whole; do
    log "Pack $p"
    local n keep_full keep_lite src="$WORK/trained/$p.ply"
    n="$(count "$src")"
    # Turn to our frame (y up), drop splats outside the part's sphere.
    "$ST" -w -q $ST_ARGS "$src" -S "$(sphere "$p")" -r 90,0,0 "$WORK/packed/$p-clean.ply"
    if [ "$p" = whole ]; then
      # The whole orrery trained as one piece, with its SH bands: a captured toy to compare.
      "$ST" -w -q $ST_ARGS "$WORK/packed/$p-clean.ply" "$WORK/packed/whole.sog"
      "$ST" -w -q $ST_ARGS "$WORK/packed/$p-clean.ply" -H 0 "$WORK/packed/whole-nosh.sog"
      continue
    fi
    # The parts toy keeps colors only (src/packs/fidelity.js), so its files carry no SH bands.
    keep_full=$(((FULL * n + total - 1) / total))
    keep_lite=$(((LITE * n + total - 1) / total))
    if [ "$keep_full" -lt "$n" ]; then
      "$ST" -w -q $ST_ARGS "$WORK/packed/$p-clean.ply" -H 0 -d "$keep_full" "$WORK/packed/$p-full.ply"
    else
      "$ST" -w -q $ST_ARGS "$WORK/packed/$p-clean.ply" -H 0 "$WORK/packed/$p-full.ply"
    fi
    "$ST" -w -q $ST_ARGS "$WORK/packed/$p-clean.ply" -H 0 -d "$keep_lite" "$WORK/packed/$p-lite.ply"
    "$ST" -w -q $ST_ARGS "$WORK/packed/$p-full.ply" "$OUT/$p.sog"
    "$ST" -w -q $ST_ARGS "$WORK/packed/$p-lite.ply" "$OUT/$p-lite.sog"
    # The part with its SH bands, for measuring what they add.
    "$ST" -w -q $ST_ARGS "$WORK/packed/$p-clean.ply" "$WORK/packed/$p-sh.sog"
  done
  node -e '
    const fs = require("fs");
    const info = JSON.parse(fs.readFileSync(process.argv[1]));
    delete info.datasets; // the toy needs the parts only
    fs.writeFileSync(process.argv[2], JSON.stringify(info, null, 1) + "\n");
  ' "$WORK/data/parts.json" "$OUT/parts.json"
  "$ROOT/node_modules/.bin/prettier" --write "$OUT/parts.json" >/dev/null
  ls -l "$OUT"
}

measure() {
  (cd "$ROOT" && python3 -m http.server 4173 --bind 127.0.0.1 >/dev/null 2>&1) &
  local server=$!
  trap 'kill $server 2>/dev/null' RETURN
  sleep 1
  for p in "${PARTS[@]}"; do
    log "Measure $p"
    node "$ROOT/tools/fidelity/measure.mjs" "$OUT/$p.sog" "$WORK/data/$p" --out="$WORK/measure/$p"
    node "$ROOT/tools/fidelity/measure.mjs" "$OUT/$p-lite.sog" "$WORK/data/$p" --out="$WORK/measure/$p-lite"
    node "$ROOT/tools/fidelity/measure.mjs" "$WORK/packed/$p-sh.sog" "$WORK/data/$p" --out="$WORK/measure/$p-sh"
  done
  log "Measure whole"
  node "$ROOT/tools/fidelity/measure.mjs" "$WORK/packed/whole.sog" "$WORK/data/whole" --out="$WORK/measure/whole"
  node "$ROOT/tools/fidelity/measure.mjs" "$WORK/packed/whole-nosh.sog" "$WORK/data/whole" --out="$WORK/measure/whole-nosh"
  node "$ROOT/tools/fidelity/summary.mjs" "$WORK" | tee "$WORK/summary.md"
}

case "$STEP" in
  render) render ;;
  train) train ;;
  pack) pack ;;
  measure) measure ;;
  all) render && train && pack && measure ;;
  *) echo "Unknown step: $STEP (render, train, pack, measure or all)" >&2 && exit 1 ;;
esac
