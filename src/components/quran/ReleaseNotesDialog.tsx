'use client'
import {t,uiDirection} from '@/lib/i18n'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog'
import { CURRENT_RELEASE,missedReleases,type AppUpdate } from '@/lib/app-releases'
import { toFa } from '@/lib/quran'
export default function ReleaseNotesDialog({open,onOpenChange,update,onUpdate,onLater,busy=false,error=false,history=false}:{open:boolean;onOpenChange:(open:boolean)=>void;update:AppUpdate|null;onUpdate?:()=>void;onLater?:()=>void;busy?:boolean;error?:boolean;history?:boolean}){
  const missed=missedReleases(update?.releases??[],CURRENT_RELEASE)
  const entries=history?update?.releases??[]:missed
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="release-notes-dialog" dir={uiDirection()}>
    <DialogHeader><DialogTitle>{history?t("ui.3a0967fbbe"):t("ui.20245d9e19")}</DialogTitle><DialogDescription>{t("ui.457dafcc7b")}{' '}{toFa(CURRENT_RELEASE)}{!history&&missed.length>1?t("ui.449d089d40",{p0:(toFa(missed.length))}):''}</DialogDescription></DialogHeader>
    <div className="release-notes-list">
      {!entries.length&&<p className="text-sm leading-7">{t("ui.177aa250df")}</p>}
      {entries.map(release=><section key={release.version} aria-label={t("ui.bb810c0981",{p0:(release.version)})}><h3>{t("ui.953819a315")}{' '}{toFa(release.version)} <small>{toFa(release.date)}</small></h3><p>{release.title}</p><ul>{release.changes.map((change,i)=><li key={i}>{change}</li>)}</ul></section>)}
    </div>
    {error&&<p role="alert" className="text-xs">{t("ui.bfa8430237")}</p>}
    <div className="release-notes-actions"><button type="button" className="chip" disabled={busy} onClick={()=>{onOpenChange(false);onLater?.()}}>{onUpdate?t("ui.bae3fdab58"):t("ui.313cbecb4d")}</button>{onUpdate&&<button type="button" className="app-update-button" disabled={busy} onClick={onUpdate}>{busy?t("ui.80516c4adb"):t("ui.2a9c64792a")}</button>}</div>
  </DialogContent></Dialog>
}
