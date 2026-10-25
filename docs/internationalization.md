# Interface languages and Quran translations

UI messages live in `src/messages/<language>.json`, independent of components.
Resource/reciter metadata and branding also live in separate data JSON files.
Keys are stable IDs: changing wording in a JSON file does not require changing
JSX. Placeholders (`{p0}`, `{language}`, etc.) must keep their names and counts.
`src/lib/i18n.ts` supplies `t`, a reactive locale subscription, lazy JSON loading,
Persian fallback and direction. No DOM text replacement or online translation
service runs on user devices. Locale catalogues are generated translations;
structural checks do not establish native-speaker linguistic review.

The 44 supported language codes come from Tanzil's language collection. Language
names use Intl.DisplayNames. Metadata and quoted Quran text are separate from UI
messages. Quran text, dictionary excerpts and imported translation text are not
machine-rewritten by the interface layer. The four existing Persian translations
and Persian default remain available. The Arabic-language source is explicitly
Tafsir al-Muyassar rather than a purported translation of Arabic into Arabic.

`public/data/translations/catalogue.json` records one source for each of the 43
additional languages, source URL, pinned distribution (@ghoran/translation 0.0.9),
SHA256 and verse coverage. Every source retains the original 6,236-position array.
Kurdish Asan has one empty source verse (6,235 nonempty translations); emptiness
is preserved and must not be replaced by Persian or invented target text.
Use `scripts/import-tanzil-languages.py` with the extracted pinned package and
Tanzil JavaScript catalogue to reproduce the import. All additional text is
about 61.2 MB uncompressed on the server; initial offline packs exclude it.

`loadTrans(surah, translator)` lazily loads the selected source, slices it using
canonical surah verse counts, caches by source and evicts failed promises for
retry. Reader, selection sheet, sharing, adjacent surahs, mushaf and search all
pass the selected source. Search links preserve/validate its catalogue ID. The
Quran remains readable if a translation download fails. Translation paragraphs
carry their own language/direction independently of the Arabic Quran and UI.

Each additional translation is its own hashed offline pack. Concurrent downloads
queue behind the automatic base pack instead of returning a busy error. The web
worker also saves the first reader document and already-loaded locale chunks,
including on first installation, for offline reloads. Selected translation pack
IDs are retained for subsequent incremental refreshes.

 The language section
in Settings downloads the currently selected translation explicitly. New language
packs are not bundled into native initial installation; they remain available
online and can be downloaded later. Existing native fetch fallback is retained.
UI JSON chunks are included in the native static build.

First visit: match navigator.languages against supported languages. An optional
same-origin `/api/language-region` request supplies only the Vercel edge country
hint; the app never requests precise location, stores an IP, or calls an external
IP lookup provider. Device language takes priority; country is the fallback.
Off Vercel the endpoint returns null, and device detection still works. On native
static exports a missing endpoint likewise falls back to the device. A 1.5-second
bound prevents region lookup from holding the suggestion indefinitely.

A non-Persian suggestion is shown in Persian and the target language. Neither UI
nor Quran translation changes before acceptance. Acceptance saves the locale,
selects the target-language Quran source and enables translation display. Decline
or dismissal keeps the current choices and suppresses future suggestions. An
explicit Settings selection also suppresses suggestions. Interface language and
Quran source can subsequently be changed independently. Stored choices survive
reloads and work offline after their language/source assets have been obtained.
