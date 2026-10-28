'use client'
import {t} from '@/lib/i18n'
import {CALENDARS,isCalendar} from '@/lib/calendar'
import {useCalendar} from '@/lib/use-calendar'
export default function CalendarSettings(){
 const {preference,setCalendar,formatDate}=useCalendar()
 return <section><h3 className="text-sm font-bold mb-3">{t('calendar.settings')}</h3>
  <label className="text-sm flex flex-col gap-2">{t('calendar.type')}<select className="resource-select" aria-label={t('calendar.type')} value={preference} onChange={e=>{if(isCalendar(e.target.value))setCalendar(e.target.value)}}>{CALENDARS.map(id=><option value={id} key={id}>{t(`calendar.${id}`)}</option>)}</select></label>
  <p className="text-xs leading-7 mt-2">{t('calendar.example',{date:formatDate('2026-10-28')})}</p>
 </section>
}
