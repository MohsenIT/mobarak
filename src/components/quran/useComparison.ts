'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { compareRootRange, loadGlobalRoots, loadSurah } from '@/lib/quran'
import { rootHue } from '@/lib/comparison-colors'
import {
  mutedComparisonRoots,
  toggleComparisonRoot,
  visibleComparison,
  type ComparisonRange,
  type ComparisonVisibility,
} from '@/lib/root-comparison'

const rangeKey = (range: ComparisonRange | null) => range ? `${range.s}:${range.from}:${range.to}` : ''

/**
 * Range comparison, as one owned piece of state instead of eight loose ones in
 * page.tsx.
 *
 * Ownership:
 * - This hook owns everything that only exists because a comparison exists:
 *   whether the range sheet is open, whether the comparison came from a context
 *   (a verse range picked in the analysis panel) or from the sheet, which surah
 *   and range are being compared, the roots found for that range, the one root
 *   picked to spotlight, and which roots are muted or soloed.
 * - The page still owns `sel` / `analysisSelection` (selection is shared by
 *   word taps, the analysis panel, audio and search) and the reading surfaces.
 *   It passes the selection and selection changes in, because a context
 *   comparison follows whatever context is selected.
 * - The visibility rules themselves stay in src/lib/root-comparison.ts; this
 *   hook only holds their state and wires them to React.
 *
 * `visibleComparison()` is the single "nothing muted, nothing soloed" value.
 * It is not copied into an effect: the muted/soloed set is stored *keyed by the
 * range*, so a new range reads as the empty value and the first tap of a new
 * comparison seeds from it. Same for the loaded roots. That keeps the reset a
 * derivation rather than a cascading render.
 */
export function useComparison({
  selected,
  analysisSelection,
}: {
  /** Whether anything is selected at all (the page's `sel !== null`). */
  selected: boolean
  /** The analysis panel's current selection, which may describe a context. */
  analysisSelection: { s: number; from?: number; to?: number; tab: string } | null
}) {
  const [show, setShow] = useState(false)
  const [context, setContext] = useState(false)
  const [surah, setSurah] = useState(1)
  const [range, setRange] = useState<ComparisonRange | null>(null)
  /** The root picked from the sheet, spotlit in the reading surface. */
  const [pickedRoot, setPickedRoot] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ key: string; roots: Record<string, number> }>({ key: '', roots: {} })
  const [visibilityState, setVisibilityState] = useState<{ key: string; value: ComparisonVisibility }>({ key: '', value: visibleComparison() })

  const key = rangeKey(range)

  /**
   * The single way the compared range changes. A new range is a new
   * comparison, so the muted/soloed set goes with it — the old code did that
   * from an effect watching the range; doing it here keeps the reset on the
   * seam that causes it.
   */
  const changeRange = useCallback((next: ComparisonRange | null) => {
    if (rangeKey(next) === key) return
    setRange(next)
    setVisibilityState({ key: rangeKey(next), value: visibleComparison() })
  }, [key])

  // While the sheet is closed, the reader keeps its own copy of the range's
  // roots so it can highlight them without the sheet mounted. A range whose
  // roots have not loaded yet reads as empty; a range whose roots were loaded
  // keeps them while the sheet is open (the sheet owns the root list then).
  useEffect(() => {
    if (!context || show || !range) return
    let live = true
    const { s, from, to } = range
    Promise.all([loadSurah(s), loadGlobalRoots()]).then(([data, allRoots]) => {
      if (live) setLoaded({ key: rangeKey(range), roots: Object.fromEntries(compareRootRange(data, allRoots, from, to).map(row => [row.root, rootHue(row.root)])) })
    }).catch(() => { if (live) setLoaded({ key: rangeKey(range), roots: {} }) })
    return () => { live = false }
  }, [context, show, range])

  const roots = loaded.key === key ? loaded.roots : {}
  const visibility = visibilityState.key === key ? visibilityState.value : visibleComparison()

  const muted = useMemo(() => mutedComparisonRoots(roots, visibility), [roots, visibility])

  /** Apply a change to the muted/soloed set of the current range. */
  const updateVisibility = useCallback((change: (current: ComparisonVisibility) => ComparisonVisibility) => {
    setVisibilityState(current => ({ key, value: change(current.key === key ? current.value : visibleComparison()) }))
  }, [key])

  /** Start a comparison from a context range picked in the analysis panel. */
  const startContext = useCallback((s: number, from: number, to: number) => {
    setSurah(s)
    changeRange({ s, from, to })
    setPickedRoot(null)
    setShow(false)
    setContext(true)
  }, [changeRange])

  /**
   * A context comparison follows the selection while the panel shows a context.
   * Called from the same seam that changes the selection, not from an effect.
   */
  const followContext = useCallback((selection: { s: number; from?: number; to?: number; tab: string } | null) => {
    if (!context || !selected || selection?.tab !== 'context' || !selection.from || !selection.to) return
    const { s, from, to } = selection
    setSurah(s)
    changeRange({ s, from, to })
  }, [context, selected, changeRange])

  /** Open the range sheet on a surah, leaving context-comparison mode. */
  const open = useCallback((surahN: number) => {
    setShow(true)
    setSurah(surahN)
    setContext(false)
  }, [])

  /** Open the sheet from the reader band; the context comparison stays as it is. */
  const openSheet = useCallback(() => setShow(true), [])

  /** Close the sheet; the comparison highlighting (and the range) stays live. */
  const closeSheet = useCallback(() => setShow(false), [])

  /** Drop the comparison entirely: band, highlights, range and spotlit root. */
  const dismiss = useCallback(() => {
    setContext(false)
    setPickedRoot(null)
    setLoaded({ key: '', roots: {} })
    changeRange(null)
  }, [changeRange])

  /** Tapping a highlighted root mutes it, or reveals it again. */
  const toggleRoot = useCallback((root: string) => updateVisibility(current => toggleComparisonRoot(root, current)), [updateVisibility])

  /** Long-press / sheet pick: show this root on its own. */
  const solo = useCallback((root: string) => updateVisibility(current => ({ ...current, solo: root })), [updateVisibility])

  /** The reader-side chip: reveal every root and leave solo mode. */
  const revealAll = useCallback(() => updateVisibility(visibleComparison), [updateVisibility])

  /** The muted-count chip: reveal the muted roots, leaving any solo alone. */
  const unhideAll = useCallback(() => updateVisibility(current => ({ ...current, hidden: new Set<string>() })), [updateVisibility])

  /** The sheet reports the roots it found; they belong to the range in force now. */
  const setRoots = useCallback((next: Record<string, number>) => {
    setLoaded(current => ({ key, roots: next }))
  }, [key])

  return {
    show, open, openSheet, closeSheet, dismiss,
    context, startContext, followContext,
    surah, range, setRange: changeRange,
    roots, setRoots,
    pickedRoot, setPickedRoot,
    visibility, muted, toggleRoot, solo, revealAll, unhideAll,
  }
}
