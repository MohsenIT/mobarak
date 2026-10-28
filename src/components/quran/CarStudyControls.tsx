'use client'
import {DictationInput} from './DictationInput'
import {useEffect,useState,useRef} from 'react'
import {t} from '@/lib/i18n'
import {toFa} from '@/lib/quran'
import {AUDIO_TRANSLATIONS} from '@/lib/recitation'
import {downloadRecitation,getVerseAudio,deleteRecitation} from '@/lib/recitation-storage'
import {cacheNativeVerse} from '@/lib/native-recitation'
import meta from '../../../public/data/meta.json'
import {useCarLibrary} from '@/lib/car-library'
import {nativeCommand,subscribeNativePlaybackState,type CarOptions} from '@/lib/native-recitation'
const defaults:CarOptions={speed:1,verse:1,surah:1,pause:0,rangeSurah:0,from:0,to:0,sleepDeadline:0,sleepAtEnd:false,translationAudio:''}
export default function CarStudyControls({s,a,onNormal}:{s:number;a:number;onNormal:()=>void}){
 const {data,available,mutate}=useCarLibrary(),[mounted,setMounted]=useState(false),[options,setOptions]=useState(defaults),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const download=useRef<AbortController|null>(null),[downloaded,setDownloaded]=useState<number|null>(null)
 useEffect(()=>()=>{download.current?.abort()},[])
 const [editing,setEditing]=useState('')
 const [title,setTitle]=useState(''),[selected,setSelected]=useState<number[]>([s]),[nextSurah,setNextSurah]=useState(s)
 useEffect(()=>{setMounted(true);return subscribeNativePlaybackState(state=>{if(state.options)setOptions(state.options)})},[])
 if(!mounted||!available)return null
 const run=async(action:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await action()}catch(error){if((error as {name?:string})?.name!=='AbortError')setError(t('auto.actionFailed'))}finally{setBusy(false)}}
 const change=(key:string,value:string)=>run(()=>nativeCommand({op:'carOption',key,value}))
 const translated=AUDIO_TRANSLATIONS.find(item=>item.id===options.translationAudio)
 const downloadTranslation=()=>void run(async()=>{
  if(!translated)return;const controller=new AbortController();download.current=controller;setDownloaded(0)
  try{await downloadRecitation(s,meta.surahs[s-1].vc,controller.signal,setDownloaded,translated);for(let ayah=1;ayah<=meta.surahs[s-1].vc;ayah++){controller.signal.throwIfAborted();const audio=await getVerseAudio(s,ayah,controller.signal,true,translated);await cacheNativeVerse(audio.blob,{r:translated.id,s,a:ayah},true);setDownloaded(meta.surahs[s-1].vc+ayah)}}finally{download.current=null;setDownloaded(null)}
 })
 const marked=data.favorites.some(v=>v.s===s&&v.a===a)
 return <details className="car-study-controls"><summary>{t('auto.carLibrary')}</summary>
 <button type="button" className="chip" disabled={busy} onClick={()=>void run(async()=>{await nativeCommand({op:'carOption',key:'normal',value:'off'});onNormal()})}>{t('auto.normalPlayback')}</button>
 <p>{t('auto.currentPlayback',{speed:toFa(options.speed),repeat:options.verse===1?t('auto.noRepeat'):options.verse===0?t('auto.forever'):toFa(options.verse)})}</p>
 <label>{t('auto.setting_pause')}<select aria-label={t('auto.setting_pause')} disabled={busy} value={options.pause} onChange={e=>void change('pause',e.target.value)}>{[0,2,5,10].map(n=><option key={n} value={n}>{n?t('auto.secondsCount',{count:n}):t('auto.off')}</option>)}</select></label>
 <p>{t('auto.rangeHint')}</p>
 <label>{t('auto.setting_range')}<select aria-label={t('auto.setting_range')} disabled={busy} value={options.rangeSurah?'active':'off'} onChange={e=>void change('range',e.target.value)}><option value="off">{t('auto.off')}</option>{options.rangeSurah>0&&<option value="active" disabled>{t('auto.activeRange',{from:options.from,to:options.to})}</option>}<option value="5">{t('auto.nextVerses',{count:5})}</option><option value="10">{t('auto.nextVerses',{count:10})}</option><option value="end">{t('auto.endSurah')}</option></select></label>
 <label>{t('auto.setting_timer')}<select aria-label={t('auto.setting_timer')} disabled={busy} value={options.sleepAtEnd?'end':options.sleepDeadline?'active':'off'} onChange={e=>void change('timer',e.target.value)}><option value="off">{t('auto.off')}</option>{options.sleepDeadline>0&&<option value="active" disabled>{t('auto.timerActive')}</option>}{[15,30,60].map(n=><option key={n} value={n}>{t('auto.minutesCount',{count:n})}</option>)}<option value="end">{t(options.rangeSurah?'auto.endRange':'auto.endSurah')}</option></select></label>
 <label>{t('auto.setting_translation')}<select aria-label={t('auto.setting_translation')} disabled={busy} value={options.translationAudio||'off'} onChange={e=>void change('translation',e.target.value)}><option value="off">{t('auto.off')}</option>{AUDIO_TRANSLATIONS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
 <p>{t('auto.translationHint')}</p>
 {translated&&<div><p>{t('auto.translationOfflineHint')}</p><button type="button" className="chip" disabled={busy} onClick={downloadTranslation}>{t('auto.downloadTranslation')}</button><button type="button" className="chip" disabled={busy} onClick={()=>void run(async()=>{await deleteRecitation(s,translated);await nativeCommand({op:'deleteCache',r:translated.id,s})})}>{t('auto.deleteTranslation')}</button>{downloaded!==null&&<><progress aria-label={t('auto.downloadTranslation')} value={downloaded} max={meta.surahs[s-1].vc*2}/><button type="button" className="chip" onClick={()=>download.current?.abort()}>{t('ui.f8960d4ff6')}</button></>}</div>}
 <button type="button" className="chip" disabled={busy} onClick={()=>void run(()=>mutate({action:'favorite',s,a,add:!marked}))}>{t(marked?'auto.removeFavorite':'auto.addFavorite')}</button>
 <h4>{t('auto.favorites')}</h4><ul>{data.favorites.map(v=><li key={`${v.s}:${v.a}`}><span>{meta.surahs[v.s-1]?.ar} · {t('ui.b1b168c791')} {toFa(v.a)}</span><button type="button" className="chip" disabled={busy} onClick={()=>void run(()=>mutate({action:'favorite',...v,add:false}))}>{t('auto.remove')}</button></li>)}</ul>
 <h4>{t('auto.playlists')}</h4><ul>{data.playlists.map(list=><li key={list.id}><span>{list.title} · {toFa(list.surahs.length)}</span><button type="button" className="chip" disabled={busy} onClick={()=>{setTitle(list.title);setSelected(list.surahs);setEditing(list.id)}}>{t('auto.edit')}</button><button type="button" className="chip" disabled={busy} onClick={()=>void run(()=>mutate({action:'deleteList',listId:list.id}))}>{t('auto.remove')}</button></li>)}</ul>
 <PlaylistEditor title={title} setTitle={setTitle} selected={selected} setSelected={setSelected} nextSurah={nextSurah} setNextSurah={setNextSurah} busy={busy} save={()=>void run(async()=>{await mutate({action:'saveList',listId:editing||crypto.randomUUID(),title:title.trim(),surahs:selected});setTitle('');setEditing('');setSelected([s])})}/>
 {error&&<p role="status">{error}</p>}
 </details>
}

function PlaylistEditor({title,setTitle,selected,setSelected,nextSurah,setNextSurah,busy,save}:{title:string;setTitle:(value:string)=>void;selected:number[];setSelected:(value:number[])=>void;nextSurah:number;setNextSurah:(value:number)=>void;busy:boolean;save:()=>void}){
 return <div className="car-playlist-editor"><DictationInput aria-label={t('auto.listTitle')} placeholder={t('auto.listTitle')} value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/>
 <label>{t('auto.addSurah')}<select aria-label={t('auto.addSurah')} value={nextSurah} onChange={e=>setNextSurah(Number(e.target.value))}>{meta.surahs.map(s=><option key={s.n} value={s.n}>{toFa(s.n)} · {s.ar}</option>)}</select></label>
 <button type="button" className="chip" disabled={busy||selected.length>=20} onClick={()=>setSelected([...selected,nextSurah])}>{t('auto.addSurah')}</button>
 <ol>{selected.map((s,index)=><li key={index}><span>{toFa(index+1)} · {meta.surahs[s-1].ar}</span><button type="button" className="chip" disabled={index===0||busy} onClick={()=>{const next=[...selected];[next[index-1],next[index]]=[next[index],next[index-1]];setSelected(next)}}>{t('auto.moveUp')}</button><button type="button" className="chip" disabled={busy} onClick={()=>setSelected(selected.filter((_,i)=>i!==index))}>{t('auto.remove')}</button></li>)}</ol>
 <button type="button" className="chip" disabled={busy||!title.trim()||!selected.length} onClick={save}>{t('auto.saveList')}</button></div>
}
