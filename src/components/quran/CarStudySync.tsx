'use client'
import {useEffect,type RefObject} from 'react'
import {useCarLibrary} from '@/lib/car-library'
import {nativeCommand,nativeRecitationAvailable} from '@/lib/native-recitation'
import {readingWindow} from '@/lib/reading-visibility'
/** Keep the visible/selected phone reading position available to the car, without starting playback. */
export default function CarStudySync({reader,revision}:{reader:RefObject<HTMLElement|null>;revision:string}){
 useCarLibrary()
 useEffect(()=>{
  if(!nativeRecitationAvailable())return
  const scroll=reader.current?.querySelector<HTMLElement>('[data-reading-scroll]');if(!scroll)return
  let timer:ReturnType<typeof setTimeout>,last='',live=true
  const sync=()=>{
   const marked=scroll.querySelector<HTMLElement>('.selected-word,.flash,.analysis-selected')?.closest<HTMLElement>('[data-surah][data-ayah][data-pos]')
   const words=[...(marked?[marked]:[]),...scroll.querySelectorAll<HTMLElement>('[data-surah][data-ayah][data-pos]')]
   const bounds=scroll.getBoundingClientRect()
   for(const word of words){
    const rect=word.getBoundingClientRect();if(!rect.width||rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue
    const visible=readingWindow(scroll,word);if(rect.bottom<=visible.top||rect.top>=visible.bottom||visible.bottom-visible.top<40)continue
    const s=Number(word.dataset.surah),a=Number(word.dataset.ayah),key=`${s}:${a}`
    if(key!==last){last=key;void nativeCommand({op:'library',action:'reading',s,a}).catch(()=>{last=''})}break
   }
  }
  const schedule=()=>{if(!live)return;clearTimeout(timer);timer=setTimeout(sync,300)}
  const observer=new ResizeObserver(schedule);observer.observe(scroll);document.fonts.ready.then(schedule);scroll.addEventListener('scroll',schedule,{passive:true});schedule()
  return()=>{live=false;observer.disconnect();clearTimeout(timer);scroll.removeEventListener('scroll',schedule)}
 },[reader,revision])
 return null
}
