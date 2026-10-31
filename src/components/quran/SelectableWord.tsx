'use client'
import {useContext,type CSSProperties} from 'react'
import {ReaderSearchContext} from './ReaderSearchHighlights'
import type { Word } from '@/lib/quran'
import { splitWord, wordTarget } from '@/lib/word-parts'
import type { Selection } from './MushafPage'
import QuranText from './QuranText'

/** Keep canonical word coordinates while exposing the corpus's independent waw. */
export default function SelectableWord({ word, location, selection, onWordTap, className, style, ...data }: {
  word: Word; location: { s: number; a: number; pos: number }; selection: Selection | null
  onWordTap: (selection: Selection) => void; className: string; style?: CSSProperties
  'data-comparison-root'?: string | null; 'data-comparison-range'?: string
}) {
  const highlights=useContext(ReaderSearchContext),key=`${location.s}:${location.a}:${location.pos}`,mask=highlights.matches.get(key)??0
  const highlight=(bit:number)=>mask&bit?(highlights.active.has(key)?'active':'match'):undefined
  const { prefix, stem } = splitWord(word)
  const selectingText=()=>window.matchMedia('(hover:hover) and (pointer:fine)').matches&&!!window.getSelection()?.toString().trim()

  const selected = selection?.s === location.s && selection.a === location.a && selection.pos === location.pos
  const stemClass = selected && selection?.part === 'prefix' ? className.replace(/ selected-word| analysis-selected/g, '') : className
  return <span style={{ whiteSpace: 'nowrap' }} data-surah={location.s} data-ayah={location.a} data-pos={location.pos} data-comparison-range={data['data-comparison-range']}>
    {prefix && <><span className={`reader-highlight quran-word${selected && selection?.part === 'prefix' ? ' selected-word' : ''}`} data-word-part="prefix" data-quick-search-match={highlight(1)} data-highlight-state={highlight(1)==='active'?'selected':highlight(1)} aria-current={selected && selection?.part === 'prefix' ? 'true' : undefined} onClick={() => {if(!selectingText())onWordTap({ ...location, ...wordTarget(word, 'prefix') })}}><QuranText text={prefix} /></span>{' '}</>}
    <span {...data} style={style} className={`reader-highlight ${stemClass}`} data-word-part="stem" data-quick-search-match={highlight(2)} data-highlight-state={highlight(2)==='active'?'selected':highlight(2)} aria-current={selected && selection?.part !== 'prefix' ? 'true' : undefined} onClick={() => {if(!selectingText())onWordTap({ ...location, ...wordTarget(word) })}}><QuranText text={stem} /></span>
  </span>
}
