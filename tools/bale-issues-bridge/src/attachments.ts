import {APIs} from './api.ts';
import {execute,one,rows,type Database} from './db.ts';
export interface Photo {file_id:string;file_size?:number;width?:number;height?:number;}
const MAX=512*1024;
export function imageType(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function attachImage(db:Database,api:APIs,conversation:string,key:string,photos:Photo[]):Promise<'saved'|'limit'|'error'>{
 if(await one(db,'SELECT id FROM intake_attachments WHERE source_key=?',key))return 'saved';
 const count=await one<{n:number}>(db,'SELECT COUNT(*) AS n FROM intake_attachments WHERE conversation_id=?',conversation);if((count?.n??0)>=4)return 'limit';
 const photo=[...photos].filter(p=>typeof p.file_id==='string'&&(p.file_size??0)<=MAX).sort((a,b)=>(b.width??0)*(b.height??0)-(a.width??0)*(a.height??0))[0];if(!photo)return 'error';
 try{
  const file=await api.bale<{file_path?:string;file_size?:number}>('getFile',{file_id:photo.file_id},false);
  if(!file.file_path||file.file_path.includes('..')||file.file_path.startsWith('/')||!/^[-\w./]+$/.test(file.file_path)||(file.file_size??0)>MAX)return 'error';
  const response=await fetch(`https://tapi.bale.ai/file/bot${api.env.BALE_TOKEN}/${file.file_path}`,{redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok||Number(response.headers.get('content-length'))>MAX)return 'error';
  const reader=response.body?.getReader();if(!reader)return 'error';const chunks:Uint8Array[]=[];let size=0;
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>MAX){await reader.cancel();return 'error';}chunks.push(r.value);}
  const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}
  const mime=imageType(bytes);if(!mime)return 'error';
  await execute(db,'INSERT OR IGNORE INTO intake_attachments(id,conversation_id,source_key,mime,data) VALUES (?,?,?,?,?)',crypto.randomUUID().replaceAll('-',''),conversation,key,mime,bytes.buffer);
  return 'saved';
 }catch{return 'error';}
}
export async function attachmentLinks(db:Database,conversation:string,base:string):Promise<{url:string}[]>{
 const found=await rows<{id:string}>(db,'SELECT id FROM intake_attachments WHERE conversation_id=? ORDER BY created_at,id',conversation);
 return found.map(v=>({url:base.replace(/\/$/,'')+'/media/'+v.id}));
}
export async function mediaResponse(db:Database,id:string):Promise<Response>{
 if(!/^[a-f0-9]{32}$/.test(id))return new Response('Not found',{status:404});
 const item=await one<{mime:string;data:ArrayBuffer|number[]}>(db,'SELECT mime,data FROM intake_attachments WHERE id=? AND published=1',id);
 if(!item)return new Response('Not found',{status:404});
 const data=Array.isArray(item.data)?new Uint8Array(item.data):item.data;
 return new Response(data,{headers:{'Content-Type':item.mime,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'public, max-age=86400'}});
}
