'use client'
import {useLayoutEffect,useRef,useState} from 'react'
import {quranDisplayText} from '@/lib/quran-display'
import {selectionPreview} from '@/lib/selection-presentation'
import QuranText from './QuranText'

/** A single responsive presentation for every selection in a compact header. */
export default function SelectionPreview({text}:{text:string}) {
 const ref=useRef<HTMLSpanElement>(null)
 const [preview,setPreview]=useState(()=>selectionPreview(text))
 useLayoutEffect(()=>{
  const element=ref.current
  if(!element)return
  let live=true
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d')
  const measure=()=>{
   if(!live)return
   const style=getComputedStyle(element)
   if(context)context.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
   const next=selectionPreview(text,candidate=>!context||context.measureText(quranDisplayText(candidate)).width<=element.clientWidth)
   setPreview(previous=>previous===next?previous:next)
  }
  measure()
  const observer=new ResizeObserver(measure);observer.observe(element)
  document.fonts.ready.then(measure)
  return()=>{live=false;observer.disconnect()}
 },[text])
 return <span ref={ref} className="font-quran panel-word selection-preview" dir="rtl" data-selection-preview data-truncated={preview.endsWith('…')?'true':'false'}><QuranText text={preview}/></span>
}
