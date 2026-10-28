export const CALENDARS=['auto','persian','islamic-umalqura','islamic-civil','gregory','buddhist','ethiopic','hebrew','indian','japanese'] as const
export type CalendarPreference=typeof CALENDARS[number]
export const isCalendar=(value:unknown):value is CalendarPreference=>typeof value==='string'&&(CALENDARS as readonly string[]).includes(value)
const ARAB_REGIONS=new Set('SA AE BH DZ EG IQ JO KW LB LY MA MR OM PS QA SD SO SY TN YE KM DJ'.split(' '))
/** Calendar preferences for this Quran app; explicit Unicode calendar tags take priority. */
export function automaticCalendar(language:string,deviceLocale:string):string{
 let locale:Intl.Locale
 try{locale=new Intl.Locale(deviceLocale)}catch{locale=new Intl.Locale(language)}
 if(locale.calendar)return locale.calendar
 const region=locale.region??(language===locale.language?locale.maximize().region:undefined)
 if(language==='fa'||region==='IR'||region==='AF')return 'persian'
 if(language==='ar'||region&&ARAB_REGIONS.has(region))return region==='SA'?'islamic-umalqura':'islamic-civil'
 return new Intl.DateTimeFormat(locale.toString()).resolvedOptions().calendar
}
/** Publication dates are date-only values, never shifted into the previous day by a timezone. */
export function formatCalendarDate(iso:string,language:string,preference:CalendarPreference='auto',deviceLocale=language):string{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
 if(!match)return iso
 const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),12))
 if(date.toISOString().slice(0,10)!==iso)return iso
 const calendar=preference==='auto'?automaticCalendar(language,deviceLocale):preference
 try{return new Intl.DateTimeFormat(language,{calendar,timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(date)}catch{return new Intl.DateTimeFormat(language,{calendar:'gregory',timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(date)}
}
