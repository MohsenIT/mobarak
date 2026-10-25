'use client'
import {translationDirection,translationLanguage} from '@/lib/translations'
import {t} from '@/lib/i18n'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { SurahData, Translations, Translator } from '@/lib/quran'

type Fragment = { verse: number; text: string; left: number; top: number; width: number; fontSize: number }

/** Annotate the actual wrapped verse fragments without changing Quran word flow. */
export default function FlowTranslations({ container, surah, trans, translator, fontSize }: {
  container: RefObject<HTMLDivElement | null>; surah: SurahData; trans: Translations | null; translator: Translator; fontSize: number
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [fragments, setFragments] = useState<Fragment[]>([])
  useLayoutEffect(() => {
    // The host ref may attach after this child layout effect on first mount.
    const root = container.current ?? anchor.current?.parentElement
    if (!root) return
    let live = true
    let frame = 0
    const measure = () => {
      const origin = root.getBoundingClientRect()
      const canvas = document.createElement('canvas').getContext('2d')!
      canvas.font = '12px Vazirmatn'
      const next: Fragment[] = []
      for (const verse of surah.v) {
        const el = root.querySelector(`[data-verse="${verse.n}"]`)
        if (!el) continue
        const lines: { left: number; right: number; bottom: number; y: number }[] = []
        for (const word of el.querySelectorAll('.quran-word')) {
          const rect = word.getBoundingClientRect()
          if (!rect.width) continue
          let line = lines.find(l => Math.abs(l.y - rect.top) < fontSize / 2)
          if (!line) { line = { left: rect.left, right: rect.right, bottom: rect.bottom, y: rect.top }; lines.push(line) }
          else { line.left = Math.min(line.left, rect.left); line.right = Math.max(line.right, rect.right); line.bottom = Math.max(line.bottom, rect.bottom) }
        }
        const translation = trans?.[String(verse.n)]?.[translator]
        const words = (translation === '' ? t("ui.24cd4b7b61") : translation ?? t('translation.unavailable')).split(/\s+/)
        let offset = 0
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const width = Math.max(1, line.right - line.left)
          const remainingWidth = lines.slice(i).reduce((sum, l) => sum + l.right - l.left, 0)
          const count = i === lines.length - 1 ? words.length - offset : Math.min(words.length - offset, Math.round((words.length - offset) * width / remainingWidth))
          const text = words.slice(offset, offset + count).join(' ')
          offset += count
          const textWidth = canvas.measureText(text).width
          const fittedSize = textWidth > 0 ? Math.min(12, 12 * Math.max(1, width - 1) / textWidth) : 12
          next.push({ verse: verse.n, text, left: line.left - origin.left, top: line.bottom - origin.top + 2, width, fontSize: fittedSize })
        }
      }
      root.style.paddingBottom = '20px'
      const height = `${Math.ceil(fontSize * 2.05 + 20)}px`
      if (root.style.lineHeight !== height) { root.style.lineHeight = height; measure(); return }
      setFragments(next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    document.fonts.ready.then(() => { if (live) schedule() })
    // Finalize line spacing before the parent positions the new surah.
    measure()
    return () => { live = false; observer.disconnect(); cancelAnimationFrame(frame); root.style.lineHeight = '2.05'; root.style.paddingBottom = '' }
  }, [container, surah, trans, translator, fontSize])
  return <><span ref={anchor} hidden aria-hidden="true" />{fragments.map((f, i) => <span key={i} className="verse-translation" dir={translationDirection(translator)} lang={translationLanguage(translator)} data-translation-verse={f.verse}
    style={{ left: f.left, top: f.top, width: f.width, fontSize: f.fontSize }}>{f.text}</span>)}</>
}
