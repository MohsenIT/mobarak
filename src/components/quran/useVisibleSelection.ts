'use client'

import { useLayoutEffect,useRef,type RefObject } from 'react'
import {revealReadingTarget,revealReadingVerse,syncReadingSpace} from '@/lib/reading-visibility'

/** Keep word or whole-ayah selections inside the uncovered reading area. */
export function useVisibleSelection(main: RefObject<HTMLElement | null>, target: { s: number; a: number; pos: number } | null, enabled: boolean, layoutKey: string, wholeVerse=false) {
  const manuallyScrolled=useRef(false)
  useLayoutEffect(()=>{manuallyScrolled.current=false},[target?.s,target?.a,target?.pos,wholeVerse])
  useLayoutEffect(()=>{
    const reader=main.current;if(!reader)return
    let frame=0
    const observed=new Set<Element>()
    const sync=()=>{
      const scroll=reader.querySelector<HTMLElement>('[data-reading-scroll]')
      const elements=new Set<Element>([reader,...document.querySelectorAll('.root-panel,.recitation-bar,.app-update-notice')])
      if(scroll){elements.add(scroll);syncReadingSpace(scroll)}
      for(const element of observed)if(!elements.has(element)){size.unobserve(element);observed.delete(element)}
      for(const element of elements)if(!observed.has(element)){size.observe(element);observed.add(element)}
    }
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync)}
    const changes=new MutationObserver(schedule)
    // A panel may be portalled outside the reader's parent. Observe its actual
    // mounted size, including drag resize, rather than only selection changes.
    changes.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']})
    const size=new ResizeObserver(schedule)
    const manualScroll=(event:Event)=>{
      if('touches' in event&&(event as TouchEvent).touches.length!==1)return
      manuallyScrolled.current=true
    }
    const scrollbar=(event:PointerEvent)=>{if(event.target instanceof HTMLElement&&event.target.matches('[data-reading-scroll]'))manualScroll(event)}
    const keyboard=(event:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))manualScroll(event)}
    reader.addEventListener('wheel',manualScroll,{passive:true,capture:true})
    reader.addEventListener('touchmove',manualScroll,{passive:true,capture:true})
    reader.addEventListener('pointerdown',scrollbar,true)
    reader.addEventListener('keydown',keyboard,true)
    window.addEventListener('resize',schedule)
    window.visualViewport?.addEventListener('resize',schedule)
    window.visualViewport?.addEventListener('scroll',schedule)
    schedule()
    return()=>{cancelAnimationFrame(frame);changes.disconnect();size.disconnect();reader.removeEventListener('wheel',manualScroll,true);reader.removeEventListener('touchmove',manualScroll,true);reader.removeEventListener('pointerdown',scrollbar,true);reader.removeEventListener('keydown',keyboard,true);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)}
  },[main,layoutKey])
  useLayoutEffect(() => {
    const reader=main.current,scroll=reader?.querySelector<HTMLElement>('[data-reading-scroll]')
    if(!enabled||!target||!reader||!scroll)return
    let frame=0,live=true
    const reveal=()=>{
      // Virtual page loading and panel resize must not pull a manual reader
      // back to an old selection. A newly selected word/playing ayah resets it.
      if(manuallyScrolled.current)return
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
