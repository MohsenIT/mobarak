# Search and Go · Phase 2

The review branch starts from beta merge `f573bbd` (Phase 1 PR #20, reviewed head `3c13d04`). Beta's version endpoint confirmed that release. Phase 2 has its own preview flag, `NEXT_PUBLIC_SEARCH_AND_GO_PHASE_2=1`, alongside the Phase 1 flag.

## What Phase 1 already shipped

- `SearchAndGo` owns the unified search field, keyboard viewport and destination selection. Phase 1 already searched concurrently for bare «طه» and dispatched plain text to the same worker used by the standalone advanced surface.
- `QuranSearch` owns live computation, cards, translations, existing controls and list pagination. Phase 1 search results displayed the count of highlighted word positions, and the unified input did not show the worker's completions.
- `useSearchNavigation` coordinates entry sources and the reader's return control. `useReadingRoute` alone writes URL and browser history. Phase 1's unified return restored the query and list scroll, with browser Back tied to the initial reading arrival.
- `QuickSurahSearch` remains the independent reader toolbar search. Its advanced entry transfers query mode and scope. `navigation.ts` remains the authority on valid surah, verse, page, juz and context destinations.

## Phase 2 contracts

- `SearchLinkState` carries the original query, text/root/lemma criterion, surah scope, existing filters, translation options and analysis selection. The existing `/q` and `/search` query parameters remain readable. New plain searches start with same-root expansion off.
- The live search worker loads the checked-in `public/data/quran-search.json` corpus from the core offline pack and keeps its index for successive requests. The reader primes the worker script cache after service-worker control. Request identity controls which reply may paint results.
- Text matching uses the existing Quran normalization for Persian/Arabic letters, diacritics, hamza, tatweel and spaces. Per-verse occurrence spans refer to canonical word positions. Counts distinguish verse cards, occurrences and unique highlighted positions. Cards and suggestions display original Quran text.
- The preview shows one horizontally scrollable row of up to three attested completions. Existing advanced options are available using the help control, including copy link and translation. Arrow keys explicitly select a destination or completion. Confirming a completion only edits the field.
- The results snapshot holds the selected canonical word, the number of loaded cards, the first visible verse and its offset. The results view recomputes after returning and positions the anchor after fonts and any visible translations load. Browser history carries the snapshot and return journey across reading routes. A session-scoped dismissal marker prevents the return chip from reviving through Back or Forward. Results and scroll positions are not stored in localStorage.
- Search history stores replayable operation links as before. Phase 2 can replay root, lemma and analysis criteria. The existing surah shortcuts keep their initial-screen placement. New filter/sort design and advanced syntax belong to Phase 3.

## Preview verification

1. Open `/s/20/a/34`, enter Search and Go and type «طه», «طه ۴۰», «۳» and «۱۸۰». Check simultaneous text results, highlighted exact destination, safe Enter and valid bounds.
2. Type «صبر» and «وعد » (with a trailing space). Open a result from a deeply scrolled list, move to a different surah and return. Check the selected card, scroll and × dismissal. Repeat in mushaf mode.
3. Open `/q?q=علم&m=l&s=20`, expand a lemma search from the quick bar, and open an occurrence search from the analysis panel. Compare the criterion and scope.
4. Download the core pack, reopen with the network disconnected and run «اسما الحسنی». On physical Android and iOS devices, check keyboard height, Enter, Back and dictation.
5. Record feedback on completion placement and count from the preview. The compact row is a review candidate.

To roll back Phase 2, remove `NEXT_PUBLIC_SEARCH_AND_GO_PHASE_2` from the preview branch and redeploy. Keep `NEXT_PUBLIC_SEARCH_AND_GO=1` to retain Phase 1. See [performance and offline verification](search-and-go-phase-2-performance.md).
