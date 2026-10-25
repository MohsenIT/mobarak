'use client'
import {t} from '@/lib/i18n'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { APP_RELEASES,CURRENT_RELEASE,checkAppUpdate,compareRelease,type AppUpdate } from '@/lib/app-releases'
import { toFa } from '@/lib/quran'
import ReleaseNotesDialog from './ReleaseNotesDialog'

export async function refreshApplication() {
  const url = new URL(window.location.href)
  url.searchParams.set('_refresh', Date.now().toString())
  // Verify a fresh document is reachable before leaving a working offline reader.
  const response = await fetch(url.href, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Update unavailable')
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined)
    await registration?.update().catch(() => undefined)
  }
  window.location.replace(url.href)
}

export default function UpdateSettings() {
  const [state,setState]=useState<'idle'|'checking'|'latest'|'available'|'error'|'refreshing'>('idle')
  const [info,setInfo]=useState<AppUpdate|null>(null)
  const [notes,setNotes]=useState<'history'|'changes'|null>(null)
  const refresh=async()=>{setState('refreshing');try{await refreshApplication()}catch{setState('error')}}
  const check=async()=>{
    setState('checking')
    try{const update=await checkAppUpdate();setInfo(update);setState(update.build!==process.env.NEXT_PUBLIC_APP_VERSION&&(!update.latest||compareRelease(update.latest.version,CURRENT_RELEASE)>=0)?'available':'latest')}
    catch{setState('error')}
  }
  const history:AppUpdate={build:process.env.NEXT_PUBLIC_APP_VERSION||'local',releases:APP_RELEASES,latest:APP_RELEASES[0]}
  return <section aria-label={t("ui.f0857df27f")}>
    <h3 className="text-sm font-bold mb-3">{t("ui.f0857df27f")}</h3>
    <p className="text-xs mb-3" style={{color:'var(--ink-soft)'}}>{t("ui.0f2d214015")}{' '}{toFa(CURRENT_RELEASE)} · <button type="button" className="underline" onClick={()=>setNotes('history')}>{t("ui.3a0967fbbe")}</button></p>
    {process.env.NEXT_PUBLIC_DESKTOP==='1'?<a className="chip inline-flex min-h-11 items-center" href="https://github.com/MohsenIT/quran-vajeh/releases/latest" target="_blank" rel="noreferrer">{t("ui.c5462f5130")}</a>:<>
      <div className="flex flex-wrap items-center gap-3"><button className="chip inline-flex min-h-11 items-center gap-2" disabled={state==='checking'||state==='refreshing'} onClick={state==='available'?()=>void refresh():()=>void check()}><RefreshCw size={16} className={state==='checking'||state==='refreshing'?'animate-spin':''}/>{state==='checking'?t("ui.25384e5227"):state==='available'?t("ui.c5462f5130"):state==='refreshing'?t("ui.15f33a75a4"):t("ui.20b05bf19a")}</button>{state==='available'&&<button type="button" className="underline text-xs" onClick={()=>setNotes('changes')}>{t("ui.3234f424d7")}</button>}</div>
      <p role="status" className="text-xs leading-6 mt-2" style={{color:'var(--ink-soft)'}}>{state==='latest'?t("ui.e7ae3ec09b"):state==='available'?t("ui.98e493291d",{p0:(info?.latest?toFa(info.latest.version):t("ui.7b2b35c950"))}):state==='error'?t("ui.3da752b258"):''}</p>
    </>}
    <ReleaseNotesDialog open={notes!==null} onOpenChange={open=>{if(!open)setNotes(null)}} update={notes==='history'?history:info} history={notes==='history'} onUpdate={notes==='changes'&&state!=='latest'?()=>void refresh():undefined} busy={state==='refreshing'} error={notes==='changes'&&state==='error'}/>
  </section>
}
