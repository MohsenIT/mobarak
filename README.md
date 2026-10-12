# Quran Vajeh — قرآن واژه

قرآن‌خوان فارسی با نمایش مصحف و متن پیوسته، ترجمه و تحلیل ریشهٔ واژه‌ها.

[نسخهٔ آنلاین قرآن واژه](https://quran-vajeh.pastelcat2.chatgpt.site) — با ورود به حساب مالک سایت.

شناسهٔ سایت در `.openai/hosting.json` ذخیره شده است تا در توسعه‌های بعدی همان سایت به‌روزرسانی شود. نسخهٔ فعلی در Sites منتشر شده؛ اتصال خودکار به گیت‌هاب هنوز نیاز به راه‌اندازی میزبان دارد.

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
