import {test,expect} from 'bun:test'
import {AUDIO_TRANSLATIONS,RECITERS,recitationSourceUrl} from './recitation'
import {GET} from '@/app/api/recitation/route'
test('recorded translations have separate identities and fixed verified Tanzil directories',()=>{
 expect(RECITERS).toHaveLength(22);expect(AUDIO_TRANSLATIONS).toHaveLength(2)
 expect(new Set([...RECITERS,...AUDIO_TRANSLATIONS].map(r=>r.id)).size).toBe(24)
 for(const source of AUDIO_TRANSLATIONS){expect(source.id).toStartWith('translation-fa-');expect(recitationSourceUrl(20,72,source)).toBe(`https://tanzil.net/res/audio/${source.tanzilDirectory}/020072.mp3`)}
})
test('translation proxy accepts catalogue IDs and rejects arbitrary audio destinations',async()=>{
 const previous=globalThis.fetch,requests:string[]=[]
 globalThis.fetch=(async(input:RequestInfo|URL)=>{requests.push(String(input));return new Response(new Uint8Array([73,68,51,0]),{headers:{'content-type':'audio/mpeg'}})}) as typeof fetch
 try{
  const response=await GET(new Request('http://localhost/api/recitation?r=translation-fa-fooladvand&s=20&a=72'));expect(response.status).toBe(200);expect(requests).toEqual(['https://tanzil.net/res/audio/fa.fooladvand/020072.mp3'])
  for(const query of ['r=https://example.com/file.mp3&s=20&a=72','r=translation-fa-fooladvand&s=1&a=8','r=../../private&s=20&a=72'])expect((await GET(new Request('http://localhost/api/recitation?'+query))).status).toBe(400)
  expect(requests).toHaveLength(1)
 }finally{globalThis.fetch=previous}
})
