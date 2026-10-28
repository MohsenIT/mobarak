import meta from '../../public/data/meta.json'
export type MizanPassage={from:number;to:number;sourceSha256:string;text:string}
export type MizanSurah={surah:number;verses:number;passages:MizanPassage[]}
export type MizanSummary={lines:string[];sourceSha256:string;sourceFrom:number;sourceTo:number;evidence:string[];model:string;review:'source-checked'}
export type MizanExcerpt=MizanPassage&{sourceStart:number;sourceEnd:number;truncated:boolean}
export type MizanExcerpts={surah:number;verses:number;passages:MizanExcerpt[]}
const excerpts=new Map<number,Promise<MizanExcerpts>>()
export function loadMizanExcerpts(s:number):Promise<MizanExcerpts>{
 if(!Number.isInteger(s)||s<1||s>114)return Promise.reject(Error('invalid-surah'))
 if(!excerpts.has(s)){
  if(excerpts.size>=8)excerpts.delete(excerpts.keys().next().value!)
  excerpts.set(s,fetch(`/data/mizan-excerpts/${s}.json`).then(async response=>{
   if(!response.ok)throw Error('excerpt-unavailable')
   const data=await response.json() as MizanExcerpts
   validateMizan(data,s)
   for(const p of data.passages){
    if(!Number.isInteger(p.sourceStart)||p.sourceStart<0||!Number.isInteger(p.sourceEnd)||p.sourceEnd-p.sourceStart!==p.text.length||p.text.length>620||typeof p.truncated!=='boolean')throw Error('invalid-excerpt')
   }
   return data
  }).catch(error=>{excerpts.delete(s);throw error}))
 }
 return excerpts.get(s)!
}
const summaries=new Map<number,Promise<Record<string,MizanSummary>>>()
export function loadMizanSummaries(s:number):Promise<Record<string,MizanSummary>>{
 if(!Number.isInteger(s)||s<1||s>114)return Promise.reject(Error('invalid-surah'))
 if(!summaries.has(s))summaries.set(s,fetch(`/data/mizan-summaries/${s}.json`).then(async r=>{
  if(r.status===404)return {}
  if(!r.ok)throw Error('summary-unavailable')
  const data=await r.json()
  if(data.surah!==s||!data.rows||typeof data.rows!=='object'||Array.isArray(data.rows))throw Error('invalid-summary')
  for(const [a,value] of Object.entries(data.rows)){
   const row=value as MizanSummary
   if(!/^\d+$/.test(a)||Number(a)<1||Number(a)>meta.surahs[s-1].vc||row.review!=='source-checked'||!Array.isArray(row.lines)||row.lines.length<1||row.lines.length>3||row.lines.some(line=>typeof line!=='string'||!line.trim())||!Array.isArray(row.evidence)||!row.evidence.length||!/^[a-f0-9]{64}$/.test(row.sourceSha256))throw Error('invalid-summary')
  }
  return data.rows as Record<string,MizanSummary>
 }).catch(error=>{summaries.delete(s);throw error}))
 return summaries.get(s)!
}
export function validateMizan(data:MizanSurah,s:number):MizanSurah{
 if(!Number.isInteger(s)||s<1||s>114||data?.surah!==s||data.verses!==meta.surahs[s-1].vc||!Array.isArray(data.passages))throw Error('invalid-mizan')
 let next=1
 for(const p of data.passages){
  if(p.from!==next||!Number.isInteger(p.to)||p.to<p.from||p.to>data.verses||typeof p.text!=='string'||!p.text.trim()||!/^[a-f0-9]{64}$/.test(p.sourceSha256))throw Error('invalid-mizan')
  next=p.to+1
 }
 if(next!==data.verses+1)throw Error('incomplete-mizan')
 return data
}
const cache=new Map<number,Promise<MizanSurah>>()
export function loadMizan(s:number):Promise<MizanSurah>{
 if(!Number.isInteger(s)||s<1||s>114)return Promise.reject(Error('invalid-surah'))
 if(!cache.has(s)){
  if(cache.size>=4)cache.delete(cache.keys().next().value!)
  cache.set(s,fetch(`/data/mizan/${s}.json`).then(async response=>{
   if(!response.ok)throw Error('mizan-unavailable')
   return validateMizan(await response.json(),s)
  }).catch(error=>{cache.delete(s);throw error}))
 }
 return cache.get(s)!
}
