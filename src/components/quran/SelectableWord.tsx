'use client'
import type { CSSProperties } from 'react'
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
  const { prefix, stem } = splitWord(word)
  const selected = selection?.s === location.s && selection.a === location.a && selection.pos === location.pos
  const stemClass = selected && selection?.part === 'prefix' ? className.replace(/ selected-word| analysis-selected/g, '') : className
  return <span style={{ whiteSpace: 'nowrap' }} data-surah={location.s} data-ayah={location.a} data-pos={location.pos} data-comparison-range={data['data-comparison-range']}>
    {prefix && <><span className={`quran-word${selected && selection?.part === 'prefix' ? ' selected-word' : ''}`} data-word-part="prefix" aria-current={selected && selection?.part === 'prefix' ? 'true' : undefined} onClick={() => onWordTap({ ...location, ...wordTarget(word, 'prefix') })}><QuranText text={prefix} /></span>{' '}</>}
    <span {...data} style={style} className={stemClass} data-word-part="stem" aria-current={selected && selection?.part !== 'prefix' ? 'true' : undefined} onClick={() => onWordTap({ ...location, ...wordTarget(word) })}><QuranText text={stem} /></span>
  </span>
}
