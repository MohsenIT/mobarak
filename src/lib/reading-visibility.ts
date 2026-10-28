/** Reader-only navigation geometry; never scroll ancestors or the page itself. */
export type ReadingWindow={top:number;bottom:number}
/** Reserve occluded space even during manual reading, without leaving a closed-sheet gap. */
export function syncReadingSpace(scroll:HTMLElement){
 const bounds=scroll.getBoundingClientRect(),visible=readingWindow(scroll,scroll)
 const covered=visible.bottom-visible.top>40?Math.max(0,Math.ceil(bounds.bottom-visible.bottom)):0
 let spacer=scroll.querySelector<HTMLElement>(':scope > [data-reader-reveal-spacer]')
 if(covered<=1){spacer?.remove();return}
 if(!spacer){
  spacer=document.createElement('div');spacer.dataset.readerRevealSpacer=''
  spacer.setAttribute('aria-hidden','true');spacer.style.flexShrink='0';scroll.appendChild(spacer)
 }
 // Keep extra room for an explicitly revealed final word until the covering
 // geometry changes. Resizing/shrinking a panel must also shrink its reserve.
 const previousCovered=Number(spacer.dataset.readerOcclusion)
 const height=previousCovered===covered?Math.max(covered,parseFloat(spacer.style.height)||0):covered
 if(spacer.style.height!==`${height}px`)spacer.style.height=`${height}px`
 if(previousCovered!==covered)spacer.dataset.readerOcclusion=String(covered)
}
export function readingTargetDelta(rect:{top:number;bottom:number},visible:ReadingWindow,gap=12):number {
  if(visible.bottom<=visible.top)return 0
  // A passage already fully exposed stays exactly where the reader left it.
  if(rect.top>=visible.top && rect.bottom<=visible.bottom)return 0
  return rect.top-visible.top-gap
}
export function readingWindow(scroll:HTMLElement,target:HTMLElement,word=target.getBoundingClientRect()):ReadingWindow {
 const bounds=scroll.getBoundingClientRect(),viewport=window.visualViewport
 const visible={top:Math.max(bounds.top,viewport?.offsetTop??0),bottom:Math.min(bounds.bottom,(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight))}
 for(const overlay of document.querySelectorAll<HTMLElement>('.root-panel,.app-update-notice,.recitation-bar')){
  const style=getComputedStyle(overlay)
  if(style.display==='none'||style.visibility==='hidden')continue
  const box=overlay.getBoundingClientRect()
  if(box.width===0||box.height===0||box.left>=word.right||box.right<=word.left)continue
  // Ignore a sheet's entrance translation, as its resting position occludes text.
  const offset=overlay.matches('.root-panel')&&style.transform!=='none'?new DOMMatrixReadOnly(style.transform).m42:0
  const top=box.top-offset,bottom=box.bottom-offset
  if(bottom>visible.top && top<=visible.top)visible.top=Math.min(visible.bottom,bottom)
  else if(top<visible.bottom && bottom>=visible.bottom)visible.bottom=Math.max(visible.top,top)
 }
 return visible
}
export function revealReadingTarget(scroll:HTMLElement,target:HTMLElement,behavior:ScrollBehavior='smooth'):boolean {
 const visible=readingWindow(scroll,target)
 return scrollReadingDelta(scroll,visible,readingTargetDelta(target.getBoundingClientRect(),visible),behavior)
}
function scrollReadingDelta(scroll:HTMLElement,visible:ReadingWindow,delta:number,behavior:ScrollBehavior):boolean {
 syncReadingSpace(scroll)
 const bounds=scroll.getBoundingClientRect()
 if(visible.bottom<=visible.top+40)return false
 if(Math.abs(delta)<=1)return false
 let spacer=scroll.querySelector<HTMLElement>(':scope > [data-reader-reveal-spacer]')
 const covered=Math.max(0,bounds.bottom-visible.bottom)
 const previous=spacer?parseFloat(spacer.style.height)||0:0
 const baseMax=scroll.scrollHeight-scroll.clientHeight-previous
 const extra=Math.max(previous,covered,scroll.scrollTop+delta-baseMax)
 // Reserve only the room necessary to align even a final ayah above a sheet.
 if(extra>0&&!spacer){spacer=document.createElement('div');spacer.dataset.readerRevealSpacer='';spacer.setAttribute('aria-hidden','true');spacer.style.flexShrink='0';scroll.appendChild(spacer)}
 if(spacer)spacer.style.height=`${extra}px`
 const next=Math.max(0,Math.min(scroll.scrollHeight-scroll.clientHeight,scroll.scrollTop+delta))
 if(Math.abs(delta)<=1 || Math.abs(next-scroll.scrollTop)<=1)return false
 scroll.scrollTo({top:next,behavior});return true
}

/** Reveal the entire ayah with the smallest movement when it is only partly hidden. */
export function readingVerseDelta(rect:{top:number;bottom:number},visible:ReadingWindow,gap=12):number {
 const available=visible.bottom-visible.top,height=rect.bottom-rect.top
 if(available<=0||rect.top>=visible.top&&rect.bottom<=visible.bottom)return 0
 if(height>available)return rect.top-visible.top-gap
 const margin=Math.min(gap,Math.max(0,(available-height)/2))
 if(rect.bottom<=visible.top||rect.top>=visible.bottom)return rect.top-visible.top-margin
 if(rect.top<visible.top)return rect.top-visible.top-margin
 return rect.bottom-visible.bottom+margin
}
export function readingVerseBounds(scroll:HTMLElement,target:HTMLElement):DOMRect {
 const word=target.closest<HTMLElement>('[data-surah][data-ayah][data-pos]')??target
 const s=word.dataset.surah,a=word.dataset.ayah
 if(!s||!a)return target.getBoundingClientRect()
 const flow=word.closest<HTMLElement>('[data-verse]')
 const elements:HTMLElement[]=flow?[flow]:[...scroll.querySelectorAll<HTMLElement>(`[data-surah="${s}"][data-ayah="${a}"][data-pos]`)]
 if(flow)elements.push(...flow.parentElement!.querySelectorAll<HTMLElement>(`[data-translation-verse="${a}"]`))
 else {
  const last=elements.at(-1),marker=last?.nextElementSibling?.querySelector<HTMLElement>('.ayah-marker')
  if(marker)elements.push(marker)
 }
 const rects=elements.map(element=>element.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0)
 if(!rects.length)return word.getBoundingClientRect()
 const left=Math.min(...rects.map(r=>r.left)),right=Math.max(...rects.map(r=>r.right)),top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom))
 return new DOMRect(left,top,right-left,bottom-top)
}
export function revealReadingVerse(scroll:HTMLElement,target:HTMLElement,behavior:ScrollBehavior='smooth'):boolean {
 const rect=readingVerseBounds(scroll,target),visible=readingWindow(scroll,target,rect)
 return scrollReadingDelta(scroll,visible,readingVerseDelta(rect,visible),behavior)
}
