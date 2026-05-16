#!/usr/bin/env bash
set -euo pipefail

TAURI_CONF="frontend/src-tauri/tauri.conf.json"
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ── Read current version ──────────────────────────────────────────────────────
CURRENT=$(grep -o '"version": "[^"]*"' "$TAURI_CONF" | cut -d'"' -f4)
echo "Current version: $CURRENT"

# ── Prompt for new version ────────────────────────────────────────────────────
read -rp "New version (leave blank to keep $CURRENT): " INPUT
VERSION="${INPUT:-$CURRENT}"

# Basic semver sanity check
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.][0-9]+)?$ ]]; then
  echo "Error: '$VERSION' doesn't look like a version number (expected X.Y.Z or X.Y.Z.N)"
  exit 1
fi

# ── Bump version in tauri.conf.json if changed ───────────────────────────────
if [[ "$VERSION" != "$CURRENT" ]]; then
  # Use Python for portable in-place JSON edit (avoids sed -i portability issues)
  python3 - "$TAURI_CONF" "$VERSION" <<'PY'
import sys, json, pathlib
p = pathlib.Path(sys.argv[1])
data = json.loads(p.read_text())
data["version"] = sys.argv[2]
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
PY
  echo "Bumped $TAURI_CONF → $VERSION"
  git add "$TAURI_CONF"
  git commit -m "chore: bump version to $VERSION"
fi

# ── Check for uncommitted changes ─────────────────────────────────────────────
if ! git diff --quiet HEAD; then
  echo "Error: there are uncommitted changes. Commit or stash them first."
  git status --short
  exit 1
fi

TAG="v$VERSION"

# ── Guard against duplicate tag ───────────────────────────────────────────────
if git tag -l "$TAG" | grep -q .; then
  echo "Error: tag $TAG already exists locally."
  exit 1
fi
if git ls-remote --tags origin "refs/tags/$TAG" | grep -q .; then
  echo "Error: tag $TAG already exists on remote."
  exit 1
fi

# ── Create and push tag → triggers CI release ────────────────────────────────
git tag "$TAG"
echo "Created tag $TAG"

echo ""
echo "Pushing main + tag to origin…"
git push origin main
git push origin "$TAG"

echo ""
echo "✓  Tag $TAG pushed — GitHub Actions release workflow has been triggered."
echo "   https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo 'YOUR_ORG/meetily-zh')/actions"
