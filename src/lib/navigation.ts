import type { Meta, SurahMeta } from './quran'
import { getSurahContexts } from './contexts'
import { SURAH_ALIASES } from './surah-aliases'
export type JumpKind = 'surah' | 'page' | 'juz' | 'verse' | 'context'
export type Destination = { kind: 'surah'; s: number } | { kind: 'page'; p: number } | { kind: 'verse'; s: number; a: number } | { kind: 'context'; s: number; index: number; from: number; to: number }
export function normalizeSearch(value: string): string {
  return value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[\u200c\sـ]/g, '').toLowerCase()
}
function nameKey(value: string) { return normalizeSearch(value).replace(/^ال/, '') }
function surahKeys(s: SurahMeta) { return [s.fa, s.ar, ...(SURAH_ALIASES[s.n] ?? [])].map(nameKey) }
function surahScore(s: SurahMeta, query: string): number {
  if (String(s.n) === normalizeSearch(query)) return 0
  const key = nameKey(query)
  if (!key) return 3
  const names = surahKeys(s)
  return names.includes(key) ? 0 : names.some(name => name.startsWith(key)) ? 1 : names.some(name => name.includes(key)) ? 2 : Infinity
}
export function searchSurahs(meta: Meta, input: string): SurahMeta[] {
  if (!normalizeSearch(input)) return meta.surahs
  return meta.surahs.map(s => ({ s, score: surahScore(s, input) })).filter(item => Number.isFinite(item.score)).sort((a, b) => a.score - b.score || a.s.n - b.s.n).map(item => item.s)
}
function findSurah(meta: Meta, query: string) {
  const exact = meta.surahs.filter(s => surahScore(s, query) === 0)
  if (exact.length === 1) return exact[0]
  const matches = searchSurahs(meta, query)
  return matches.length === 1 ? matches[0] : undefined
}
const longPrefixes: Record<string,JumpKind> = { سوره:'surah', صفحه:'page', جزء:'juz', جز:'juz', آیه:'verse', ایه:'verse', سیاق:'context' }
const shortPrefixes: Record<string,JumpKind> = { س:'surah', ص:'page', ج:'juz', آ:'verse', ا:'verse', ق:'context' }
const commandText = (value:string) => value.normalize('NFC').replace(/[\u200c\u200d]/g,' ').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\u064B-\u065F\u0670]/g,'').replace(/ة/g,'ه').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[أإٱ]/g,'ا').trim()
/** Recognize commands before normalizing alef: «ق ا» and «ق آ» have different meanings. */
export function jumpCommand(input:string): {kind:JumpKind;value:string}|null {
  const value=commandText(input)
  const combined=value.match(/^(?:سوره|س)\s*(\d+)\s*(آیه|ایه|آ|ا|سیاق|ق)\s*(\d+|اول|آخر|اخر|ا|آ)$/)
  if(combined)return {kind:combined[2]==='ق'||combined[2]==='سیاق'?'context':'verse',value:`${combined[1]}:${combined[3]}`}
  const long=value.match(/^(سوره|صفحه|جزء|جز|آیه|ایه|سیاق)\s*(.+)$/)
  if(long)return {kind:longPrefixes[long[1]],value:long[2].trim()}
  const short=value.match(/^([سصجآاق])\s*(\d+(?:[:：/]\d+)?|[^:：/]+[:：/](?:\d+|اول|آخر|اخر|ا|آ))$/)
  if(short)return {kind:shortPrefixes[short[1]],value:short[2].trim()}
  const compactContext=value.match(/^ق([اآ])$/)
  if(compactContext)return {kind:'context',value:compactContext[1]}
  const edge=value.match(/^([سصجآاق])\s+(اول|آخر|اخر|ا|آ)$/)
  return edge?{kind:shortPrefixes[edge[1]],value:edge[2]}:null
}
export function isNavigationInput(input:string) { return !!jumpCommand(input)||/^[^:：/]+[:：/]\s*[^:：/]+$/.test(input.trim()) }
function indexNumber(value:string,max:number) {
  const raw=value.trim().normalize('NFC')
  const key=normalizeSearch(raw)
  if(raw==='آ'||key==='اخر')return max
  if(key==='ا'||key==='اول')return 1
  return /^\d+$/.test(key)?Number(key):NaN
}
export function resolveDestination(meta: Meta, kind: JumpKind, input: string, currentSurah: number): Destination | null {
  const command=jumpCommand(input)
  let value=command?.value??input.trim()
  kind=command?.kind??kind
  if (!value) return null
  if(kind==='surah'&&/[:：/]/.test(value))kind='verse'
  if (kind === 'surah') {
    const edge=command||/^\d+$/.test(normalizeSearch(value))?indexNumber(value,114):NaN
    const s = Number.isInteger(edge)?meta.surahs[edge-1]:findSurah(meta,value)
    return s ? { kind: 'surah', s: s.n } : null
  }
  if (kind === 'verse'||kind==='context') {
    const parts=value.split(/[:：/]/)
    if(parts.length>2)return null
    const s=parts.length===2?findSurah(meta,parts[0]):meta.surahs[currentSurah-1]
    if(!s)return null
    if(kind==='context') {
      const ranges=getSurahContexts(s.n)?.ranges??[]
      const number=indexNumber(parts[parts.length-1],ranges.length)
      const range=Number.isInteger(number)&&number>=1?ranges[number-1]:undefined
      return range?{kind:'context',s:s.n,index:number,from:range.from,to:range.to}:null
    }
    const a=indexNumber(parts[parts.length-1],s.vc)
    return Number.isInteger(a)&&a>=1&&a<=s.vc?{kind:'verse',s:s.n,a}:null
  }
  const n=indexNumber(value,kind==='page'?604:30)
  if (!Number.isInteger(n)) return null
  if (kind === 'page') return n >= 1 && n <= 604 ? { kind: 'page', p: n } : null
  const first = meta.juz[String(n)]
  return n >= 1 && n <= 30 && first ? { kind: 'verse', s: first[0], a: first[1] } : null
}

export type DestinationSuggestion = { destination: Destination; label: string }
/** Infer the destination after typing; show explicit choices for ambiguous numbers. */
export function destinationSuggestions(meta: Meta, input: string, currentSurah: number): DestinationSuggestion[] {
  const value = input.trim()
  if (!value) return []
  const label = (d: Destination) => d.kind==='context'?`سیاق ${d.index} سورهٔ ${meta.surahs[d.s-1]?.fa} · آیات ${d.from} تا ${d.to}`:d.kind==='surah'?`سورهٔ ${meta.surahs[d.s-1]?.fa}`:d.kind==='page'?`صفحهٔ ${d.p}`:`${meta.surahs[d.s-1]?.fa} · آیهٔ ${d.a}`
  const command=jumpCommand(value)
  if (command || /[:：/]/.test(value)) {
    const destination = resolveDestination(meta, /[:：/]/.test(value) ? 'verse' : 'surah', value, currentSurah)
    const juz=command?.kind==='juz'?indexNumber(command.value,30):undefined
    return destination?[{destination,label:juz?`جزء ${juz}`:label(destination)}]:[]
  }
  if (/^\d+$/.test(normalizeSearch(value))) {
    return (['surah', 'verse', 'page', 'juz', 'context'] as const).flatMap(kind => {
      const destination = resolveDestination(meta, kind, value, currentSurah)
      return destination ? [{ destination, label: kind === 'juz' ? `جزء ${normalizeSearch(value)}` : label(destination) }] : []
    })
  }
  return searchSurahs(meta, value).slice(0, 6).map(s => {
    const alias = SURAH_ALIASES[s.n]?.find(alias => nameKey(alias) === nameKey(value))
    return { destination: { kind: 'surah' as const, s: s.n }, label: alias ? `سورهٔ ${s.fa} (${alias})` : `سورهٔ ${s.fa}` }
  })
}
/** Search bars expose explicit jump commands without stealing ordinary word searches. */
export function searchDestinations(meta:Meta,input:string,currentSurah:number) {
  return isNavigationInput(input)?destinationSuggestions(meta,input,currentSurah):[]
}

export const NAVIGATION_HELP = [
  ['سوره','س۲۰، سوره ۲۰، طه، حمد، توحید'],
  ['صفحه','ص۶، صفحه ۶'],
  ['جزء','ج۶، جزء ۶'],
  ['آیه','آ۶، ا۶، آیه ۶؛ طه:۶، ۲۰:۶، س۲۰ آ۶'],
  ['سیاق','ق۶، سیاق ۶؛ ق۲۰:۶، سیاق طه:۶، س۲۰ ق۶'],
  ['اول و آخر','ق ا / ق آ؛ همین الگو برای س، ص، ج و آ هم کار می‌کند.'],
] as const
