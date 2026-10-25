'use client'
import { useEffect, useRef, type RefObject } from 'react'

interface Options {
  audio: RefObject<HTMLAudioElement | null>; active: boolean; playing: boolean
  title: string; artist: string
  onPlay: () => void; onPause: () => void; onNext: () => void; onPrevious: () => void; onStop: () => void
}
/** Browser/OS media controls. Native Android Auto requires a separate MediaLibraryService. */
export function useRecitationMediaSession(options: Options) {
  const current=useRef(options);current.current=options
  useEffect(()=>{
    if(!options.active || !('mediaSession' in navigator))return
    const session=navigator.mediaSession
    const seek=(offset:number)=>{const a=current.current.audio.current;if(a&&Number.isFinite(a.duration))a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+offset))}
    const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={
      play:()=>current.current.onPlay(),pause:()=>current.current.onPause(),
      nexttrack:()=>current.current.onNext(),previoustrack:()=>current.current.onPrevious(),stop:()=>current.current.onStop(),
      seekforward:d=>seek(d.seekOffset??10),seekbackward:d=>seek(-(d.seekOffset??10)),
      seekto:d=>{const a=current.current.audio.current;if(a&&Number.isFinite(a.duration)&&d.seekTime!==undefined)a.currentTime=Math.max(0,Math.min(a.duration,d.seekTime))},
    }
    for(const [action,handler] of Object.entries(handlers))try{session.setActionHandler(action as MediaSessionAction,handler)}catch{/* Unsupported action on this browser. */}
    const position=()=>{
      const a=current.current.audio.current
      if(!a||!Number.isFinite(a.duration)||a.duration<=0)return
      try{session.setPositionState?.({duration:a.duration,playbackRate:a.playbackRate,position:Math.min(a.duration,Math.max(0,a.currentTime))})}catch{}
    }
    const audio=options.audio.current
    const events=['loadedmetadata','durationchange','timeupdate','ratechange','seeked']
    events.forEach(event=>audio?.addEventListener(event,position));position()
    return()=>{
      events.forEach(event=>audio?.removeEventListener(event,position))
      for(const action of Object.keys(handlers))try{session.setActionHandler(action as MediaSessionAction,null)}catch{}
      session.metadata=null;session.playbackState='none';try{session.setPositionState?.()}catch{}
    }
  },[options.active,options.audio])
  useEffect(()=>{
    if(!options.active||!('mediaSession' in navigator))return
    if(typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({
      title:options.title,artist:options.artist,album:'قرآن مبارک',
      artwork:[192,512].map(size=>({src:new URL(`/icons/app-logo-v3-any-${size}.png`,location.href).href,sizes:`${size}x${size}`,type:'image/png'})),
    })
    navigator.mediaSession.playbackState=options.playing?'playing':'paused'
  },[options.active,options.playing,options.title,options.artist])
}
