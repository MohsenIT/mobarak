'use client'

import { useLayoutEffect, type RefObject } from 'react'

/** Reserve scroll room beneath an overlay sheet and reveal only obscured words. */
export function useVisibleSelection(main: RefObject<HTMLElement | null>, target: { s: number; a: number; pos: number } | null, enabled: boolean, layoutKey: string) {
  useLayoutEffect(() => {
    const reader = main.current
    const sheet = document.querySelector<HTMLElement>('.root-panel')
    const scroll = reader?.querySelector<HTMLElement>('[data-reading-scroll]')
    if (!enabled || !target || !reader || !sheet || !scroll) return
    const spacer = document.createElement('div')
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.flexShrink = '0'
    scroll.appendChild(spacer)
    let frame = 0
    let destination: number | null = null
    const reveal = () => {
      const bounds = scroll.getBoundingClientRect()
      const panel = sheet.getBoundingClientRect()
      const overlaps = panel.left < bounds.right && panel.right > bounds.left
      // Use the resting position, not the sheet's changing entrance transform.
      const transform = getComputedStyle(sheet).transform
      const offset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
      const bottom = overlaps ? Math.min(bounds.bottom, panel.top - offset) : bounds.bottom
      if (bottom <= bounds.top + 40) { spacer.style.height = '0px'; return }
      spacer.style.height = `${Math.max(0, bounds.bottom - bottom) + 16}px`
      const word = reader.querySelector<HTMLElement>(`[data-surah="${target.s}"][data-ayah="${target.a}"][data-pos="${target.pos}"]`)
      if (!word) return
      const rect = word.getBoundingClientRect()
      const delta = rect.bottom > bottom - 16 ? rect.bottom - bottom + 16
        : rect.top < bounds.top + 12 ? rect.top - bounds.top - 12 : 0
      const next = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, scroll.scrollTop + delta))
      if (Math.abs(delta) > 1 && (destination === null || Math.abs(next - destination) > 1)) {
        destination = next
        scroll.scrollTo({ top: next,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      }
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(reveal) }
    const observer = new ResizeObserver(schedule)
    observer.observe(sheet)
    observer.observe(scroll)
    window.addEventListener('resize', schedule)
    schedule()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); spacer.remove() }
  }, [main, target?.s, target?.a, target?.pos, enabled, layoutKey])
}
