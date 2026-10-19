import type { SurahData } from './quran'
import { splitWord, type WordPart } from './word-parts'

export type ContextToken = { kind: 'word'; a: number; pos: number; part: WordPart; text: string } | { kind: 'marker'; a: number }
export function occurrenceTokens(surah: SurahData): ContextToken[] {
  return surah.v.flatMap(verse => [
    ...verse.w.flatMap((word, i): ContextToken[] => {
      const { prefix, stem } = splitWord(word)
      return [...(prefix ? [{ kind: 'word' as const, a: verse.n, pos: i + 1, part: 'prefix' as const, text: prefix }] : []), { kind: 'word', a: verse.n, pos: i + 1, part: 'stem', text: stem }]
    }),
    { kind: 'marker' as const, a: verse.n },
  ])
}
export function occurrenceWindow(tokens: ContextToken[], a: number, pos: number, part: WordPart = 'stem') {
  const target = tokens.findIndex(t => t.kind === 'word' && t.a === a && t.pos === pos && t.part === part)
  if (target < 0) return { tokens: [] as ContextToken[], target: -1 }
  const start = tokens.findIndex(t => t.a === a)
  let end = start
  while (end < tokens.length && tokens[end].a === a) end++
  const from = Math.max(0, start - 8)
  return { tokens: tokens.slice(from, Math.min(tokens.length, end + 8)), target: target - from }
}
