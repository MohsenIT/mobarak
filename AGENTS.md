<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Interface text

All user-facing interface labels, messages, placeholders and accessibility names
must use i18n keys from `src/messages/<language>.json`; do not hardcode them in
components or UI helpers. Persian remains the default. Preserve placeholders in
all locales. Source content (Quran, translations, dictionary entries and verified
bibliographic metadata) must remain separate and must not be rewritten by UI
localization. See `docs/internationalization.md` and `src/messages/README.md`.
