'use client'

import { useEffect, type RefObject } from 'react'
import type { Meta } from '@/lib/quran'
import { formatVerseCopy, quranCopyText, mergeSelectionRects, type CopiedVerse, type SelectionRect } from '@/lib/verse-copy'

function intersection(range: Range, element: Element): Range | null {
  if (!range.intersectsNode(element)) return null
  const bounds = document.createRange()
  bounds.selectNodeContents(element)
  const clipped = range.cloneRange()
  if (clipped.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) clipped.setStart(element, 0)
  if (clipped.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) clipped.setEnd(element, element.childNodes.length)
  return clipped.toString().trim() ? clipped : null
}

/** Preserve native dragging/context menus while adding references and continuous selection bands. */
export default function QuranClipboard({ root, meta }: { root: RefObject<HTMLElement | null>; meta: Meta }) {
  useEffect(() => {
    const reader = root.current
    if (!reader) return
    let frame = 0
    let disposed = false
    const surfaces = () => [...reader.querySelectorAll<HTMLElement>('[data-reading-scroll] [data-quran-copy-surface]')]
    const clear = () => {
      for (const surface of surfaces()) {
        surface.classList.remove('has-native-selection')
        surface.querySelector('.quran-native-selection')?.remove()
      }
    }
    const ranges = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return []
      return Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i))
        .filter(range => reader.contains(range.startContainer) && reader.contains(range.endContainer))
    }
    const paint = () => {
      frame = 0
      clear()
      const selected = ranges()
      if (!selected.length || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return
      for (const surface of surfaces()) {
        const rows: SelectionRect[] = []
        for (const range of selected) {
          const rects: SelectionRect[] = []
          for (const word of surface.querySelectorAll('.quran-word, .ayah-marker')) {
            const clipped = intersection(range, word)
            if (clipped) rects.push(...Array.from(clipped.getClientRects()))
          }
          rows.push(...mergeSelectionRects(rects))
        }
        if (!rows.length) continue
        const bounds = surface.getBoundingClientRect()
        const layer = document.createElement('div')
        layer.className = 'quran-native-selection'
        layer.setAttribute('aria-hidden', 'true')
        for (const row of rows) {
          const band = document.createElement('span')
          band.style.cssText = `left:${row.left - bounds.left + surface.scrollLeft}px;top:${row.top - bounds.top + surface.scrollTop}px;width:${row.right - row.left}px;height:${row.bottom - row.top}px`
          layer.append(band)
        }
        surface.append(layer)
        surface.classList.add('has-native-selection')
      }
    }
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(paint) }
    const copy = (event: ClipboardEvent) => {
      if (!event.clipboardData || event.defaultPrevented) return
      const selected = ranges()
      if (!selected.length) return
      const verses: CopiedVerse[] = []
      for (const word of reader.querySelectorAll<HTMLElement>('[data-reading-scroll] [data-quran-copy-surface] .quran-word')) {
        const location = word.closest<HTMLElement>('[data-surah][data-ayah][data-pos]')
        if (!location) continue
        const text = selected.map(range => quranCopyText(intersection(range, word)?.toString() || '')).filter(Boolean).join(' ')
        if (!text) continue
        const surah = Number(location.dataset.surah), ayah = Number(location.dataset.ayah)
        const name = meta.surahs[surah - 1]?.fa
        if (!name) continue
        const previous = verses[verses.length - 1]
        if (previous?.surah === surah && previous.ayah === ayah) previous.text += ` ${text}`
        else verses.push({ surah, name, ayah, text })
      }
      const text = formatVerseCopy(verses)
      if (!text) return
      event.clipboardData.setData('text/plain', text)
      event.preventDefault()
    }
    reader.addEventListener('copy', copy)
    document.addEventListener('selectionchange', schedule)
    reader.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    void document.fonts.ready.then(schedule)
    return () => {
      disposed = true
      reader.removeEventListener('copy', copy)
      document.removeEventListener('selectionchange', schedule)
      reader.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      clear()
    }
  }, [root, meta])
  return null
}
