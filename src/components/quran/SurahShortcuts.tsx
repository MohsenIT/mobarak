'use client'
import {t} from '@/lib/i18n'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Meta } from '@/lib/quran'

export default function SurahShortcuts({ meta, pinned, recent, onGo, onTogglePin }: { meta: Meta; pinned: number[]; recent: number[]; onGo: (n: number) => void; onTogglePin: (n: number) => void }) {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const [status, setStatus] = useState('')
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; pointer.current = null }
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current) }, [])
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
        if (used + cost > Math.max(0, available * 0.96 - 40)) break
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
    <div ref={row} className="drawer-recent-shortcuts" aria-label={t("ui.f94311caeb")}>
      {shortcuts.slice(0, expanded ? undefined : count).map(n => <button type="button" key={n} className="chip" data-pinned={pinned.includes(n) || undefined} onPointerDown={event => {
        cancelHold(); held.current = false
        if (!event.isPrimary || event.button !== 0) return
        pointer.current = { x:event.clientX, y:event.clientY }
        hold.current = setTimeout(() => { held.current = true; onTogglePin(n); setStatus(pinned.includes(n) ? t("ui.7c631348f5",{p0:(meta.surahs[n - 1]?.fa)}) : t("ui.4fdcf22559",{p0:(meta.surahs[n - 1]?.fa)})); cancelHold() }, 550)
      }} onPointerMove={event => { if (pointer.current && Math.hypot(event.clientX-pointer.current.x,event.clientY-pointer.current.y)>8) { held.current = true; cancelHold() } }} onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}
      onContextMenu={event => { event.preventDefault(); if (held.current) return; cancelHold(); held.current = true; onTogglePin(n); setStatus(pinned.includes(n) ? t("ui.7c631348f5",{p0:(meta.surahs[n - 1]?.fa)}) : t("ui.4fdcf22559",{p0:(meta.surahs[n - 1]?.fa)})) }}
      onClick={() => { if (held.current) { held.current = false; return } onGo(n) }} title={pinned.includes(n) ? t("ui.b6c1280f97") : t("ui.9c19bc2926")}>{meta.surahs[n - 1]?.fa}</button>)}
      {shortcuts.length > count && <button type="button" aria-label={expanded ? t("ui.d2c95cb2a1") : t("ui.41bef233fe")} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? t("ui.a023ed0970") : '…'}</button>}
    </div>
    <span className="sr-only" role="status">{status}</span>
    <div ref={measure} className="drawer-recent-shortcuts" aria-hidden="true" inert style={{ position:'fixed', visibility:'hidden', width:'max-content', pointerEvents:'none', top:0, left:0 }}>
      {shortcuts.map(n => <button key={n} type="button" tabIndex={-1} className="chip" data-pinned={pinned.includes(n) || undefined}>{meta.surahs[n - 1]?.fa}</button>)}
    </div>
  </>
}
