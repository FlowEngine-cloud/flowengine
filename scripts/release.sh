#!/usr/bin/env bash
# FlowEngine Portal — Release script
#
# Usage:
#   ./scripts/release.sh patch    ← 1.0.0 → 1.0.1  (bug fixes)
#   ./scripts/release.sh minor    ← 1.0.0 → 1.1.0  (new features)
#   ./scripts/release.sh major    ← 1.0.0 → 2.0.0  (breaking changes)
#
# What it does:
#   1. Bumps version in package.json + package-lock.json
#   2. Prompts for release notes and prepends to CHANGELOG.md
#   3. Commits, creates git tag vX.Y.Z
#   4. Prints push command — GitHub Actions then builds + publishes Docker image

set -e

BUMP=${1:-patch}

if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

# Ensure working tree is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first."
  exit 1
fi

CURRENT=$(node -p "require('./package.json').version")
npm version "$BUMP" --no-git-tag-version --silent
NEW=$(node -p "require('./package.json').version")
DATE=$(date +%Y-%m-%d)

echo ""
echo "Releasing v$NEW (was v$CURRENT)"
echo ""

# Collect release notes
echo "Enter release notes (one item per line, blank line when done):"
NOTES=""
while IFS= read -r line; do
  [ -z "$line" ] && break
  NOTES="${NOTES}\n- ${line}"
done

if [ -z "$NOTES" ]; then
  echo "No release notes entered. Aborting."
  npm version "$CURRENT" --no-git-tag-version --silent
  exit 1
fi

# Prepend new entry to CHANGELOG.md
ENTRY="## v${NEW} — ${DATE}\n${NOTES}\n"
EXISTING=$(cat CHANGELOG.md)
HEADER=$(echo "$EXISTING" | head -1)
BODY=$(echo "$EXISTING" | tail -n +2)
printf "%s\n\n%b\n%s" "$HEADER" "$ENTRY" "$BODY" > CHANGELOG.md

# Commit and tag
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v${NEW}"
git tag "v${NEW}"

echo ""
echo "✅ Tagged v${NEW}. Now push:"
echo ""
echo "   git push && git push --tags"
echo ""
echo "GitHub Actions will then build and publish:"
echo "   ghcr.io/flowengine-cloud/flowengne:latest"
echo "   ghcr.io/flowengine-cloud/flowengne:${NEW}"
