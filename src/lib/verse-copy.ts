import { t, currentLanguage } from './i18n'
import { formatDigits } from './locale-numbers'
import { quranDisplayText } from './quran-display'

export function quranCopyText(text: string): string {
  return quranDisplayText(text).replace(/^\p{M}+/u, '').replace(/\s+/g, ' ').trim()
}

/** Source text and references for one copied verse (including partial verses). */
export interface CopiedVerse {
  surah: number
  name: string
  ayah: number
  text: string
  translation?: string
}

/** Each surah has a heading; every copied verse keeps its own inline number. */
export function formatVerseCopy(verses: CopiedVerse[], intro?: string): string {
  const groups: CopiedVerse[][] = []
  for (const verse of verses) {
    if (!quranCopyText(verse.text)) continue
    const group = groups[groups.length - 1]
    if (group?.[0].surah === verse.surah) group.push(verse)
    else groups.push([verse])
  }
  const digits = (number: number) => formatDigits(number, currentLanguage())
  return groups.map((group, index) => {
    const ranges: number[][] = []
    for (const verse of group) {
      const previous = ranges[ranges.length - 1]
      if (previous && verse.ayah === previous[1] + 1) previous[1] = verse.ayah
      else ranges.push([verse.ayah, verse.ayah])
    }
    const address = ranges.map(([from, to]) => from === to ? digits(from) : `${digits(from)}-${digits(to)}`).join('، ')
    const heading = t(group.length === 1 ? 'copy.verseHeading' : 'copy.versesHeading', { surah: group[0].name, verses: address })
    const text = group.map(verse => `${quranCopyText(verse.text)} (${digits(verse.ayah)})${verse.translation?.trim() ? ` — ${verse.translation.trim()}` : ''}`).join(' ')
    const body = [index === 0 && intro ? quranCopyText(intro) : '', text].filter(Boolean).join(' ')
    return `${heading}\n${body}`
  }).join('\n\n')
}

export interface SelectionRect { left: number; top: number; right: number; bottom: number }
/** Fill the spaces between selected inline words and flex items on each reading line. */
export function mergeSelectionRects(rects: SelectionRect[]): SelectionRect[] {
  const rows: SelectionRect[] = []
  for (const rect of [...rects].sort((a, b) => a.top - b.top || a.left - b.left)) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue
    const row = rows.find(row => Math.min(row.bottom, rect.bottom) - Math.max(row.top, rect.top) >= Math.min(row.bottom - row.top, rect.bottom - rect.top) * 0.5)
    if (row) {
      row.left = Math.min(row.left, rect.left); row.right = Math.max(row.right, rect.right)
      row.top = Math.min(row.top, rect.top); row.bottom = Math.max(row.bottom, rect.bottom)
    } else rows.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })
  }
  return rows
}
