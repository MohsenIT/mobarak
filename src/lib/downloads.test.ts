import {test,expect} from 'bun:test'
import {listDownloadedPacks,deleteDownloadedPack} from './downloads'
test('partial downloads use actual cache entries; removal clears duplicate copies but preserves Quran data',async()=>{
 const originalFetch=globalThis.fetch,cacheDescriptor=Object.getOwnPropertyDescriptor(globalThis,'caches'),locationDescriptor=Object.getOwnPropertyDescriptor(globalThis,'location')
 const origin='http://localhost',stores=new Map<string,Set<string>>([
  ['quran-offline-packs-v1',new Set([origin+'/data/mizan/20.json',origin+'/data/meta.json'])],
  ['quran-startup-v1',new Set([origin+'/data/mizan/20.json'])],
 ])
 globalThis.fetch=(async()=>Response.json({groups:{core:[{url:'/data/meta.json',bytes:10}],mizan:[{url:'/data/mizan/20.json',bytes:100},{url:'/data/mizan/21.json',bytes:200}]}})) as unknown as typeof fetch
 Object.defineProperty(globalThis,'location',{configurable:true,value:{origin}})
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{keys:async()=>[...stores.keys()],open:async(name:string)=>({keys:async()=>[...stores.get(name)!].map(url=>({url})),delete:async(url:string)=>stores.get(name)!.delete(url)})}})
 try{
  const packs=await listDownloadedPacks()
  expect(packs).toHaveLength(1);expect(packs[0].count).toBe(1);expect(packs[0].total).toBe(2);expect(packs[0].bytes).toBe(200)
  await deleteDownloadedPack(packs[0]);expect(await listDownloadedPacks()).toEqual([])
  expect(stores.get('quran-offline-packs-v1')!.has(origin+'/data/meta.json')).toBe(true)
  await expect(deleteDownloadedPack({...packs[0],id:'core'})).rejects.toThrow('protected-pack')
 }finally{
  globalThis.fetch=originalFetch
  if(cacheDescriptor)Object.defineProperty(globalThis,'caches',cacheDescriptor);else Reflect.deleteProperty(globalThis,'caches')
  if(locationDescriptor)Object.defineProperty(globalThis,'location',locationDescriptor);else Reflect.deleteProperty(globalThis,'location')
 }
})
