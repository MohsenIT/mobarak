'use client'
import {useEffect,useSyncExternalStore} from 'react'
import fa from '@/messages/fa.json'
import languages from '@/messages/languages.json'
import names from '@/messages/language-names.json'
export type UiLanguage=string
export const UI_LANGUAGES=languages
const KEY='mubarak.ui-language.v1'
let locale='fa',catalogue:Record<string,string>=fa
const listeners=new Set<()=>void>()
const reverse=new Map(Object.entries(fa).map(([key,value])=>[value,key]))
export const uiDirection=(language=locale)=>['fa','ar','ur','ps','sd','ug','dv','ku'].includes(language)?'rtl':'ltr'
export const currentLanguage=()=>locale
export const languageName=(code:string,display=code)=>{
 const known=(names as Record<string,{english:string;native:string}>)[code]
 if(known&&(display===code||display==='en'))return display==='en'?known.english:known.native
 try{const result=new Intl.DisplayNames([display],{type:'language'}).of(code);return result&&result!==code?result:known?.english??code}catch{return known?.english??code}
}
export const languageLabel=(code:string)=>{const native=languageName(code),english=languageName(code,'en');return native===english?english:`${english} · ${native}`}

export function resolveLanguage(tags:readonly string[]){for(const tag of tags){const code=tag.toLowerCase().split(/[-_]/)[0];if(UI_LANGUAGES.includes(code))return code}return null}
export function t(key:string,values:Record<string,string|number|undefined>={}){
 const id=Object.hasOwn(fa,key)?key:reverse.get(key)??key
 const text=catalogue[id]??(fa as Record<string,string>)[id]??key
 return text.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]??''):match)
}
export async function setUiLanguage(next:string,persist=true){
 if(!UI_LANGUAGES.includes(next))return false
 let messages:Record<string,string>
 try{messages=next==='fa'?fa:await import(`../messages/${next}.json`).then(module=>module.default)}catch{return false}
 catalogue=messages;locale=next
 if(typeof document!=='undefined'){document.documentElement.lang=next;document.documentElement.dir=uiDirection(next)}
 if(persist)try{localStorage.setItem(KEY,next)}catch{}
 listeners.forEach(listener=>listener());return true
}
export function useUiLanguage(){
 const language=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>locale,()=> 'fa')
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem(KEY)}catch{};if(saved&&saved!==locale)void setUiLanguage(saved,false)},[])
 return {language,t,dir:uiDirection(language)}
}
