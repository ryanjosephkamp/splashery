#!/usr/bin/env bash
# Setup script for a Codex cloud environment (docs/codex/SETUP.md).
#
#   bash tools/codex-setup.sh                 # the normal run, in Codex's setup step
#   bash tools/codex-setup.sh --skip-browser  # no Chromium download or apt (a machine that has one)
#   bash tools/codex-setup.sh --no-check      # skip the final browser launch check
#
# It installs what the tests need (npm packages from the lockfile, Playwright's Chromium with its
# system libraries), checks python3 (the tests' web server), and prints a summary. It changes
# nothing in the repository: node_modules is git-ignored, and no assets are rebuilt.
# Safe to run again: each step does nothing when its work is already done.
#
# Environment:
#   SPLASHERY_CHROMIUM  a Chromium to use instead of Playwright's own (with --skip-browser)
#   CODEX_SETUP_MIN_FREE_MB  free disk needed at the start (default 3000)

set -euo pipefail

SKIP_BROWSER=0
NO_CHECK=0
for arg in "$@"; do
  case "$arg" in
    --skip-browser) SKIP_BROWSER=1 ;;
    --no-check) NO_CHECK=1 ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "codex-setup: unknown option '$arg' (try --help)" >&2
      exit 2
      ;;
  esac
done

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$PWD"
MIN_FREE_MB="${CODEX_SETUP_MIN_FREE_MB:-3000}"
START=$SECONDS
SUMMARY=()

step() { printf '\n==> [%s] %s\n' "$((SECONDS - START))s" "$*"; }
note() { SUMMARY+=("$*"); }
die() {
  printf '\n!! codex-setup FAILED at: %s\n!! %s\n' "$STEP_NAME" "$*" >&2
  printf '!! See docs/codex/SETUP.md, "If setup fails", for what this means.\n' >&2
  exit 1
}
STEP_NAME="start"
begin() {
  STEP_NAME="$1"
  step "$1"
}

# 1. The repository ----------------------------------------------------------
begin "Check the repository"
[ -f package.json ] && [ -f package-lock.json ] || die "package.json or package-lock.json is missing in $ROOT. Is the environment's repository the whole Splashery repository, on branch main?"
[ -d tests ] && [ -d src ] || die "tests/ or src/ is missing in $ROOT. The checkout is incomplete (a partial or sparse clone?)."
# A Git LFS pointer instead of a real file would mean the clone skipped large files.
if [ -f assets/toys/cactus/cactus.sog ] && head -c 40 assets/toys/cactus/cactus.sog | grep -q "git-lfs"; then
  die "assets are Git LFS pointers, not files. Re-create the environment with the repository's large files included."
fi
note "repository: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?') at $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

# 2. Disk --------------------------------------------------------------------
begin "Check free disk space (need ${MIN_FREE_MB} MB)"
FREE_MB="$(df -Pm "$ROOT" | awk 'NR==2 {print $4}')"
if [ -n "$FREE_MB" ] && [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
  die "only ${FREE_MB} MB free; npm packages and Chromium need about ${MIN_FREE_MB} MB. Free space or use a larger container."
fi
note "disk: ${FREE_MB:-unknown} MB free"

# 3. Node and npm ------------------------------------------------------------
begin "Check Node and npm"
command -v node >/dev/null 2>&1 || die "node is not installed. In Codex, pick a universal image with Node 20 or newer, or set the Node version in the environment."
command -v npm >/dev/null 2>&1 || die "npm is not installed (node is, so the image is unusual)."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $(node -v) is too old; the tools and Playwright 1.56 need Node 20 or newer."
note "node $(node -v), npm $(npm -v)"

# 4. python3 -----------------------------------------------------------------
begin "Check python3 (the tests' web server)"
command -v python3 >/dev/null 2>&1 || die "python3 is not installed. The tests start 'python3 -m http.server'. Install python3 or choose an image that has it."
python3 -c 'import http.server' 2>/dev/null || die "python3 cannot import http.server; the install is broken."
note "python3 $(python3 --version 2>&1 | awk '{print $2}')"

# 5. npm packages ------------------------------------------------------------
begin "Install npm packages (npm ci)"
STAMP="node_modules/.codex-setup-lock"
LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$LOCK_HASH" ] && [ -x node_modules/.bin/playwright ]; then
  echo "node_modules already matches package-lock.json; skipping."
  note "npm packages: already installed"
else
  npm ci --no-audit --no-fund --loglevel=error || die "'npm ci' failed. Common causes: no internet during setup (turn internet access on for the setup step), a full disk, or a registry outage. Run it by hand to see the full error."
  echo "$LOCK_HASH" >"$STAMP"
  note "npm packages: installed from the lockfile"
fi
[ -x node_modules/.bin/playwright ] || die "node_modules/.bin/playwright is missing after npm ci."
PW_VERSION="$(node_modules/.bin/playwright --version | awk '{print $2}')"

# 6. Chromium ----------------------------------------------------------------
CHROMIUM_NOTE=""
if [ "$SKIP_BROWSER" -eq 1 ]; then
  begin "Browser install skipped (--skip-browser)"
  CHROMIUM_PATH="${SPLASHERY_CHROMIUM:-}"
  if [ -z "$CHROMIUM_PATH" ] && [ -x /opt/pw-browsers/chromium ]; then CHROMIUM_PATH=/opt/pw-browsers/chromium; fi
  [ -n "$CHROMIUM_PATH" ] || die "--skip-browser needs a Chromium: set SPLASHERY_CHROMIUM to its path."
  [ -x "$CHROMIUM_PATH" ] || die "SPLASHERY_CHROMIUM='$CHROMIUM_PATH' is not an executable file."
  export SPLASHERY_CHROMIUM="$CHROMIUM_PATH"
  CHROMIUM_NOTE="existing Chromium at $CHROMIUM_PATH (run tests with SPLASHERY_CHROMIUM=$CHROMIUM_PATH)"
else
  begin "Install Playwright's Chromium and its system libraries"
  # --with-deps runs apt-get, so it needs root (Codex's container is root). Without root we still try
  # the browser alone and say that the libraries may be missing.
  if [ "$(id -u)" -eq 0 ] || command -v sudo >/dev/null 2>&1; then
    npx --no-install playwright install --with-deps chromium || die "'playwright install --with-deps chromium' failed. Likely causes: apt could not reach its mirrors (internet off, or a blocked mirror), a package could not be found (an older or unusual image), or a full disk."
    CHROMIUM_NOTE="Playwright $PW_VERSION Chromium, with system libraries"
  else
    echo "warning: not root and no sudo; installing the browser without system libraries." >&2
    npx --no-install playwright install chromium || die "'playwright install chromium' failed (no internet, or a full disk)."
    CHROMIUM_NOTE="Playwright $PW_VERSION Chromium (system libraries NOT installed: not root)"
  fi
fi
note "browser: $CHROMIUM_NOTE"

# 7. Prove the browser launches ---------------------------------------------
if [ "$NO_CHECK" -eq 0 ]; then
  begin "Launch the browser once (WebGL2 check)"
  CHECK_JS='
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const p = await b.newPage();
  const gl = await p.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  await b.close();
  if (!gl) { console.error("Chromium started but WebGL2 is not available."); process.exit(3); }
})().catch((e) => { console.error(String(e.message || e).split("\n").slice(0, 6).join("\n")); process.exit(1); });
'
  (cd "$ROOT" && node -e "$CHECK_JS") || die "Chromium would not launch (or has no WebGL2). A message like 'error while loading shared libraries' means system packages are missing: re-run without --skip-browser as root."
  note "browser launch: ok, WebGL2 available (software rendering)"
fi

# 8. Done --------------------------------------------------------------------
STEP_NAME="summary"
printf '\n==> Setup finished in %ss. What works:\n' "$((SECONDS - START))"
for line in "${SUMMARY[@]}"; do printf '  - %s\n' "$line"; done
cat <<'EOF'

Run the checks a task asks for:
  npx prettier --check .
  node tools/us-english.mjs --diff
  npx playwright test tests/<file>.spec.mjs      # starts its own web server on port 4173
Not done here on purpose: asset rebuilds (tools/prepare-assets.mjs), thumbnails, Blender or Brush.
EOF
