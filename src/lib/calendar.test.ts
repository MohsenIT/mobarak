import {test,expect} from 'bun:test'
import {automaticCalendar,formatCalendarDate,isCalendar} from './calendar'
test('calendar policy honours explicit device calendars then app language and territory',()=>{
 expect(automaticCalendar('fa','en-US')).toBe('persian')
 expect(automaticCalendar('en','fa-IR')).toBe('persian')
 expect(automaticCalendar('ps','ps-AF')).toBe('persian')
 expect(automaticCalendar('ar','ar-SA')).toBe('islamic-umalqura')
 expect(automaticCalendar('ar','ar-EG')).toBe('islamic-civil')
 expect(automaticCalendar('en','en-US')).toBe('gregory')
 expect(automaticCalendar('th','th-TH')).toBe('buddhist')
 expect(automaticCalendar('fa','fa-IR-u-ca-gregory')).toBe('gregory')
})
test('publication dates convert correctly, never change the source day, and allow manual override',()=>{
 expect(formatCalendarDate('2026-10-28','fa','persian')).toBe('۶ آبان ۱۴۰۵')
 expect(formatCalendarDate('2026-10-28','en','gregory')).toBe('October 28, 2026')
 expect(formatCalendarDate('2026-10-28','en','auto','th-TH')).toContain('2569')
 expect(formatCalendarDate('bad','en')).toBe('bad')
 expect(formatCalendarDate('2026-02-30','en')).toBe('2026-02-30')
 expect(isCalendar('auto')).toBe(true);expect(isCalendar('random')).toBe(false)
})
