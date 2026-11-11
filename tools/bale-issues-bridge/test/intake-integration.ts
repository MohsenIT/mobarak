// Local only. No public messages, real credentials or paid model calls.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Bridge,drain,type BridgeEnv} from '../src/bridge.ts';
import {Intake,type IntakeUpdate,type Conversation} from '../src/intake.ts';
import type {Database} from '../src/db.ts';
import {analyze} from '../src/ai-intake.ts';
import {rules} from '../src/intake-domain.ts';
import {mediaResponse} from '../src/attachments.ts';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ready")}}',d1Databases:{DB:'intake-test'}}));
const originalFetch=globalThis.fetch;
try{
 const db=await mf.getD1Database('DB');for(const file of ['0001_phase_zero.sql','0002_bridge.sql','0003_transport.sql','0004_intake.sql'])await db.exec((await readFile('migrations/'+file,'utf8')).replaceAll('\n',' '));
 let queries=0;const realDB=db as unknown as Database;const countedDB:Database={prepare(sql:string){queries++;return realDB.prepare(sql);}};
 const env:BridgeEnv={DB:countedDB,BALE_TOKEN:'test',GITHUB_TOKEN:'test',GITHUB_REPO:'example/project',BALE_CHANNEL_ID:'100',BALE_GROUP_ID:'200',BALE_CHANNEL_USERNAME:'channel',BALE_BOT_ID:'99',BALE_WEBHOOK_SECRET:'b',GITHUB_WEBHOOK_SECRET:'g',ADMIN_SECRET:'a',BRIDGE_ENABLED:'true',INTAKE_ENABLED:'true',PUBLIC_BASE_URL:'https://bridge.test',GITHUB_GOVERNANCE_READY:'true'};
 const sent:{method:string;data:Record<string,unknown>}[]=[];let sequence=100,issues=0,paid=0;let aiBad=false;let comments=0;
 const issue={id:50,number:42,title:'',body:'',state:'open',html_url:'https://github.com/example/project/issues/42',labels:[],updated_at:'2026-11-11T12:00:00Z'};
 globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));const data=typeof init?.body==='string'?JSON.parse(init.body):{};
  if(url.hostname==='model.test'){paid++;if(aiBad)return new Response('bad',{status:503});return Response.json({choices:[{message:{content:JSON.stringify({...rules('وقتی پنل تحلیل بسته می‌شود موقعیت مطالعه به ابتدای صفحه می‌رود.'),environment:{browser:'imaginary'}})}}],usage:{prompt_tokens:120,completion_tokens:80}});}
  if(url.pathname.startsWith('/file/'))return new Response(new Uint8Array([255,216,255,1,2,3]),{headers:{'Content-Type':'image/jpeg'}});
  if(url.hostname==='tapi.bale.ai'){const method=url.pathname.split('/').at(-1)!;sent.push({method,data});return Response.json({ok:true,result:method==='sendMessage'?{message_id:sequence++}:method==='getFile'?{file_path:'photos/test.jpg',file_size:6}:true});}
  if(url.pathname==='/search/issues')return Response.json({items:issues?[issue]:[]});
  if(url.pathname.endsWith('/issues')&&init?.method==='POST'){issues++;Object.assign(issue,data);assert.equal(data.type,'Bug');return Response.json(issue);}
  if(url.pathname.endsWith('/comments')&&init?.method==='POST'){comments++;return Response.json({id:900+comments,body:data.body,html_url:'https://github.com/example/project/issues/42#issuecomment-901',user:{login:'bridge'}});}
  if(url.pathname.endsWith('/issues/42'))return Response.json(issue);
  throw Error('Unexpected synthetic route '+url.pathname);
 };
 const bridge=new Bridge(env),intake=new Intake(bridge);let event=0;
 async function message(text:string,user=1,extra:Record<string,unknown>={}){const u={update_id:++event,message:{message_id:event,from:{id:user},chat:{id:user,type:'private'},text,...extra}};queries=0;await bridge.onBale(u);assert.ok(queries<=45,'private message D1 query budget: '+queries);return u;}
 async function current(user=1){return await db.prepare('SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1').bind(user).first<Conversation>();}
 async function click(action:string,user=1,arg?:string,c?:Conversation){c??=await current(user);const u:IntakeUpdate={update_id:++event,callback_query:{id:'q'+event,from:{id:user},message:{message_id:1,chat:{id:user,type:'private'}},data:`i:${action}:${c!.id}:${c!.revision}${arg?':'+arg:''}`}};queries=0;await intake.handle(u);assert.ok(queries<=45,'callback D1 query budget: '+queries);return u;}
 const first=await message('وقتی توی موبایل روی واژه می‌زنم و پنل تحلیل رو می‌بندم، جای مطالعه‌ام گم می‌شه.');
 let c=(await current())!;assert.equal(c.state,'preview');assert.equal(c.questions,0);assert.equal(issues,0);
 await bridge.onBale(first);assert.equal((await current())!.context.split('وقتی').length,2,'replayed user input must not append twice');
 await click('publish',2,undefined,c);assert.equal(issues,0,'another user cannot approve');
 const approve=await click('publish');await intake.handle(approve);assert.equal(issues,1);assert.equal((await current())!.state,'published');
 assert.equal(sent.filter(s=>s.method==='sendMessage'&&s.data.chat_id===100).length,1,'one channel post');
 await message(first.message.text,3);await click('duplicate',3,'42');assert.equal(issues,1);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id=3 AND issue_number=42').first<{n:number}>())!.n,1);
 const post=sent.find(s=>s.data.chat_id===100)!;
 await bridge.onBale({update_id:++event,message:{message_id:500,from:{id:99,is_bot:true,username:'channel'},chat:{id:200,type:'group'},text:String(post.data.text)}});
 await bridge.onBale({update_id:++event,message:{message_id:501,message_thread_id:500,from:{id:4,is_bot:false},chat:{id:200,type:'group'},text:'ممنون'}});assert.equal(comments,0);
 await bridge.onBale({update_id:++event,message:{message_id:502,message_thread_id:500,from:{id:4,is_bot:false},chat:{id:200,type:'group'},text:'در مرورگر فایرفاکس هم همین خطا رخ می‌دهد و تلفن 09123456789 است.'}});assert.equal(comments,1);
 Object.assign(issue,{labels:['bug','area:reader'],updated_at:'2026-11-11T12:01:00Z'});await bridge.onGitHub({repository:{full_name:'example/project'},issue},'issues','minor-label');
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM events WHERE kind='status'").first<{n:number}>())!.n,0,'minor technical labels do not notify');
 Object.assign(issue,{state:'closed',state_reason:'completed',updated_at:'2026-11-11T12:02:00Z'});await bridge.onGitHub({repository:{full_name:'example/project'},issue},'issues','closed');
 for(let n=0;n<4;n++)await drain(env);
 assert.ok(sent.some(s=>s.data.chat_id===3&&String(s.data.text).includes('بسته‌شده')));assert.equal(sent.some(s=>s.data.chat_id===4),false,'group participation alone cannot trigger private messages');
 await message('/new');await message('جستجو خرابه.');c=(await current())!;assert.equal(c.state,'clarifying');assert.equal(c.questions,1);
 await click('answer',1,'1');c=(await current())!;assert.equal(c.state,'preview');assert.equal(c.questions,1);
 const old={...c};await click('details');assert.ok(sent.some(s=>String(s.data.text).includes('### Summary')));await click('edit');await click('title');await message('عنوان اصلاح‌شده');c=(await current())!;assert.equal(JSON.parse(c.report_json).title,'عنوان اصلاح‌شده');assert.ok(c.context.includes('جستجو'));
 await click('publish',1,undefined,old);assert.equal(issues,1,'stale button cannot publish');
 await message('/new');await message('چطور ترجمه رو عوض کنم؟');assert.equal((await current())!.state,'help');await click('solved');assert.equal((await current())!.state,'resolved');assert.equal(issues,1);
 await message('/new');await message('ترجمه آیه ۱۴ سوره طه یه مشکلی داره.');c=(await current())!;assert.equal(c.state,'clarifying');await message('بخشی از جمله نمایش داده نمی‌شود و با منبع چاپی فرق دارد.');c=(await current())!;assert.equal(c.state,'preview');assert.equal(JSON.parse(c.report_json).needs_human_review,true);
 await message('/new');await message('جستجو خرابه.');c=(await current())!;await db.prepare('UPDATE conversations SET questions=2 WHERE id=?').bind(c.id).run();await intake.evaluate(await intake.load(c.id),'cap');assert.equal((await current())!.state,'preview');assert.equal((await current())!.questions,2);
 await message('/new');await message('موقع بستن پنل تحلیل به جای قبلی مطالعه برنمی‌گردم. ایمیل a@example.com و تلفن 09123456789');c=(await current())!;assert.equal(c.context.includes('example.com'),false);assert.equal(c.report_json.includes('091234'),false);
 await message('/start');assert.ok(sent.some(s=>String(s.data.text).includes('نیمه‌تمام')));await message('/continue');assert.equal((await current())!.id,c.id);
 await message('',1,{photo:[{file_id:'test-photo',file_size:6,width:100,height:100}]});c=(await current())!;assert.equal(c.state,'collecting');await click('ready');
 const media=await db.prepare('SELECT id,published FROM intake_attachments WHERE conversation_id=?').bind(c.id).first<{id:string;published:number}>();assert.ok(media);assert.equal((await mediaResponse(env.DB,media.id)).status,404);
 await db.prepare('UPDATE intake_attachments SET published=1 WHERE id=?').bind(media.id).run();assert.equal((await mediaResponse(env.DB,media.id)).status,200);
 await message('',1,{voice:{file_id:'voice'}});assert.ok(String(sent.at(-1)!.data.text).includes('تبدیل ویس'));
 const aiEnv={...env,AI_ENABLED:'true',AI_API_TOKEN:'mock',AI_ENDPOINT:'https://model.test/v1/chat/completions',AI_MODEL:'mock-small',AI_INPUT_TOMAN_PER_MILLION:'800',AI_OUTPUT_TOMAN_PER_MILLION:'4600',AI_REPORT_BUDGET_TOMAN:'100'};
 const r=await analyze(aiEnv,c.id,'ai-first',c.context);assert.equal(r.environment.browser,undefined);await analyze(aiEnv,c.id,'ai-first',c.context);assert.equal(paid,1,'replayed event must not pay again');
 aiBad=true;await analyze(aiEnv,c.id,'ai-failure',c.context);assert.equal(paid,2);await analyze(aiEnv,c.id,'ai-third',c.context);await analyze(aiEnv,c.id,'ai-fourth',c.context);assert.equal(paid,3,'normal report capped at three calls');
 await analyze({...aiEnv,AI_REPORT_BUDGET_TOMAN:'0'},c.id,'no-budget',c.context);assert.equal(paid,3);
 await message('/my');assert.ok(sent.some(s=>String(s.data.text).includes('#42')));
 await message('/forget');assert.equal((await current())!.context,'');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id=1').first<{n:number}>())!.n,0);
 console.log('PASS: zero-question report, one-question clarification, cap, consent, ownership, replay, correction, FAQ, content review, resume, privacy, image publication gate, AI fallback and budget, subscriptions and forget');
}finally{globalThis.fetch=originalFetch;await mf.dispose();}
