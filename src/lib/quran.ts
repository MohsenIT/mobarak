import {t,currentLanguage} from './i18n'
import {EXTRA_TRANSLATIONS,type Translator} from './translations'
export type {Translator} from './translations'
import formNames from '../../public/data/form-names.json'
// Data layer: lazy-loading + caching for quran datasets

export interface Word {
  lemma?: string // attested corpus lemma (Buckwalter identifier), excluding affixes
  wa?: boolean // independent initial waw prefix, identified by the morphology corpus
  t: string // uthmani text
  l: number | null // mushaf line number
  r?: string // arabic root (if any)
  form?: string // Quranic Arabic Corpus verb form, including derived participles
}

export interface Verse {
  n: number
  p: number // page
  j: number // juz
  w: Word[]
}

export interface SurahData {
  n: number
  ar: string | null
  fa: string
  vc: number
  v: Verse[]
  ri: Record<string, [number, number][]> // root -> [ayah, wordPos][]
}

export interface SurahMeta {
  n: number
  ar: string
  fa: string
  vc: number
  rev: string
  pg: number
  b: boolean // bismillah before
}

export interface PageSeg { s: number; f: number; t: number }

export interface Meta {
  surahs: SurahMeta[]
  pages: PageSeg[][]
  juz: Record<string, [number, number]>
}

export type Translations = Record<string, Record<Translator, string>>

let metaPromise: Promise<Meta> | null = null
export function loadMeta(): Promise<Meta> {
  if (!metaPromise) metaPromise = fetch('/data/meta.json').then(r => r.json())
  return metaPromise
}

const surahCache = new Map<number, Promise<SurahData>>()
export function loadSurah(n: number): Promise<SurahData> {
  if (!surahCache.has(n))
    surahCache.set(n, fetch(`/data/surah/${n}.json`).then(r => r.json()))
  return surahCache.get(n)!
}

const transCache = new Map<string, Promise<Translations>>()
const extraTransCache = new Map<string,Promise<string[]>>()
export function loadTrans(n: number,translator:Translator='s'): Promise<Translations> {
  const key=`${n}:${translator}`
  if (!transCache.has(key)) transCache.set(key,(async()=>{
    const response=await fetch(`/data/trans/${n}.json`)
    if(!response.ok)throw new Error('translation-unavailable')
    const base:Translations=await response.json()
    if(!EXTRA_TRANSLATIONS.some(item=>item.id===translator))return base
    if(!extraTransCache.has(translator))extraTransCache.set(translator,fetch(`/data/translations/${translator}.json`).then(async response=>{
      if(!response.ok)throw new Error('translation-unavailable')
      const rows=await response.json()
      if(!Array.isArray(rows)||rows.length!==6236||rows.some(row=>typeof row!=='string'))throw new Error('invalid-translation')
      return rows as string[]
    }).catch(error=>{extraTransCache.delete(translator);throw error}))
    const [rows,meta]=await Promise.all([extraTransCache.get(translator)!,loadMeta()])
    const offset=meta.surahs.slice(0,n-1).reduce((sum,surah)=>sum+surah.vc,0)
    for(let a=1;a<=meta.surahs[n-1].vc;a++)base[String(a)]={...base[String(a)],[translator]:rows[offset+a-1]}
    return base
  })().catch(error=>{transCache.delete(key);throw error}))
  return transCache.get(key)!
}

let rootsPromise: Promise<Record<string, Record<string, number>>> | null = null
export function loadGlobalRoots(): Promise<Record<string, Record<string, number>>> {
  if (!rootsPromise) rootsPromise = fetch('/data/roots.json').then(r => r.json())
  return rootsPromise
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export function toFa(n: number | string): string {
  const digits=new Intl.NumberFormat(currentLanguage(),{useGrouping:false})
  return String(n).replace(/[0-9]/g, d => digits.format(+d))
}

const FORM_LABELS: Record<string, string> = {
  I: t('ui.3d29181eea'), II: t('ui.d46524e04b'), III: t('ui.649e0a9bb4'), IV: t('ui.e591828577'),
  V: t('ui.c099990a07'), VI: t('ui.69ff4ac820'), VII: t('ui.4de6639f67'), VIII: t('ui.bcc3453cd1'),
  IX: t('ui.7f19f4ebb1'), X: t('ui.9e60775066'),
}

export function morphologyLabel(form: string): string {
  return (FORM_LABELS[form]?t(FORM_LABELS[form]):undefined) ?? t('ui.683d7fb1b2',{p0:(form)})
}

export function formName(root: string | null, form?: string): string | undefined {
  if (!root || !form) return undefined
  return (formNames as Record<string, string[]>)[`${root}:${form}`]?.[0]
}

export interface SharedRoot {
  root: string
  inside: number
  outside: number
  insideAyahs: number[]
  outsideAyahs: number[]
  keyword: number
  connection: number
}

/** Compare a closed verse interval with its complement, never with itself.
 * Connection = geometric mean of keyword scores in the two sections.
 * Each section's word count normalizes for its length; roots absent from
 * either section are excluded. This is lexical overlap, not semantic proof.
 */
export function compareRootRange(
  surah: SurahData, globalRoots: Record<string, Record<string, number>>,
  from: number, to: number,
): SharedRoot[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > surah.vc || from > to) return []
  const insideWords = surah.v.filter(v => v.n >= from && v.n <= to).reduce((n, v) => n + v.w.length, 0)
  const totalWords = surah.v.reduce((n, v) => n + v.w.length, 0)
  const outsideWords = totalWords - insideWords
  if (!insideWords || !outsideWords) return []
  const rows: SharedRoot[] = []
  for (const [root, occurrences] of Object.entries(surah.ri)) {
    const within = occurrences.filter(([a]) => a >= from && a <= to)
    const beyond = occurrences.filter(([a]) => a < from || a > to)
    if (!within.length || !beyond.length) continue
    const distribution = globalRoots[root]
    if (!distribution) continue
    const total = Object.values(distribution).reduce((a, b) => a + b, 0)
    const df = Object.keys(distribution).length
    const insideScore = keywordScore({ inSurah: within.length, total, surahWords: insideWords, df })
    const outsideScore = keywordScore({ inSurah: beyond.length, total, surahWords: outsideWords, df })
    rows.push({ root, inside: within.length, outside: beyond.length,
      insideAyahs: [...new Set(within.map(([a]) => a))],
      outsideAyahs: [...new Set(beyond.map(([a]) => a))],
      keyword: keywordScore({ inSurah: occurrences.length, total, surahWords: totalWords, df }),
      connection: Math.sqrt(insideScore * outsideScore),
    })
  }
  return rows.sort((a, b) => b.connection - a.connection || b.keyword - a.keyword || a.root.localeCompare(b.root, 'ar'))
}

// ----------------------------------------------------------------------------
// Keyword scoring — v3, tuned so thematic keywords win over generic verbs.
//
// The previous formula (v2) had two problems:
//   1. Hapax roots (single occurrence in this surah, df=1) dominated the
//      top of the list because their share=1 and idf=1.
//   2. Repeated thematic keywords like رحم in Maryam (20×, df=62) ranked
//      below generic verbs like كون ("to be", 43×, df=86) and قول ("to
//      say", 28×, df=84) — even though رحم is identity-defining for
//      Maryam while كون and قول are just generic helping verbs.
//
// v3 uses "lift" (over-representation) capped at 10×, multiplied by
// log-scaled volume. This means:
//   • Roots appearing many times in this surah (high volume) AND
//     more often than expected from their global density (lift > 1)
//     get high scores.
//   • Hapax roots still score, but they're capped by the lift ceiling
//     AND by their low volume, so they don't dominate.
//   • Generic verbs (low lift because they appear proportionally
//     everywhere) are penalised even if their volume is high.
//
// In Surah Maryam this gives the following approximate ranking:
//   #1 رحم   (lift 4.9, vol 0.98) → ~0.73
//   #2 ورث   (lift 11→10 cap, vol 0.56) → ~0.56
//   #3 عتو   (lift 16→10 cap, vol 0.38) → ~0.38
//   #4 وعد   (lift 2.2, vol 0.53) → ~0.26
//   #5 عهد   (lift 3.6, vol 0.38) → ~0.24
// All five user-flagged identity-defining roots now rank well above
// hapax (~0.23) and above generic verbs كون (~0.53, but ranked #3
// overall — better than v2 but still notable).
// ----------------------------------------------------------------------------
export interface RootSignals {
  inSurah: number
  total: number
  surahWords: number
  df: number
}

// Approximate word count of the Uthmani Quran — used to compute the
// "expected count" if a root were uniformly distributed across surahs.
const QURAN_WORDS = 80000

// Lift ceiling: prevents hapax roots (which would naturally have
// lift ≈ 80× or more) from dominating the score. Cap at 5× — anything
// above 5× is already "heavily over-represented", and lowering the cap
// from 10 to 5 also lifts the floor for moderate-lift thematic roots
// (e.g. وعد lift=2.2, عهد lift=3.6) because the normaliser shrinks.
const LIFT_CAP = 5

// Max possible raw score = log(1 + LIFT_CAP) * 1.0 = log(6) ≈ 1.792
const RAW_MAX = Math.log(1 + LIFT_CAP)

export function keywordScore(s: RootSignals): number {
  const { inSurah, total, surahWords, df } = s
  if (inSurah <= 0 || total <= 0 || df <= 0 || surahWords <= 0) return 0

  // Expected occurrences if the root were uniformly distributed
  // across the whole Quran: total × (this surah's word share).
  const expected = total * (surahWords / QURAN_WORDS)
  // Lift = how many times more frequent than expected.
  const lift = inSurah / Math.max(0.0001, expected)
  const liftCapped = Math.min(LIFT_CAP, lift)

  // Volume: log-scaled count. 1× → 0, 20× → ~1.
  const volume = Math.log(1 + inSurah) / Math.log(20)

  // Final raw score combines lift (concentration) and volume (repetition).
  const raw = Math.log(1 + liftCapped) * volume
  return Math.min(1, Math.max(0, raw / RAW_MAX))
}

// Label tiers for the keyword gauge — calibrated for the v3 lift-based score.
// رحم in Maryam = 1.0 (core), ورث = 0.60 (core), عتو = 0.37 (key),
// وعد = 0.35 (key), عهد = 0.31 (key), hapax ≈ 0.23 (related).
export function keywordTier(score: number): { label: string; tier: 'core' | 'key' | 'related' | 'edge' } {
  if (score >= 0.50) return { label: t('ui.dc1cdc6695'), tier: 'core' }
  if (score >= 0.30) return { label: t('ui.4f53cf3fad'), tier: 'key' }
  if (score >= 0.15) return { label: t('ui.159535aa24'), tier: 'related' }
  return { label: t('ui.743938a57c'), tier: 'edge' }
}

// ----------------------------------------------------------------------------
// Quranic mark character handling.
//
// In the Uthmani mushaf text there are many "small" mark characters
// (U+06D6..U+06ED) — small high meem, small low meem, small waw/yeh,
// rounded zero, etc. They are real Quranic recitation aids and must be
// shown. But the bundled Hafs font's glyphs for several of these codepoints
// are full-sized letterforms, so when rendered inline they look like an
// extra "م" sitting in the middle of a word.
//
// We mark these characters with a CSS class so they can be styled as small
// superscripts/subscripts (matching how a printed mushaf displays them).
// ----------------------------------------------------------------------------
export const QURAN_MARK_RE = /[\u06D6-\u06ED\u0670]/g

export function isQuranMark(ch: string): boolean {
  const cp = ch.codePointAt(0)!
  return (cp >= 0x06D6 && cp <= 0x06ED) || cp === 0x0670
}

// Split a word's text into runs: regular text vs Quranic marks.
// Marks are wrapped so the React renderer can style them with a span.
export function splitQuranMarks(text: string): Array<{ t: string; mark: boolean }> {
  const out: Array<{ t: string; mark: boolean }> = []
  let buf = ''
  const flush = () => {
    if (buf) {
      out.push({ t: buf, mark: false })
      buf = ''
    }
  }
  for (const ch of text) {
    if (isQuranMark(ch)) {
      flush()
      out.push({ t: ch, mark: true })
    } else {
      buf += ch
    }
  }
  flush()
  return out
}
