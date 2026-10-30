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

/** Consecutive verses share a reference; gaps and surah boundaries start a new group. */
export function formatVerseCopy(verses: CopiedVerse[]): string {
  const groups: CopiedVerse[][] = []
  for (const verse of verses) {
    if (!verse.text.trim()) continue
    const group = groups[groups.length - 1]
    const previous = group?.[group.length - 1]
    if (previous && previous.surah === verse.surah && verse.ayah === previous.ayah + 1) group.push(verse)
    else groups.push([verse])
  }
  return groups.map(group => {
    const first = group[0], last = group[group.length - 1]
    const address = first.ayah === last.ayah ? String(first.ayah) : `${first.ayah}-${last.ayah}`
    const text = group.map(verse => [quranCopyText(verse.text), verse.translation?.trim()].filter(Boolean).join(' — ')).join('، ')
    return `${text} (${first.name}، ${address})`
  }).join('، ')
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
