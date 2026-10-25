'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, SlidersHorizontal, X, Download, Check, LoaderCircle, Trash2 } from 'lucide-react'
import { useRecitationMediaSession } from './useRecitationMediaSession'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { SurahMeta } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { RECITER, nextRecitation, type PlaybackPosition } from '@/lib/recitation'
import { audioDownloadStatus, cleanAudioCache, deleteRecitation, downloadRecitation, getVerseAudio } from '@/lib/recitation-storage'

interface Props { open: boolean; surah: SurahMeta; startAyah: number; onClose: () => void; onFollow: (s: number, a: number) => void; selectedAyah?: number | null; onPlaying: (s: number,a: number) => void; onNextSurah: (s:number,a?:number) => void; previousSurahVerses?: number }
const initial = (ayah: number): PlaybackPosition => ({ ayah, verseRound: 1, surahRound: 1 })
const repeatOptions = [1,2,3,5,10,0]
export default function RecitationPlayer({ open, surah, startAyah, onClose, onFollow, selectedAyah, onPlaying, onNextSurah, previousSurahVerses }: Props) {
  const audio = useRef<HTMLAudioElement>(null)
  const [position, setPosition] = useState(() => initial(startAyah))
  const [positionSurah, setPositionSurah] = useState(surah.n)
  const pendingSurah = useRef<number | null>(null)
  const pendingAutoplay = useRef(true)
  const pendingAyah = useRef(1)
  const [settings, setSettings] = useState(false)
  const [verseRepeats, setVerseRepeats] = useState(1)
  const [surahRepeats, setSurahRepeats] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [follow, setFollow] = useState(true)
  const [background, setBackground] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [savedParts, setSavedParts] = useState(0)
  const [savedBytes, setSavedBytes] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const download = useRef<AbortController | null>(null)
  const intent = useRef(false)
  const source = useRef('')
  const current = useRef({ position, verseRepeats, surahRepeats, total: surah.vc, follow, onFollow, onPlaying, onNextSurah, surah: surah.n })
  current.current = { position, verseRepeats, surahRepeats, total: surah.vc, follow, onFollow, onPlaying, onNextSurah, surah: surah.n }
  const start = useRef(startAyah); start.current = startAyah
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('quran-recitation-settings') || '{}')
      if (repeatOptions.includes(saved.verseRepeats)) setVerseRepeats(saved.verseRepeats)
      if (repeatOptions.includes(saved.surahRepeats)) setSurahRepeats(saved.surahRepeats)
      if ([0.75,1,1.25,1.5,2].includes(saved.speed)) setSpeed(saved.speed)
      if (typeof saved.follow === 'boolean') setFollow(saved.follow)
      if (typeof saved.background === 'boolean') setBackground(saved.background)
    } catch {}
    void cleanAudioCache().catch(() => {})
    return () => download.current?.abort()
  }, [])
  const saveSetting = (key: string, value: number | boolean) => {
    try { const saved = JSON.parse(localStorage.getItem('quran-recitation-settings') || '{}'); localStorage.setItem('quran-recitation-settings', JSON.stringify({ ...saved, [key]: value })) } catch {}
  }
  useEffect(() => { if (audio.current) audio.current.playbackRate = speed }, [speed])
  useEffect(() => {
    const continuing=open && pendingSurah.current===surah.n
    intent.current=continuing && pendingAutoplay.current && (background || !document.hidden);pendingSurah.current=null; audio.current?.pause(); setPlaying(false); setSettings(false); setError(''); setNotice('')
    setPosition(initial(continuing?pendingAyah.current:Math.max(1, Math.min(surah.vc, start.current))))
    setPositionSurah(surah.n)
    download.current?.abort(); download.current = null; setProgress(null); setDownloaded(false); setSavedParts(0); setSavedBytes(0)
    if (open) {
      let live = true
      audioDownloadStatus(surah.n,surah.vc).then(value => { if (live) { setDownloaded(value.complete);setSavedParts(value.count);setSavedBytes(value.bytes) } }).catch(() => {})
      return () => { live = false }
    }
  }, [open, surah.n, surah.vc])

  useEffect(() => {
    const element = audio.current
    if (!element || !open || positionSurah!==surah.n) return
    const controller = new AbortController()
    setReady(false); setError(''); element.pause(); setPlaying(false)
    let objectUrl = ''
    getVerseAudio(surah.n,position.ayah,controller.signal).then(result => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(result.blob); source.current = objectUrl
      element.src = objectUrl; element.playbackRate = currentSpeed.current; setReady(true)
      if (!result.saved) setNotice('فضای ذخیره‌سازی در دسترس نیست؛ کش این آیه ذخیره نشد.')
      if (intent.current) void element.play().catch(() => { if (!controller.signal.aborted) { intent.current = false; setError('برای ادامه، پخش را بزنید.') } })
    }).catch(() => {
      if (!controller.signal.aborted) { intent.current = false; setError('صوت دریافت نشد؛ اتصال اینترنت را بررسی و دوباره امتحان کنید.') }
    })
    return () => { controller.abort(); element.pause(); element.removeAttribute('src'); element.load(); if (objectUrl) URL.revokeObjectURL(objectUrl); source.current = '' }
  }, [open, surah.n, positionSurah, position.ayah, retry])
  const currentSpeed = useRef(speed); currentSpeed.current = speed
  // Same verse repeats do not reload or download its audio.
  const ended = () => {
    if(!background && document.hidden){intent.current=false;setPlaying(false);return}
    const c = current.current
    const next = nextRecitation(c.position,c.total,c.verseRepeats,c.surahRepeats)
    if (!next) {
      if(c.surah<114){pendingAyah.current=1;pendingAutoplay.current=true;pendingSurah.current=c.surah+1;intent.current=true;setReady(false);c.onNextSurah(c.surah+1)}
      else {intent.current=false;setPlaying(false)}
      return
    }
    setPosition(next)
    if (next.ayah === c.position.ayah && audio.current) {
      audio.current.currentTime = 0
      void audio.current.play().catch(() => { intent.current = false; setError('برای ادامه، پخش را بزنید.') })
    }
  }
  const toggle = () => {
    const element = audio.current
    if (!element || !ready) return
    if (!element.paused) { intent.current = false; element.pause(); return }
    intent.current = true; setError('')
    const target=selectedAyah && selectedAyah>=1 && selectedAyah<=surah.vc?selectedAyah:position.ayah
    onPlaying(surah.n,target)
    if(target!==position.ayah){setPosition(initial(target));return}
    if (element.ended) { element.currentTime = 0; setPosition(initial(position.ayah)) }
    void element.play().catch(() => { intent.current = false; setError('پخش ممکن نشد؛ دوباره امتحان کنید.') })
  }
  const move = (a: number) => {
    if (a < 1 || a > surah.vc) return
    setPosition(initial(a));onPlaying(surah.n,a)
    if (follow) onFollow(surah.n,a)
    if (a === position.ayah && audio.current) audio.current.currentTime = 0
  }
  const pause = () => { intent.current=false;audio.current?.pause() }
  const resume = () => {
    if(!background && document.hidden)return
    intent.current=true;setError('')
    if(audio.current?.ended){audio.current.currentTime=0;setPosition(initial(position.ayah))}
    if(ready && audio.current)void audio.current.play().catch(()=>{intent.current=false;setError('برای ادامه، پخش را بزنید.')})
  }
  const skipNext = () => {
    if(position.ayah<surah.vc)move(position.ayah+1)
    else if(surah.n<114){pendingAyah.current=1;pendingAutoplay.current=intent.current;pendingSurah.current=surah.n+1;setReady(false);onNextSurah(surah.n+1)}
  }
  const skipPrevious = () => {
    if(position.ayah>1)move(position.ayah-1)
    else if(surah.n>1 && previousSurahVerses){pendingAyah.current=previousSurahVerses;pendingAutoplay.current=intent.current;pendingSurah.current=surah.n-1;setReady(false);onNextSurah(surah.n-1,previousSurahVerses)}
  }
  useEffect(()=>{
    const visibility=()=>{if(!background && document.hidden){intent.current=false;audio.current?.pause()}}
    document.addEventListener('visibilitychange',visibility);visibility()
    return()=>document.removeEventListener('visibilitychange',visibility)
  },[background])
  useRecitationMediaSession({audio,active:open,playing,title:`سورهٔ ${surah.fa} · آیهٔ ${toFa(position.ayah)}`,artist:RECITER.name,
    onPlay:resume,onPause:pause,onNext:skipNext,onPrevious:skipPrevious,onStop:()=>{pause();onClose()}})
  const startDownload = async () => {
    const controller = new AbortController(); download.current = controller; setProgress(0); setError('')
    try {
      await downloadRecitation(surah.n,surah.vc,controller.signal,setProgress)
      if (!controller.signal.aborted) { setDownloaded(true); setNotice('صوت این سوره برای استفادهٔ آفلاین ذخیره شد.') }
    } catch { if (!controller.signal.aborted) setError('دانلود کامل نشد؛ اتصال یا فضای خالی را بررسی کنید. با تلاش دوباره از ادامه دریافت می‌شود.') }
    finally { if (download.current === controller) { download.current = null; setProgress(null); void audioDownloadStatus(surah.n,surah.vc).then(value=>{setDownloaded(value.complete);setSavedParts(value.count);setSavedBytes(value.bytes)}).catch(()=>{}) } }
  }
  return <>
    <audio ref={audio} preload="none" onEnded={ended} onPlay={() => {
      if(!background && document.hidden){intent.current=false;audio.current?.pause();return}
      setPlaying(true)
      const c=current.current;c.onPlaying(c.surah,c.position.ayah); if(c.follow) c.onFollow(c.surah,c.position.ayah)
    }} onPause={() => setPlaying(false)} onError={() => { if(source.current) { intent.current=false;setPlaying(false);setError('فایل صوتی قابل پخش نیست؛ دوباره امتحان کنید.') } }} />

    {open && <div className="recitation-bar" role="region" aria-label="پخش تلاوت">
      <button type="button" className="recitation-location" onClick={() => onFollow(surah.n,position.ayah)} title="رفتن به آیهٔ در حال پخش">{surah.fa} · آیهٔ {toFa(position.ayah)}<small>{RECITER.name}</small></button>
      <div className="recitation-controls" dir="ltr">
        <button type="button" className="icon-btn sm" aria-label="آیهٔ قبلی" disabled={position.ayah<=1 && surah.n===1} onClick={skipPrevious}><SkipBack size={17} /></button>
        <button type="button" className="icon-btn sm recitation-play" aria-label={playing?'مکث تلاوت':'پخش تلاوت'} disabled={!ready} onClick={toggle}>{!ready&&!error?<LoaderCircle size={19} className="animate-spin" />:playing?<Pause size={19}/>:<Play size={19}/>}</button>
        <button type="button" className="icon-btn sm" aria-label="آیهٔ بعدی" disabled={position.ayah>=surah.vc && surah.n===114} onClick={skipNext}><SkipForward size={17}/></button>
      </div>
      <button type="button" className="icon-btn sm" aria-label="تنظیمات تلاوت و دانلود" onClick={() => setSettings(true)}><SlidersHorizontal size={18}/></button>
      <button type="button" className="icon-btn sm" aria-label="بستن پخش تلاوت" onClick={() => { intent.current=false;audio.current?.pause();onClose() }}><X size={18}/></button>
      {error && <div className="recitation-error" role="status">{error} <button type="button" onClick={() => { intent.current=false;setRetry(v=>v+1) }}>تلاش دوباره</button></div>}
    </div>}
    <Dialog open={open&&settings} onOpenChange={setSettings}><DialogContent className="recitation-settings" dir="rtl">
      <DialogHeader><DialogTitle>تلاوت {surah.fa}</DialogTitle><DialogDescription>{RECITER.name} · ترتیل</DialogDescription></DialogHeader>
      <label>شروع از آیه<select aria-label="شروع از آیه" value={position.ayah} onChange={e=>move(Number(e.target.value))}>{Array.from({length:surah.vc},(_,i)=><option key={i+1} value={i+1}>{toFa(i+1)}</option>)}</select></label>
      <label>سرعت پخش<select aria-label="سرعت پخش" value={speed} onChange={e=>{const n=Number(e.target.value);setSpeed(n);saveSetting('speed',n)}}>{[0.75,1,1.25,1.5,2].map(n=><option key={n} value={n}>{toFa(n)}×</option>)}</select></label>
      <label>تکرار هر آیه<select aria-label="تکرار هر آیه" value={verseRepeats} onChange={e=>{const n=Number(e.target.value);setVerseRepeats(n);saveSetting('verseRepeats',n)}}>{repeatOptions.map(n=><option key={n} value={n}>{n?`${toFa(n)} بار`:'تا توقف'}</option>)}</select></label>
      <label>تکرار کل سوره<select aria-label="تکرار کل سوره" value={surahRepeats} onChange={e=>{const n=Number(e.target.value);setSurahRepeats(n);saveSetting('surahRepeats',n)}}>{repeatOptions.map(n=><option key={n} value={n}>{n?`${toFa(n)} بار`:'تا توقف'}</option>)}</select></label>
      <label className="recitation-follow"><input type="checkbox" checked={follow} onChange={e=>{setFollow(e.target.checked);saveSetting('follow',e.target.checked)}}/>دنبال‌کردن آیه روی صفحه</label>
      <label className="recitation-follow"><input type="checkbox" checked={background} onChange={e=>{setBackground(e.target.checked);saveSetting('background',e.target.checked)}}/>ادامهٔ پخش در پس‌زمینه</label>
      <div className="recitation-download">
        {savedParts>0&&<small>{toFa(savedParts)} آیه ذخیره‌شده · {toFa(Math.round(savedBytes/1024/1024*10)/10)} مگابایت</small>}
        {progress!==null?<><p role="status">دریافت آیهٔ {toFa(progress)} از {toFa(surah.vc)}</p><progress value={progress} max={surah.vc}/><button type="button" className="chip" onClick={()=>download.current?.abort()}>توقف دانلود</button></>:downloaded?<><p><Check size={16}/>آمادهٔ پخش آفلاین</p></>:<button type="button" className="chip" onClick={()=>void startDownload()}><Download size={16}/>دانلود صوت این سوره</button>}
        {savedParts>0&&progress===null&&<button type="button" className="chip" onClick={()=>void deleteRecitation(surah.n).then(()=>{setDownloaded(false);setSavedParts(0);setSavedBytes(0)}).catch(()=>setError('حذف صوت ممکن نشد.'))}><Trash2 size={15}/>حذف صوت ذخیره‌شدهٔ این سوره</button>}
        <small>آیات پخش‌شده تا ۷ روز، حداکثر ۴۰ مگابایت کش می‌شوند. دانلود کامل سوره جدا نگه داشته می‌شود؛ پاک‌کردن داده‌های برنامه آن را هم حذف می‌کند.</small>
        {notice&&<p role="status">{notice}</p>}
      </div>
      <a href="https://quran.com/" target="_blank" rel="noreferrer" className="recitation-source">منبع صوت: Quran.com</a>
    </DialogContent></Dialog>
  </>
}
