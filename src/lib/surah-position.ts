import type { ReadingMode, VerseAddress } from './verse-link'

export const SURAH_POSITIONS_KEY = 'mushaf.surah-positions.v1'
export type SurahPosition = VerseAddress & { mode: ReadingMode }
type SurahPositions = Readonly<Record<number, unknown>>

export function readSurahPosition(stored: unknown, surah: number, verseCount: number): SurahPosition | null {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null
  const entry = (stored as SurahPositions)[surah] as Partial<SurahPosition> | null | undefined
  if (!entry || entry.s !== surah || (entry.mode !== 'flow' && entry.mode !== 'mushaf')) return null
  const { a, pos } = entry
  if (typeof a !== 'number' || !Number.isInteger(a) || a < 1 || a > verseCount) return null
  if (typeof pos !== 'number' || !Number.isInteger(pos) || pos < 1 || pos > 500) return null
  return { s: surah, a, pos, mode: entry.mode }
}

export function rememberSurahPosition(stored: unknown, entry: SurahPosition): SurahPositions {
  const previous = readSurahPosition(stored, entry.s, 286)
  if (previous?.a === entry.a && previous.pos === entry.pos && previous.mode === entry.mode) return stored as SurahPositions
  const positions = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  return { ...positions, [entry.s]: entry }
}
