'use client'

import { useEffect, useState } from 'react'

/**
 * The startup splash's lifecycle, as one owned piece of state instead of three
 * loose ones plus two timers in page.tsx.
 *
 * Owns: whether the splash is still up, the minimum display time (1s), the
 * reader's press-and-hold that pauses the departure, and the departure timer
 * itself. Does not own readiness — the screen knows when the first page's
 * data has arrived, and reports it through `ready`.
 *
 * The departure is derived, not stored: `leaving` is true exactly when the
 * splash is incomplete, the minimum time has elapsed, the reader is ready and
 * nobody is holding the splash. The only effect left is the short timer that
 * turns a departure into a removal (respected immediately under
 * prefers-reduced-motion).
 */
export function useStartupSplash(ready: boolean) {
  const [complete, setComplete] = useState(false)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  /** Holding the splash pauses its departure; releasing lets it carry on. */
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  const leaving = !complete && minimumElapsed && ready && !held

  useEffect(() => {
    if (!leaving || held) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setComplete(true), reduced ? 0 : 180)
    return () => clearTimeout(timer)
  }, [leaving, held])

  return { complete, leaving, setHeld }
}
