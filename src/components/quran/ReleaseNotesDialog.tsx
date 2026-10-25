'use client'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog'
import { CURRENT_RELEASE,missedReleases,type AppUpdate } from '@/lib/app-releases'
import { toFa } from '@/lib/quran'
export default function ReleaseNotesDialog({open,onOpenChange,update,onUpdate,onLater,busy=false,error=false,history=false}:{open:boolean;onOpenChange:(open:boolean)=>void;update:AppUpdate|null;onUpdate?:()=>void;onLater?:()=>void;busy?:boolean;error?:boolean;history?:boolean}){
  const missed=missedReleases(update?.releases??[],CURRENT_RELEASE)
  const entries=history?update?.releases??[]:missed
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="release-notes-dialog" dir="rtl">
    <DialogHeader><DialogTitle>{history?'تاریخچهٔ نسخه‌ها':'تغییرات نسخهٔ جدید'}</DialogTitle><DialogDescription>نسخهٔ فعلی شما: {toFa(CURRENT_RELEASE)}{!history&&missed.length>1?` · ${toFa(missed.length)} نسخهٔ جدید`:''}</DialogDescription></DialogHeader>
    <div className="release-notes-list">
      {!entries.length&&<p className="text-sm leading-7">جزئیات تازه‌ای برای این به‌روزرسانی ثبت نشده است.</p>}
      {entries.map(release=><section key={release.version} aria-label={`نسخه ${release.version}`}><h3>نسخهٔ {toFa(release.version)} <small>{toFa(release.date)}</small></h3><p>{release.title}</p><ul>{release.changes.map((change,i)=><li key={i}>{change}</li>)}</ul></section>)}
    </div>
    {error&&<p role="alert" className="text-xs">دریافت نسخه انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.</p>}
    <div className="release-notes-actions"><button type="button" className="chip" disabled={busy} onClick={()=>{onOpenChange(false);onLater?.()}}>{onUpdate?'بعداً':'بستن'}</button>{onUpdate&&<button type="button" className="app-update-button" disabled={busy} onClick={onUpdate}>{busy?'در حال دریافت…':'به‌روزرسانی اکنون'}</button>}</div>
  </DialogContent></Dialog>
}
