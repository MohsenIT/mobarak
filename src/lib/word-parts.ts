import type { Word } from './quran'
export type WordPart = 'prefix' | 'stem'
export function splitWord(word: Pick<Word, 't' | 'wa'>): { prefix: string; stem: string } {
  const prefix = word.wa ? word.t.match(/^(?:۞\s*)?و[\u064b-\u065f\u0670\u06d6-\u06ed]*/)?.[0] ?? '' : ''
  return { prefix, stem: word.t.slice(prefix.length) }
}
export function wordKey(text: string): string {
  return text.replace(/[\u064b-\u065f\u0670\u06d6-\u06edـ۞\s]/g, '').replace(/[یى]/g, 'ي').replace(/ک/g, 'ك').replace(/ٱ/g, 'ا')
}
export function wordTarget(word: Word, part?: WordPart) {
  const { prefix, stem } = splitWord(word)
  return part === 'prefix' && prefix
    ? { text: prefix, root: null, part: 'prefix' as const }
    : { text: stem, root: word.r ?? null, part: 'stem' as const }
}

/** Spacing for read-only verse excerpts, with the same corpus-backed split as the reader. */
export function displayWordText(word: Pick<Word, 't' | 'wa'>): string {
  const { prefix, stem } = splitWord(word)
  return prefix ? `${prefix} ${stem}` : stem
}

/** A corpus lemma groups inflections and attached pronouns, without conflating roots. */
export function lexicalKey(word: Word, part?: WordPart): string {
  if (part === 'prefix' && splitWord(word).prefix) return 'و'
  return word.lemma ? `lemma:${word.lemma}` : wordKey(splitWord(word).stem)
}
