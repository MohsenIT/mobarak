'use client'
import {t} from '@/lib/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { APP_RELEASES,CURRENT_RELEASE,NATIVE_RELEASES,appUpdateStatus,checkAppUpdate,checkNativeUpdate,type AppUpdate } from '@/lib/app-releases'
import ReleaseNotesDialog from './ReleaseNotesDialog'

export async function refreshApplication(onProgress?: (done:number,total:number)=>void) {
  const url = new URL(window.location.href)
  url.searchParams.set('_refresh', Date.now().toString())
  // Verify a fresh document is reachable before leaving a working offline reader.
  const response = await fetch(url.href, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Update unavailable')
  const html = await response.text()
  const document = new DOMParser().parseFromString(html, 'text/html')
  const assets = [...new Set([...document.querySelectorAll('script[src],link[rel=stylesheet][href],link[rel=modulepreload][href]')].map(node => new URL(node.getAttribute('src') || node.getAttribute('href')!, url)).filter(asset => asset.origin === url.origin && asset.pathname.startsWith('/_next/static/')).map(asset => asset.href))]
  let done = 1, cursor = 0
  const total = assets.length + 1
  onProgress?.(done,total)
  await Promise.all(Array.from({length:Math.min(4,assets.length)},async()=>{
    while(cursor < assets.length){
      const asset = assets[cursor++]
      const result = await fetch(asset,{signal:AbortSignal.timeout(15000)})
      if(!result.ok)throw new Error('Update asset unavailable')
      await result.arrayBuffer()
      onProgress?.(++done,total)
    }
  }))
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined)
    await registration?.update().catch(() => undefined)
  }
  window.location.replace(url.href)
}

const native = process.env.NEXT_PUBLIC_DESKTOP === '1'
const build = process.env.NEXT_PUBLIC_APP_VERSION
const nativeVersion = process.env.NEXT_PUBLIC_NATIVE_VERSION
export const installedVersion = native ? nativeVersion : CURRENT_RELEASE
const installedHistory: AppUpdate = { build: build || 'local', releases: APP_RELEASES, latest: APP_RELEASES[0] }

type CheckStatus = 'idle' | 'checking' | 'latest' | 'available' | 'unknown' | 'error' | 'offline'
export function useVersionCheck(enabled: boolean) {
  const [status, setStatus] = useState<CheckStatus>('idle')
  const [update, setUpdate] = useState<AppUpdate | null>(null)
  const request = useRef<AbortController | null>(null)
  const check = useCallback(async () => {
    request.current?.abort()
    if (!navigator.onLine) {
      request.current = null
      setStatus('offline')
      return
    }
    const controller = new AbortController()
    request.current = controller
    const timeout = window.setTimeout(() => controller.abort('timeout'), 10000)
    const { signal } = controller
    setStatus('checking')
    try {
      if (native) {
        const result = await checkNativeUpdate(nativeVersion ?? '', signal)
        if (!controller.signal.aborted) setStatus(result)
      } else {
        const info = await checkAppUpdate(signal)
        if (controller.signal.aborted) return
        setUpdate(info)
        setStatus(appUpdateStatus(info, build))
      }
    } catch {
      if (request.current === controller && (!signal.aborted || signal.reason === 'timeout')) setStatus(navigator.onLine ? 'error' : 'offline')
    } finally { window.clearTimeout(timeout) }
  }, [])
  useEffect(() => {
    if (!enabled) return
    void check()
    window.addEventListener('online', check)
    window.addEventListener('offline', check)
    return () => {
      request.current?.abort()
      request.current = null
      window.removeEventListener('online', check)
      window.removeEventListener('offline', check)
    }
  }, [check, enabled])
  return { status, update, check }
}

export default function UpdateSettings({ status, update, check }: ReturnType<typeof useVersionCheck>) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [notes, setNotes] = useState<'history' | 'changes' | null>(null)
  const refresh = async () => {
    setRefreshing(true)
    setRefreshFailed(false)
    try { await refreshApplication() }
    catch { setRefreshing(false); setRefreshFailed(true) }
  }
  const checking = status === 'checking'
  const available = status === 'available'
  return <section className="drawer-version-content">
    <p className="text-sm">{t('about.version', { version: installedVersion ?? t('about.unknownVersion') })}</p>
    {native && <p className="text-xs">{t('about.contentVersion', { version: CURRENT_RELEASE })}</p>}
    <button type="button" className="chip" onClick={() => setNotes('history')}>{t('ui.3a0967fbbe')}</button>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="chip inline-flex min-h-11 items-center gap-2" disabled={checking || refreshing} onClick={() => { setRefreshFailed(false); void check() }}>
        <RefreshCw size={16} className={checking ? 'animate-spin' : ''} aria-hidden="true" />{t(checking ? 'ui.25384e5227' : 'ui.20b05bf19a')}
      </button>
      {native ? <a className="chip inline-flex min-h-11 items-center" href={NATIVE_RELEASES} target="_blank" rel="noreferrer">{t('about.installers')}</a> : available && <>
        <button type="button" className="chip min-h-11" disabled={refreshing} onClick={() => void refresh()}>{t(refreshing ? 'ui.15f33a75a4' : 'ui.c5462f5130')}</button>
        <button type="button" className="chip min-h-11" onClick={() => setNotes('changes')}>{t('ui.3234f424d7')}</button>
      </>}
    </div>
    <p role="status" className="about-caption">
      {refreshFailed || status === 'error' ? t('ui.3da752b258') :
        status === 'offline' ? t('about.updateOffline') :
        status === 'unknown' ? t('about.updateUnknown') :
        status === 'latest' ? t('ui.e7ae3ec09b') :
        available ? t('about.updateAvailable') : ''}
    </p>
    <ReleaseNotesDialog open={notes !== null} onOpenChange={open => { if (!open) setNotes(null) }}
      update={notes === 'history' ? installedHistory : update} history={notes === 'history'}
      onUpdate={notes === 'changes' && available ? () => void refresh() : undefined}
      busy={refreshing} error={notes === 'changes' && refreshFailed} />
  </section>
}
