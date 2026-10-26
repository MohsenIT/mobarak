'use client'
import {useEffect,useRef,type RefObject} from 'react'

type Gesture={distance:number;scale:number;next:number;sent:number}
const distance=(touches:TouchList)=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY)
const step=(value:number)=>Math.max(.55,Math.min(1.9,Math.round(value*20)/20))

/** Change the actual font live in 5% steps, without a separate visual zoom. */
export function useReaderPinch(rootRef:RefObject<HTMLElement|null>,scale:number,onScale:(value:number)=>void,ready:boolean){
 const latest=useRef({scale,onScale});latest.current={scale,onScale}
 useEffect(()=>{
  const root=rootRef.current
  if(!ready||!root)return
  let gesture:Gesture|null=null,frame=0,blockClickUntil=0
  const apply=()=>{
   frame=0
   if(gesture&&gesture.next!==gesture.sent){gesture.sent=gesture.next;latest.current.onScale(gesture.next)}
  }
  const start=(event:TouchEvent)=>{
   if(event.touches.length!==2||gesture)return
   const target=event.target instanceof Element?event.target:null
   const scroll=target?.closest('[data-reading-scroll]'),d=distance(event.touches)
   if(!scroll||!root.contains(scroll)||!d)return
   if(event.cancelable)event.preventDefault()
   gesture={distance:d,scale:latest.current.scale,next:latest.current.scale,sent:latest.current.scale}
  }
  const move=(event:TouchEvent)=>{
   if(!gesture)return
   if(event.cancelable)event.preventDefault();event.stopPropagation()
   if(event.touches.length!==2)return
   gesture.next=step(gesture.scale*distance(event.touches)/gesture.distance)
   if(!frame&&gesture.next!==gesture.sent)frame=requestAnimationFrame(apply)
  }
  const end=(event:TouchEvent)=>{
   if(!gesture||event.touches.length>=2)return
   if(event.cancelable)event.preventDefault();event.stopPropagation()
   cancelAnimationFrame(frame);frame=0
   if(event.type!=='touchcancel')apply()
   gesture=null;blockClickUntil=performance.now()+250
  }
  const click=(event:MouseEvent)=>{if(gesture||performance.now()<blockClickUntil){event.preventDefault();event.stopPropagation()}}
  root.addEventListener('touchstart',start,{capture:true,passive:false});root.addEventListener('touchmove',move,{capture:true,passive:false})
  root.addEventListener('touchend',end,{capture:true,passive:false});root.addEventListener('touchcancel',end,{capture:true,passive:false});root.addEventListener('click',click,true)
  return()=>{
   cancelAnimationFrame(frame)
   root.removeEventListener('touchstart',start,true);root.removeEventListener('touchmove',move,true);root.removeEventListener('touchend',end,true);root.removeEventListener('touchcancel',end,true);root.removeEventListener('click',click,true)
  }
 },[rootRef,ready])
}
