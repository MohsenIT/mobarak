# Offline data

The default data pack includes Quran text, current Persian translations (including Safavi), search data, book indexes and summaries, and full Tahqiq. Maqayis and Ishtiqaqi full entries are optional. Existing translation JSON files contain all translators together; these remain bundled rather than duplicating or changing the reading format.

`node scripts/build-offline-manifest.mjs` generates a file-level SHA-256 manifest and a lightweight Ishtiqaqi summary sidecar. Both web and native build scripts run it. Do not hand-edit the generated manifest.

Web/PWA downloads defaults after service worker readiness, and resumes on a later visit or reconnection. Settings offers optional books and a manual update. The service worker verifies hashes before committing each file. Incomplete downloads retain valid files; unchanged files are skipped. This is file-level incremental updating, not binary patches. Browsers can evict site storage; offline use requires a completed initial download and cached app shell.

The native static build bundles defaults and excludes the two optional full-book directories. Native data fetches prefer downloaded cache entries, then bundled files, then the public web data endpoint. Opening an undownloaded entry online caches it. Settings downloads complete optional books. Updates compare bundled/cached hashes before requesting changed files. Public data and manifest responses allow cross-origin native reads. App-code updates still require a new application package.

Validation: browser service-worker download, repeat with zero data requests, offline Quran/translation/search/Tahqiq/summary reads and offline document reload; production web and native static builds. Device-specific Android storage and signing remain separate from browser validation.
