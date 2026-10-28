'use client'
import {useCallback,useEffect,useState} from 'react'
import {Trash2,RefreshCw} from 'lucide-react'
import {t} from '@/lib/i18n'
import {toFa,type Meta} from '@/lib/quran'
import {getResource} from '@/lib/resources'
import {AUDIO_SOURCES} from '@/lib/recitation'
import {listDownloadedPacks,deleteDownloadedPack,type DownloadedPack} from '@/lib/downloads'
import {listDownloadedRecitations,deleteRecitation,type DownloadedRecitation} from '@/lib/recitation-storage'
import {nativeCommand,nativeRecitationAvailable} from '@/lib/native-recitation'
export default function DownloadsManager({meta}:{meta:Meta}){
 const [packs,setPacks]=useState<DownloadedPack[]>([]),[audio,setAudio]=useState<DownloadedRecitation[]>([])
 const [busy,setBusy]=useState(true),[error,setError]=useState(false)
 const load=useCallback(async()=>{
  const results=await Promise.allSettled([listDownloadedPacks(),listDownloadedRecitations()])
  setError(results.some(row=>row.status==='rejected'))
  if(results[0].status==='fulfilled')setPacks(results[0].value)
  if(results[1].status==='fulfilled')setAudio(results[1].value)
 },[])
 useEffect(()=>{let live=true;void load().finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[load])
 async function remove(action:()=>Promise<void>){
  setBusy(true);setError(false)
  try{await action();await load()}catch{setError(true)}finally{setBusy(false)}
 }
 const size=(bytes:number)=>`${toFa((bytes/1048576).toFixed(2))} ${t('ui.9a29784b98')}`
 const packName=(id:string)=>id==='mizan'?t('mizan.open'):id==='maqayis'?t('ui.4c3a424943'):id==='ishtiqaqi'?t('ui.1da653b2f3'):getResource(id)?.title??id
 return <section className="p-4 space-y-4" aria-label={t('downloads.manage')}>
  <header className="flex items-center justify-between gap-2"><h3>{t('downloads.manage')}</h3><button type="button" className="icon-btn" disabled={busy} aria-label={t('ui.be9b8b4f2b')} onClick={()=>{setBusy(true);void load().finally(()=>setBusy(false))}}><RefreshCw size={18}/></button></header>
  <p className="text-xs leading-6">{t('downloads.bundled')}</p>
  <p className="text-sm font-bold">{size(packs.reduce((n,p)=>n+p.bytes,0)+audio.reduce((n,p)=>n+p.bytes,0))}</p>
  {busy&&<p role="status">{t('ui.069a6fab08')}</p>}
  {error&&<p role="alert">{t('downloads.failed')}</p>}
  {!busy&&!error&&!packs.length&&!audio.length&&<p>{t('downloads.empty')}</p>}
  {packs.map(pack=><div key={pack.id} className="rounded-xl border p-3 flex items-center justify-between gap-3">
   <div><h4>{packName(pack.id)}</h4><p className="text-xs leading-7">{t('downloads.files',{count:toFa(pack.count),total:toFa(pack.total)})} · {size(pack.bytes)}</p></div>
   <button type="button" className="chip min-h-11" disabled={busy} aria-label={`${t('auto.remove')} ${packName(pack.id)}`} onClick={()=>void remove(()=>deleteDownloadedPack(pack))}><Trash2 size={16}/>{t('auto.remove')}</button>
  </div>)}
  {audio.map(row=>{
   const source=AUDIO_SOURCES.find(item=>item.id===row.reciterId),surah=meta.surahs.find(item=>item.n===row.surah)
   const name=`${source?.name??row.reciterId} · ${surah?.ar??toFa(row.surah)}`
   return <div key={`${row.reciterId}:${row.surah}`} className="rounded-xl border p-3 flex items-center justify-between gap-3"><div><h4>{name}</h4><p className="text-xs leading-7">{t('downloads.files',{count:toFa(row.count),total:toFa(surah?.vc??row.count)})} · {size(row.bytes)}</p></div><button type="button" className="chip min-h-11" disabled={busy||!source} aria-label={`${t('auto.remove')} ${name}`} onClick={()=>void remove(async()=>{
    if(!source)return
    if(nativeRecitationAvailable())await nativeCommand({op:'deleteCache',r:source.id,s:row.surah})
    await deleteRecitation(row.surah,source)
   })}><Trash2 size={16}/>{t('auto.remove')}</button></div>
  })}
 </section>
}
