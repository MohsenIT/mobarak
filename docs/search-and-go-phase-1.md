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
