'use client'
import {t,useUiLanguage} from '@/lib/i18n'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { downloadOffline } from './OfflineSettings'
import { refreshApplication } from './UpdateSettings'
import ReleaseNotesDialog from './ReleaseNotesDialog'
import { checkAppUpdate,CURRENT_RELEASE,compareRelease,type AppUpdate } from '@/lib/app-releases'
import { toFa } from '@/lib/quran'
import { APP_NAME } from '@/lib/branding'
import { Download,X } from 'lucide-react'

export default function PwaRegistration() {
  const {language}=useUiLanguage()
  useEffect(()=>{
    if(process.env.NEXT_PUBLIC_DESKTOP==='1'||!('serviceWorker' in navigator))return
    let live=true
    void navigator.serviceWorker.ready.then(registration=>{
      if(!live)return
      const assets=performance.getEntriesByType('resource').map(entry=>entry.name).filter(value=>{try{const url=new URL(value);return url.origin===location.origin&&url.pathname.startsWith('/_next/static/')}catch{return false}})
      registration.active?.postMessage({type:'CACHE_READER',document:location.href,assets})
    })
    return()=>{live=false}
  },[language])
  const [available, setAvailable] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [progress,setProgress]=useState<number|null>(null)
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
      try { optional = [...JSON.parse(localStorage.getItem('offline-optional-books') || '[]'),...JSON.parse(localStorage.getItem('offline-optional-translations') || '[]')] } catch {}
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
  const refresh=async()=>{setRefreshing(true);setProgress(null);setUpdateError(false);try{await refreshApplication((done,total)=>setProgress(Math.round(done/total*100)))}catch{setRefreshing(false);setUpdateError(true)}}
  if (!available) return null
  return <><div ref={banner} className="app-update-notice" dir="rtl" role="status" aria-live="polite">
    <div className="app-update-title min-w-0"><div className="app-update-copy"><button type="button" className="app-update-version" aria-haspopup="dialog" aria-expanded={notesOpen} aria-label={t("ui.7aee767160")} onClick={()=>setNotesOpen(true)}>{t("ui.953819a315")}{' '}{update?.latest?toFa(update.latest.version):t("ui.7b2b35c950")}</button><span className="app-update-brand">{APP_NAME}</span><span className="app-update-arrival">{t("ui.5e29284308")}.</span></div>{updateError&&<small className="block">{t("ui.0f59a42726")}</small>}</div>
    <button type="button" className="app-update-button" disabled={refreshing} aria-busy={refreshing} aria-label={refreshing?t("ui.3c067a3db0"):t("ui.72eadf7b16")} onClick={()=>void refresh()}><Download size={14} aria-hidden="true"/>{refreshing?t("ui.14a687003e"):t("ui.72eadf7b16")}{refreshing&&progress!==null&&<span className="app-update-percent">{toFa(progress)}٪</span>}</button>
    <button type="button" className="app-update-later" disabled={refreshing} aria-label={t("ui.e862c63e41")} onClick={dismiss}><X size={14} aria-hidden="true"/></button>
    {refreshing&&<progress className="app-update-progress" max={100} value={progress??undefined} aria-label={t("ui.3c067a3db0")}/> }
  </div><ReleaseNotesDialog open={notesOpen} onOpenChange={setNotesOpen} update={update} onUpdate={()=>void refresh()} onLater={dismiss} busy={refreshing} error={updateError}/></>
}
