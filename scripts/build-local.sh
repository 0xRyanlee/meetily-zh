#!/usr/bin/env bash
# Local macOS build script for meetily-zh
# Produces a signed (ad-hoc) .app + .dmg in:
#   target/<triple>/release/bundle/dmg/
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ── Detect host triple ────────────────────────────────────────────────────────
TARGET=$(rustc -vV 2>/dev/null | awk '/^host:/{print $2}')
if [[ -z "$TARGET" ]]; then
  echo "Error: rustc not found. Install Rust: https://rustup.rs"
  exit 1
fi
echo "Host target: $TARGET"

# ── Check pnpm ────────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "Error: pnpm not found. Install: npm install -g pnpm"
  exit 1
fi

# ── Step 1: Frontend dependencies ─────────────────────────────────────────────
echo ""
echo "==> Installing frontend dependencies…"
(cd frontend && pnpm install)

# ── Step 2: llama-helper sidecar ─────────────────────────────────────────────
echo ""
echo "==> Building llama-helper sidecar (Metal)…"
cargo build --release -p llama-helper --features metal

mkdir -p frontend/src-tauri/binaries
cp target/release/llama-helper "frontend/src-tauri/binaries/llama-helper-${TARGET}"
echo "    Copied to frontend/src-tauri/binaries/llama-helper-${TARGET}"

# ── Step 3: Tauri app ─────────────────────────────────────────────────────────
echo ""
echo "==> Building Tauri app…"
echo "    (FFmpeg will be downloaded automatically if not cached)"
(cd frontend && pnpm tauri build)

# ── Output ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "Build complete!"
echo ""
echo "DMG:  $(find target -name '*.dmg' 2>/dev/null | head -1)"
echo "App:  $(find target -name '*.app' -maxdepth 6 2>/dev/null | head -1)"
echo "============================================"
