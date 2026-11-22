// Explicit opt-in only. Synthetic input; no Bale or GitHub writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {analyze} from '../src/ai-intake.ts';
import type {Database} from '../src/db.ts';
if(process.env.RUN_AI_LIVE!=='approved-1000-toman')throw Error('Owner spending approval required');
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ready")}}',d1Databases:{DB:'live-ai-synthetic'}}));
const nativeFetch=globalThis.fetch;
try{
 const db=await mf.getD1Database('DB');
 for(const f of ['0001_phase_zero.sql','0002_bridge.sql','0003_transport.sql','0004_intake.sql'])await db.exec((await readFile('migrations/'+f,'utf8')).replaceAll('\n',' '));
 await db.prepare("INSERT INTO conversations(id,user_id,chat_id,expires_at) VALUES ('live-test',0,0,unixepoch()+3600)").run();
 if(process.env.RUN_AI_VISION==='1'){const bytes=await readFile('test/fixtures/vision-panel.png');await db.prepare("INSERT INTO intake_attachments(id,conversation_id,source_key,mime,data) VALUES ('synthetic','live-test','synthetic','image/png',?)").bind(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)).run();}
 let calls=0;let diagnostic:Record<string,unknown>={};
 globalThis.fetch=async(input,init)=>{
  if(++calls>1)throw Error('Live test hard limit: one request');
  const r=await nativeFetch(input,init);let body:Record<string,any>={};
  try{body=await r.clone().json() as Record<string,any>;}catch{}
  diagnostic={http_status:r.status,usage:body.usage,finish_reason:body.choices?.[0]?.finish_reason,has_content:!!body.choices?.[0]?.message?.content,content_preview:process.env.RUN_AI_VISION==='1'?String(body.choices?.[0]?.message?.content??'').slice(0,1200):undefined,error_code:body.error?.code};
  return r;
 };
 const endpoint=(await readFile('.secrets/ai-api-url.txt','utf8')).trim().replace(/\/$/,'')+'/chat/completions';
 const free=new URL(endpoint).hostname==='coarena.ai';
 const sample=({clear:'وقتی توی موبایل روی واژه می‌زنم و پنل تحلیل رو می‌بندم، جای مطالعه‌ام گم می‌شه.',vague:'جستجو خرابه.',content:'ترجمه آیه ۱۴ سوره طه یه مشکلی داره.',image:'وقتی پنل بازه نوشته‌های پایین صفحه دیده نمی‌شه؛ تصویر صفحه رو هم فرستادم.'} as Record<string,string>)[process.env.AI_LIVE_CASE??'clear'];if(!sample)throw Error('Synthetic sample required');
 const report=await analyze({DB:db as unknown as Database,AI_ENABLED:'true',AI_VISION_ENABLED:process.env.RUN_AI_VISION==='1'?'true':undefined,AI_API_TOKEN:(await readFile('.secrets/ai-api-token','utf8')).trim(),AI_ENDPOINT:endpoint,AI_MODEL:process.env.AI_LIVE_MODEL??'z-ai/glm-5.3-flash',AI_REASONING_EFFORT:'low',AI_TIMEOUT_MS:'45000',AI_FREE_ONLY:free?'true':undefined,AI_INPUT_TOMAN_PER_MILLION:free?'0':'80000',AI_OUTPUT_TOMAN_PER_MILLION:free?'0':'280000',AI_REPORT_BUDGET_TOMAN:'1000'},'live-test','live-glm-1',sample);
 const usage=await db.prepare('SELECT state,input_tokens,output_tokens,estimated_cost,latency_ms,model FROM ai_usage').all();
 const evidence={timestamp:new Date().toISOString(),synthetic:true,calls,diagnostic,usage:usage.results,report,cost_note:free?'Provider advertises free daily allowance. No paid fallback or public writes.':'Conservative test accounting: 1 USD = 1,000,000 toman ceiling, not a claimed exchange rate. API rates USD 0.08/0.28 per million tokens. No real user content or public writes.'};
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/ai-live-'+(free?'coarena-':'iteracompute-')+(process.env.AI_LIVE_CASE??'clear')+'.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));
 if(process.env.RUN_AI_VISION==='1'&&!report.evidence_notes?.length)throw Error('Vision response omitted image observations');
 if((usage.results[0] as any)?.state!=='done')process.exitCode=1;
}finally{globalThis.fetch=nativeFetch;await mf.dispose();}
