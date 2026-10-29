'use client'
import {createContext,useMemo,type ReactNode} from 'react'
import type {QuranSearchResult} from '@/lib/quran-search'
export type ReaderSearchState={results:QuranSearchResult[];index:number}
export const ReaderSearchContext=createContext<{matches:Map<string,number>;active:Set<string>}>({matches:new Map(),active:new Set()})
export default function ReaderSearchHighlights({value,children}:{value:ReaderSearchState|null;children:ReactNode}){
 const highlight=useMemo(()=>{
  const matches=new Map<string,number>(),active=new Set<string>()
  value?.results.forEach((result,index)=>result.positions.forEach(pos=>{
   const key=`${result.s}:${result.a}:${pos}`
   matches.set(key,(matches.get(key)??0)|(result.parts[pos]??2))
   if(index===value.index)active.add(key)
  }))
  return {matches,active}
 },[value])
 return <ReaderSearchContext.Provider value={highlight}>{children}</ReaderSearchContext.Provider>
}
