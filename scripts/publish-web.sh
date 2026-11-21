#!/usr/bin/env bash
set -euo pipefail

sha=${1:-}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Pass the full commit SHA reviewed on beta.' >&2
  exit 1
fi

git fetch origin main beta
git merge-base --is-ancestor "$sha" origin/beta
git merge-base --is-ancestor origin/main "$sha"

result=$(gh run list --workflow build.yml --branch beta --commit "$sha" \
  --event push --limit 1 --json conclusion --jq '.[0].conclusion // ""')
if [[ $result != success ]]; then
  echo 'The reviewed beta commit must pass Reader regression checks before release.' >&2
  exit 1
fi

git push origin "$sha:refs/heads/main"
