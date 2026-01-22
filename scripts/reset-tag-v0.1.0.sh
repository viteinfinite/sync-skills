#!/usr/bin/env bash
set -euo pipefail

TAG="v0.1.0"
REMOTE="origin"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) is required." >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "Remote '$REMOTE' not found." >&2
  exit 1
fi

echo "Deleting GitHub release ${TAG} (if present)..."
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release delete "$TAG" --yes
else
  echo "Release ${TAG} not found; skipping."
fi

echo "Deleting remote tag ${TAG} (if present)..."
if git ls-remote --tags "$REMOTE" "refs/tags/${TAG}" | grep -q .; then
  git push "$REMOTE" ":refs/tags/${TAG}"
else
  echo "Remote tag ${TAG} not found; skipping."
fi

echo "Deleting local tag ${TAG} (if present)..."
if git show-ref --tags --verify --quiet "refs/tags/${TAG}"; then
  git tag -d "$TAG"
else
  echo "Local tag ${TAG} not found; skipping."
fi

echo "Creating new tag ${TAG} at HEAD..."
git tag "$TAG"

echo "Pushing new tag ${TAG}..."
git push "$REMOTE" "$TAG"
