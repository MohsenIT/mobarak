# Search usability scenarios

Two complementary views share the same search engine:

- The toolbar magnifier opens quick search with an inline current-surah / whole-Quran scope segment. It defaults to the current surah and persists the explicit choice under `mushaf.quick-search-scope`. Text/substring/phrase, direct root or lemma, verse numbers and previous/next results remain available; advanced search inherits the chosen scope.
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

Whole-Quran quick search uses the existing search worker/corpus. Revealing a hit does not change the source surah of an ongoing scoped search. Explicitly switching back to “this surah” starts from the currently displayed surah. `useSearchNavigation` owns the scope preference; `useReadingRoute` owns the return journey. Opening quick search captures the visible word and its offset. The first jump creates one history entry; subsequent hits replace it. The return chip or browser Back restores the original URL, reading mode and visual offset; Forward can revisit the last hit. Closing the bar preserves the return chip.

All inline filter rows use `SearchFilterRow`, a shared component receiving labels, options, optional counts, selection and a toggle callback. It has no knowledge of lemma/form types; current form and lemma filters and future inline filters use the same layout contract. It measures actual chip and overflow-action widths using ResizeObserver, including font and viewport changes. All fitting chips appear on one line; “more” is reserved only when needed. Its hidden measurement copy is inert and excluded from accessibility. Expansion still reveals every option and retains the existing filtering semantics. Browser coverage includes root نصر with four form options, not just lemma overflow.

Browser regression checks verify that the toolbar stays at the top, window.scrollY remains zero, the first and next matches are visible promptly, repeated verse-number jumps work, a shorter viewport retains the toolbar, and local search works with the global corpus request blocked. The complete advanced-search/result-return scenario also passes.

## Compact redesign

The search screen now has a two-row command bar (~94 px at widths 320, 390 and 1280 in Chromium). Back, query and translation share the first row. Search modes, an explicit same-root expansion switch, scope and secondary options share the second. Morphology facets scroll with results, show the first three chips immediately, and offer more/less for the rest. Autocomplete is an anchored list, works for words, phrases, roots and lemmas, and supports keyboard selection. Completions use attested corpus text and prioritize exact/prefix matches and frequency. There is a direct advanced-search entry in the reader toolbar, alongside quick search.

Research references (source-code inspection, not claims about live user ratings):

- [Telegram Android DialogsActivity](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/DialogsActivity.java): integrated search field/filter controls and individually removable filters.
- [Google Now in Android search screen](https://github.com/android/nowinandroid/blob/main/feature/search/impl/src/main/kotlin/com/google/samples/apps/nowinandroid/feature/search/impl/SearchScreen.kt): compact search toolbar, query-dependent content and recent-query/result states.
- [Flutter Material SearchAnchor](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/material/search_anchor.dart): query-driven suggestions and explicit search-field/view interaction.

Browser scenarios cover direct entry without quick search, keyboard completion, expanding a typed word to its root, immediately visible facets, more/less without increasing fixed-header height, translation in the command bar, preserved result return/scroll and narrow/mobile/desktop widths.

## Reader navigation and false-match regression

Advanced search lives in the three-line menu with a magnifier and text label; the reader toolbar keeps quick search and shows only the surah name. The toolbar star was replaced by recent-surah navigation in the menu. Recent surahs persist locally; existing page bookmarks remain accessible in a secondary legacy collection. The menu has one input for surah names, explicit page/juz/verse references and numeric destination alternatives, without a prior destination-type selector. Ambiguous alternatives require an explicit choice rather than guessing.

The reported رحم → مكلبين bug was reproduced at 5:4: compact matching joined the end of الجوارح and the beginning of مكلبين. A no-space single-word query may now match within one word, or a sequence of complete adjacent words, but cannot match two partial word edges. Core tests cover both ordinary and root-expanded searches, retain inside-word matching and omitted-space phrases, and verify that every match for رحم with typo tolerance off belongs to root رحم. Fresh searches also reset typo tolerance; explicitly enabled tolerance is visible outside its settings menu.

Browser checks cover menu search entry, absent toolbar star/extra metadata, numeric alternatives, 20:14 navigation, recent surahs, corrected رحم facets with and without root expansion, explicit/reset typo tolerance and 320/390 layouts.
