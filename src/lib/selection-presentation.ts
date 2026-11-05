import {analysisRangeContains,isAnalysisRange,type AnalysisSelection} from './analysis'
import type {SurahData} from './quran'
import {displayWordText} from './word-parts'

/** Selected content, independent of whether it came from a tap or a search. */
export function selectedContentText(selection:AnalysisSelection,surah?:SurahData|null):string {
 if(!isAnalysisRange(selection)||surah?.n!==selection.s)return selection.text
 return surah.v.filter(verse=>analysisRangeContains(selection,surah.n,verse.n))
  .flatMap(verse=>verse.w.map(displayWordText)).join(' ')||selection.text
}

/**
 * A compact header gets a readable character budget, never a fixed word count.
 * Short words may therefore bring their neighbour along; the final visible word
 * is always complete and an ellipsis appears only after that boundary.
 */
export function selectionPreview(text:string,fits:(candidate:string)=>boolean=()=>true):string {
 const words=text.trim().split(/\s+/).filter(Boolean)
 if(words.length<=1)return words.join(' ')
 const characterBudget=18
 const visibleLength=(value:string)=>Array.from(value.normalize('NFD').replace(/\p{M}/gu,'')).length
 let count=1
 while(count<words.length){
  const next=count+1
  const candidate=words.slice(0,next).join(' ')
  if(visibleLength(candidate)>characterBudget||!fits(candidate+(next<words.length?'…':'')))break
  count=next
 }
 return words.slice(0,count).join(' ')+(count<words.length?'…':'')
}
