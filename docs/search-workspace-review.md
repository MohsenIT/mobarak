# Search workspace review

This branch starts at beta `0acfff9`. The selected layout uses the existing Mobarak palette, text, chips and result cards. The search dialog docks on the opposite edge from the reader’s existing right-side panels on wide RTL screens. Its research column is selected by a container query on the rendered surface. The same groups collapse inline in narrow space. The dock retains the dialog’s focus management and Back behavior.

## UI review

- Open from the reader, verify the empty browse view, then focus to see examples or saved operations. Pin and replay an entry.
- Search `صبر`, then `صبر نصر`. The relation control is disclosed for the second query. Sorting is next to the result count.
- Open the research panel, toggle a facet and sort, open an ayah and return. The panel preference is stored locally, independently of the link and the facets. Closing it keeps the active-filter count on the trigger.
- On a narrow screen, each morphology group can be collapsed separately. The same controls retain accessible labels when their visible labels shorten.
- Quick search continues to use its existing independent reader flow and result picker, including multiword root and lemma lookup.

## Engine review

The default is relaxed spelling and co-occurrence in one ayah. The additional link options are `co=context`, `co=surah` and `sp=1`. Settings are restored by shared links and result return snapshots. The broader boundary only changes the meaning of the multiword “all” relation. Exact phrases still require adjacency. Each card in a broader hit is a real ayah that contains at least one contributing occurrence. The count is the number of displayed matching ayahs and actual match spans, not the number of entire contexts or surahs.

The bundled source ranges cover all 114 surahs and 6,236 verses. Search resolves those ranges from the source, not from made-up boundaries or device-local study edits. If a verse lacks a unique source range, it falls back to verse-level grouping.

Relaxed spelling tolerates the documented Persian/Arabic forms, with narrow aliases for `رویا/رؤیا` and `صلاة/صلات` as individual clauses. Strict spelling keeps written distinctions without treating vocalization as a separate requirement. It uses the bundled spelling, preserves standalone hamza, and does not apply typo expansion. Quotation and independent waw behavior are tested separately.

## Before and after

Actual browser captures use the same query on each surface. The baseline is the exact beta commit with the three existing search flags enabled so its advanced interface can be compared. The after captures use the new branch's production build.

| Width | Light before / after | Dark before / after |
| --- | --- | --- |
| 320 px | [Before](handoff/validation/search-workspace/320-light-before.jpg) / [After](handoff/validation/search-workspace/320-light-after.jpg) | [Before](handoff/validation/search-workspace/320-dark-before.jpg) / [After](handoff/validation/search-workspace/320-dark-after.jpg) |
| 390 px | [Before](handoff/validation/search-workspace/390-light-before.jpg) / [After](handoff/validation/search-workspace/390-light-after.jpg) | [Before](handoff/validation/search-workspace/390-dark-before.jpg) / [After](handoff/validation/search-workspace/390-dark-after.jpg) |
| 768 px | [Before](handoff/validation/search-workspace/768-light-before.jpg) / [After](handoff/validation/search-workspace/768-light-after.jpg) | [Before](handoff/validation/search-workspace/768-dark-before.jpg) / [After](handoff/validation/search-workspace/768-dark-after.jpg) |
| 1280 px | [Before](handoff/validation/search-workspace/1280-light-before.jpg) / [After](handoff/validation/search-workspace/1280-light-after.jpg) | [Before](handoff/validation/search-workspace/1280-dark-before.jpg) / [After](handoff/validation/search-workspace/1280-dark-after.jpg) |
| 1440 px | [Before](handoff/validation/search-workspace/1440-light-before.jpg) / [After](handoff/validation/search-workspace/1440-light-after.jpg) | [Before](handoff/validation/search-workspace/1440-dark-before.jpg) / [After](handoff/validation/search-workspace/1440-dark-after.jpg) |

- [Reader entry at 1280](handoff/validation/search-workspace/1280-dark-browse.jpg)
- [Open tools and active facet](handoff/validation/search-workspace/1280-dark-active-facet.jpg)
- [Closed tools and active facet](handoff/validation/search-workspace/390-light-active-facet-closed.jpg)
- [Mobile settings](handoff/validation/search-workspace/390-light-settings-open.jpg)

## Validation

- Beta baseline: 248 unit tests, TypeScript and the production build passed. Lint had 18 errors and one warning.
- New branch: 252 unit tests passed, TypeScript passed, and the production build passed. Lint reported the same 18 errors and one warning. Local exhaustive browser passes were subject to runner timeouts under concurrent builds.
- GitHub Actions completed the Phase 2 and Phase 3 Playwright jobs, including phone, desktop and offline coverage. See the [regression workflow](https://github.com/MohsenIT/mobarak/actions/runs/45541337241) for the remaining reader matrix status.
- Real browser checks also verified current-surah scope and the root and lemma search for `دین ملک`, including both highlights at Yusuf 76.
- The Vercel preview requires existing team access. The beta branch and PR #22 were left in place.
