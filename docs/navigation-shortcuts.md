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
