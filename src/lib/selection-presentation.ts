import {analysisRangeContains,isAnalysisRange,type AnalysisSelection} from './analysis'
import type {SurahData} from './quran'
import {displayWordText} from './word-parts'

/** Selected content, independent of whether it came from a tap or a search. */
export function selectedContentText(selection:AnalysisSelection,surah?:SurahData|null):string {
 if(!isAnalysisRange(selection)||surah?.n!==selection.s)return selection.text
 return surah.v.filter(verse=>analysisRangeContains(selection,surah.n,verse.n))
  .flatMap(verse=>verse.w.map(displayWordText)).join(' ')||selection.text
}

/** Keep word boundaries: one word on narrow headers, at most two on roomy ones. */
export function selectionPreview(text:string,fits:(candidate:string)=>boolean=()=>true):string {
 const words=text.trim().split(/\s+/).filter(Boolean)
 if(words.length<=1)return words.join(' ')
 let count=1
 while(count<Math.min(2,words.length)){
  const next=count+1
  if(!fits(words.slice(0,next).join(' ')+(next<words.length?'…':'')))break
  count=next
 }
 return words.slice(0,count).join(' ')+(count<words.length?'…':'')
}
