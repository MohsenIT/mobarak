import {analysisRangeContains,isAnalysisRange,type AnalysisSelection} from './analysis'
import type {SurahData} from './quran'
import {displayWordText} from './word-parts'

/** Selected content, independent of whether it came from a tap or a search. */
export function selectedContentText(selection:AnalysisSelection,surah?:SurahData|null):string {
 if(!isAnalysisRange(selection)||surah?.n!==selection.s)return selection.text
 return surah.v.filter(verse=>analysisRangeContains(selection,surah.n,verse.n))
  .flatMap(verse=>verse.w.map(displayWordText)).join(' ')||selection.text
}

/** Keep word boundaries and the beginning of long selections in compact UI. */
export function selectionPreview(text:string,fits:(candidate:string)=>boolean=()=>true):string {
 const words=text.trim().split(/\s+/).filter(Boolean)
 if(words.length<=1)return words.join(' ')
 let count=Math.min(3,words.length)
 while(count>1&&!fits(words.slice(0,count).join(' ')+(count<words.length?'…':'')))count--
 return words.slice(0,count).join(' ')+(count<words.length?'…':'')
}
