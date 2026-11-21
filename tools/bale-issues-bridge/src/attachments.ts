import {APIs} from './api.ts';
import {execute,one,rows,type Database} from './db.ts';
export interface Photo {file_id:string;file_size?:number;width?:number;height?:number;}
export const MAX_IMAGE_BYTES=1536*1024;
const MAX=MAX_IMAGE_BYTES;
export type AttachmentResult='saved'|'limit'|'too_large'|'download_error'|'invalid_image'|'storage_error';
export function imageType(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export async function attachImage(db:Database,api:APIs,conversation:string,key:string,photos:Photo[]):Promise<AttachmentResult>{
 if(await one(db,'SELECT id FROM intake_attachments WHERE source_key=?',key))return 'saved';
 const count=await one<{n:number}>(db,'SELECT COUNT(*) AS n FROM intake_attachments WHERE conversation_id=?',conversation);if((count?.n??0)>=4)return 'limit';
 const candidates=photos.filter(p=>typeof p.file_id==='string'&&(p.file_size??0)<=MAX);
 const medium=candidates.filter(p=>Math.max(p.width??0,p.height??0)<=1280);
 const photo=[...(medium.length?medium:candidates)].sort((a,b)=>(b.width??0)*(b.height??0)-(a.width??0)*(a.height??0))[0];if(!photo)return 'too_large';
 let stage:AttachmentResult='download_error';
 try{
  const file=await api.bale<{file_path?:string;file_size?:number}>('getFile',{file_id:photo.file_id},false);
  if((file.file_size??0)>MAX)return 'too_large';
  if(!file.file_path)return 'download_error';
  const prefix=`https://tapi.bale.ai/file/bot${api.env.BALE_TOKEN}/`;
  let url:URL;
  try{
   if(file.file_path.startsWith('https://')){url=new URL(file.file_path);if(!url.href.startsWith(prefix))return 'download_error';}
   else{
    const parts=file.file_path.split('/').map(v=>decodeURIComponent(v));
    if(parts.some(v=>v==='..'||v==='.'||/[\\/\x00-\x1f]/.test(v))||file.file_path.startsWith('/'))return 'download_error';
    url=new URL(prefix+parts.map(encodeURIComponent).join('/'));
   }
  }catch{return 'download_error';}
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(!response.ok)return 'download_error';
  if(Number(response.headers.get('content-length'))>MAX){await response.body?.cancel();return 'too_large';}
  const reader=response.body?.getReader();if(!reader)return 'download_error';const chunks:Uint8Array[]=[];let size=0;
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>MAX){await reader.cancel();return 'too_large';}chunks.push(r.value);}
  const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}
  const mime=imageType(bytes);if(!mime)return 'invalid_image';
  stage='storage_error';
  await execute(db,'INSERT OR IGNORE INTO intake_attachments(id,conversation_id,source_key,mime,data) VALUES (?,?,?,?,?)',crypto.randomUUID().replaceAll('-',''),conversation,key,mime,bytes.buffer);
  return 'saved';
 }catch{return stage;}
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

export interface VisionImage {mime:string;base64:string;}
// Only private bytes go to the configured model. Never expose a Bale token URL.
export async function visionImages(db:Database,conversation:string):Promise<VisionImage[]>{
 const found=await rows<{mime:string;data:ArrayBuffer|number[]}>(db,'SELECT mime,data FROM intake_attachments WHERE conversation_id=? ORDER BY created_at DESC,rowid DESC LIMIT 2',conversation);
 return found.map(item=>{
  const bytes=Array.isArray(item.data)?new Uint8Array(item.data):new Uint8Array(item.data);
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {mime:item.mime,base64:btoa(binary)};
 });
}
