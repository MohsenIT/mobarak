import systems from '@/messages/numbering-systems.json'
const ascii=new Map<string,string>()
for(const digits of systems.digits)Array.from(digits).forEach((digit,i)=>ascii.set(digit,String(i)))
export function normalizeDigits(value:string){return Array.from(value).map(c=>ascii.get(c)??c).join('')}
const formatters=new Map<string,Intl.NumberFormat>()
export function formatDigits(value:string|number,language:string){
 if(!formatters.has(language))formatters.set(language,new Intl.NumberFormat(language,{useGrouping:false,numberingSystem:(systems.languages as Record<string,string>)[language]}))
 const formatter=formatters.get(language)!
 if(typeof value==='number'&&Number.isFinite(value))return formatter.format(value)
 return normalizeDigits(String(value)).replace(/[0-9]/g,d=>formatter.format(Number(d)))
}
