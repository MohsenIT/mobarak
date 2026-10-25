import {test,expect} from 'bun:test'
import {readFileSync} from 'node:fs'
import {loadTrans} from './quran'
test('source loading respects ayah offsets, source identity and retry after failure',async()=>{
 const request=globalThis.fetch,meta=JSON.parse(readFileSync('public/data/meta.json','utf8'))
 const english=JSON.parse(readFileSync('public/data/translations/en.sahih.json','utf8'))
 let attempts=0
 globalThis.fetch=(async input=>{
  const url=String(input)
  if(url==='/data/meta.json')return Response.json(meta)
  if(url.startsWith('/data/trans/'))return Response.json(JSON.parse(readFileSync(`public${url}`,'utf8')))
  if(url==='/data/translations/en.sahih.json'){attempts++;if(attempts===1)return new Response('',{status:503});return Response.json(english)}
  throw new Error('Unexpected request')
 }) as typeof fetch
 try{
  await expect(loadTrans(20,'en.sahih')).rejects.toThrow('translation-unavailable')
  const data=await loadTrans(20,'en.sahih'),offset=meta.surahs.slice(0,19).reduce((n:number,s:{vc:number})=>n+s.vc,0)
  expect(data['72']['en.sahih']).toBe(english[offset+71]);expect(attempts).toBe(2)
  expect((await loadTrans(20,'s'))['72']['en.sahih']).toBeUndefined()
  await loadTrans(1,'en.sahih');expect(attempts).toBe(2)
 }finally{globalThis.fetch=request}
})
