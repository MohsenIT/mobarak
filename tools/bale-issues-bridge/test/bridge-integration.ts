// Synthetic local integration: real D1 storage, mocked official HTTP APIs.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import app from '../src/bridge-worker.ts';
import {drain,type BridgeEnv} from '../src/bridge.ts';
import type {Database} from '../src/db.ts';
import {pollBale} from '../src/bale-polling.ts';
import {effect} from '../src/effects.ts';
import {Retryable,Uncertain} from '../src/api.ts';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ready")}}',d1Databases:{DB:'bridge-test'}}));
const originalFetch=globalThis.fetch;
try{
 const db=await mf.getD1Database('DB');
 for(const file of ['0001_phase_zero.sql','0002_bridge.sql','0003_transport.sql'])await db.exec((await readFile('migrations/'+file,'utf8')).replaceAll('\n',' '));
 const env:BridgeEnv={DB:db as unknown as Database,BALE_TOKEN:'test-bot',GITHUB_TOKEN:'test-gh',GITHUB_REPO:'example/project',BALE_CHANNEL_ID:'100',BALE_GROUP_ID:'200',BALE_CHANNEL_USERNAME:'test_channel',BALE_BOT_ID:'99',BALE_WEBHOOK_SECRET:'b'.repeat(40),GITHUB_WEBHOOK_SECRET:'g'.repeat(40),ADMIN_SECRET:'a'.repeat(40),BRIDGE_ENABLED:'true'};
 const issue={id:1234,number:42,title:'',body:'',state:'open',state_reason:null as string|null,html_url:'https://github.com/example/project/issues/42',labels:[{name:'bug'}],updated_at:'2026-11-09T12:00:00Z'};
 let pollOffset=-1;let polled=false;
 const sent:{method:string;data:Record<string,unknown>}[]=[];let issueCreates=0,commentCreates=0;let seq=300;
 globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));const method=init?.method??'GET';const data=init?.body?JSON.parse(String(init.body)):{};
  if(url.hostname==='tapi.bale.ai'){
   const action=url.pathname.split('/').at(-1)!;
   if(action==='getUpdates'){pollOffset=data.offset;return Response.json({ok:true,result:polled?[]:[{update_id:80,message:{message_id:80,chat:{id:200,type:'group'}}}]});}
   sent.push({method:action,data});
   return Response.json({ok:true,result:action==='sendMessage'?{message_id:seq++,chat:{id:data.chat_id,type:'group'}}:true});
  }
  if(url.pathname==='/search/issues')return Response.json({items:issueCreates?[issue]:[]});
  if(url.pathname.endsWith('/issues')&&method==='POST'){issueCreates++;Object.assign(issue,{title:data.title,body:data.body});return Response.json(issue);}
  if(url.pathname.endsWith('/issues/42'))return Response.json(issue);
  if(url.pathname.endsWith('/comments')&&method==='POST'){commentCreates++;return Response.json({id:800+commentCreates,body:data.body,html_url:'https://github.com/example/project/issues/42#issuecomment-'+commentCreates,user:{login:'bridge-user'}});}
  throw new Error('Unexpected test HTTP request '+method+' '+url.pathname);
 };
 let delivery=0;
 async function send(payload:unknown,source='bale',kind='issues'){
  const data=JSON.stringify(payload);const headers:Record<string,string>={};let path='/webhooks/bale/'+env.BALE_WEBHOOK_SECRET;
  if(source==='github'){
   path='/webhooks/github';headers['X-GitHub-Event']=kind;headers['X-GitHub-Delivery']='test-delivery-'+delivery++;
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   headers['X-Hub-Signature-256']='sha256='+[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  const tasks:Promise<unknown>[]=[];const result=await app.fetch(new Request('https://bridge.test'+path,{method:'POST',headers,body:data}),env,{waitUntil:p=>tasks.push(p)});
  assert.equal(result.status,200);await Promise.all(tasks);
  for(let i=0;i<4;i++)await drain(env,3);
 }
 const privateMessage=(id:number,text:string)=>({update_id:id,message:{message_id:id,from:{id:777,is_bot:false},chat:{id:777,type:'private'},text}});
 await send(privateMessage(1,'جستجوی کتاب عربی خطا دارد'));
 assert.equal(issueCreates,0,'must never publish before explicit consent');
 const preview=sent.find(v=>v.method==='sendMessage'&&String(v.data.text).includes('متن قابل انتشار'));
 assert.ok(preview,'full preview and consent exist');
 const approved={update_id:2,callback_query:{id:'callback-2',from:{id:777},message:{message_id:300,chat:{id:777,type:'private'}},data:'approve:d1'}};
 await send(approved);await send(approved);
 assert.equal(issueCreates,1,'redelivery must not create another issue');
 const post=sent.find(v=>v.method==='sendMessage'&&v.data.chat_id===100)!;
 assert.ok(post);assert.ok(String(post.data.text).includes('#42'));assert.equal(issue.body.includes('777'),false);
 await send({update_id:3,message:{message_id:500,chat:{id:200,type:'group'},from:{is_bot:true,id:999,username:'test_channel'},text:post.data.text}});
 const mapped=await db.prepare('SELECT group_root_id FROM issues WHERE number=42').first<{group_root_id:number}>();
 assert.equal(mapped?.group_root_id,500);
 await send({update_id:4,message:{message_id:501,message_thread_id:500,chat:{id:200,type:'group'},from:{is_bot:false,id:888},text:'من هم همین مشکل را دارم',reply_to_message:{message_id:0}}});
 assert.equal(commentCreates,1);
 const before=sent.filter(v=>v.method==='sendMessage'&&v.data.chat_id===200).length;
 await send({repository:{full_name:'example/project'},action:'created',issue,comment:{id:801,body:'<!-- mobarak-bridge:bale:group:200:501 -->',user:{login:'bridge-user'},html_url:'https://github.com/example/project/issues/42#issuecomment-801'}},'github','issue_comment');
 assert.equal(sent.filter(v=>v.method==='sendMessage'&&v.data.chat_id===200).length,before,'must suppress comment loops');
 await send({repository:{full_name:'example/project'},action:'created',issue,comment:{id:900,body:'اصلاح شد؛ لطفاً بررسی کنید.',user:{login:'maintainer'},html_url:'https://github.com/example/project/issues/42#issuecomment-900'}},'github','issue_comment');
 assert.ok(sent.some(v=>v.method==='sendMessage'&&v.data.chat_id===200&&v.data.reply_to_message_id===500&&String(v.data.text).includes('از GitHub — maintainer')));
 issue.state='closed';issue.state_reason='completed';issue.updated_at='2026-11-09T13:00:00Z';
 await send({repository:{full_name:'example/project'},action:'closed',issue},'github');
 assert.equal(sent.filter(v=>v.method==='sendMessage'&&v.data.chat_id===100).length,1,'status must edit one original post');
 assert.ok(sent.some(v=>v.method==='editMessageText'&&v.data.chat_id===100&&String(v.data.text).includes('بسته‌شده')));
 assert.ok(sent.some(v=>v.method==='sendMessage'&&v.data.chat_id===777&&String(v.data.text).startsWith('وضعیت #42:')));
 await send(privateMessage(5,'جستجوی کتاب عربی خطا دارد'));
 const duplicate=await db.prepare("SELECT candidates_json FROM drafts WHERE id='d5'").first<{candidates_json:string}>();
 assert.equal(JSON.parse(duplicate!.candidates_json)[0].number,42);
 await send({update_id:6,callback_query:{id:'bad-owner',from:{id:555},message:{message_id:300,chat:{id:555,type:'private'}},data:'approve:d5'}});
 assert.equal(issueCreates,1,'another user cannot approve the draft');
 await send(privateMessage(7,'/report 42 محتوای نامناسب'));
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM abuse_reports').first<{n:number}>())?.n,1);
 const failed=await db.prepare("SELECT id,error_code FROM events WHERE state IN ('failed','uncertain')").all();
 assert.deepEqual(failed.results,[]);
 let attempts=0;
 await assert.rejects(effect(env.DB,'uncertain-test',async()=>{attempts++;throw new Uncertain('simulated_timeout');}),Uncertain);
 await assert.rejects(effect(env.DB,'uncertain-test',async()=>{attempts++;return {}; }),Uncertain);
 assert.equal(attempts,1,'ambiguous remote POST must not be repeated');
 await assert.rejects(effect(env.DB,'retry-test',async()=>{throw new Retryable('simulated_rate_limit');}),Retryable);
 assert.deepEqual(await effect(env.DB,'retry-test',async()=>({id:7})),{id:7});
 env.BALE_TRANSPORT='polling';await pollBale(env);
 assert.equal(pollOffset,0);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM events WHERE id='bale:80'").first<{n:number}>())?.n,1);
 polled=true;await pollBale(env);assert.equal(pollOffset,81,'poll offset advances only after durable storage');
 console.log('PASS: D1 + full consent/report flow, duplicate detection, issue/post uniqueness, thread mapping, both comment directions, loop prevention, GitHub close, reporter notification and abuse report');
}finally{globalThis.fetch=originalFetch;await mf.dispose();}
