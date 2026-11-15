import {expect,test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

function browserCache() {
  let online=true
  let handler:(event:unknown)=>void=()=>{}
  const stores=new Map<string,Map<string,Response>>()
  const key=(request:string|{url:string})=>typeof request==='string'?request:request.url
  runInNewContext(readFileSync('public/sw.js','utf8'),{
    self:{location:{origin:'https://mobarak.app'},addEventListener:(kind:string,fn:typeof handler)=>{if(kind==='fetch')handler=fn}},
    caches:{open:async(name:string)=>{
      if(!stores.has(name))stores.set(name,new Map())
      const store=stores.get(name)!
      return {match:async(request:string|{url:string})=>store.get(key(request))?.clone(),put:async(request:string|{url:string},response:Response)=>{store.set(key(request),response.clone())}}
    }},
    fetch:async(request:{url:string})=>{if(!online)throw Error('offline');return new Response(`online:${new URL(request.url).pathname}`)},
    URL,Response,Headers,Uint8Array,crypto,
  })
  return {
    offline:()=>{online=false},
    visit:async(path:string,mode='navigate')=>{
      let response:Promise<Response>|null=null
      handler({request:{method:'GET',url:`https://mobarak.app${path}`,mode},respondWith:(value:Promise<Response>)=>{response=value}})
      return response?await (await (response as Promise<Response>)).text():null
    },
  }
}

test('reader and study retain their own last successful documents',async()=>{
  const browser=browserCache()
  await browser.visit('/s/18');await browser.visit('/study/taha')
  browser.offline()
  expect(await browser.visit('/s/19')).toBe('online:/s/18')
  expect(await browser.visit('/study/taha')).toBe('online:/study/taha')
})

test('visiting the introduction never replaces the offline Quran or study shell',async()=>{
  const browser=browserCache()
  await browser.visit('/s/18');await browser.visit('/study/taha');await browser.visit('/about')
  browser.offline()
  expect(await browser.visit('/s/19')).toBe('online:/s/18')
  expect(await browser.visit('/study/taha')).toBe('online:/study/taha')
  expect(await browser.visit('/about/index.html')).toBe('online:/about')
})

test('visited introduction scripts and styles remain available offline',async()=>{
  const browser=browserCache()
  await browser.visit('/about/presentation.js','cors');await browser.visit('/about/presentation.css','cors')
  browser.offline()
  expect(await browser.visit('/about/presentation.js','cors')).toBe('online:/about/presentation.js')
  expect(await browser.visit('/about/presentation.css','cors')).toBe('online:/about/presentation.css')
})
