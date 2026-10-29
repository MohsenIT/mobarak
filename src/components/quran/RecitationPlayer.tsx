'use client'
import {t,uiDirection} from '@/lib/i18n'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, SlidersHorizontal, X, Download, Check, LoaderCircle, Trash2 } from 'lucide-react'
import CarStudyControls from './CarStudyControls'
import ResourcePicker from './ResourcePicker'
import {NativeRecitationAudio,nativeRecitationAvailable,cacheNativeVerse,nativeCommand,subscribeNativePlaybackState,type CarOptions} from '@/lib/native-recitation'
import { useRecitationMediaSession } from './useRecitationMediaSession'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { SurahMeta } from '@/lib/quran'
import { toFa } from '@/lib/quran'
import { RECITER, RECITERS, AUDIO_TRANSLATIONS, nextRecitation, type PlaybackPosition } from '@/lib/recitation'
import { audioDownloadStatus, cleanAudioCache, deleteRecitation, downloadRecitation, getVerseAudio } from '@/lib/recitation-storage'

export type RecitationTransportStatus='idle'|'loading'|'playing'|'paused'|'error'
interface Props { onNativeActive?:(s:number,a:number)=>void;playRequest?:number;onStatusChange?:(status:RecitationTransportStatus)=>void;controlsVisible?: boolean; open: boolean; surah: SurahMeta; startAyah: number; onClose: () => void; onFollow: (s: number, a: number) => void; selectedAyah?: number | null; onPlaying: (s: number,a: number) => void; onNextSurah: (s:number,a?:number) => void; previousSurahVerses?: number }
const initial = (ayah: number): PlaybackPosition => ({ ayah, verseRound: 1, surahRound: 1 })
const repeatOptions = [1,2,3,5,10,0]
export default function RecitationPlayer({ onNativeActive,playRequest=0,onStatusChange,controlsVisible=true, open, surah, startAyah, onClose, onFollow, selectedAyah, onPlaying, onNextSurah, previousSurahVerses }: Props) {
  const audio = useRef<HTMLAudioElement|null>(null)
  const nativeAudio=useRef<NativeRecitationAudio|null>(null)
  const nativeOptions=useRef<CarOptions|null>(null)
  const nativeAdopting=useRef<{r:string;s:number;a:number}|null>(null)
  const nativePositionCallback=useRef<(p:{r:string;s:number;a:number},state:{playing:boolean;speed:number})=>void>(()=>{})
  const attachAudio=useCallback((element:HTMLAudioElement|null)=>{
    nativeAudio.current?.dispose();nativeAudio.current=null
    if(element&&nativeRecitationAvailable())nativeAudio.current=new NativeRecitationAudio(element,(p,state)=>nativePositionCallback.current(p,state))
    audio.current=nativeAudio.current?(nativeAudio.current as unknown as HTMLAudioElement):element
  },[])
  const [reciterId,setReciterId]=useState<string>(RECITER.id)
  const [translationId,setTranslationId]=useState(''),[translationPhase,setTranslationPhase]=useState(false)
  const translation=AUDIO_TRANSLATIONS.find(item=>item.id===translationId)
  const reciter=RECITERS.find(item=>item.id===reciterId)??RECITER
  const activeAudio=useRef({s:surah.n,id:reciter.id});activeAudio.current={s:surah.n,id:reciter.id}
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
  const transportStatus:RecitationTransportStatus=!open?'idle':error?'error':!ready?'loading':playing?'playing':'paused'
  useEffect(()=>{onStatusChange?.(transportStatus)},[transportStatus,onStatusChange])
  const lastPlayRequest=useRef(playRequest)
  const [downloaded, setDownloaded] = useState(false)
  const [savedParts, setSavedParts] = useState(0)
  const [savedBytes, setSavedBytes] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const download = useRef<AbortController | null>(null)
  const intent = useRef(false)
  const wasOpen = useRef(false)
  const source = useRef('')
  const current = useRef({ position, verseRepeats, surahRepeats, total: surah.vc, follow, onFollow, onPlaying, onNextSurah, surah: surah.n })
  current.current = { position, verseRepeats, surahRepeats, total: surah.vc, follow, onFollow, onPlaying, onNextSurah, surah: surah.n }
  nativePositionCallback.current=(p,state)=>{
    setReciterId(p.r);setSpeed(state.speed)
    if(p.s===current.current.surah){setPosition(old=>old.ayah===p.a?old:initial(p.a));setPositionSurah(p.s)}
    else current.current.onNextSurah(p.s,p.a)
    if(state.playing){current.current.onPlaying(p.s,p.a);if(current.current.follow)current.current.onFollow(p.s,p.a)}
    if(state.playing&&!open)onNativeActive?.(p.s,p.a)
  }
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
      if(RECITERS.some(item=>item.id===saved.reciter))setReciterId(saved.reciter)
      if(!nativeRecitationAvailable()&&AUDIO_TRANSLATIONS.some(item=>item.id===saved.translationAudio))setTranslationId(saved.translationAudio)
    } catch {}
    void cleanAudioCache().catch(() => {})
    return () => download.current?.abort()
  }, [])
  const saveSetting = (key: string, value: number | boolean | string) => {
    try { const saved = JSON.parse(localStorage.getItem('quran-recitation-settings') || '{}'); localStorage.setItem('quran-recitation-settings', JSON.stringify({ ...saved, [key]: value })) } catch {}
  }
  useEffect(()=>subscribeNativePlaybackState(state=>{
    if(!state.options)return
    nativeOptions.current=state.options
    setTranslationId(state.options.translationAudio);setSpeed(state.options.speed);setVerseRepeats(state.options.verse);setSurahRepeats(state.options.surah)
  }),[])
  useEffect(() => { if(nativeAudio.current&&(!nativeOptions.current||nativeOptions.current.speed===speed))return;if (audio.current) audio.current.playbackRate = speed }, [speed])
  useEffect(() => {
    const starting=open && !wasOpen.current
    wasOpen.current=open
    const continuing=open && pendingSurah.current===surah.n
    if(nativeAudio.current?.state.item&&open&&(!starting||nativeAudio.current.state.playing)){
      const item=nativeAudio.current.state.item.split('/')
      if(Number(item[2])===surah.n||starting&&nativeAudio.current.state.playing){if(starting&&nativeAudio.current.state.playing)nativeAdopting.current={r:item[1],s:Number(item[2]),a:Number(item[3])};intent.current=nativeAudio.current.state.playWhenReady;setPosition(initial(Number(item[3])));setPositionSurah(Number(item[2]));return}
    }
    if(open)nativeAudio.current?.expect({r:reciter.id,s:surah.n,a:continuing?pendingAyah.current:Math.max(1,Math.min(surah.vc,start.current))})
    intent.current=(starting || continuing && pendingAutoplay.current) && (background || !document.hidden);pendingSurah.current=null;if(!nativeAudio.current||!open)audio.current?.pause();setPlaying(false); setSettings(false); setError(''); setNotice('')
    setPosition(initial(continuing?pendingAyah.current:Math.max(1, Math.min(surah.vc, start.current))))
    setPositionSurah(surah.n);setTranslationPhase(false)
    download.current?.abort(); download.current = null; setProgress(null); setDownloaded(false); setSavedParts(0); setSavedBytes(0)
  }, [open, surah.n, surah.vc])
  useEffect(()=>{
    download.current?.abort();download.current=null;setProgress(null);setDownloaded(false);setSavedParts(0);setSavedBytes(0);setNotice('')
    if(!open)return
    let live=true
    audioDownloadStatus(surah.n,surah.vc,reciter).then(value=>{if(live){setDownloaded(value.complete);setSavedParts(value.count);setSavedBytes(value.bytes)}}).catch(()=>{})
    return()=>{live=false;download.current?.abort()}
  },[open,surah.n,surah.vc,reciter.id])

  useEffect(() => {
    const element = audio.current
    if (!element || !open || positionSurah!==surah.n) return
    const controller = new AbortController()
    const native=nativeAudio.current
    if(native){
      const target={r:reciter.id,s:surah.n,a:position.ayah}
      if(nativeAdopting.current){const p=nativeAdopting.current;if(p.r!==target.r||p.s!==target.s||p.a!==target.a)return;nativeAdopting.current=null}
      source.current='native'
      if(native.matches(target)){setReady(native.state.ready);return}
      native.expect(target);setReady(false);setError('')
      getVerseAudio(surah.n,position.ayah,controller.signal,false,reciter).then(async result=>{
        if(!controller.signal.aborted)await native.prepare(result.blob,target,()=>intent.current,verseRepeats,surahRepeats,controller.signal)
      }).catch(()=>{if(!controller.signal.aborted){intent.current=false;setError(t("ui.823d089129"))}})
      return()=>{controller.abort();native.cancel(target)}
    }
    setReady(false); setError(''); element.pause(); setPlaying(false)
    let objectUrl = ''
    getVerseAudio(surah.n,position.ayah,controller.signal,false,translationPhase&&translation?translation:reciter).then(result => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(result.blob); source.current = objectUrl
      element.src = objectUrl; element.playbackRate = currentSpeed.current; setReady(true)
      if (!result.saved) setNotice(t("ui.dfc48e5fbf"))
      if (intent.current) void element.play().catch(() => { if (!controller.signal.aborted) { intent.current = false; setError(t("ui.4a08c7828a")) } })
    }).catch(() => {
      if (!controller.signal.aborted) { intent.current = false; setError(t("ui.823d089129")) }
    })
    return () => { controller.abort(); element.pause(); element.removeAttribute('src'); element.load(); if (objectUrl) URL.revokeObjectURL(objectUrl); source.current = '' }
  }, [open, surah.n, positionSurah, position.ayah, retry,reciter.id,translationId,translationPhase])
  const currentSpeed = useRef(speed); currentSpeed.current = speed
  // Same verse repeats do not reload or download its audio.
  useEffect(()=>{const o=nativeOptions.current;if(o&&(o.verse!==verseRepeats||o.surah!==surahRepeats))nativeAudio.current?.configure(verseRepeats,surahRepeats)},[verseRepeats,surahRepeats])
  const ended = () => {
    if(nativeAudio.current)return
    if(!background && document.hidden){intent.current=false;setPlaying(false);return}
    if(translation&&!translationPhase){setTranslationPhase(true);return}
    if(translationPhase)setTranslationPhase(false)
    const c = current.current
    const next = nextRecitation(c.position,c.total,c.verseRepeats,c.surahRepeats)
    if (!next) {
      if(c.surah<114){pendingAyah.current=1;pendingAutoplay.current=true;pendingSurah.current=c.surah+1;intent.current=true;setReady(false);c.onNextSurah(c.surah+1)}
      else {intent.current=false;setPlaying(false)}
      return
    }
    setPosition(next)
    if (!translation&&next.ayah === c.position.ayah && audio.current) {
      audio.current.currentTime = 0
      void audio.current.play().catch(() => { intent.current = false; setError(t("ui.4a08c7828a")) })
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
    void element.play().catch(() => { intent.current = false; setError(t("ui.e3832a276d")) })
  }
  const move = (a: number) => {
    if (a < 1 || a > surah.vc) return
    setTranslationPhase(false);setPosition(initial(a));onPlaying(surah.n,a)
    if (follow) onFollow(surah.n,a)
    if (a === position.ayah && audio.current) audio.current.currentTime = 0
  }
  const pause = () => { intent.current=false;audio.current?.pause() }
  const resume = () => {
    if(!background && document.hidden)return
    intent.current=true;setError('')
    if(audio.current?.ended){audio.current.currentTime=0;setPosition(initial(position.ayah))}
    if(ready && audio.current)void audio.current.play().catch(()=>{intent.current=false;setError(t("ui.4a08c7828a"))})
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
  useEffect(()=>{
    if(lastPlayRequest.current===playRequest)return
    lastPlayRequest.current=playRequest
    if(!open)return
    if(!ready||error){intent.current=true;setError('');setRetry(value=>value+1)}
    else if(audio.current?.paused)toggle()
  },[playRequest,open,ready,error])
  useRecitationMediaSession({audio,active:open,playing,title:t("ui.cb282cb444",{p0:(surah.fa),p1:(toFa(position.ayah))}),artist:reciter.name,
    surah:surah.n,onPlay:resume,onPause:pause,onNext:skipNext,onPrevious:skipPrevious,onStop:()=>{pause();onClose()}})
  const startDownload = async () => {
    const controller = new AbortController(); download.current = controller; setProgress(0); setError('')
    try {
      await downloadRecitation(surah.n,surah.vc,controller.signal,setProgress,reciter)
      if(nativeAudio.current&&!controller.signal.aborted){
        for(let a=1;a<=surah.vc;a++){
          if(controller.signal.aborted)break
          const cached=await getVerseAudio(surah.n,a,controller.signal,false,reciter)
          await cacheNativeVerse(cached.blob,{r:reciter.id,s:surah.n,a},true)
        }
      }
      if (!controller.signal.aborted) { setDownloaded(true); setNotice(t("ui.f77fdf433a")) }
    } catch { if (!controller.signal.aborted) setError(t("ui.3d82b884ee")) }
    finally { if (download.current === controller) { download.current = null; setProgress(null); void audioDownloadStatus(surah.n,surah.vc,reciter).then(value=>{if(activeAudio.current.s!==surah.n||activeAudio.current.id!==reciter.id)return;setDownloaded(value.complete);setSavedParts(value.count);setSavedBytes(value.bytes)}).catch(()=>{}) } }
  }
  return <>
    <audio ref={attachAudio} preload="none" onCanPlay={()=>setReady(true)} onLoadStart={()=>setReady(false)} onRateChange={()=>{if(nativeAudio.current)setSpeed(nativeAudio.current.playbackRate)}} onEnded={ended} onPlay={() => {
      if(!background && document.hidden){intent.current=false;audio.current?.pause();return}
      setPlaying(true)
      if(nativeAudio.current){intent.current=nativeAudio.current.state.playWhenReady;return}
      const c=current.current;c.onPlaying(c.surah,c.position.ayah);if(c.follow)c.onFollow(c.surah,c.position.ayah)
    }} onPause={() => {setPlaying(false);if(nativeAudio.current&&!nativeAudio.current.state.playWhenReady)intent.current=false}} onError={() => { if(source.current) { intent.current=false;setPlaying(false);setError(t("ui.69833552b5")) } }} />

    {open && controlsVisible && <div className="recitation-bar" role="region" aria-label={t("ui.1f7cc9473a")}>
      <button type="button" className="recitation-location" onClick={() => onFollow(surah.n,position.ayah)} title={t("ui.edcffc5849")}>{surah.fa}{' '}{t("ui.f922b82cb1")}{' '}{toFa(position.ayah)}<small>{reciter.name}</small></button>
      <div className="recitation-controls" dir="ltr">
        <button type="button" className="icon-btn sm" aria-label={t("ui.a8ca409b79")} disabled={position.ayah<=1 && surah.n===1} onClick={skipPrevious}><SkipBack size={17} /></button>
        <button type="button" className="icon-btn sm recitation-play" aria-label={playing?t("ui.fe2e1906b8"):t("ui.1f7cc9473a")} disabled={!ready} onClick={toggle}>{!ready&&!error?<LoaderCircle size={19} className="animate-spin" />:playing?<Pause size={19}/>:<Play size={19}/>}</button>
        <button type="button" className="icon-btn sm" aria-label={t("ui.add1e314a2")} disabled={position.ayah>=surah.vc && surah.n===114} onClick={skipNext}><SkipForward size={17}/></button>
      </div>
      <button type="button" className="icon-btn sm" aria-label={t("ui.d2ac810b00")} onClick={() => setSettings(true)}><SlidersHorizontal size={18}/></button>
      <button type="button" className="icon-btn sm" aria-label={t("ui.2c65036980")} onClick={() => { intent.current=false;audio.current?.pause();onClose() }}><X size={18}/></button>
      {error && <div className="recitation-error" role="status">{error} <button type="button" onClick={() => { intent.current=false;setRetry(v=>v+1) }}>{t("ui.be9b8b4f2b")}</button></div>}
    </div>}
    <Dialog open={open&&settings} onOpenChange={setSettings}><DialogContent className="recitation-settings" dir={uiDirection()}>
      <DialogHeader><DialogTitle>{t("ui.2ea8f68e72")}{' '}{surah.fa}</DialogTitle><DialogDescription>{reciter.name}{' '}{t("ui.328fa816d6")}</DialogDescription></DialogHeader>
      <div><span className="text-xs">{t("ui.48288575ed")}</span><ResourcePicker label={t("ui.48288575ed")} ids={RECITERS.map(item=>`reciter:${item.id}`)} value={`reciter:${reciter.id}`} onChange={id=>{const value=id.replace(/^reciter:/,'');setTranslationPhase(false);setReciterId(value);saveSetting('reciter',value)}}/></div>
      <label>{t('auto.setting_translation')}<select aria-label={t('auto.setting_translation')} value={translationId||'off'} onChange={e=>{
        const id=e.target.value==='off'?'':e.target.value;setTranslationPhase(false);setTranslationId(id);saveSetting('translationAudio',id)
        if(nativeAudio.current)void nativeCommand({op:'carOption',key:'translation',value:id||'off'}).catch(()=>setError(t('auto.actionFailed')))
      }}><option value="off">{t('auto.off')}</option>{AUDIO_TRANSLATIONS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!nativeRecitationAvailable()&&translation&&<div><p className="text-xs leading-6">{t('auto.translationHint')}</p><button type="button" className="chip" disabled={progress!==null} onClick={()=>void(async()=>{
        const controller=new AbortController();download.current=controller;setProgress(0)
        try{await downloadRecitation(surah.n,surah.vc,controller.signal,setProgress,translation);setNotice(t('ui.026091c23f'))}catch{if(!controller.signal.aborted)setError(t('ui.3d82b884ee'))}finally{if(download.current===controller){download.current=null;setProgress(null)}}
      })()}>{t('auto.downloadTranslation')}</button></div>}
      <label>{t("ui.1dde68b6a8")}<select aria-label={t("ui.1dde68b6a8")} value={position.ayah} onChange={e=>move(Number(e.target.value))}>{Array.from({length:surah.vc},(_,i)=><option key={i+1} value={i+1}>{toFa(i+1)}</option>)}</select></label>
      <label>{t("ui.991d782fda")}<select aria-label={t("ui.991d782fda")} value={speed} onChange={e=>{const n=Number(e.target.value);setSpeed(n);saveSetting('speed',n)}}>{[0.75,1,1.25,1.5,2].map(n=><option key={n} value={n}>{n===1?t('auto.normalSpeed'):`${toFa(n)}×`}</option>)}</select></label>
      <label>{t("ui.9645b5c54f")}<select aria-label={t("ui.9645b5c54f")} value={verseRepeats} onChange={e=>{const n=Number(e.target.value);setVerseRepeats(n);saveSetting('verseRepeats',n)}}>{repeatOptions.map(n=><option key={n} value={n}>{n===1?t('auto.noRepeat'):n===0?t('auto.forever'):t("ui.d303a8c08f",{p0:(toFa(n))})}</option>)}</select></label>
      <label>{t("ui.2cfa25518d")}<select aria-label={t("ui.2cfa25518d")} value={surahRepeats} onChange={e=>{const n=Number(e.target.value);setSurahRepeats(n);saveSetting('surahRepeats',n)}}>{repeatOptions.map(n=><option key={n} value={n}>{n===1?t('auto.noRepeat'):n===0?t('auto.forever'):t("ui.d303a8c08f",{p0:(toFa(n))})}</option>)}</select></label>
      <label className="recitation-follow choice-row"><input type="checkbox" checked={follow} onChange={e=>{setFollow(e.target.checked);saveSetting('follow',e.target.checked)}}/>{t("ui.e3bdacb9c9")}</label>
      <label className="recitation-follow choice-row"><input type="checkbox" checked={background} onChange={e=>{setBackground(e.target.checked);saveSetting('background',e.target.checked)}}/>{t("ui.f357dd405c")}</label>
      <div className="recitation-download">
        {savedParts>0&&<small>{toFa(savedParts)}{' '}{t("ui.e1448c3b31")}{' '}{toFa(Math.round(savedBytes/1024/1024*10)/10)}{' '}{t("ui.9a29784b98")}</small>}
        {progress!==null?<><p role="status">{t("ui.0c77df7fdd")}{' '}{toFa(progress)}{' '}{t("ui.77e7a9224b")}{' '}{toFa(surah.vc)}</p><progress value={progress} max={surah.vc}/><button type="button" className="chip" onClick={()=>download.current?.abort()}>{t("ui.f8960d4ff6")}</button></>:downloaded?<><p><Check size={16}/>{t("ui.ac3db18411")}</p></>:<button type="button" className="chip" onClick={()=>void startDownload()}><Download size={16}/>{t("ui.4078092b65")}</button>}
        {savedParts>0&&progress===null&&<button type="button" className="chip" onClick={()=>void deleteRecitation(surah.n,reciter).then(async()=>{if(nativeAudio.current)await nativeCommand({op:"deleteCache",r:reciter.id,s:surah.n});setDownloaded(false);setSavedParts(0);setSavedBytes(0)}).catch(()=>setError(t("ui.398f681786")))}><Trash2 size={15}/>{t("ui.e2188fd0aa")}</button>}
        <small>{t("ui.27e353abc8")}</small>
        {notice&&<p role="status">{notice}</p>}
      </div>
      <CarStudyControls s={surah.n} a={position.ayah} onNormal={()=>{setSpeed(1);setVerseRepeats(1);setSurahRepeats(1);saveSetting('speed',1);saveSetting('verseRepeats',1);saveSetting('surahRepeats',1)}}/>
      <a href={reciter.sourcePage} target="_blank" rel="noreferrer" className="recitation-source">{t("ui.bb4cb4db3d")}{' '}{reciter.source}</a>
    </DialogContent></Dialog>
  </>
}
