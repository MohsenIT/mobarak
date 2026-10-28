'use client'
import {useEffect,useState} from 'react'
import {BookOpen,BotMessageSquare,Download} from 'lucide-react'
import {t} from '@/lib/i18n'
import {toFa} from '@/lib/quran'
import {loadMizan,loadMizanExcerpts,loadMizanSummaries,type MizanExcerpts,type MizanSurah,type MizanSummary} from '@/lib/mizan'
import catalogue from '../../../public/data/mizan/catalogue.json'
import SourceReference from './SourceReference'

export default function MizanCommentary({s,a}:{s:number;a:number}){
 const [data,setData]=useState<MizanSurah|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false)
 const [summaries,setSummaries]=useState<{s:number;rows:Record<string,MizanSummary>}|null>(null),[summaryError,setSummaryError]=useState(false),[retry,setRetry]=useState(0)
 const [openings,setOpenings]=useState<MizanExcerpts|null>(null),[excerptError,setExcerptError]=useState(false)
 useEffect(()=>{
  let live=true
  setSummaryError(false)
  setExcerptError(false)
  loadMizanSummaries(s).then(rows=>{if(live)setSummaries({s,rows})}).catch(()=>{if(live)setSummaryError(true)})
  loadMizanExcerpts(s).then(rows=>{if(live)setOpenings(rows)}).catch(()=>{if(live)setExcerptError(true)})
  return()=>{live=false}
 },[s,retry])
 const summary=summaries?.s===s?summaries.rows[String(a)]:undefined
 const excerpt=openings?.surah===s?openings.passages.find(p=>p.from<=a&&p.to>=a):undefined
 const passage=data?.surah===s?data.passages.find(p=>p.from<=a&&p.to>=a):undefined
 // Selecting an ayah never downloads the full commentary implicitly.
 async function download(){
  setBusy(true);setError(false)
  try{setData(await loadMizan(s))}catch{setError(true)}finally{setBusy(false)}
 }
 const mb=Math.ceil((catalogue.surahs.find(row=>row.surah===s)?.bytes??0)/1000000)
 return <section className="mizan-commentary" aria-label={t('mizan.open')}>
  <header className="flex items-center justify-between gap-2"><h3>{t('mizan.open')}</h3><SourceReference sourceId="book:mizan"/></header>
  {summary?<>
   <div className="mizan-ai-label inline-flex items-center gap-1 text-xs"><BotMessageSquare size={15} aria-hidden="true"/><span>{t('mizan.aiSummary')}</span></div>
   <div dir="rtl" lang="fa" className="text-sm leading-8" aria-label={t('mizan.aiSummary')}>{summary.lines.map((line,i)=><p key={i}>{line}</p>)}</div>
  </>:excerpt?<div className="mizan-excerpt" aria-label={t('mizan.excerpt')}>
   <div className="inline-flex items-center gap-1 text-xs"><BookOpen size={15} aria-hidden="true"/><span>{t('mizan.excerpt')}</span></div>
   <p dir="rtl" lang="fa" className="whitespace-pre-wrap text-sm leading-8">{excerpt.text}{excerpt.truncated?'…':''}</p>
   {excerpt.from!==excerpt.to&&<p className="text-xs leading-7">{t('mizan.range',{from:toFa(excerpt.from),to:toFa(excerpt.to)})}</p>}
  </div>:excerptError?<p role="alert">{t('mizan.failed')} <button type="button" className="chip" onClick={()=>setRetry(v=>v+1)}>{t('ui.be9b8b4f2b')}</button></p>:<p role="status">{t('mizan.loading')}</p>}
  {summaryError&&!summary&&excerpt&&<button type="button" className="chip" onClick={()=>setRetry(v=>v+1)}>{t('ui.be9b8b4f2b')}</button>}
  <button type="button" className="chip inline-flex items-center gap-1 min-h-11" disabled={busy} onClick={()=>void download()}><Download size={15} aria-hidden="true"/>{t(busy?'mizan.loading':'mizan.downloadFull',{mb:toFa(mb)})}</button>
  {error&&<p role="alert">{t('mizan.failed')}</p>}
  {passage&&<details key={`${s}:${a}`}><summary>{t('mizan.full')}</summary><p className="text-xs leading-7">{t(passage.from===passage.to?'mizan.verse':'mizan.range',{from:toFa(passage.from),to:toFa(passage.to)})}</p><article dir="rtl" lang="fa" className="whitespace-pre-wrap text-sm leading-8 text-justify" aria-label={t('mizan.full')}>{passage.text}</article></details>}
 </section>
}
