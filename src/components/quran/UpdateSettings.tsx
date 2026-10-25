'use client'
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
  return <section aria-label="به‌روزرسانی برنامه">
    <h3 className="text-sm font-bold mb-3">به‌روزرسانی برنامه</h3>
    <p className="text-xs mb-3" style={{color:'var(--ink-soft)'}}>نسخهٔ فعلی: {toFa(CURRENT_RELEASE)} · <button type="button" className="underline" onClick={()=>setNotes('history')}>تاریخچهٔ نسخه‌ها</button></p>
    {process.env.NEXT_PUBLIC_DESKTOP==='1'?<a className="chip inline-flex min-h-11 items-center" href="https://github.com/MohsenIT/quran-vajeh/releases/latest" target="_blank" rel="noreferrer">دریافت نسخهٔ جدید</a>:<>
      <div className="flex flex-wrap items-center gap-3"><button className="chip inline-flex min-h-11 items-center gap-2" disabled={state==='checking'||state==='refreshing'} onClick={state==='available'?()=>void refresh():()=>void check()}><RefreshCw size={16} className={state==='checking'||state==='refreshing'?'animate-spin':''}/>{state==='checking'?'در حال بررسی…':state==='available'?'دریافت نسخهٔ جدید':state==='refreshing'?'در حال به‌روزرسانی…':'بررسی به‌روزرسانی'}</button>{state==='available'&&<button type="button" className="underline text-xs" onClick={()=>setNotes('changes')}>دیدن تغییرات</button>}</div>
      <p role="status" className="text-xs leading-6 mt-2" style={{color:'var(--ink-soft)'}}>{state==='latest'?'برنامه به‌روز است.':state==='available'?`نسخهٔ ${info?.latest?toFa(info.latest.version):'جدید'} آمادهٔ دریافت است.`:state==='error'?'بررسی یا دریافت انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.':''}</p>
    </>}
    <ReleaseNotesDialog open={notes!==null} onOpenChange={open=>{if(!open)setNotes(null)}} update={notes==='history'?history:info} history={notes==='history'} onUpdate={notes==='changes'&&state!=='latest'?()=>void refresh():undefined} busy={state==='refreshing'} error={notes==='changes'&&state==='error'}/>
  </section>
}
