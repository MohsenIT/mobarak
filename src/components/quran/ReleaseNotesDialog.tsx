'use client'
import {useEffect,useRef,useState} from 'react'
import {Lightbulb,Wrench,Bug,ShieldCheck,MinusCircle} from 'lucide-react'
import {t,uiDirection} from '@/lib/i18n'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {CURRENT_RELEASE,compareRelease,missedReleases,type AppUpdate,type ReleaseChangeKind} from '@/lib/app-releases'
import {toFa} from '@/lib/quran'
import {useCalendar} from '@/lib/use-calendar'
const ICONS={feature:Lightbulb,improvement:Wrench,fix:Bug,security:ShieldCheck,removed:MinusCircle}
export default function ReleaseNotesDialog({open,onOpenChange,update,onUpdate,onLater,busy=false,error=false,history=false}:{open:boolean;onOpenChange:(open:boolean)=>void;update:AppUpdate|null;onUpdate?:()=>void;onLater?:()=>void;busy?:boolean;error?:boolean;history?:boolean}){
 const {formatDate}=useCalendar()
 const missed=missedReleases(update?.releases??[],CURRENT_RELEASE),entries=history?update?.releases??[]:missed.length?missed:update?.latest&&compareRelease(update.latest.version,CURRENT_RELEASE)===0?[update.latest]:[]
 const [visible,setVisible]=useState(5),list=useRef<HTMLDivElement>(null),[sentinel,setSentinel]=useState<HTMLDivElement|null>(null)
 useEffect(()=>{if(open)setVisible(5)},[open,history,update?.build])
 useEffect(()=>{
  if(!open||visible>=entries.length||!sentinel||!('IntersectionObserver' in window))return
  const observer=new IntersectionObserver(items=>{if(items.some(item=>item.isIntersecting))setVisible(value=>Math.min(value+5,entries.length))},{root:list.current,rootMargin:'80px'})
  observer.observe(sentinel);return()=>observer.disconnect()
 },[open,visible,entries.length,sentinel])
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="release-notes-dialog" dir={uiDirection()}>
  <DialogHeader><DialogTitle>{history?t('ui.3a0967fbbe'):t('ui.20245d9e19')}</DialogTitle><DialogDescription>{t('ui.457dafcc7b')}{' '}{toFa(CURRENT_RELEASE)}{!history&&missed.length>1?t('ui.449d089d40',{p0:toFa(missed.length)}):''}</DialogDescription></DialogHeader>
  <div className="release-notes-list" ref={list}>
   {!entries.length&&<p className="text-sm leading-7">{t('ui.177aa250df')}</p>}
   {entries.slice(0,visible).map(release=><section key={release.version} aria-label={t('ui.bb810c0981',{p0:release.version})}><h3>{t('ui.953819a315')}{' '}{toFa(release.version)} <small><time dateTime={release.date}>{formatDate(release.date)}</time></small></h3><p>{toFa(release.title)}</p><ul>{release.changes.map((change,i)=>{const kind:ReleaseChangeKind=release.changeKinds?.[i]??'improvement',Icon=ICONS[kind];return <li key={i} className="release-change" data-change-kind={kind}><span className="release-change-icon" title={t(`release.${kind}`)}><Icon size={16} aria-hidden="true"/><span className="release-change-label">{t(`release.${kind}`)}</span></span><span>{toFa(change)}</span></li>})}</ul></section>)}
   {visible<entries.length&&<div ref={setSentinel} className="release-notes-more"><button className="chip" type="button" onClick={()=>setVisible(value=>Math.min(value+5,entries.length))}>{t('release.more')}</button></div>}
  </div>
  {error&&<p role="alert" className="text-xs">{t('ui.bfa8430237')}</p>}
  <div className="release-notes-actions" data-double={!!onUpdate}><button type="button" className="release-action release-action-secondary" disabled={busy} onClick={()=>{onOpenChange(false);onLater?.()}}>{onUpdate?t('ui.bae3fdab58'):t('ui.313cbecb4d')}</button>{onUpdate&&<button type="button" className="release-action release-action-primary" disabled={busy} onClick={onUpdate}>{busy?t('ui.80516c4adb'):t('ui.2a9c64792a')}</button>}</div>
 </DialogContent></Dialog>
}
