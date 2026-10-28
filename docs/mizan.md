# Persian Al-Mizan commentary

The user supplied `mizan.zip` through the handoff link. The downloaded archive was decrypted using that link's key and checked against the file SHA-1 recorded by LimeWire. The archive SHA-256 and per-surah generated SHA-256/size are recorded in `public/data/mizan/catalogue.json`. No download credentials, sharing key or signed download URLs are committed.

The archive contains exactly 114 `trans/<surah>.json` files, mapping all 6236 canonical ayahs to a nonempty `mizan` string. It contains 1375 distinct exact HTML strings. Adjacent identical strings within a surah are represented by 1553 ranges; these are source-data associations, not independently verified authorial section boundaries. Nothing is filled from another ayah. The archive does not identify translator, edition or bibliographic page numbers; do not invent these or describe verse coverage as proof of a complete critical edition. Source attribution is Quran Noor, as supplied in the handoff.

`python scripts/import-mizan.py /path/to/mizan.zip` reproduces the import. It reads only the exact expected JSON members, rejects unexpected fields and HTML tags/attributes, decodes entities and removes only paragraph wrappers. Source text is not translated, normalized or summarized. Original HTML hashes accompany the passages. React renders the commentary as escaped text, never injected HTML.

Open a word in the reader, switch the analysis sheet to **آیه**, then expand **تفسیر المیزان**. It loads one surah on demand and displays the source-linked ayah range. Failed loads have retry; obsolete responses cannot replace another surah. The in-memory cache is bounded to four surahs. This remains separate from Safavi's translation based on Al-Mizan.

The data totals 63,855,740 bytes. It is an optional `mizan` offline group with content hashes, excluded from the native installer payload and the default core download. Enable it in offline settings for complete offline commentary. Other UI languages currently use English for the six new commentary controls, except Persian and Arabic; the commentary itself remains Persian.

## Updated product request: summary before download

The newer UI shows a compact AI summary immediately in the verse section, identified by a robot-message icon and the explicit localized label “خلاصهٔ هوش مصنوعی”. It requests only `mizan-summaries/<surah>.json`; it never loads full commentary until the user clicks the download button. Full text stays separate and escaped. Each summary holds two or three short Persian lines, source range and hash, supporting exact source excerpts, model identity and source-check status. A sample for 1:2 is locally prepared; **all other summaries remain pending**. Do not describe this as full summary coverage or ship pending drafts as checked.

Run `node scripts/validate-mizan-summaries.mjs --require-complete` before publishing the summary feature. This validates all 6236 addresses, source hashes and evidence, but does not replace semantic review. Generation and independent source comparison must preserve qualifications, alternative interpretations and uncertainty; do not copy a shared-range summary blindly to every ayah or silently truncate long source passages. Current source passages can reach 360,433 characters. All output must be treated as generated explanation, not a verbatim quotation or a definitive attribution to the author.

Bulk generation is a new task. No dictionary translation job has been restarted and no paid model requests have been sent. There is no connected, ready text-generation service in the current environment; provider/budget or a suitable local model remains to be established for the full dataset.
