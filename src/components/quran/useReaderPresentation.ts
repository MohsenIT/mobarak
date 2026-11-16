'use client'

import { useCallback, useEffect, useState, type SetStateAction } from 'react'
import { readStored, writeStored } from '@/lib/reader-storage'
import { clampScale, initialReaderScales, resolveInitialTranslator } from '@/lib/reader-settings'
import type { ReadingMode } from '@/lib/verse-link'
import { syncNativeAppearance } from '@/lib/native-appearance'
import type { Translator } from '@/lib/quran'

/**
 * The reader's presentation settings, as one owned piece of state instead of
 * six loose ones plus their persistence effects in page.tsx.
 *
 * Owns: the theme, the translation visibility, the active translator, the
 * reading scale, bookmarks and pinned surahs — and the `mushaf.*` persistence
 * that keeps each of them. The update arithmetic (clamping, stepping, list
 * rules) lives in `src/lib/reader-settings.ts`; this hook is its stateful
 * counterpart and adds no rules of its own.
 *
 * Does not own: the recent-surah memory (it follows the reading position, so
 * it stays with the screen that knows the position), anything about *where*
 * the reader is (useReadingRoute), or the reading surface's gestures — the
 * wheel/pinch wiring stays in page.tsx because it observes the DOM surface.
 */
export function useReaderPresentation() {
  const [showTrans, setShowTrans] = useState(() => readStored('mushaf.showTrans', false))
  const [theme, setTheme] = useState<'paper' | 'night'>(() => readStored('mushaf.theme', 'paper'))
  const [translator, setTranslator] = useState<Translator>(() => resolveInitialTranslator(readStored('mushaf.tr', 's'), readStored('mushaf.safavi-default.v1', false)))
  const [scaleState, setScaleState] = useState(() => ({
    values: initialReaderScales(readStored('mushaf.scale', 1), readStored('mushaf.scales.v1', null)),
    lastEdited: null as ReadingMode | null,
  }))
  const scaleFor = (mode: ReadingMode) => scaleState.values[mode]
  const setScaleFor = useCallback((mode: ReadingMode, value: SetStateAction<number>) => {
    setScaleState(current => ({
      values: { ...current.values, [mode]: clampScale(typeof value === 'function' ? value(current.values[mode]) : value) },
      lastEdited: mode,
    }))
  }, [])
  const [bookmarks, setBookmarks] = useState<number[]>(() => readStored('mushaf.marks', []))
  const [pinnedSurahs, setPinnedSurahs] = useState<number[]>(() => readStored('mushaf.pinned-surahs', []))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    void syncNativeAppearance(theme)
    writeStored('mushaf.theme', theme)
  }, [theme])
  useEffect(() => { writeStored('mushaf.showTrans', showTrans) }, [showTrans])
  useEffect(() => { writeStored('mushaf.tr', translator); writeStored('mushaf.safavi-default.v1', true) }, [translator])
  useEffect(() => {
    writeStored('mushaf.scales.v1', scaleState.values)
    // Preserve the legacy last-edited preference; mode memory is append-only.
    if (scaleState.lastEdited) writeStored('mushaf.scale', scaleState.values[scaleState.lastEdited])
  }, [scaleState])
  useEffect(() => { writeStored('mushaf.marks', bookmarks) }, [bookmarks])

  return {
    showTrans, setShowTrans,
    theme, setTheme,
    translator, setTranslator,
    scaleFor, setScaleFor,
    bookmarks, setBookmarks,
    pinnedSurahs, setPinnedSurahs,
  }
}
