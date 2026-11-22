# Search and Go Phase 3 review

This preview builds on PR #21 at `04b4251`. The flag `NEXT_PUBLIC_SEARCH_AND_GO_PHASE_3=1` enables the Phase 3 interface and worker options when both previous Search and Go flags are enabled. Remove the Phase 3 flag and rebuild to return to the Phase 2 interface and search semantics.

## Contracts

- The single field still supports destination suggestions. The Worker handles all words, any word, an exact adjacent phrase, and quoted clauses. Unquoted words use the existing normalized matching rules and partial-match preference. Exact phrases respect canonical boundaries and independently tagged wāw.
- The four quick controls show scope, word relationship, same-root expansion and sort. The mobile row expands on request. The research panel offers attested roots, lemmas and forms. Values within one group combine by OR. Different groups must intersect on a matched stem.
- The reader surah at opening is captured for the current, before and after scopes. Resolved surah IDs and the named scope travel in links and in the return snapshot. Same-root expansion changed by the user is saved for fresh searches.
- Default order is Mushaf. Relevance uses BM25 and positions from the corpus. The sort precedence travels with the session and link. The data audit distinguishes the available Meccan and Medinan classification from a source-backed revelation sequence. [Data audit](search-and-go-phase-3-data-audit.md)

## Review in the preview

1. Search «تخف موسى» and compare all words, any word and exact phrase. Try `"لا تخف"` and confirm adjacent hits.
2. Change scope to the current surah, earlier, later, selected, Meccan or Medinan. Open a result, navigate to another surah then return and verify the original context, scroll, sort and filters.
3. Open research filters after typing and combine different values from one group and values from two groups. Use the existing help control for copy link, translation and partial-match settings.
4. Review on desktop and phone with the keyboard open. Compare the compact mobile presentation with the expanded controls.

## Verification and performance

Use `bun test src/lib`, `bunx tsc --noEmit`, `bun run lint` and `bun run build`. The Phase 3 browser job builds with the three flags and runs `SEARCH_AND_GO_PHASE_3_E2E=1 bunx playwright test --project=chromium-phone --project=chromium-desktop search-and-go-phase-3`.

A warmed container microbenchmark used ten queries and thirty measured engine calls per mode. Phase 2 p50/p95 was 21/53 ms. Phase 3 all-words with Mushaf sort measured 34/392 ms and relevance measured 31/239 ms. Exact phrases measured 67/96 ms. The long tail includes multi-clause queries and shared runner load. Physical low-end phone measurements remain a product review gate.

## Application captures

- [Mobile with collapsed controls](handoff/validation/search-and-go-phase-3/01-mobile-collapsed.jpg)
- [Mobile scope options](handoff/validation/search-and-go-phase-3/02-mobile-scope.jpg)
- [Desktop](handoff/validation/search-and-go-phase-3/03-desktop.jpg)
- [Desktop research filters in dark theme](handoff/validation/search-and-go-phase-3/04-desktop-research-dark.jpg)
