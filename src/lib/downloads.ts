const DATA_CACHES=['quran-offline-packs-v1','quran-native-data-v1','quran-startup-v1']
export type DownloadedPack={id:string;count:number;total:number;bytes:number;files:{cache:string;url:string}[]}
/** Inspect actual stored optional files, including partial/single-surah downloads. */
export async function listDownloadedPacks():Promise<DownloadedPack[]>{
 const response=await fetch('/offline-manifest.json')
 if(!response.ok)throw Error('manifest-unavailable')
 const manifest=await response.json() as {groups:Record<string,{url:string;bytes:number}[]>}
 const paths=new Map<string,{id:string;bytes:number}>(),packs=new Map<string,DownloadedPack>(),seen=new Map<string,Set<string>>()
 for(const [id,files] of Object.entries(manifest.groups)){
  if(id==='core'||id==='tahqiq')continue // App essentials stay installed.
  packs.set(id,{id,count:0,total:files.length,bytes:0,files:[]});seen.set(id,new Set())
  for(const file of files)paths.set(file.url,{id,bytes:file.bytes})
 }
 const existing=new Set(await caches.keys())
 await Promise.all(DATA_CACHES.filter(name=>existing.has(name)).map(async name=>{
  const cache=await caches.open(name)
  for(const request of await cache.keys()){
   const url=new URL(request.url)
   if(url.origin!==location.origin)continue
   const file=paths.get(url.pathname)
   if(!file)continue
   const pack=packs.get(file.id)!
   pack.files.push({cache:name,url:request.url});pack.bytes+=file.bytes
   if(!seen.get(file.id)!.has(url.pathname)){seen.get(file.id)!.add(url.pathname);pack.count++}
  }
 }))
 return [...packs.values()].filter(pack=>pack.count>0)
}
export async function deleteDownloadedPack(pack:DownloadedPack){
 if(pack.id==='core'||pack.id==='tahqiq')throw Error('protected-pack')
 for(const file of pack.files){
  if(!DATA_CACHES.includes(file.cache)||new URL(file.url).origin!==location.origin)throw Error('invalid-cache')
  await (await caches.open(file.cache)).delete(file.url)
 }
}
