# External resource catalogue

`public/data/resources.json` contains editable resource metadata;
`src/lib/resources.ts` combines it with the translation catalogue for source profiles
and resource pickers. Interface labels come from `src/messages/<language>.json`. IDs are stable and separate from providers (`reciter:*`,
`translation:*`, `book:*`, `quran:*`, `corpus:*`). Current resources are the two
available reciters, four bundled translators, three dictionaries, Tanzil text and
the morphology corpus. Tafsir is a supported category; no unavailable tafsir is
presented as selectable.

Profiles contain name/full title, creator, known country/nationality, language,
recitation style, known date/era, features, image and source links. Unknown dates,
recording years and biographical details stay absent rather than being guessed.
No licence field is displayed, per the product decision; existing attribution and
source/data files are retained. Images are optional: no verified portraits were
obtained in this environment. The UI uses a neutral person symbol until a trusted
image and matching alt text are added; it does not generate a person's portrait.

The search index includes title, creator, country/nationality, date, category,
language, style, description, features and aliases. Structured filters combine with
all search terms. The currently available recordings are murattal; selecting the
mujawwad filter correctly gives an empty result rather than substituting another
recording. A catalogue browser in Settings also filters by resource kind.

SourceReference preserves entry-specific volumes/pages and notes alongside shared
metadata. Book headings keep the existing title / source chip / left disclosure
order. Existing citations and external links remain. The corpus reference also
uses the shared profile. Qari and translator selectors use the same searchable
picker with an info control beside each resource and the current selection.

To add a resource:
1. Add a registry entry with verified facts, optional photo and aliases.
2. Connect the actual data/audio provider and include its ID in the applicable picker.
3. Add any source-specific citation fields while retaining the shared source ID.
4. Verify identity, searching/filtering, offline behavior and release notes.

The registry alone does not ingest a new book, create translations or make a new
audio recording available. The current Translator/data-provider contracts still
need explicit extension for additional translation datasets. This keeps unsupported
metadata from becoming a misleading playable/usable option.
