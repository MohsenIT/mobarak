'use client'
import {useEffect,useSyncExternalStore} from 'react'
import {useUiLanguage} from './i18n'
import {isCalendar,formatCalendarDate,type CalendarPreference} from './calendar'
const KEY='mubarak.calendar.v1'
let preference:CalendarPreference='auto',deviceLocale='',ready=false
const listeners=new Set<()=>void>()
function initialize(){
 if(ready)return
 ready=true;deviceLocale=navigator.languages?.[0]||navigator.language
 try{const saved=localStorage.getItem(KEY);if(isCalendar(saved))preference=saved}catch{}
 for(const listener of listeners)listener()
}
export function setCalendar(preferenceValue:CalendarPreference){
 preference=preferenceValue
 try{localStorage.setItem(KEY,preference)}catch{}
 for(const listener of listeners)listener()
}
export function useCalendar(){
 const {language}=useUiLanguage()
 const value=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>`${preference}:${deviceLocale}`,()=> 'auto:')
 useEffect(initialize,[])
 const [selected,locale]=value.split(':')
 return {preference:selected as CalendarPreference,setCalendar,formatDate:(iso:string)=>formatCalendarDate(iso,language,selected as CalendarPreference,locale||language)}
}
