# Search and Go Phase 3 data audit

The search corpus contains all 6,236 ayahs across 114 surahs and 77,429 word positions. A read-only comparison of each ayah verified exact equality between the 114 source files and the derived search corpus for Uthmani word strings, order, morphology tuples and position indexes for independently tagged initial wāw. The core offline manifest's SHA-256 and file size match the shipped 3,480,607-byte search corpus. [Corpus builder](../scripts/build-quran-search.py) · [Core manifest](../public/offline-manifest.json)

| Field | Word positions with a value | Distinct IDs | Interpretation |
| --- | ---: | ---: | --- |
| Root | 49,967 | 1,642 | An attested Arabic root for a matching word. |
| Lemma | 74,122 | 4,831 | An attested Buckwalter identifier, decoded for display and input matching. |
| Form | 21,324 | 12 | A corpus form value, `I` through `XII`, including derived participles where the source supplies a form. |

Morphology comes from Quranic Arabic Corpus version 0.4. There are 3,307 positions with all three fields empty. A match using a morphology field needs an actual value at that position. Keep the stored IDs for matching and use the existing display adapters for labels. For example, word 9 of 20:14 (`وَأَقِمِ`) carries root `قوم`, lemma `>aqaAma` and form `IV` on the same position. [Morphology source and license](../public/data/morphology-source.txt) · [Reader data types](../src/lib/quran.ts) · [Taha source](../public/data/surah/20.json)

Every surah has a `rev` classification in reader metadata. There are 86 `makkah` and 28 `madinah` values. This field can support a surah category filter. The repository has no verified revelation sequence or ayah-level revelation order. Keep chronological revelation sorting out of the feature. Mushaf order is available from canonical surah and ayah numbers. [Surah metadata](../public/data/meta.json) · [Search link contract](search-links.md)
