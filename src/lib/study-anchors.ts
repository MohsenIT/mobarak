import type { ContextRange } from './contexts'
import { studyT as st } from './study-messages'
import { morphologyLabel, toFa, type SurahData } from './quran'
import { lemmaDisplay } from './lemma-display'
import type { NoteKind, PersonalContext } from './study'

/** One selectable anchor for a study note. */
export interface AnchorOption { key: string; label: string }

/**
 * The anchors a note can attach to, for one note kind.
 *
 * `verse` lists every verse; `context` lists the source ranges plus the
 * reader's own contexts; `root`/`lemma`/`form` are derived from the words of
 * the surah, de-duplicated by key and sorted by their displayed label.
 *
 * Pure so it can be tested without the notebook's UI: it is the only place
 * that decides which entity a note can be anchored to.
 */
export function anchorOptions(
  kind: NoteKind,
  surah: SurahData | null,
  source: ContextRange[],
  personal: PersonalContext[],
): AnchorOption[] {
  if (!surah) return []
  if (kind === 'verse') {
    return surah.v.map(verse => ({ key: String(verse.n), label: `${st('verse')} ${toFa(verse.n)}` }))
  }
  if (kind === 'context') {
    return [
      ...source.map((range, index) => ({ key: `s20:${range.id}`, label: `${st('source')} · ${st('context', { n: index + 1 })}` })),
      ...personal.map((context, index) => ({ key: context.id, label: `${st('personal')} · ${context.title || st('context', { n: index + 1 })}` })),
    ]
  }
  const rows = surah.v
    .flatMap(verse => verse.w)
    .flatMap(word => kind === 'root' && word.r
      ? [{ key: word.r, label: word.r }]
      : kind === 'lemma' && word.lemma
        ? [{ key: word.lemma, label: lemmaDisplay(word.lemma) }]
        : kind === 'form' && word.r && word.form
          ? [{ key: `${word.r}:${word.form}`, label: `${word.r} · ${morphologyLabel(word.form)}` }]
          : [])
  return [...new Map(rows.map(row => [row.key, row])).values()].sort((a, b) => a.label.localeCompare(b.label, 'ar'))
}
