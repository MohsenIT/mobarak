/** Reader-only navigation geometry; never scroll ancestors or the page itself. */
export type ReadingWindow={top:number;bottom:number}
export function readingTargetDelta(rect:{top:number;bottom:number},visible:ReadingWindow,gap=12):number {
  if(visible.bottom<=visible.top)return 0
  // A passage already fully exposed stays exactly where the reader left it.
  if(rect.top>=visible.top && rect.bottom<=visible.bottom)return 0
  return rect.top-visible.top-gap
}
export function readingWindow(scroll:HTMLElement,target:HTMLElement):ReadingWindow {
 const bounds=scroll.getBoundingClientRect(),word=target.getBoundingClientRect(),viewport=window.visualViewport
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
 const visible=readingWindow(scroll,target),bounds=scroll.getBoundingClientRect()
 if(visible.bottom<=visible.top+40)return false
 const delta=readingTargetDelta(target.getBoundingClientRect(),visible)
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
