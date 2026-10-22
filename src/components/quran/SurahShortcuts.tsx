'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Meta } from '@/lib/quran'

export default function SurahShortcuts({ meta, pinned, recent, onGo }: { meta: Meta; pinned: number[]; recent: number[]; onGo: (n: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [count, setCount] = useState(1)
  const row = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const shortcuts = [...pinned, ...recent.filter(n => !pinned.includes(n))]
  const key = shortcuts.join(',')
  useLayoutEffect(() => {
    const element = row.current, ruler = measure.current
    if (!element || !ruler) return
    let live = true
    const fit = () => {
      if (!live) return
      const style = getComputedStyle(element)
      const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const gap = parseFloat(style.gap) || 0
      const widths = Array.from(ruler.children, item => item.getBoundingClientRect().width)
      const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * gap
      if (total <= available) { setCount(widths.length); return }
      let used = 0, next = 0
      for (const width of widths) {
        const cost = width + (next ? gap : 0)
        if (used + cost > Math.max(0, available * 0.8 - 32)) break
        used += cost; next++
      }
      setCount(Math.max(1, next))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element); observer.observe(ruler)
    document.fonts.ready.then(fit)
    return () => { live = false; observer.disconnect() }
  }, [key])
  if (!shortcuts.length) return null
  return <>
    <div ref={row} className="drawer-recent-shortcuts" aria-label="میان‌بر سوره‌ها">
      {shortcuts.slice(0, expanded ? undefined : count).map(n => <button type="button" key={n} className="chip" data-pinned={pinned.includes(n) || undefined} onClick={() => onGo(n)} title={pinned.includes(n) ? 'سورهٔ سنجاق‌شده' : 'اخیراً خوانده‌اید'}>{meta.surahs[n - 1]?.fa}</button>)}
      {shortcuts.length > count && <button type="button" aria-label={expanded ? 'نمایش کمتر سوره‌ها' : 'نمایش همهٔ میان‌برها'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'کمتر' : '…'}</button>}
    </div>
    <div ref={measure} className="drawer-recent-shortcuts" aria-hidden="true" inert style={{ position:'fixed', visibility:'hidden', width:'max-content', pointerEvents:'none', top:0, left:0 }}>
      {shortcuts.map(n => <button key={n} type="button" tabIndex={-1} className="chip" data-pinned={pinned.includes(n) || undefined}>{meta.surahs[n - 1]?.fa}</button>)}
    </div>
  </>
}
