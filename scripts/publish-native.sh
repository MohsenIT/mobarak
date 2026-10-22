#!/usr/bin/env bash
set -Eeuo pipefail
publish_log=$(mktemp)
exec > >(tee "$publish_log") 2>&1
report_failure() {
  local status=$?
  LOG_PATH="$publish_log" node <<'JS'
const fs = require('fs');
const text = fs.readFileSync(process.env.LOG_PATH, 'utf8').slice(-3000).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
console.log('::error title=Installer publication failed::' + text);
JS
  exit "$status"
}
trap report_failure ERR
: "${RELEASE_TAG:?}" "${RELEASE_SHA:?}" "${GH_REPO:?}" "${GH_TOKEN:?}"
# upload-artifact preserves bundle subdirectories; flatten only installer files.
mkdir -p release-files
while IFS= read -r -d '' installer; do
  name=$(basename "$installer")
  # GitHub normalizes spaces in release asset names to periods.
  cp "$installer" "release-files/${name// /.}"
done < <(find installers -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o -name '*.exe' -o -name '*.msi' -o -name '*.dmg' -o -name '*.apk' \) -print0)
cd release-files
shopt -s nullglob
assets=(./*.deb ./*.rpm ./*.AppImage ./*.exe ./*.msi ./*.dmg ./*.apk)
if [ "${#assets[@]}" -eq 0 ]; then echo 'No verified installers were downloaded.' >&2; exit 1; fi
sha256sum "${assets[@]}" > SHA256SUMS.txt
cat > release-notes.md <<EOF_NOTES
Offline Quran Mubarak installers. Quran text, fonts, translations and search data are included; no server is required.

Source: $RELEASE_SHA

Windows and macOS packages are currently unsigned (macOS is not notarized). Android APKs appear only after the permanent signing key is configured. iOS distribution requires separate Apple signing and is not included.
EOF_NOTES
if body=$(gh release view "$RELEASE_TAG" --repo "$GH_REPO" --json body --jq .body 2>/dev/null); then
  if [[ "$body" != *"Source: $RELEASE_SHA"* ]]; then echo 'Existing release has a different source commit.' >&2; exit 1; fi
  gh release upload "$RELEASE_TAG" --repo "$GH_REPO" --clobber "${assets[@]}" SHA256SUMS.txt
else
  release_target=(--target "$RELEASE_SHA")
  if tag_sha=$(gh api "repos/$GH_REPO/commits/$RELEASE_TAG" --jq .sha 2>/dev/null); then
    if [[ "$tag_sha" != "$RELEASE_SHA" ]]; then echo 'Existing tag has a different source commit.' >&2; exit 1; fi
    release_target=(--verify-tag)
  fi
  gh release create "$RELEASE_TAG" "${release_target[@]}" --title "Quran Mubarak $RELEASE_TAG" --notes-file release-notes.md --latest --repo "$GH_REPO" "${assets[@]}" SHA256SUMS.txt
fi
