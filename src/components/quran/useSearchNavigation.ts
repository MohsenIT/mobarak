'use client'

import { useCallback, useState } from 'react'
import { occurrenceScopeSurahs, type OccurrenceScope } from '@/lib/occurrence-scope'
import type { AnalysisSelection } from '@/lib/analysis'
import type { SearchLinkState } from '@/lib/search-link'
import type { Translator } from '@/lib/quran'
import type { SearchStart } from './QuranSearch'
import type { ReaderSearchState } from './ReaderSearchHighlights'
import { readStored, writeStored } from '@/lib/reader-storage'

/**
 * Search, as one owned piece of state instead of six loose ones in page.tsx.
 *
 * Ownership:
 * - This hook owns the search UI: the advanced page being open, the quick bar
 *   being open, the highlights the quick bar asks the reader to paint, the
 *   payload a fresh advanced search starts from, the analysis filter handed
 *   over as an occurrence search, and the "back to results" band.
 * - It does NOT own the reading surface. Asking the reader to show a hit is a
 *   callback (`onReveal`); moving there — flow vs mushaf, the URL, the flash,
 *   the scroll — stays with the reader.
 * - It does NOT own the location either. useReadingRoute builds and unwinds the
 *   search URL (writeSearchState / leaveSearch); this hook decides *when* the
 *   panel opens and closes, never how a URL is written. The one composition
 *   that needs both is three lines long and lives in page.tsx.
 *
 * The pending reveal target is deliberately not here: verse deep links set it
 * too, so it belongs with the reader, which already owns what a reveal means.
 */
export function useSearchNavigation({
  onReveal,
  onTranslator,
}: {
  /** Show this location in the reader without closing anything by itself. */
  onReveal: (s: number, a: number, pos: number) => void
  /** A search URL may carry its own translator; the reader owns that setting. */
  onTranslator: (translator: Translator) => void
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickScope, setQuickScope] = useState<'surah' | 'quran'>(() => readStored<unknown>('mushaf.quick-search-scope', 'surah') === 'quran' ? 'quran' : 'surah')
  const changeQuickScope = useCallback((scope: 'surah' | 'quran') => {
    setQuickScope(scope)
    writeStored('mushaf.quick-search-scope', scope)
  }, [])
  const [quickHighlights, setQuickHighlights] = useState<ReaderSearchState | null>(null)
  /** What a freshly mounted advanced search starts from, keyed by revision. */
  const [start, setStart] = useState<SearchStart | null>(null)
  /** The analysis selection an advanced search was opened to find. */
  const [occurrence, setOccurrence] = useState<AnalysisSelection | null>(null)
  /** A hit was picked from search: offer the way back to the results. */
  const [returnToSearch, setReturnToSearch] = useState(false)

  /**
   * Leaving search by *navigating* from it. The band only appears when there
   * was an advanced page to go back to: moving from the quick bar, which has no
   * such page, must not raise it.
   */
  const leaveForReading = useCallback(() => {
    setReturnToSearch(current => advancedOpen || current)
    setAdvancedOpen(false)
    setQuickOpen(false)
  }, [advancedOpen])

  /** The tools menu: a fresh, unfiltered advanced search. */
  const openAdvanced = useCallback(() => {
    setOccurrence(null)
    setStart({ query: '', mode: 'text', surahs: [], revision: Date.now() })
    setAdvancedOpen(true)
  }, [])

  /** The toolbar button: the quick bar for the surah being read. */
  const openQuick = useCallback(() => setQuickOpen(true), [])

  /**
   * The analysis panel's "find occurrences": the same criterion, narrowed to
   * the requested surahs. An empty scope means the whole Quran.
   */
  const startOccurrence = useCallback((selection: AnalysisSelection, scope: OccurrenceScope) => {
    const surahs = occurrenceScopeSurahs(scope, selection.s)
    if (!surahs) return
    setStart({
      query: selection.tab === 'root' ? selection.root || selection.text : selection.text,
      mode: selection.tab === 'root' ? 'root' : selection.tab === 'word' ? 'lemma' : 'text',
      surahs,
      revision: Date.now(),
    })
    setOccurrence(selection)
    setAdvancedOpen(true)
  }, [])

  /** The quick bar's "advanced" / "whole Quran" buttons: same query, new scope. */
  const advance = useCallback((next: Omit<SearchStart, 'revision'>) => {
    setOccurrence(null)
    setStart({ ...next, revision: Date.now() })
    setAdvancedOpen(true)
  }, [])

  /** A hit was chosen: leave search and show it. */
  const pick = useCallback((s: number, a: number, pos: number) => {
    setReturnToSearch(true)
    setAdvancedOpen(false)
    setQuickOpen(false)
    onReveal(s, a, pos)
  }, [onReveal])

  /**
   * The location is now a search: restore its own query, filter and translator.
   * `sameEntry` means the location already matched this panel (a replace, not a
   * new search), so only the translator is re-read.
   */
  const applyEntry = useCallback((state: SearchLinkState, sameEntry: boolean) => {
    onTranslator(state.translator)
    if (sameEntry) { setAdvancedOpen(true); return }
    setStart({ query: state.query, mode: state.mode, surahs: state.surahs, revision: Date.now(), state })
    setOccurrence(state.occurrence)
    setAdvancedOpen(true)
  }, [onTranslator])

  /** Any reading location: search is not where the reader is any more. */
  const close = useCallback(() => setAdvancedOpen(false), [])

  return {
    advancedOpen, setAdvancedOpen, close,
    quickOpen, openQuick, setQuickOpen, quickScope, changeQuickScope,
    quickHighlights, setQuickHighlights,
    start, occurrence, clearOccurrence: () => setOccurrence(null),
    returnToSearch, dismissReturn: () => setReturnToSearch(false),
    openAdvanced, startOccurrence, advance, pick, leaveForReading, applyEntry,
  }
}
