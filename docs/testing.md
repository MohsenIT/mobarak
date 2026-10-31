# Reader regression checks

Run `bun run hooks:install` once per clone and install Chromium with
`bunx playwright install --with-deps chromium`. The tracked pre-push hook runs
`bun run verify:release`: unit tests, a production build, and browser tests on
phone, desktop, and the Android bridge. A failed check stops the push. Hooks
are local safeguards; GitHub Actions also runs checks for every main push/PR.

The browser suite exercises all 604 pages for ordered word coverage, visible
surah headings, bismillah and horizontal clipping, plus search, navigation,
selection, clipboard and sharing flows. Highlight tests cover light/dark themes,
custom ordinary/selected colors, continuous verse/context/surah bands, and the
shared ban on underlines, outlines and borders for selected Quran text. This is a rendering regression suite,
not a claim of independent scholarly verification of the Quran source.
Sharing preview and exported text have different font compatibility needs;
both paths have explicit regressions. Preserve the existing test cases when
changing these features. Add a failing example before fixing each new bug.

`vercel.json` runs `scripts/await-ci.mjs` before production builds. It waits
for the successful `build.yml` push workflow on the exact main commit and
fails closed on failed/cancelled checks, unavailable GitHub results, or timeout.
GitHub Actions calls the normal build directly, so it does not wait on Vercel.
No GitHub or Vercel token is needed for this public repository's status lookup.
Local pre-push checks do not replace this production gate.
