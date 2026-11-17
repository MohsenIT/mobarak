# Navigation shortcuts

The Go field is in the drawer opened by tapping the surah title. Explicit shortcuts also work in quick search and advanced text search; choose the destination or press Enter. Ordinary text/root/lemma searches retain their existing behavior.

| Destination | Short forms | Full forms |
| --- | --- | --- |
| Surah | `س۲۰`, `س ۲۰` | `سوره ۲۰`, `طه`, aliases such as `حمد`, `توحید`, `قتال` |
| Page | `ص۶`, `ص ۶` | `صفحه ۶` |
| Juz | `ج۶`, `ج ۶` | `جزء ۶`, `جز ۶` |
| Ayah in current surah | `آ۶`, `ا۶` | `آیه ۶` |
| Context in current surah | `ق۶`, `ق ۶` | `سیاق ۶` |

Qualified ayahs: `۲۰:۷۲`, `طه:۷۲`, `س۲۰:۷۲`, `س۲۰ آ۷۲`. Colon, fullwidth colon and slash are accepted between surah and ayah.

Qualified contexts: `ق۲۰:۶`, `ق طه:۶`, `سیاق طه:۶`, `س۲۰ ق۶`. Context numbers identify the position in the existing context dataset; a command navigates to the first ayah of that context and names its full range in the suggestion.

For every explicit destination prefix, `ا` / `اول` means first; `آ` / `آخر` / `اخر` means last. Examples: `ق ا`, `ق آ`, `ص آ`, `س ا`, `ج آ`, `آ آ`. The distinction is parsed before alef normalization. `قا` and `قآ` are also accepted. A standalone `ق` continues to mean surah Qaf in Go suggestions, not a context command.

Persian, Arabic and Latin digits are accepted. Bare numbers in Go offer explicit alternatives; they do not silently pick a page or a surah. Bare numbers in quick search keep their existing meaning of an ayah number in the current surah. Shortcuts never change continuous reading into mushaf mode. Page, juz, ayah and context jumps align the target at the top rather than the bottom-sheet centering position.

For shared advanced-search links containing relative commands, `at` retains the source surah. This is separate from `s`, the search-results scope.

The unfiltered surah drawer also has a vertical juz index. `juz-navigation.ts`
owns its thirty slots, adaptive label density, coordinate mapping and
surah juz ranges, all derived from the existing juz boundary metadata. Labels
1 and 30 always remain; intermediate labels are distributed evenly at the
densest count that fits the available pane height. Label and dot rectangles
have separate measured-size budgets and nonnegative spacing. Short landscape
panes compress dot gaps instead of overlapping text. Pointer mapping uses the
nearest actual slot center, the same geometry as rendering and the preview.
Taller panes show additional labels; every intervening juz retains its dot.
`JuzRail` owns pointer capture, touch, keyboard and the full-label floating
preview. Selecting an index position scrolls the surah list; it does not change
the reading location until a surah is chosen. Existing drawer navigation and
mode behavior remain owned by their existing handlers. Unit coverage checks
every verse against the original juz data; browser coverage pins slot counts,
range metadata, drag/touch/keyboard navigation and preservation of reading mode.

The drawer has one surah list, without the surah/juz/recent tab strip. Existing
recent shortcuts and Go commands remain available. The index reserves a small
inset at both ends of the list for the floating preview: its center stays
exactly aligned with the selected slot, including juz 1 and 30, without
clamping the preview upward. The rail uses the available inset height even on
tall displays and still ends immediately after its final slot.
