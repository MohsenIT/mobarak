'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { juzAtRailY, juzRailLayout } from '@/lib/juz-navigation'
import { t } from '@/lib/i18n'
import { toFa } from '@/lib/quran'

/** A contact-index style navigator: one calculated slot per juz, at every height. */
export default function JuzRail({ numbers, active, onSelect }: { numbers: number[]; active: number; onSelect: (juz: number) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [height, setHeight] = useState(480)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.clientHeight))
    observer.observe(element)
    return () => { observer.disconnect(); if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [])
  const layout = juzRailLayout(numbers, height)
  const center = layout.slots.find(slot => slot.juz === active)?.center ?? layout.padding
  const showPreview = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setPreview(true) }
  const selectAt = (event: PointerEvent<HTMLDivElement>) => {
    const juz = juzAtRailY(event.clientY - event.currentTarget.getBoundingClientRect().top, layout)
    if (juz !== null) onSelect(juz)
  }
  return <div ref={host} className="drawer-juz-index">
    <div className="juz-rail" role="slider" tabIndex={0} aria-label={t('ui.f74f9b04c7')} aria-orientation="vertical"
      aria-valuemin={numbers[0]} aria-valuemax={numbers.at(-1)} aria-valuenow={active} aria-valuetext={t('ui.6668c797a2',{p0:toFa(active)})}
      style={{height:layout.height}}
      onFocus={showPreview} onBlur={()=>setPreview(false)}
      onPointerDown={event=>{event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);dragging.current=true;showPreview();selectAt(event)}}
      onPointerMove={event=>{if(dragging.current)selectAt(event)}}
      onPointerUp={event=>{dragging.current=false;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);hideTimer.current=setTimeout(()=>setPreview(false),900)}}
      onPointerCancel={()=>{dragging.current=false;setPreview(false)}}
      onKeyDown={event=>{
        const index=numbers.indexOf(active)
        const next=event.key==='Home'?0:event.key==='End'?numbers.length-1:event.key==='ArrowDown'?index+1:event.key==='ArrowUp'?index-1:null
        if(next===null)return
        event.preventDefault();showPreview();onSelect(numbers[Math.max(0,Math.min(numbers.length-1,next))])
      }}>
      <span className="juz-rail-active" aria-hidden="true" style={{top:center}} />
      {layout.slots.map(slot=><span className="juz-rail-slot" style={{top:slot.center,height:layout.labelHeight}} data-juz-slot={slot.juz} data-labelled={slot.labelled||undefined} key={slot.juz} aria-hidden="true">
        {slot.labelled?t('ui.6668c797a2',{p0:toFa(slot.juz)}):<span className="juz-rail-dot" />}
      </span>)}
      {preview&&<output className="juz-rail-preview" aria-hidden="true" style={{top:Math.max(24,Math.min(layout.height-24,center))}}>{t('ui.6668c797a2',{p0:toFa(active)})}</output>}
    </div>
  </div>
}
