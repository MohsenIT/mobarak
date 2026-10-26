import meta from '../../../../public/data/meta.json'
import { RECITERS, recitationSourceUrl } from '@/lib/recitation'

const cors = { 'Access-Control-Allow-Origin':'*', 'X-Content-Type-Options':'nosniff' }
const fail=(status:number)=>Response.json({error:'audio-unavailable'},{status,headers:cors})
/** Fixed catalogue sources only: never accept a caller-supplied URL or directory. */
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams
  const s=Number(params.get('s')), a=Number(params.get('a'))
  const reciter=RECITERS.find(item=>item.id===params.get('r')&&item.tanzilDirectory)
  if(!reciter||!Number.isInteger(s)||s<1||s>114||!Number.isInteger(a)||a<1||a>meta.surahs[s-1].vc)return fail(400)
  try {
    const upstream=await fetch(recitationSourceUrl(s,a,reciter),{signal:AbortSignal.timeout(20000),redirect:'error',cache:'force-cache'})
    if(!upstream.ok||!upstream.headers.get('content-type')?.includes('audio/'))return fail(502)
    const reader=upstream.body?.getReader();if(!reader)return fail(502)
    const chunks:Uint8Array<ArrayBuffer>[]=[];let length=0
    try {
      while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>4*1024*1024){await reader.cancel();return fail(502)};chunks.push(new Uint8Array(item.value))}
    } finally {reader.releaseLock()}
    if(!length)return fail(502)
    return new Response(new Blob(chunks,{type:'audio/mpeg'}),{headers:{...cors,'Content-Type':'audio/mpeg','Content-Length':String(length),'Cache-Control':'public, max-age=86400, s-maxage=2592000','X-Audio-Source':'tanzil.net'}})
  } catch {return fail(502)}
}
