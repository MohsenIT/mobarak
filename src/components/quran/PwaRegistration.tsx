'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { downloadOffline } from './OfflineSettings'
import { refreshApplication } from './UpdateSettings'
import ReleaseNotesDialog from './ReleaseNotesDialog'
import { checkAppUpdate,CURRENT_RELEASE,compareRelease,type AppUpdate } from '@/lib/app-releases'
import { toFa } from '@/lib/quran'
import { RefreshCw } from 'lucide-react'

export default function PwaRegistration() {
  const [available, setAvailable] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [updateError, setUpdateError] = useState(false)
  const [update,setUpdate]=useState<AppUpdate|null>(null)
  const [notesOpen,setNotesOpen]=useState(false)
  const dismissed = useRef<string | null>(null)
  const banner=useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    const element=banner.current
    if(!available||!element)return
    const root=document.documentElement
    const measure=()=>{root.style.setProperty('--app-update-height',`${element.getBoundingClientRect().height}px`);root.dataset.appUpdate='true'}
    const observer=new ResizeObserver(measure);observer.observe(element);measure()
    return()=>{observer.disconnect();root.style.removeProperty('--app-update-height');delete root.dataset.appUpdate}
  },[available])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DESKTOP === '1') return
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Reading remains available when the browser disables installation support.
    })
    const download = () => {
      let optional: string[] = []
      try { optional = JSON.parse(localStorage.getItem('offline-optional-books') || '[]') } catch {}
      void downloadOffline(['core', 'tahqiq', ...optional]).catch(() => {})
    }
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(download)
    window.addEventListener('online', download)
    let live = true
    let pending = false
    const controller = new AbortController()
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const info=await checkAppUpdate(controller.signal)
        if(!live)return
        if(info.latest&&compareRelease(info.latest.version,CURRENT_RELEASE)<0){setAvailable(null);setNotesOpen(false);setUpdate(null);return}
        if(live&&info.build!==process.env.NEXT_PUBLIC_APP_VERSION&&info.build!==dismissed.current){setUpdate(info);setAvailable(info.build)}
      } catch {
        // Offline reading should not be interrupted by update checks.
      } finally { pending = false }
    }
    void check()
    const timer = setInterval(check, 60_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('online', download)
      live = false; controller.abort(); clearInterval(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  const dismiss=()=>{dismissed.current=available;setAvailable(null);setNotesOpen(false)}
  const refresh=async()=>{setRefreshing(true);setUpdateError(false);try{await refreshApplication()}catch{setRefreshing(false);setUpdateError(true)}}
  if (!available) return null
  return <><div ref={banner} className="app-update-notice" role="status" aria-live="polite">
    <div className="app-update-title flex-1 min-w-0"><button type="button" className="app-update-version" aria-haspopup="dialog" aria-expanded={notesOpen} aria-label="دیدن تغییرات نسخهٔ جدید" onClick={()=>setNotesOpen(true)}>نسخهٔ {update?.latest?toFa(update.latest.version):'جدید'}</button> رسید{updateError&&<small className="block">دریافت انجام نشد؛ دوباره تلاش کنید.</small>}</div>
    <button type="button" className="app-update-button" disabled={refreshing} aria-busy={refreshing} aria-label={refreshing?'در حال به‌روزرسانی':'به‌روزرسانی'} onClick={()=>void refresh()}><RefreshCw size={14} aria-hidden="true" className={refreshing?'app-update-spinner':undefined}/>{refreshing?'دریافت…':'به‌روزرسانی'}</button>
    <button type="button" className="app-update-later" disabled={refreshing} aria-label="بستن اعلان به‌روزرسانی" onClick={dismiss}>×</button>
  </div><ReleaseNotesDialog open={notesOpen} onOpenChange={setNotesOpen} update={update} onUpdate={()=>void refresh()} onLater={dismiss} busy={refreshing} error={updateError}/></>
}
