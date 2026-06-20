#!/usr/bin/env bash
# Mirror packages/universal-schema -> the standalone suliemandev/universal-schema repo.
#
# The monorepo is the SINGLE SOURCE OF TRUTH; the standalone repo is a read-only
# mirror (a publish artifact), not a dev location. Run this after any change to
# packages/universal-schema lands on main, so the mirror never silently drifts.
#
#   ./scripts/sync-universal-schema.sh
#
# It subtree-splits the package (history preserved, rebased to repo root) and pushes
# it as the mirror's main. Force-push is intentional: nothing depends on the mirror's
# history, so rewriting it is safe and keeps it a faithful reflection of the monorepo.
set -euo pipefail

PREFIX="packages/universal-schema"
MIRROR="https://github.com/suliemandev/universal-schema.git"
SPLIT_BRANCH="split-universal-schema"

root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash before syncing." >&2
  exit 1
fi

echo "Syncing $PREFIX -> $MIRROR (main)"
git branch -D "$SPLIT_BRANCH" 2>/dev/null || true
git subtree split --prefix="$PREFIX" -b "$SPLIT_BRANCH"
git push --force "$MIRROR" "$SPLIT_BRANCH:main"
git branch -D "$SPLIT_BRANCH" 2>/dev/null || true
echo "Done. Mirror now matches $(git rev-parse --short HEAD) on $(git branch --show-current)."
