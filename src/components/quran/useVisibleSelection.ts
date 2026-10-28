'use client'

import { useLayoutEffect, type RefObject } from 'react'
import {revealReadingTarget,revealReadingVerse,clearUncoveredReadingSpace} from '@/lib/reading-visibility'

/** Keep word or whole-ayah selections inside the uncovered reading area. */
export function useVisibleSelection(main: RefObject<HTMLElement | null>, target: { s: number; a: number; pos: number } | null, enabled: boolean, layoutKey: string, wholeVerse=false) {
  useLayoutEffect(()=>{
    const reader=main.current;if(!reader)return
    let frame=0
    const trim=()=>{const scroll=reader.querySelector<HTMLElement>('[data-reading-scroll]');if(scroll)clearUncoveredReadingSpace(scroll)}
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(trim)}
    const changes=new MutationObserver(schedule)
    changes.observe(reader.parentElement??reader,{childList:true,subtree:true,attributes:true,attributeFilter:['style']})
    const size=new ResizeObserver(schedule);size.observe(reader)
    window.visualViewport?.addEventListener('resize',schedule)
    schedule()
    return()=>{cancelAnimationFrame(frame);changes.disconnect();size.disconnect();window.visualViewport?.removeEventListener('resize',schedule)}
  },[main,layoutKey])
  useLayoutEffect(() => {
    const reader=main.current,scroll=reader?.querySelector<HTMLElement>('[data-reading-scroll]')
    if(!enabled||!target||!reader||!scroll)return
    let frame=0,live=true
    const reveal=()=>{
      const word=scroll.querySelector<HTMLElement>(`[data-surah="${target.s}"][data-ayah="${target.a}"][data-pos="${target.pos}"]`)
      if(word)(wholeVerse?revealReadingVerse:revealReadingTarget)(scroll,word,window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth')
    }
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(reveal)}
    const observer=new ResizeObserver(schedule)
    observer.observe(scroll)
    for(const panel of document.querySelectorAll<HTMLElement>('.root-panel,.recitation-bar,.app-update-notice'))observer.observe(panel)
    window.addEventListener('resize',schedule)
    window.visualViewport?.addEventListener('resize',schedule)
    window.visualViewport?.addEventListener('scroll',schedule)
    document.fonts.ready.then(()=>{if(live)schedule()})
    schedule()
    return()=>{live=false;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)}
  },[main,target?.s,target?.a,target?.pos,enabled,layoutKey,wholeVerse])
}
