import type { QuranSearchResult } from './quran-search'
import { formName, morphologyLabel } from './quran'
import { lemmaDisplay } from './lemma-display'

/** Use recorded verbal nouns, then an attested lemma; never inflect a weak root by guesswork. */
export function searchFormLabels(results: QuranSearchResult[]): Map<string, { label: string; description: string }> {
  const groups = new Map<string, Map<string, { text: string; count: number }>>()
  for (const result of results) for (const pos of result.positions) {
    const [root, lemma, form] = result.morphology?.[pos - 1] ?? []
    if (!form) continue
    const text = formName(root ?? null, form) ?? (root === 'علم' && form === 'I' ? 'عِلْم' : lemma ? lemmaDisplay(lemma) : root)
    if (!text) continue
    let entries = groups.get(form)
    if (!entries) { entries = new Map(); groups.set(form, entries) }
    const key = root ?? text
    const entry = entries.get(key)
    if (entry) entry.count++
    else entries.set(key, { text, count: 1 })
  }
  return new Map([...groups].map(([form, entries]) => {
    const names = [...entries.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'ar')).map(entry => entry.text)
    return [form, { label: names.slice(0, 2).join('، ') + (names.length > 2 ? '…' : ''), description: `${morphologyLabel(form)} · ${names.join('، ')}` }]
  }))
}
