import {analyze} from './ai-intake.ts';
import {mediaResponse} from './attachments.ts';
import {Bridge,drain,type BridgeEnv} from './bridge.ts';
import {execute,rows,one} from './db.ts';
import {secretMatches,verifyGitHubSignature} from './security.ts';
import {pollingLoop} from './polling-loop.ts';
import {pollBale} from './bale-polling.ts';
import {routingUpdate} from './worker.ts';
interface Context {waitUntil(promise:Promise<unknown>):void;}
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function body(request:Request):Promise<Uint8Array<ArrayBuffer>>{
 const reader=request.body?.getReader();if(!reader)throw new Error('missing_body');
 const parts:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>262144){await reader.cancel();throw new Error('body_too_large');}parts.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
const parse=(bytes:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as Record<string,unknown>;
async function admin(request:Request,env:BridgeEnv,ctx:Context,path:string):Promise<Response>{
 if(!await secretMatches(request.headers.get('Authorization')?.replace(/^Bearer /,'')??'',env.ADMIN_SECRET))return json({error:'not_found'},404);
 if(path==='/admin/ai-check'&&request.method==='POST'){
  const id='probe-'+crypto.randomUUID();
  await execute(env.DB,'INSERT INTO conversations(id,user_id,chat_id,expires_at) VALUES (?,0,0,unixepoch()+3600)',id);
  await analyze(env,id,id,'وقتی در موبایل پنل تحلیل را می‌بندم جای مطالعه قبلی از دست می‌رود.');
  return json(await one(env.DB,'SELECT state,input_tokens,output_tokens,latency_ms FROM ai_usage WHERE conversation_id=?',id)??{state:'disabled_or_budget_blocked'});
 }
 if(path==='/admin/poll'&&request.method==='POST'){await pollBale(env);return json({ok:true});}
 if(path==='/admin/drain'&&request.method==='POST'){await drain(env);return json({ok:true});}
 if(path==='/admin/pump'&&request.method==='POST'){await pollBale(env);await drain(env);return json({ok:true});}
 if(path==='/admin/status'&&request.method==='GET'){
  return json({events:await rows(env.DB,'SELECT id,source,kind,state,attempts,error_code FROM events ORDER BY created_at DESC LIMIT 50'),
   intake_metrics:env.INTAKE_ENABLED==='true'?await rows(env.DB,"SELECT state,COUNT(*) AS count,SUM(input_tokens) AS input_tokens,SUM(output_tokens) AS output_tokens,SUM(estimated_cost) AS estimated_cost FROM ai_usage GROUP BY state"):[],
   uncertain_effects:await rows(env.DB,"SELECT id,state,updated_at FROM effects WHERE state='uncertain' ORDER BY updated_at DESC LIMIT 50"),
   abuse_reports:await rows(env.DB,"SELECT id,issue_number,reason,state FROM abuse_reports WHERE state='open' ORDER BY created_at DESC LIMIT 50")});
 }
 if(path==='/admin/events'&&request.method==='GET')return json(await rows(env.DB,'SELECT update_id,received_at,routing_json FROM probe_events ORDER BY update_id DESC LIMIT 100'));
 if(path==='/admin/sync'&&request.method==='POST'){
  const input=parse(await body(request));if(!Number.isSafeInteger(input.number)||Number(input.number)<1)return json({error:'invalid_issue'},400);
  await new Bridge(env).queue('manual-sync:'+input.number+':'+crypto.randomUUID(),'internal','sync',{number:input.number});
  ctx.waitUntil(drain(env).catch(()=>undefined));return json({queued:true},202);
 }
 if(path==='/admin/retry'&&request.method==='POST'){
  const input=parse(await body(request));if(typeof input.id!=='string')return json({error:'invalid_id'},400);
  const event=await one<{state:string}>(env.DB,'SELECT state FROM events WHERE id=?',input.id);
  if(event?.state==='uncertain')return json({error:'reconcile_remote_side_effect_first'},409);
  await execute(env.DB,"UPDATE events SET state='pending',attempts=0,available_at=0 WHERE id=? AND state='failed'",input.id);
  ctx.waitUntil(drain(env).catch(()=>undefined));return json({queued:true},202);
 }
 if(path==='/admin/reconcile'&&request.method==='POST'){
  const input=parse(await body(request));if(typeof input.effectId!=='string'||typeof input.eventId!=='string'||!input.result||typeof input.result!=='object')return json({error:'invalid_reconciliation'},400);
  const changed=await execute(env.DB,"UPDATE effects SET state='done',result_json=?,updated_at=unixepoch() WHERE id=? AND state='uncertain'",JSON.stringify(input.result),input.effectId);
  if(!changed)return json({error:'uncertain_effect_not_found'},409);
  await execute(env.DB,"UPDATE events SET state='pending',attempts=0,available_at=0 WHERE id=? AND state='uncertain'",input.eventId);
  ctx.waitUntil(drain(env).catch(()=>undefined));return json({reconciled:true},202);
 }
 return json({error:'not_found'},404);
}
export default {
 async fetch(request:Request,env:BridgeEnv,ctx:Context):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(env.INTAKE_ENABLED==='true'&&path.startsWith('/media/')&&request.method==='GET')return mediaResponse(env.DB,path.slice(7));
  if(path==='/health'&&request.method==='GET')return json({service:'bale-github-bridge',stage:'bridge',bridge_enabled:env.BRIDGE_ENABLED==='true',bale_transport:env.BALE_TRANSPORT??'webhook',intake_enabled:env.INTAKE_ENABLED==='true',ai_enabled:env.AI_ENABLED==='true'&&!!env.AI_API_TOKEN&&!!env.AI_ENDPOINT&&(Number(env.AI_REPORT_BUDGET_TOMAN)>0||env.AI_FREE_ONLY==='true')});
  try{
   if(path.startsWith('/admin/'))return await admin(request,env,ctx,path);
   if(request.method!=='POST')return json({error:'not_found'},404);
   let source:string,kind:string,id:string,payload:Record<string,unknown>;
   if(path.startsWith('/webhooks/bale/')){
    if(!await secretMatches(path.slice('/webhooks/bale/'.length),env.BALE_WEBHOOK_SECRET))return json({error:'not_found'},404);
    const bytes=await body(request);payload=parse(bytes);const safe=routingUpdate(payload);
    source='bale';kind='update';id='bale:'+safe.update_id;
    await execute(env.DB,'INSERT OR IGNORE INTO probe_events(update_id,routing_json) VALUES (?,?)',safe.update_id,JSON.stringify(safe));
   }else if(path==='/webhooks/github'){
    const bytes=await body(request);
    if(!await verifyGitHubSignature(bytes,request.headers.get('X-Hub-Signature-256'),env.GITHUB_WEBHOOK_SECRET))return json({error:'invalid_signature'},401);
    payload=parse(bytes);kind=request.headers.get('X-GitHub-Event')??'';
    if(kind==='ping')return json({ok:true});
    if(!['issues','issue_comment'].includes(kind))return json({ignored:true});
    if((payload.repository as {full_name?:string}|undefined)?.full_name?.toLowerCase()!==env.GITHUB_REPO.toLowerCase())return json({error:'wrong_repository'},403);
    const delivery=request.headers.get('X-GitHub-Delivery');if(!delivery||!/^[a-zA-Z0-9-]{1,100}$/.test(delivery))return json({error:'invalid_delivery'},400);
    source='github';id='github:'+delivery;
   }else return json({error:'not_found'},404);
   await execute(env.DB,'INSERT OR IGNORE INTO events(id,source,kind,payload_json) VALUES (?,?,?,?)',id,source,kind,JSON.stringify(payload));
   ctx.waitUntil(drain(env).catch(()=>undefined));
   return json({ok:true});
  }catch(error){
   if(error instanceof SyntaxError||error instanceof TypeError||error instanceof Error&&['invalid update','missing_body','body_too_large'].includes(error.message))return json({error:'invalid_payload'},400);
   return json({error:'temporarily_unavailable'},503);
  }
 },
 async scheduled(_event:unknown,env:BridgeEnv,ctx:Context):Promise<void>{
  ctx.waitUntil((async()=>{
   if(env.PUMP&&env.BALE_TRANSPORT==='polling'){
    ctx.waitUntil(pollingLoop(env));
    if(new Date().getUTCMinutes()!==0)return;
   }else{
    await pollBale(env);
    if(new Date().getUTCMinutes()!==0){await drain(env,2);return;}
   }
   // Cleanup runs hourly in a separate invocation budget from report processing.
   const cutoff=Math.floor(Date.now()/1000)-7*86400;
   await execute(env.DB,'DELETE FROM drafts WHERE expires_at<?',cutoff);
   if(env.INTAKE_ENABLED==='true'){
    await execute(env.DB,'DELETE FROM intake_inputs WHERE conversation_id IN (SELECT id FROM conversations WHERE expires_at<?)',cutoff);
    await execute(env.DB,'DELETE FROM intake_attachments WHERE published=0 AND conversation_id IN (SELECT id FROM conversations WHERE expires_at<?)',cutoff);
    await execute(env.DB,"UPDATE conversations SET context='',report_json='{}',question=NULL,options_json='[]',state=CASE WHEN state='published' THEN state ELSE 'cancelled' END WHERE expires_at<? AND context!=''",cutoff);
    await execute(env.DB,'UPDATE ai_usage SET result_json=NULL WHERE result_json IS NOT NULL AND conversation_id IN (SELECT id FROM conversations WHERE expires_at<?)',cutoff);
    await execute(env.DB,'DELETE FROM ai_usage WHERE created_at<?',cutoff-23*86400);
   }
   await execute(env.DB,"UPDATE events SET payload_json='{}' WHERE created_at<? AND payload_json!='{}'",cutoff);
   await execute(env.DB,"DELETE FROM events WHERE state='done' AND created_at<?",cutoff-23*86400);
   await execute(env.DB,"DELETE FROM probe_events WHERE received_at<datetime('now','-7 days')");
  })().catch(()=>undefined));
 }
};
