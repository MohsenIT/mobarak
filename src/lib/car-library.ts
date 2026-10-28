'use client'
import {useEffect,useSyncExternalStore} from 'react'
import {nativeCommand,nativeRecitationAvailable,subscribeNativeLibrary} from './native-recitation'
export type CarVerse={s:number;a:number}
export type CarPlaylist={id:string;title:string;surahs:number[]}
export type CarLibrary={favorites:CarVerse[];playlists:CarPlaylist[];reading:Partial<CarVerse>;revision:number}
const empty:CarLibrary={favorites:[],playlists:[],reading:{},revision:0}
let snapshot=empty,bridge:unknown
const listeners=new Set<()=>void>()
const notify=()=>listeners.forEach(listener=>listener())
function connect(){
 if(!nativeRecitationAvailable()||bridge===window.QuranNativeAudio)return
 bridge=window.QuranNativeAudio
 subscribeNativeLibrary(data=>{const next=data as CarLibrary;if(!next||!Array.isArray(next.favorites)||!Array.isArray(next.playlists)||typeof next.revision!=='number')return;snapshot=next;notify()})
 void nativeCommand({op:'libraryGet'}).catch(()=>{})
}
export function useCarLibrary(){
 const data=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>snapshot,()=>empty)
 useEffect(connect,[])
 return{data,available:nativeRecitationAvailable(),mutate:(command:Record<string,unknown>)=>nativeCommand({op:'library',...command})}
}
