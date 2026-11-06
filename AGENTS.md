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

## Architecture and module ownership

This project is a **layered** architecture, not feature-based. Dependencies flow
one direction only: `src/lib/** → src/components/** → src/app/**`. Never import
from `src/app` or `src/components` into `src/lib`. Never import from `src/app`
into `src/components`. This boundary is what keeps one feature from silently
breaking another; do not weaken it to make an import "easier".

Verified (Phase 5 review): the only existing exception is test-only —
`src/lib/translation-audio.test.ts` imports `GET` from
`@/app/api/recitation/route` to exercise the audio-proxy endpoint alongside
the pure `recitation.ts` helpers it already covers. No production file in
`src/lib` or `src/components` imports from `src/app`. This is accepted as-is
(moving the route's validation logic into `src/lib` to avoid it is a larger,
unrelated restructuring, not a boundary violation in shipped code) — do not
add a second instance without discussing it first.

- `src/lib/*.ts`: framework-agnostic data loading, pure business logic, and thin
  platform bridges (`native-*.ts`). Prefer pure functions here — they are the
  cheapest code in the repo to test and the safest to refactor. Most files pair
  with a co-located `*.test.ts`; keep that pairing when adding new logic.
- `src/components/quran/*.tsx`: presentational and interactive building blocks.
  Each component should own a single concern (a panel, a dialog, a reusable
  hook). Shared cross-cutting hooks (`useDismissiblePanel`, `useComparisonHold`,
  `useVisibleSelection`) belong here, not duplicated inline in a component.
- `src/components/ui/*`: generic shadcn/radix primitives. Only `dialog` and
  `popover` are currently used by the app — everything else in this directory
  is dead scaffolding from the project template. Do not add new files here
  speculatively; add a primitive only when a real feature imports it.
- `src/app/page.tsx`: the reading screen's orchestration root. It currently owns
  a large amount of state (presentation settings, search, selection, drawers,
  audio, comparison). This is a known architectural weak point (see "Known
  technical debt" below). When adding a new reading-screen feature, prefer
  extracting a dedicated hook under `src/components/quran/` over adding more
  inline `useState`/`useEffect` to `page.tsx` directly.
- `src/components/quran/useReadingRoute.ts` + `src/lib/reading-route.ts`: own
  the reading position (`page`/`mode`/`surah`), its `mushaf.*` persistence, the
  canonical reading URL, and browser back/forward restoration. `page.tsx` reads
  a location change only through three callbacks it supplies to the hook
  (`onSearch`/`onVerse`/`onReading`) — the hook decides *that* the location
  changed and to what kind of route; `page.tsx` decides what that means for
  selection, flash and the search panel. `src/lib/reading-route.ts` holds the
  pure decision logic (which kind of route a location is, the first-render
  position, the canonical URL, entering/leaving search) so it is unit-testable
  without a DOM; the hook is the thin `useState`/`useEffect`/`window.history`
  wiring around it. See `src/lib/reading-route.test.ts` and
  `tests/e2e/reading-route.spec.cjs` for the pinned contract before changing
  either file.
- `src/lib/root-comparison.ts`: the root-visibility rules for a range
  comparison — which roots are muted and what tapping one does. Two overlapping
  mechanisms live here (`hidden`, the set the reader tapped off one by one, and
  `solo`, a single root shown on its own) and solo always wins. `page.tsx` keeps
  the `useState` for both sets and the rest of the comparison state; the module
  only decides the resulting display set and the next state after a tap. See
  `src/lib/root-comparison.test.ts` and `tests/e2e/root-comparison.spec.cjs`
  (which pins the tap/long-press/clear behavior through the real UI) before
  changing it — the interaction is easy to break and was untested before this.
- `src/app/study/`: the standalone study-notebook route (`/study/taha`, Surah 20
  — **Surah Taha, not Maryam** — see "Data facts" below).
- `public/data/`: Quran text, translations, roots, fonts. Read-only from the
  app's perspective; see "Quranic data integrity" below.

### Data facts (verified, do not re-derive from assumption)

- Surah 19 = مریم (Maryam). Surah 20 = طه (Taha). The study workspace
  (`src/lib/study.ts`, `src/lib/study-store.ts`) hardcodes `20`/Taha — this is
  intentional (matches the `/study/taha` route), not a bug and not Maryam.
  If you introduce a named constant for it, name it for Taha.
- Only `dialog` and `popover` under `src/components/ui/` are imported by the
  app — every other file that used to live in `src/components/ui/` (48 files:
  accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb,
  button, calendar, card, carousel, chart, checkbox, collapsible, command,
  context-menu, drawer, dropdown-menu, form, hover-card, input-otp, input,
  label, menubar, navigation-menu, pagination, progress, radio-group,
  resizable, scroll-area, select, separator, sheet, sidebar, skeleton,
  slider, sonner, switch, table, tabs, textarea, toaster, toast,
  toggle-group, toggle, tooltip) was dead shadcn scaffolding with zero
  imports anywhere in the app and was deleted (Phase 10), along with the two
  hooks (`src/hooks/use-toast.ts`, `src/hooks/use-mobile.ts`) that only those
  dead files referenced. Re-verify with
  `grep -rl "components/ui/<name>" src/components/quran src/app` before
  assuming a ui/* primitive is live if this ever needs re-checking.

## Dependency boundaries

- Do not add a new npm dependency if an existing one already solves the problem
  (check `package.json` first).
- Removed (Phase 10) as confirmed-dead scaffolding — zero imports anywhere in
  `src/` or `scripts/`, verified by repo-wide grep excluding `.next/standalone`
  build artifacts: `@dnd-kit/*`, `@hookform/resolvers`, `@mdxeditor/editor`,
  `@prisma/client`, `prisma` (+ the generic unused `prisma/schema.prisma`
  scaffold and its `db:*` package.json scripts — this app has no database),
  all unused `@radix-ui/react-*` primitives (kept only `react-dialog` and
  `react-popover`, the two actually imported by `dialog.tsx`/`popover.tsx`),
  `@reactuses/core`, `@tanstack/react-query`, `@tanstack/react-table`,
  `class-variance-authority`, `cmdk`, `date-fns`, `embla-carousel-react`,
  `framer-motion`, `input-otp`, `next-auth`, `next-intl`, `next-themes`,
  `react-day-picker`, `react-hook-form`, `react-markdown`,
  `react-resizable-panels`, `react-syntax-highlighter`, `recharts`, `sharp`,
  `sonner`, `uuid`, `vaul`, `z-ai-web-dev-sdk`, `zod`, `zustand`. Also removed
  `tailwindcss-animate` and `tailwind.config.ts` itself — Tailwind v4's
  CSS-first config (`@import "tailwindcss"` + `@theme inline` in
  `src/app/globals.css`) made the JS config file fully redundant; confirmed
  via byte-identical build output (`sha256sum` on the generated CSS chunk)
  with and without the file before deleting it. The app uses `tw-animate-css`
  (devDependency, `@import "tw-animate-css"` in `globals.css`) instead.
- The app has no database and no server-side auth. Do not add either without
  an explicit product decision — persistence is local (`localStorage`,
  IndexedDB via `study-store.ts`) by design.

## Coding conventions

- TypeScript `strict` is on; `noImplicitAny` is currently off (legacy setting,
  not a license to add untyped code — add explicit types on new code anyway).
- Resolve TypeScript errors with the narrowest fix that matches the actual
  problem. Classify every fix before writing it:
  - **Type-only correction** (annotation/narrowing changes compile-time types
    only, zero emitted-JS difference) — lowest risk, always preferred when
    applicable.
  - **Validation improvement** (adds a runtime check that was previously
    assumed) — changes behavior only for previously-invalid inputs; needs a
    test.
  - **Runtime bug fix** (changes behavior for previously-valid inputs) — needs
    a test that captures the old (wrong) and new (correct) behavior, and
    product sign-off for user-visible changes.
  - **Refactor** (restructures code without intending any behavior change) —
    verify with a before/after diff of compiled output or an equivalent test
    run, not just "it compiles now".
  Never pick a fix that silently falls into a more invasive category than
  necessary just because it's faster to write.
- Do not add `// eslint-disable` or broaden `eslint.config.mjs` to make a
  warning disappear. Fix the underlying issue, or leave the pre-existing
  warning in place and mention it in the PR/commit description.

## Reusable components and interfaces

- Localized panels/dialogs use the shared `dialog`/`popover` primitives from
  `src/components/ui/`; reuse them for new panels instead of hand-rolling
  position/overlay logic.
- Native-bridge style integrations (Tauri, Android Auto) follow the
  `nativeCommand` / `subscribeNative*` pattern in `src/lib/native-*.ts`
  (listener registration + typed postMessage envelope). Follow this pattern
  for any new native integration rather than inventing a new messaging shape.
- Adding a new translation only requires a new JSON file under `public/data`
  and a catalogue entry in `src/lib/quran.ts` / `src/lib/translations.ts` — no
  `page.tsx` changes should be required. If you find yourself touching
  `page.tsx` to add a translation, something is architecturally wrong; stop
  and reconsider.

## Quranic data integrity

- Never edit Quran text, verse/word ordering, or translation content in
  `public/data/**` as part of an architectural or UI change. Content changes
  are a different, separate kind of change requiring their own review.
- `src/lib/mushaf-page-regression.test.ts` is a whole-corpus regression check
  (604 pages × 6236 verses). If a refactor touches rendering/data loading, this
  test passing is a necessary (not sufficient) signal of data integrity.
- `src/lib/quran-display.ts` (`quranDisplayText`) is a presentation-only
  adapter (hides a small, explicitly audited set of codepoints for the bundled
  font). Do not broaden what it strips without re-reading
  `docs/reader-rendering.md` and re-auditing against the shipped font's cmap.

## Required testing

- Unit tests: `bun test src/lib` (uses `bun:test`, not Jest/Vitest). Any
  non-trivial pure function in `src/lib` should have a co-located
  `*.test.ts`.
- Type check: `bunx tsc --noEmit`.
- Lint: `bun run lint`.
- Browser regression: `bunx playwright test --project=chromium-phone
  --project=chromium-desktop --project=android-bridge-phone` (requires
  `bunx playwright install chromium`; a local standalone server must be
  running — see `scripts/verify-release.mjs` for the exact sequence CI/the
  pre-push hook use).
- Before changing fragile orchestration code (URL/history sync, IndexedDB
  study persistence, native bridge messages), add a characterization test
  that captures *current* behavior first, then refactor, then confirm the
  characterization test still passes unless the behavior change is
  intentional and approved.
- Never report a test as passing without actually running it. Never weaken or
  delete a test to make a broken implementation look correct — fix the
  implementation, or revert the change.

## Safe development procedure

1. Record a baseline: `bun test src/lib`, `bunx tsc --noEmit`, `bun run lint`,
   `bun run build` — note pre-existing failures before changing anything.
2. Make the smallest change that addresses the actual problem; keep unrelated
   refactors out of the same change.
3. Re-run the baseline commands; the only differences from baseline should be
   ones you intended and can explain.
4. For changes touching reading state, navigation, search, selection, audio,
   settings persistence, study workspace, offline/service worker, or native
   bridges, re-read the relevant section of this file and the matching doc
   under `docs/` before editing.
5. Commit with a message that states what changed and why, not just what file
   moved.

## Platform-specific constraints

- **Offline / Service Worker**: `public/sw.js` + `scripts/build-offline-manifest.mjs`
  are a critical contract — the manifest is generated, never hand-edited.
  `src/lib/mushaf-offline-refresh.test.ts` simulates the worker via `node:vm`;
  treat it as a required regression gate for any change to caching, the
  manifest shape, or API routes the worker depends on. See `docs/offline-data.md`.
- **Native bridge (Android WebView / Android Auto)**: the `window.QuranNativeAudio`
  message-passing protocol (`src/lib/native-recitation.ts`) is covered by
  `src/lib/native-recitation.test.ts` on the JS side only. The Java
  implementation under `android-auto/` has no automated test coverage in this
  repo's standard dev environment — do not change the JS-side message shape
  without manually checking (or asking a maintainer to check) the
  corresponding Java/Kotlin handler. See `docs/android-auto.md`.
- **Tauri desktop**: `src-tauri/`, `NEXT_PUBLIC_DESKTOP` env flag gates
  desktop-only behavior across several files (e.g. `/study/taha.html` vs
  `/study/taha`). There is no automated test coverage for the desktop shell in
  this environment; treat changes here as unvalidated until manually checked.
- **LocalStorage keys**: reading state is persisted under the `mushaf.*`
  namespace (`mushaf.page`, `mushaf.mode`, `mushaf.surah`, `mushaf.showTrans`,
  `mushaf.theme`, `mushaf.tr`, `mushaf.scale`, `mushaf.marks`,
  `mushaf.pinned-surahs`, `mushaf.recent-surahs`, `mushaf.safavi-default.v1`,
  `mushaf.desktop-navigation-width`, `mushaf.desktop-analysis-width`) plus a
  few feature-specific keys elsewhere (e.g. `mubarak.copy-format.v1`). Never
  rename or repurpose an existing key — that silently resets real users'
  settings. Add a new key for new data instead.

## Known technical debt (tracked, not yet fixed)

- `src/app/page.tsx` still concentrates most of the remaining reading-screen
  state (~50 `useState`) — presentation settings, search panel, selection,
  analysis, drawers, audio, and root/range comparison. The URL/history-sync
  responsibility was extracted into `useReadingRoute` (see above); planned
  mitigation for what remains: further incremental hook extraction, each with
  a characterization test landed first — not a single big rewrite.
- `react-hooks/exhaustive-deps` and `react-hooks/purity` are disabled
  repo-wide in `eslint.config.mjs`. Other React Compiler-aware hooks rules
  (`refs`, `set-state-in-effect`, `preserve-manual-memoization`) are **not**
  disabled and currently surface 27 real diagnostics across 13 files
  (`page.tsx`, `ContinuousMushaf.tsx`, `QuranSearch.tsx`, `RootPanel.tsx`,
  `SurahPull.tsx`, `AnalysisSections.tsx`, `DictationInput.tsx`,
  `IshtiqaqiMeaning.tsx`, `MaqayisMeaning.tsx`, `OccurrencePicker.tsx`,
  `QuickSurahSearch.tsx`, `RangeComparison.tsx`, `ReleaseNotesDialog.tsx`,
  `useRecitationMediaSession.ts`). These are two recurring, intentional
  patterns — "latest ref" (`const r = useRef(x); r.current = x` during
  render, so a callback/effect can read the newest value without
  re-subscribing) and "reset state at the top of an effect that then loads
  async data" — not accidental bugs. `bun run lint` is left non-zero on
  purpose rather than suppressed: fixing each requires rewriting the
  surrounding effect (e.g. moving the reset into an event handler, or
  switching to a key-based remount) with a characterization test proving no
  behavior change, file by file, not a rule-level `"off"`.
- `src/lib/study-store.ts` (IndexedDB read/write for the study workspace) has
  no direct test coverage; only the pure logic in `src/lib/study.ts` is
  tested. Add characterization tests for `loadStudy`/`saveStudy` before
  refactoring this file.

## Definition of Done

A change is done when:

- The specific problem it targets is fixed, with no unrelated files touched.
- `bun test src/lib`, `bunx tsc --noEmit`, and `bun run lint` show no new
  failures compared to the baseline recorded before the change (pre-existing
  failures are documented, not silently inherited as "fine").
- `bun run build` succeeds.
- Any fragile behavior that was touched (URL/history, persistence, native
  bridges, offline) has a passing characterization test covering the
  preserved behavior, or the intentional behavior change is explicitly called
  out and approved.
- Quran source data in `public/data/**` is untouched, unless the change is
  explicitly a content change (different review process).
- This file and the relevant `docs/*.md` are updated if the change affects
  the architecture, contracts, or constraints they describe.
