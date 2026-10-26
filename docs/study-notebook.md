# Taha study notebook preview

The tools drawer and Taha context panel open `/study/taha`. This guest-only preview uses its own IndexedDB database, without login or synchronization. Context boundaries, titles, explanations and the overall surah flow share one workspace. The source partition remains immutable; selecting the personal version updates reader context navigation and statistics.

Notes are independent and each has exactly one anchor: verse, root, lemma, root/form or source/personal context. Source context IDs and stable personal IDs prevent switching views from changing a note target. Merging personal contexts preserves text and retargets attached notes.

Boundary editing is explicit and previews affected ranges before applying. All 135 verses must remain covered with no gaps, overlaps or empty contexts. Undo is available during the session. Titles and context explanations save automatically; independent note drafts require the Save action. A Markdown report and validated JSON backup can be downloaded; backup import replaces the local workspace and can be undone.

The preview has Persian and English catalogues in `src/messages/study`; other interface languages currently use Persian for this preview. Dictation uses the shared browser capability check. There is no native speech service, cloud contribution submission or account synchronization in this version. Local browser data may be removed by clearing storage; export a backup for retention.

Validation: model tests cover boundaries, immutable source, split/merge note preservation and malformed backups. Browser checks exercise editing, persistence after reload, boundary confirmation, independent notes and report/backup exports. Web and static/native-interface builds are separate checks; they do not establish physical Android support.
