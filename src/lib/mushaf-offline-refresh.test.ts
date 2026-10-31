import {expect, test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

async function request(path: string, online: boolean) {
  let handler: (event: unknown) => void = () => {}
  const packed = new Map<string, Response>([[path, new Response('old')]])
  let fetched = false
  const cache = {match: async () => undefined, put: async () => {}}
  const packs = {match: async () => packed.get(path)?.clone(), put: async (_: unknown, response: Response) => {packed.set(path, response)}}
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: {location:{origin:'https://mobarak.app'},addEventListener:(kind:string, fn:typeof handler) => {if(kind === 'fetch') handler = fn}},
    caches: {open:async (name:string) => name.includes('packs') ? packs : cache},
    URL, Response, Headers, Uint8Array, crypto,
    fetch: async () => {fetched=true;if(!online) throw Error('offline');return new Response('new')},
  })
  let result: Promise<Response> = Promise.resolve(new Response('missing'))
  handler({request:{method:'GET',url:`https://mobarak.app${path}`,mode:'cors'},respondWith:(value:Promise<Response>) => {result=value}})
  const text = await (await result).text()
  return {text,fetched,stored:await packed.get(path)!.clone().text(),hash:packed.get(path)!.headers.get('x-content-sha256')}
}
test('online reader updates stale packed page metadata and surah files', async () => {
  for (const path of ['/data/meta.json','/data/surah/100.json']) {
    const result = await request(path,true)
    expect(result.text).toBe('new');expect(result.stored).toBe('new');expect(result.hash).toHaveLength(64)
  }
})
test('offline reader keeps packed Quran available and other packs remain cache first',async()=>{
  expect((await request('/data/surah/100.json',false)).text).toBe('old')
  const other=await request('/data/trans/100.json',true)
  expect(other.text).toBe('old');expect(other.fetched).toBe(false)
})
