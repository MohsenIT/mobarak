# Offline native releases

`bun run build:desktop` exports the reader into `desktop-dist`, including all files from `public`: Quran text, fonts, translations, root/lemma search corpus, and dictionaries. It creates an ignored staging directory, excludes the two web-only API handlers, and makes the manifest static. The ordinary `bun run build` remains the server-backed web build. The native client skips service-worker registration and web update polling. Sharing always uses the public HTTPS site, not a device-local address.

## Local development

Install Bun 1.3.4, Rust 1.90+, and the Tauri 2 prerequisites for your operating system. On Ubuntu 22.04, the native compiler needs `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`; RPM packaging additionally needs `rpm`. Windows needs the Visual Studio C++ build tools and WebView2; macOS needs Xcode command-line tools.

```
bun install --frozen-lockfile
bun run desktop:dev
bun run desktop:build
```

The source is in `src-tauri`, with identifier `app.quranmubarak.reader`. Do not change the identifier or Android release signing key after publication. The Rust dependency lockfile and Bun lockfile are committed.

## Daily GitHub Releases

`.github/workflows/releases.yml` runs at 02:30 UTC (06:00 Iran) and on manual workflow dispatch. Scheduled runs compare the source commit with the last offline release and do nothing when unchanged. Manual dispatch always rebuilds, including when only the Android signing secrets have changed. The initial bootstrap run was triggered by the workflow commit; ordinary pushes no longer publish installers. Tests and the static client build run before the platform builds. Native outputs are built on their own OS, then published together with SHA-256 checksums. Failed required jobs prevent publication. Version numbers use `0.2.<GitHub run number>` and release tags include the date and run number.

Outputs:

- Linux x64: DEB, RPM, AppImage.
- Windows x64: NSIS EXE and MSI.
- macOS Intel and Apple Silicon: DMG.
- Android: APK per ABI, published only when a permanent signing key is configured. Without the key, unsigned APKs remain workflow artifacts and are explicitly not advertised as installable releases.

Windows and macOS packages currently have no publisher certificate / Apple notarization. iOS source is supported by the Tauri mobile entry point, but installable iOS distribution is not configured; it requires Apple signing credentials. Store submission and in-app native auto-update installation are not configured. Users download an installer from Releases; daily publication alone does not install updates on devices.

### Android signing

Repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64`: base64 encoding of the permanent keystore.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- Optional `ANDROID_KEY_ALIAS` (default `quran-mubarak`).
- Optional `ANDROID_KEY_PASSWORD` (defaults to the keystore password).

The workflow aligns the APK for 16 KB page sizes, signs with Android `apksigner`, and verifies the signature before upload. Rust dependencies are cached per platform, including Android. Temporary installer artifacts are kept for one day; published GitHub Release assets remain available. Keep an independent private backup of the keystore and password. Never commit the keystore, its base64 value, or passwords to this public repository. A private key has been prepared outside the checkout; it is not part of these source files.

With GitHub API access and permission to manage repository secrets, an authorized maintainer can register the two prepared values without printing them:

```
gh secret set ANDROID_KEYSTORE_BASE64 --repo MohsenIT/quran-vajeh < /path/to/ANDROID_KEYSTORE_BASE64.txt
gh secret set ANDROID_KEYSTORE_PASSWORD --repo MohsenIT/quran-vajeh < /path/to/ANDROID_KEYSTORE_PASSWORD.txt
```

## Validation so far

The exported client was served from a plain static file server in a fresh browser context with all external network requests blocked. First launch, Quran reading, selected-verse navigation, Persian translation, and global root search worked with zero API calls and zero external requests. All 70 library tests and both web/static builds passed.

All four desktop platform jobs and the unsigned Android APK build succeeded in GitHub Actions. The public AppImage was downloaded from the release, its SHA-256 checked against the published checksum, and the actual native application launched under Xvfb on Linux. Quran text and fonts loaded from the bundle; global root search for علم, the تعليم form filter (34 verses / 42 occurrences), translation display, jumping to an ayah, and returning with the same filter and translation state were verified. Windows/macOS were built but not interactively tested on devices. Android remains unsigned until its permanent key is registered; iOS distribution still needs Apple signing.

Published installers: https://github.com/MohsenIT/quran-vajeh/releases/tag/offline-2026-10-22-3

## Continuation checkpoint (2026-10-22)

Request to resume: «ادامهٔ ریلیز چندسکویی قرآن؛ ثبت کلید امضای اندروید در GitHub Secrets مانده بود.»

- Release build: https://github.com/MohsenIT/quran-vajeh/actions/runs/39726995697 (source `c4d62ded938b66a5410e500d48003e44ddc91fb8`). Linux DEB/RPM/AppImage, Windows EXE/MSI, and both macOS DMGs have built and uploaded successfully. Check the run for final publication status.
- Android release signing values were generated outside the public checkout. The private backup is `/workspace/artifacts/quran-android-signing-PRIVATE.zip`; individual values are in `/workspace/artifacts/android-signing/`. Never print or commit those files. Reuse this key once any signed release has shipped.
- `gh` is installed and `GH_TOKEN` is present, but the request to `api.github.com/repos/MohsenIT/quran-vajeh/actions/secrets/public-key` was blocked by the environment network policy. Git push and reading public GitHub web pages work; these do not establish API permission.
- Adding `api.github.com` to the allowed domains was proposed, preserving all existing domains, but the environment draft save returned `stale_base`. No network change was confirmed. The transferable proposal is `/workspace/artifacts/github-api-network-request.json`. A fresh environment setup chat must reconcile the current draft before saving that change; do not keep retrying the stale draft.
- When API access works, verify secret-management permission, then register the two existing signing values through `gh secret set` with stdin. The user explicitly authorized doing this without asking them to copy values manually. The user postponed store accounts and submission; GitHub Releases is the publication destination.

Publication can be retried without recompiling through `.github/workflows/publish-native.yml`: dispatch with the original successful build run ID, or push a tag `publish-native-<run_id>`. The workflow verifies all platform build conclusions and the main-branch source, downloads only installer artifacts, flattens their bundle subdirectories, generates checksums, and publishes against the original source commit. The initial run completed all builds but its publication step failed on nested artifact directories; `scripts/publish-native.sh` fixes that layout.

Publication succeeded using a verified existing tag, avoiding the release API's retargeting permission error. The normal publisher creates the source tag through the Git refs API when missing, then uses `--verify-tag`. It checks any existing tag/release against the original source and never force-moves tags. Installer filenames are normalized before hashing so the checksum filenames match the assets actually served by GitHub.
