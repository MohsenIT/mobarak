'use client'
import {startTransition,useEffect,useLayoutEffect,useRef,type RefObject} from 'react'

type Gesture={content:HTMLElement;scroll:HTMLElement;distance:number;scale:number;next:number;x:number;y:number;originX:number;originY:number;dx:number;dy:number;anchor:HTMLElement|null;anchorY:number;scrollTop:number;transform:string;origin:string;willChange:string}
const distance=(touches:TouchList)=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY)
const midpoint=(touches:TouchList)=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2})
const clamp=(value:number)=>Math.round(Math.max(.55,Math.min(1.9,value))*1000)/1000

/** Preview a pinch on the compositor; reflow the Quran only once when it ends. */
export function useReaderPinch(rootRef:RefObject<HTMLElement|null>,scale:number,onScale:(value:number)=>void,ready:boolean){
 const settling=useRef<()=>void>(()=>{})
 const latest=useRef({scale,onScale});latest.current={scale,onScale}
 const gesture=useRef<Gesture|null>(null),commit=useRef<Gesture|null>(null),frame=useRef(0),blockClickUntil=useRef(0)
 const restore=(g:Gesture,keepAnchor:boolean)=>{
  g.content.style.transform=g.transform;g.content.style.transformOrigin=g.origin;g.content.style.willChange=g.willChange
  settling.current()
  if(!keepAnchor){rootRef.current?.removeAttribute('data-reader-pinching');return}
  const root=rootRef.current
  const pin=()=>{
   if(g.anchor?.isConnected)g.scroll.scrollTop+=g.anchor.getBoundingClientRect().top-(g.anchorY+g.dy)
   else g.scroll.scrollTop=g.scrollTop*g.next/g.scale
  }
  pin()
  // Translated mushaf pages report measured heights after React's layout pass.
  // Keep the same word anchored through that short, asynchronous reflow too.
  let pending=0
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(pin)})
  observer.observe(g.content)
  const section=g.anchor?.closest<HTMLElement>('[data-mushaf-page]');if(section)observer.observe(section)
  const timer=window.setTimeout(()=>settling.current(),500)
  settling.current=()=>{observer.disconnect();cancelAnimationFrame(pending);clearTimeout(timer);root?.removeAttribute('data-reader-pinching');settling.current=()=>{}}

 }
 useLayoutEffect(()=>{
  const pending=commit.current
  if(pending&&scale===pending.next){commit.current=null;restore(pending,true)}
 })
 useEffect(()=>{
  const root=rootRef.current
  if(!ready||!root)return
  const preview=()=>{
   frame.current=0
   const g=gesture.current
   if(!g)return
   g.content.style.transform=`translate3d(${g.dx}px,${g.dy}px,0) scale(${g.next/g.scale})`
  }
  const finish=(cancelled:boolean)=>{
   const g=gesture.current
   if(!g)return
   if(!cancelled)g.content.style.transform=`translate3d(${g.dx}px,${g.dy}px,0) scale(${g.next/g.scale})`
   gesture.current=null;cancelAnimationFrame(frame.current);frame.current=0;blockClickUntil.current=performance.now()+350
   if(cancelled||g.next===latest.current.scale){restore(g,false);return}
   // Keep the visual preview until the committed text has completed its layout.
   commit.current=g
   startTransition(()=>latest.current.onScale(g.next))
  }
  const start=(event:TouchEvent)=>{
   settling.current()
   if(event.touches.length!==2||gesture.current||commit.current)return
   const target=event.target instanceof Element?event.target:null
   const scroll=target?.closest<HTMLElement>('[data-reading-scroll]')
   const content=scroll?.querySelector<HTMLElement>('[data-pinch-content]')
   const d=distance(event.touches)
   if(!scroll||!content||!root.contains(scroll)||!d)return
   if(event.cancelable)event.preventDefault()
   const {x,y}=midpoint(event.touches),bounds=content.getBoundingClientRect()
   const caret=(document as Document&{caretRangeFromPoint?:(x:number,y:number)=>Range|null}).caretRangeFromPoint?.(x,y)?.startContainer
   const element=caret instanceof Element?caret:caret?.parentElement
   const anchor=(element?.closest<HTMLElement>('.quran-word')??target?.closest<HTMLElement>('.quran-word'))??null
   const g:Gesture={content,scroll,distance:d,scale:latest.current.scale,next:latest.current.scale,x,y,originX:x-bounds.left,originY:y-bounds.top,dx:0,dy:0,anchor,anchorY:anchor?.getBoundingClientRect().top??y,scrollTop:scroll.scrollTop,transform:content.style.transform,origin:content.style.transformOrigin,willChange:content.style.willChange}
   gesture.current=g;root.dataset.readerPinching='true'
   content.style.transformOrigin=`${g.originX}px ${g.originY}px`;content.style.willChange='transform'
  }
  const move=(event:TouchEvent)=>{
   const g=gesture.current
   if(!g)return
   if(event.cancelable)event.preventDefault();event.stopPropagation()
   if(event.touches.length!==2){finish(true);return}
   const center=midpoint(event.touches)
   g.next=clamp(g.scale*distance(event.touches)/g.distance);g.dx=center.x-g.x;g.dy=center.y-g.y
   if(!frame.current)frame.current=requestAnimationFrame(preview)
  }
  const end=(event:TouchEvent)=>{
   if(!gesture.current)return
   if(event.cancelable)event.preventDefault();event.stopPropagation()
   if(event.touches.length<2)finish(event.type==='touchcancel')
  }
  const click=(event:MouseEvent)=>{if(gesture.current||commit.current||performance.now()<blockClickUntil.current){event.preventDefault();event.stopPropagation()}}
  const interrupt=()=>settling.current()
  root.addEventListener('wheel',interrupt,{passive:true});root.addEventListener('pointerdown',interrupt)
  root.addEventListener('touchstart',start,{capture:true,passive:false});root.addEventListener('touchmove',move,{capture:true,passive:false})
  root.addEventListener('touchend',end,{capture:true,passive:false});root.addEventListener('touchcancel',end,{capture:true,passive:false});root.addEventListener('click',click,true)
  return()=>{
   settling.current();root.removeEventListener('wheel',interrupt);root.removeEventListener('pointerdown',interrupt)
   root.removeEventListener('touchstart',start,true);root.removeEventListener('touchmove',move,true);root.removeEventListener('touchend',end,true);root.removeEventListener('touchcancel',end,true);root.removeEventListener('click',click,true)
   cancelAnimationFrame(frame.current)
   const active=gesture.current??commit.current;if(active)restore(active,false)
   gesture.current=null;commit.current=null
  }
 },[rootRef,ready])
}
