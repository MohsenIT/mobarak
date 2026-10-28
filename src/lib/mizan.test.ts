import {test,expect} from 'bun:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {validateMizan,loadMizan,loadMizanExcerpts,loadMizanSummaries} from './mizan'
test('Mizan covers every canonical ayah with unchanged, hashed source-linked ranges',()=>{
 const catalogue=JSON.parse(readFileSync('public/data/mizan/catalogue.json','utf8'))
 let verses=0
 for(const entry of catalogue.surahs){
  const bytes=readFileSync(`public/data/mizan/${entry.surah}.json`)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)
  const data=validateMizan(JSON.parse(bytes.toString()),entry.surah)
  verses+=data.verses
  expect(data.passages.length).toBe(entry.passages)
  for(const passage of data.passages)expect(passage.text).not.toMatch(/<\/?(?:script|iframe|p)\b/i)
 }
 expect(verses).toBe(6236)
 const first=JSON.parse(readFileSync('public/data/mizan/1.json','utf8'))
 expect(first.passages.find((p:{from:number})=>p.from===2).to).toBe(3)
 expect(()=>validateMizan({...first,passages:first.passages.slice(1)},1)).toThrow()
})
test('commentary requests are bounded and a failed fetch can be retried',async()=>{
 const original=globalThis.fetch;let calls=0
 const first=JSON.parse(readFileSync('public/data/mizan/1.json','utf8'))
 globalThis.fetch=(async input=>{expect(String(input)).toBe('/data/mizan/1.json');return ++calls===1?new Response('',{status:503}):Response.json(first)}) as typeof fetch
 try{
  await expect(loadMizan(0)).rejects.toThrow('invalid-surah')
  await expect(loadMizan(1)).rejects.toThrow('mizan-unavailable')
  expect((await loadMizan(1)).surah).toBe(1)
  await loadMizan(1);expect(calls).toBe(2)
 }finally{globalThis.fetch=original}
})
test('all bundled openings are exact source excerpts and cover every ayah without the full download',()=>{
 const manifest=JSON.parse(readFileSync('public/offline-manifest.json','utf8'))
 let ayahs=0
 for(let s=1;s<=114;s++){
  const source=JSON.parse(readFileSync(`public/data/mizan/${s}.json`,'utf8'))
  const excerpt=JSON.parse(readFileSync(`public/data/mizan-excerpts/${s}.json`,'utf8'))
  validateMizan(excerpt,s)
  for(const row of excerpt.passages){
   const original=source.passages.find((p:{from:number})=>p.from===row.from)
   expect(row.sourceSha256).toBe(original.sourceSha256)
   expect(row.to).toBe(original.to)
   expect(row.text).toBe(original.text.slice(row.sourceStart,row.sourceEnd))
   expect(row.text.length).toBeGreaterThan(0)
   expect(row.text.length).toBeLessThanOrEqual(620)
   expect(row.truncated).toBe(row.sourceEnd<original.text.length)
  }
  expect(manifest.groups.core.some((row:{url:string})=>row.url===`/data/mizan-excerpts/${s}.json`)).toBe(true)
  expect(manifest.groups.core.some((row:{url:string})=>row.url===`/data/mizan/${s}.json`)).toBe(false)
  ayahs+=excerpt.verses
 }
 expect(ayahs).toBe(6236)
})
test('small source openings load independently when summary is absent and never fetch full commentary',async()=>{
 const original=globalThis.fetch,calls:string[]=[]
 globalThis.fetch=(async input=>{
  const url=String(input);calls.push(url)
  if(url==='/data/mizan-summaries/102.json')return new Response('',{status:404})
  if(url==='/data/mizan-excerpts/102.json')return Response.json(JSON.parse(readFileSync('public/data/mizan-excerpts/102.json','utf8')))
  throw Error(`Unexpected full download: ${url}`)
 }) as typeof fetch
 try{
  expect(await loadMizanSummaries(102)).toEqual({})
  expect((await loadMizanExcerpts(102)).verses).toBe(8)
  await loadMizanExcerpts(102)
  expect(calls).toEqual(['/data/mizan-summaries/102.json','/data/mizan-excerpts/102.json'])
 }finally{globalThis.fetch=original}
})
