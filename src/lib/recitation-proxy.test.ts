import { afterEach, describe, expect, test } from 'bun:test'
import { GET } from '../app/api/recitation/route'
const original=globalThis.fetch
afterEach(()=>{globalThis.fetch=original})
const request=(query:string)=>new Request(`https://example.test/api/recitation?${query}`)
describe('Tanzil audio endpoint',()=>{
 test('rejects unknown source and nonexistent ayah before any request',async()=>{
  let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('must not fetch')}) as unknown as typeof fetch
  for(const q of ['r=other&s=1&a=1','r=parhizgar&s=1&a=8','r=parhizgar&s=115&a=1','r=parhizgar&s=1&a=https://other.test'])expect((await GET(request(q))).status).toBe(400)
  expect(calls).toBe(0)
 })
 test('uses only the fixed Tanzil path and returns audio with native-client CORS',async()=>{
  let url='';globalThis.fetch=(async(input,init)=>{url=String(input);expect(init?.redirect).toBe('error');return new Response(new Uint8Array([73,68,51]),{headers:{'Content-Type':'audio/mpeg'}})}) as unknown as typeof fetch
  const result=await GET(request('r=parhizgar&s=20&a=72&url=https://other.test'))
  expect(url).toBe('https://tanzil.net/res/audio/parhizgar/020072.mp3');expect(result.status).toBe(200);expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');expect((await result.arrayBuffer()).byteLength).toBe(3)
 })
 test('does not turn an upstream HTML error into saved audio',async()=>{
  globalThis.fetch=(async()=>new Response('<html>Error</html>',{headers:{'Content-Type':'text/html'}})) as unknown as typeof fetch
  expect((await GET(request('r=parhizgar&s=1&a=1'))).status).toBe(502)
 })
})

test('new reciters still use fixed catalogue directories and reject traversal',async()=>{
 let url='';globalThis.fetch=(async(input)=>{url=String(input);return new Response(new Uint8Array([73,68,51]),{headers:{'Content-Type':'audio/mpeg'}})}) as unknown as typeof fetch
 expect((await GET(request('r=tanzil-husary&s=20&a=72&url=https://other.test'))).status).toBe(200)
 expect(url).toBe('https://tanzil.net/res/audio/husary/020072.mp3')
 expect((await GET(request('r=tanzil-..%2Fother&s=1&a=1'))).status).toBe(400)
})

test('Mansoori uses the registered EveryAyah origin through the bounded proxy',async()=>{
 let url='';globalThis.fetch=(async(input)=>{url=String(input);return new Response(new Uint8Array([73,68,51]),{headers:{'Content-Type':'audio/mpeg'}})}) as unknown as typeof fetch
 const result=await GET(request('r=everyayah-mansoori&s=20&a=72&url=https://other.test'))
 expect(result.status).toBe(200);expect(url).toBe('https://everyayah.com/data/Karim_Mansoori_40kbps/020072.mp3');expect(result.headers.get('X-Audio-Source')).toBe('everyayah.com')
})
