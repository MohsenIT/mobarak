# قرآن مبارک

قرآن‌خوان فارسی با نمایش مصحف و متن پیوسته، ترجمه و تحلیل ریشهٔ واژه‌ها.

[نسخهٔ آنلاین قرآن مبارک](https://quran-vajeh.vercel.app/)

نسخهٔ اصلی روی Vercel منتشر می‌شود؛ تغییرات شاخهٔ `main` از گیت‌هاب برای انتشار خودکار ارسال می‌شوند.

## توسعه از هر دستگاه

[باز کردن محیط توسعه در مرورگر](https://codespaces.new/MohsenIT/quran-vajeh)

با حساب گیت‌هاب صاحب مخزن وارد شوید و یک Codespace بسازید. نصب وابستگی‌ها و اجرای پیش‌نمایش روی پورت ۳۰۰۰ خودکار است. در تب Ports می‌توانید پیش‌نمایش را باز کنید؛ همین محیط با ورود به همان حساب از دستگاه دیگر قابل ادامه است. پس از ویرایش، تغییرات را commit و push کنید تا در مخزن ذخیره شوند. مصرف محیط تابع سهمیهٔ Codespaces حساب شماست؛ پس از کار آن را متوقف کنید.

هر push به main و هر pull request به‌صورت خودکار build می‌شود. برای انتشار خودکار، مخزن را در Vercel وارد کنید، Next.js را انتخاب کنید و نام پروژه را `quran-vajeh` بگذارید. پس از اتصال، push به main نسخهٔ اصلی و pull request پیش‌نمایش جداگانه می‌سازد. برنامهٔ قرآن به متغیر محیطی نیاز ندارد.

## Run locally or in a cloud development environment

Requirements: Node.js 20.9+ and Bun (the project includes `bun.lock`).

```sh
bun install --frozen-lockfile
bun run dev
```

Open port 3000. In a cloud workspace, use its forwarded port preview.

```sh
bun run build
bun run start
```

The Quran reader loads its text, translations, roots, and fonts from `public/data`; its core functionality does not require a database or API key. Preferences and bookmarks stay in the browser's local storage.

## Structure

- `src/app/page.tsx`: reading state and navigation
- `src/components/quran/`: Quran display, settings, and root analysis
- `src/lib/quran.ts`: data loading and keyword scoring
- `public/data/`: local Quran datasets, translations, and fonts
- `prisma/schema.prisma`: optional database scaffold

For optional database development, copy `.env.example` to `.env` and run `bun run db:generate` followed by `bun run db:migrate`. Never upload `.env` or local database files.

`.zscripts/` contains scripts from the project's previous hosting environment. Use the commands above for normal development.

## Morphology and verse-range comparison

Words with morphological annotations include an optional `form` field in
`public/data/surah/*.json`. Forms are imported by exact surah, verse, and word
location from Quranic Arabic Corpus 0.4, with word counts and roots checked
before writing. Unmarked verbs use form I; unmarked nouns are left unset.
Derived participles retain their annotated form. The form tab groups the selected
root within its form, disables unannotated words, and supports horizontal swipes
between enabled tabs. The word analysis panel shows
the form and links to the source and copyright notices.

The original, unmodified corpus is in `data/quranic-corpus-morphology-0.4.txt`.
Source notices are in `public/data/morphology-source.txt`. Regenerate with:

```sh
python3 scripts/import-morphology.py
bun test src/lib/quran.test.ts
```

The comparison button next to the root index compares an inclusive verse range
with all other verses of the current surah. Only roots found on both sides are
shown. Connection strength is the geometric mean of the two length-normalized
keyword scores; shared frequency sorts by the smaller count on either side.
The existing whole-surah keyword score is shown separately. These are lexical
measures, not claims of semantic equivalence.

The analysis sheet has five tabs: root, morphology form, word, verse, and context.
Each tab preserves its own location while other tabs navigate. Root/form
navigation moves between distinct roots/forms in order of first appearance
(form navigation stays within the selected root);
word navigation moves one word at a time; verse navigation moves one verse at
a time. Main-text selection follows the active tab. Context navigation uses the supplied PDF boundaries.

`public/data/analysis-index.json` provides exact-written-word and annotated-form
counts across the Quran. After changing the bundled word data, regenerate it
with `python3 scripts/build-analysis-index.py`. Word translations are not
available in the bundled datasets; the word tab labels and displays translations
of the verses containing that word instead of inventing a word gloss.

## Context source

The user-supplied `public/data/context-source.pdf` (سیاق‌بندی اولیه سوره‌های
قرآن, مؤسسه گفتمان قرآن و ولایت) is preserved verbatim. `contexts.json` records
the context-column ranges and source page numbers, excluding the independent
daily-reading column. It contains 567 PDF units across 88 surahs. Following the user’s clarification,
each of the remaining 26 short surahs is one whole-surah context, marked
`whole-surah` with `origin: user-clarification` (593 contexts across all 114 surahs). Shura's aggregate row for
contexts 5–7 is preserved as one labeled aggregate unit (29–53), because the
source does not supply the three internal boundaries.

Regenerate with `python3 scripts/import-contexts.py` (requires PyMuPDF). The
importer verifies the source digest, handles reviewed compound RTL cells, and
checks complete nonoverlapping verse coverage for every explicit partition.
Run `bun test src/lib/contexts.test.ts` to validate boundaries and navigation.

`form-names.json` contains verbal-noun names attested in the morphology source,
plus the explicit examples إلقاء / تعليم / تعلّم / استعلام. Regenerate it with
`python3 scripts/build-form-names.py`. When no verbal-noun name is available,
the app shows the recorded form name rather than guessing a masdar. Rebuild
`analysis-index.json` for root-and-form counts with `python3 scripts/build-analysis-index.py`.

## Inline translations

When translation is enabled, Quran words retain their continuous flow. Each
verse’s translation appears in a smaller font beneath its actual wrapped
text fragments. Each wrapped fragment independently uses the largest font size up to 12px
that fits its Arabic width, so a narrow continuation cannot shrink the
translation on other lines. Its translation stays
on one line per fragment; spacing reserves one translation line and a small
margin. This applies in both
continuous reading and page-based reading. Page mode
retains its page number and shows only that page's verses in a scrollable
verse-and-translation layout.

Safavi (based on al-Mizan) is stored as translation id `s`, imported from
`@ghoran/translation@0.0.9/json/fa/tanzil-safavi.json`, whose listed source is
Tanzil. The unmodified input is in `data/translations/fa-safavi.json`; source
metadata and digest are in `public/data/translation-sources.json`. Run
`python3 scripts/import-translation.py data/translations/fa-safavi.json s` to
regenerate the per-surah files. The source has 6236 positions with one empty
entry at 80:39. The user supplied «خندان و شادمانند» for that verse; the
correction is recorded separately in `data/translations/corrections.json` and
applied during import. The original input and its digest remain unchanged.

Maleki (Payamresan) and Mousavi Hamadani (al-Mizan, Jame'e Modarresin edition)
remain pending complete, verified verse-aligned source texts. They are not
registered as selectable translations until their source data is available.

## Search and context comparison

The navigation drawer searches surahs by Persian/Arabic name or number,
including Persian and Arabic digits. Its destination selector accepts a
surah, page (1–604), juz (1–30), or verse. Verse references may use the current
surah's verse number or a named/numbered reference such as `طه:۱۱` or `2:255`.
Explicit prefixes such as `صفحه ۵۰` also select the destination type.

Root comparison includes a context shortcut that fills the source-defined
verse range. The context tab can open comparison directly for its active
context; manual start/end inputs remain editable. A whole-surah context has
no complement and therefore cannot produce within-surah comparison results.

Shared-root comparison colors every occurrence of every shared root throughout
its surah. Root colors are deterministic and match the comparison list keys;
sorting and closing the list preserve them. Solid versus dashed underlines
identify occurrences inside versus outside the range. The comparison banner
reopens the list or clears all comparison colors. Both reading modes and
inline translations use the same colors, including the night theme.

In comparison mode, tap a marked Quran word to toggle highlights for its entire
root; hidden roots retain a muted underline and can be tapped again. Hold a
word for 500ms to show only its root. The visible “فقط … ×” chip restores all
root colors, and a hidden-root count offers the same reset. Movement beyond
10px or pointer cancellation aborts the hold; releasing a completed hold does
not trigger a second tap. These controls apply only to shared comparison roots.
Filters are local to the current comparison range and are not stored.

Selection highlights share a muted sage tone across root, word, verse and
context views. The selected anchor word has a slightly stronger fill and a
thin outline than other words of its root; comparison root colors remain
individually identifiable with softer fills in both themes.

Starting root comparison from the context tab keeps its bottom sheet open.
While context comparison is active, previous/next context navigation updates
the comparison range and shared-root colors in place. The header comparison
control still opens the manual-range comparison tool.

## Al-Tahqiq root meanings

The root tab includes the Persian explanation and Quranic usages from the
user-supplied Android app «التّحقیق (فارسی)», with the Arabic entry available
separately. This is the app's translated summary of Hasan Mostafavi's
«التحقیق فی کلمات القرآن الکریم», attributed by `assets/aboutapp.html` to
Sadeq Abbasi and the University of Tehran Quran and Etrat student schools.
The APK entries do not supply volume/page references; none are invented for them.
The supplemental DOCX entries below retain their actual volume/page references.

Run `python3 scripts/import-tahqiq.py /path/to/base.apk` to extract its Android
resource string arrays without executing the app. `orgwords` contains 1772
unique entry titles; `mani` contains 3544 strings, paired Arabic then Persian
for each title. Original extracted texts, attribution and APK/resource hashes
are retained in `data/tahqiq/source.json`. Per-root JSON files load on demand.
The APK import matches 1554 of 1642 site roots after spelling and shadda
normalization. Eight matches retain multiple explicitly named entries rather
than guessing between homographic words. The supplied DOCX archive provides
source-linked translated summaries for the remaining 88 roots, bringing final
coverage to 1642 of 1642. APK translations remain unchanged.

Validate preserved texts, known semantic anchors, coverage and ambiguous
entries with `python3 scripts/test-tahqiq.py`.

### Arabic-book supplement

`data/tahqiq/supplement-source.json` preserves the Arabic source section,
selected Arabic excerpt, freshly translated Persian summary, original heading,
volume/pages, DOCX paragraph boundaries and file/archive SHA-256 hashes for
each of the 88 supplemented roots. The publication is the supplied third
edition from Dar al-Kutub al-Ilmiyyah / Mostafavi works publishing center.
`supplement-map.json` records manually checked heading links;
`supplement-fa.json` holds the translated summaries. The UI identifies these
as AI-assisted translated summaries, independently of the APK translation.

Mappings were checked against actual Quran words: `ايي` points to «آية»,
`هات` to the discussion of «هات» within «ها», `كلو` to «كلا», and `لوت` to
the negating «لات», not the idol «اللات». Where a word is discussed within
another heading, such as «قسطاس» under «قسط», its source heading remains
visible. Selected Arabic excerpts are verbatim paragraph selections.
Quran examples are taken from the site's verse-aligned word data; printed
verse numbers in the source text are preserved as source text.

To reproduce the supplement from the supplied archive:

```sh
python3 scripts/extract-tahqiq-docx.py /path/to/archive.zip /tmp/tahqiq-book.json
python3 scripts/prepare-tahqiq-supplement.py /path/to/archive.zip /tmp/tahqiq-book.json
python3 scripts/build-tahqiq-supplement.py
python3 scripts/test-tahqiq.py
```

Re-importing the APK automatically reapplies the supplement. There is no
runtime dependency on the uploaded archive or on an external translation API.
