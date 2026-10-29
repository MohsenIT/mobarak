'use client'
import {useEffect,useState} from 'react'
export type SafeArea={top:number;right:number;bottom:number;left:number}
const empty:SafeArea={top:0,right:0,bottom:0,left:0}
export function useSafeArea(){
 const [value,setValue]=useState(empty)
 useEffect(()=>{
  const read=()=>{
   const style=getComputedStyle(document.documentElement),native=!!(window as unknown as {QuranNativeAudio?:unknown}).QuranNativeAudio
   const probe=document.createElement('div');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';document.body.appendChild(probe)
   const env=getComputedStyle(probe)
   const next=Object.fromEntries(Object.keys(empty).map(side=>{
    const reported=parseFloat(style.getPropertyValue(`--native-safe-area-${side}`)),inset=parseFloat(env.getPropertyValue(`padding-${side}`))||0
    return [side,Math.max(inset,Number.isFinite(reported)?reported:native&&(side==='top'||side==='bottom')?32:0)]
   })) as SafeArea;probe.remove()
   setValue(old=>Object.keys(empty).every(side=>old[side as keyof SafeArea]===next[side as keyof SafeArea])?old:next)
  }
  read();window.addEventListener('quran-safe-area',read);window.addEventListener('resize',read)
  return()=>{window.removeEventListener('quran-safe-area',read);window.removeEventListener('resize',read)}
 },[])
 return value
}
export function applyNativeSafeArea(value:unknown){
 if(typeof document==='undefined'||!value||typeof value!=='object')return
 let changed=false
 for(const side of Object.keys(empty)){
  const n=(value as Record<string,unknown>)[side]
  if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>300)continue
  const key=`--native-safe-area-${side}`,css=`${n}px`,root=document.documentElement
  if(root.style.getPropertyValue(key)!==css){root.style.setProperty(key,css);changed=true}
 }
 if(changed)window.dispatchEvent(new Event('quran-safe-area'))
}
