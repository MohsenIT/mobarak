# Search usability scenarios

Two complementary views share the same search engine:

- The toolbar magnifier opens quick search within the current surah: text/substring/phrase, direct root or lemma, verse number, previous/next result, advanced search in the same scope, or expansion to the whole Quran.
- Advanced search occupies the entire screen. It supports selecting multiple surahs, direct text/root/lemma queries, root/lemma suggestions, independently removable form/lemma facets with occurrence counts, and optional translations. Result selection opens the verse in the reader; the return action retains the query, scope, filters, translation setting, loaded results and scroll.

Morphology keeps original corpus lemma identifiers internally. Buckwalter IDs are decoded to Arabic for input matching and display. Text normalization never changes the displayed Quran text. Facet counts represent matching word occurrences, not a sum of whole verses. Multiple values within a group are OR; different groups apply AND to the same matched word. Alternatives in the same group remain available when selecting a facet.

## Verification

These are automated browser scenarios in mobile Chromium, not a study with human participants:

1. Search a word in Taha, navigate to the next match, expand to the whole Quran.
2. Enter root علم directly, select a form and a lemma, turn on translation, open a visible result, return and verify query/filters/scroll.
3. Search a partial phrase, then return to quick search and jump using a Persian verse number.
4. Start quick root search, expand while retaining the surah scope, select three surahs, verify result surahs.
5. Enter a lemma in Arabic; verify suggestions are Arabic, not corpus transliteration.
6. Check layouts at widths 320, 390 and 1280 pixels and verify the result area remains usable.

Core tests cover corpus preservation, spelling/phrase/substring matching, direct root and lemma queries, scope, and same-word facet intersection.

Surah pairing shortcuts are intentionally deferred until the user provides their source and pairing scheme.

## Quick-search scroll regression

Quick search builds its index from the already loaded current-surah data, without waiting for the global corpus. Results follow reading order. Focus uses preventScroll; result navigation scrolls only the reader container and is instant in quick mode. The previous FlowPage scrollIntoView path was removed to avoid competing scroll animations and movement of the outer document/header.

Browser regression checks verify that the toolbar stays at the top, window.scrollY remains zero, the first and next matches are visible promptly, repeated verse-number jumps work, a shorter viewport retains the toolbar, and local search works with the global corpus request blocked. The complete advanced-search/result-return scenario also passes.
