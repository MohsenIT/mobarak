'use client'

import { useEffect, type RefObject } from 'react'

/** Long press focuses a root; scrolling cancels it and release never toggles it. */
export function useComparisonHold(main: RefObject<HTMLElement | null>, enabled: boolean, onFocus: (root: string) => void) {
  useEffect(() => {
    const reader = main.current
    if (!reader || !enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let start: { x: number; y: number; element: HTMLElement } | null = null
    let consumed: HTMLElement | null = null
    const word = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('.quran-word[data-comparison-root]') : null
    const cancel = () => { clearTimeout(timer); start = null }
    const down = (event: PointerEvent) => {
      cancel(); consumed = null
      if (!event.isPrimary || event.button !== 0) return
      const element = word(event.target)
      if (!element) return
      start = { x: event.clientX, y: event.clientY, element }
      timer = setTimeout(() => { consumed = element; start = null; onFocus(element.dataset.comparisonRoot!) }, 500)
    }
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) { consumed = start.element; cancel() }
    }
    const click = (event: MouseEvent) => {
      if (consumed && word(event.target) === consumed) { event.preventDefault(); event.stopPropagation(); consumed = null }
    }
    const context = (event: MouseEvent) => { if (word(event.target)) event.preventDefault() }
    reader.addEventListener('pointerdown', down)
    reader.addEventListener('click', click, true)
    reader.addEventListener('contextmenu', context)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    return () => { cancel(); reader.removeEventListener('pointerdown', down); reader.removeEventListener('click', click, true); reader.removeEventListener('contextmenu', context); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel) }
  }, [main, enabled, onFocus])
}
