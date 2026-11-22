# Search and Go, phase 1

Baseline: `8b5b558` on both `origin/beta` and `origin/main`. The toolbar surah
button opens the navigation view of `NavDrawer`. The tools menu opens
`QuranSearch`; the quick magnifier opens `QuickSurahSearch`, which can pass
its current query and scope to advanced search. The `/q` route restores the
advanced panel through `useReadingRoute` and `useSearchNavigation`.

| Concern | Contract and owner |
| --- | --- |
| Intent | `navigation.ts` interprets explicit commands and offers ranked results. Typed text can be passed to the existing advanced search through an explicit action. |
| Target | Reuse `Destination` and metadata-backed validation. A ranked suggestion and an active selection are distinct. |
| Screen state | `useSearchNavigation` owns which search surface is open. Query, focus and suggestion selection belong to the open screen. `quran-search-session.ts` stays the existing engine session. |
| Reading | `useReadingRoute` owns the URL, browser history and saved reading position. The reading screen executes reveals through existing callbacks. |
| Persistence | `reader-storage.ts` retains best-effort access. Existing recent-surah and pin keys retain their formats. Last locations and executed operations use independent versioned keys. |

The surah list, recent shortcuts and vertical juz rail are reusable. Keep the
tools and quick-search entries in place, and preserve result return and deep
links. Characterization covers closing the old surface without moving the
reader, and the direct-link, advanced return and quick journey suites cover the
route boundaries.

The main risks are ambiguous numeric inputs, scroll restoration after fonts or
data load, page addresses shared by more than one surah, and accidentally
writing browser history while typing. Native mobile keyboard dismissal requires
device verification in addition to desktop browser emulation.

Implementation order follows the seven tasks: characterization and baseline,
destination selection, integrated surface, per-surah location, operation
history, browser traversal, and release verification.


## Beta preview and rollback

Build the dedicated branch with `NEXT_PUBLIC_SEARCH_AND_GO=1` in the isolated
preview environment. Next.js inlines the flag when it builds the client.
Rebuild with the variable unset or set to `0` to restore the legacy navigation
drawer. The destination selection rules apply in both versions. Closing or
rolling back the preview needs no storage migration.

```sh
NEXT_PUBLIC_SEARCH_AND_GO=1 bun run build
PORT=3017 HOSTNAME=127.0.0.1 node .next/standalone/server.js
```

In another terminal, run the phase-one browser tests against that build.

```sh
SEARCH_AND_GO_E2E=1 READER_URL=http://127.0.0.1:3017 bunx playwright test   --project=chromium-phone --project=chromium-desktop search-and-go
```

For the rollback check, rebuild with the flag unset and run
`navigation-characterization.spec.cjs` and `reader-surah-menu.spec.cjs`. Run
the full regression command from `AGENTS.md` against that build.

## Manual checks in the preview

1. Open `/s/20/a/34`. Tap the surah control, browse the list and vertical juz
   rail, and close. Check the same passage is visible. Check the tools menu
   and the separate quick-search magnifier.
2. Focus the empty field. Open an example, then type `۳`. Enter should leave
   the reader in place. Choose with an arrow key and press Enter. Repeat with
   the visibly highlighted `بقره ۲۵۵`, then check Back and Forward.
3. Move to ayah 40 of Taha, go to another surah and reload. Open Taha from the
   recent shortcuts. A legacy recent without a saved word opens its first ayah.
4. Focus the empty field, pin or unpin an operation using touch or Space, and
   replay it. Check that a real advanced text result records the query and
   search settings, and that opening and editing a query alone records nothing.
5. Open `/p/42` and jump to `ناس ۴`. Check page 604, the active surah and
   the original page on Back. Check a direct `/q` link and the existing
   return-to-results action.
6. Repeat on a narrow phone and desktop in light and dark. On a physical
   phone, open the system keyboard, type an ambiguous command, then use the
   keyboard's Enter or Back control. Confirm the input survives dismissal.

## Saved data and browser history

`mushaf.surah-positions.v1` stores the last visible verse and word per surah,
deduplicated and written after a brief scroll pause. Resuming uses the current
display mode. The history origin stores the word and its visual offset for Back.
Existing recent and pinned surah keys retain their original meanings.

`mushaf.search-and-go-history.v1` stores validated destinations and canonical
links for completed text searches, with timestamp and pin state. A repeated
operation refreshes its timestamp and retains its pin. Up to 12 unpinned
operations are kept. A text operation is recorded when an actual result is
opened and replays the existing advanced search with its settings.

This branch is a phase-one candidate for preview review. Product acceptance
follows testing and explicit approval. Live verse search and the phase-two
and phase-three features are outside the build.
