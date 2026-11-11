import {Intake} from './intake.ts';
import type {AIEnv} from './ai-intake.ts';
import {redact,usefulComment,ui} from './intake-domain.ts';
import {APIs,Retryable,Rejected,Uncertain} from './api.ts';
import {execute,one,rows,type Database} from './db.ts';
import {effect} from './effects.ts';
import {categories,categoryForIssue,classify,reportTitle,similarity,channelPost,githubComment,toBaleComment,statusText,publicBody,type Category,type PublicIssue} from './domain.ts';
import {digest,aliasFor} from './security.ts';

export interface BridgeEnv extends AIEnv {
 DB:Database; BALE_TOKEN:string; GITHUB_TOKEN:string; GITHUB_REPO:string;
 BALE_CHANNEL_ID:string; BALE_GROUP_ID:string; BALE_CHANNEL_USERNAME:string; BALE_BOT_ID:string;
 BALE_WEBHOOK_SECRET:string; GITHUB_WEBHOOK_SECRET:string; ADMIN_SECRET:string;
 INTAKE_ENABLED?:string;PUBLIC_BASE_URL?:string;GITHUB_GOVERNANCE_READY?:string; CATEGORIES_JSON?:string; BRIDGE_ENABLED?:string; BALE_TRANSPORT?:'webhook'|'polling';
}
export interface EventRow {id:string;source:string;kind:string;payload_json:string;attempts:number;}
interface IssueRow {number:number;github_id:number;title:string;body:string|null;labels_json:string;state:string;state_reason:string|null;url:string;channel_post_id:number|null;group_root_id:number|null;canonical_text:string|null;reporter_chat_id:number|null;updated_at:string;}
interface GitIssue extends PublicIssue {updated_at:string;}
interface Draft {id:string;user_id:number;chat_id:number;body:string;title:string;category:string;mode:string;target_issue:number|null;candidates_json:string;state:string;issue_number:number|null;expires_at:number;report_json?:string|null;}
interface User {id:number;is_bot?:boolean;username?:string;}
interface Message {message_id:number;message_thread_id?:number;date?:number;text?:string;from?:User;chat:{id:number;type:string};reply_to_message?:Message;}
interface BaleUpdate {update_id:number;message?:Message;edited_message?:Message;callback_query?:{id:string;from:User;data?:string;message?:Message};}
interface Candidate {number:number;title:string;url:string;post:number|null;score:number;}
type GHComment={id:number;body:string;html_url:string;user:{login:string}};
const now=()=>Math.floor(Date.now()/1000);
const safeNumber=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export class Bridge {
 env:BridgeEnv;api:APIs;available:Category[];
 constructor(env:BridgeEnv){this.env=env;this.api=new APIs(env);this.available=categories(env.CATEGORIES_JSON);}
 async say(key:string,chat:number,text:string,buttons?:{text:string;callback_data?:string;url?:string}[][]):Promise<{message_id:number}>{
  return effect(this.env.DB,key,()=>this.api.bale('sendMessage',{chat_id:chat,text,...(buttons?{reply_markup:{inline_keyboard:buttons}}:{})}));
 }
 async issue(number:number):Promise<GitIssue>{return this.api.github(this.api.repo('/issues/'+number));}
 postLink(message:number):string{return `https://ble.ir/${this.env.BALE_CHANNEL_USERNAME.replace(/^@/,'')}/${message}`;}
 async saveIssue(issue:GitIssue,reporter?:number):Promise<IssueRow>{
  if(issue.pull_request)throw new Rejected('pull_request_not_issue');
  await execute(this.env.DB,`INSERT INTO issues(number,github_id,title,body,labels_json,state,state_reason,url,updated_at,reporter_chat_id)
   VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(number) DO UPDATE SET title=excluded.title,body=excluded.body,
   labels_json=excluded.labels_json,state=excluded.state,state_reason=excluded.state_reason,url=excluded.url,
   updated_at=excluded.updated_at,reporter_chat_id=COALESCE(issues.reporter_chat_id,excluded.reporter_chat_id) WHERE issues.updated_at<=excluded.updated_at`,
   issue.number,issue.id,issue.title,issue.body,JSON.stringify(issue.labels),issue.state,issue.state_reason??null,issue.html_url,issue.updated_at,reporter??null);
  return (await one<IssueRow>(this.env.DB,'SELECT * FROM issues WHERE number=?',issue.number))!;
 }
 async syncIssue(issue:GitIssue,eventKey:string,reporter?:number):Promise<IssueRow>{
  const old=await one<IssueRow>(this.env.DB,'SELECT * FROM issues WHERE number=?',issue.number);
  if(old&&old.updated_at>issue.updated_at)return old;
  const previous=old?{id:old.github_id,number:old.number,title:old.title,body:old.body,state:old.state,state_reason:old.state_reason,html_url:old.url,labels:JSON.parse(old.labels_json)}:undefined;
  if(old&&previous&&(statusText(previous)!==statusText(issue)||categoryForIssue(previous,this.available).key!==categoryForIssue(issue,this.available).key)){
   const text=`وضعیت #${issue.number}: ${statusText(issue)}\nدسته: #${categoryForIssue(issue,this.available).hashtag}\n${issue.html_url}`;
   await this.queue('status:'+issue.number+':'+issue.updated_at+':'+(await digest(text)).slice(0,12),'internal','status',{number:issue.number,text});
  }
  let saved=await this.saveIssue(issue,reporter);
  if(saved.updated_at>issue.updated_at)return saved;
  const text=channelPost(issue,this.available);
  await execute(this.env.DB,'INSERT OR IGNORE INTO post_versions(issue_number,body_hash) VALUES (?,?)',issue.number,await digest(text));
  if(!saved.channel_post_id){
   // One durable effect key per issue across all webhook deliveries and report submissions.
   const post=await this.say('channel-post:'+issue.number,Number(this.env.BALE_CHANNEL_ID),text);
   await execute(this.env.DB,'UPDATE issues SET channel_post_id=?,canonical_text=? WHERE number=? AND channel_post_id IS NULL',post.message_id,text,issue.number);
  }else if(saved.canonical_text!==text){
   await effect(this.env.DB,'post-edit:'+issue.number+':'+await digest(text),()=>this.api.bale('editMessageText',{
    chat_id:Number(this.env.BALE_CHANNEL_ID),message_id:saved.channel_post_id,text
   },false),true);
   await execute(this.env.DB,'UPDATE issues SET canonical_text=? WHERE number=?',text,issue.number);
  }
  saved=(await one<IssueRow>(this.env.DB,'SELECT * FROM issues WHERE number=?',issue.number))!;
  return saved;
 }
 async queue(id:string,source:string,kind:string,payload:unknown):Promise<void>{
  await execute(this.env.DB,'INSERT OR IGNORE INTO events(id,source,kind,payload_json) VALUES (?,?,?,?)',id,source,kind,JSON.stringify(payload));
 }
 async candidates(text:string):Promise<{items:Candidate[];degraded:boolean}>{
  let found:PublicIssue[]=[];let degraded=false;
  const keywords=reportTitle(text).replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(v=>v.length>2).slice(0,5).join(' ');
  if(keywords){try{found=(await this.api.github<{items:PublicIssue[]}>(`/search/issues?q=${encodeURIComponent(`repo:${this.env.GITHUB_REPO} is:issue in:title,body ${keywords}`)}&per_page=10`)).items;}catch{degraded=true;}}
  const cached=await rows<IssueRow>(this.env.DB,'SELECT * FROM issues ORDER BY updated_at DESC LIMIT 300');
  const map=new Map<number,Candidate>();
  for(const issue of found){if(issue.pull_request)continue;map.set(issue.number,{number:issue.number,title:issue.title,url:issue.html_url,post:cached.find(c=>c.number===issue.number)?.channel_post_id??null,score:Math.max(similarity(text,issue.title),similarity(text,issue.title+' '+publicBody(issue.body)))});}
  for(const issue of cached){
   const score=Math.max(similarity(text,issue.title),similarity(text,issue.title+' '+publicBody(issue.body)));
   if(!map.has(issue.number)||score>(map.get(issue.number)?.score??0))map.set(issue.number,{number:issue.number,title:issue.title,url:issue.url,post:issue.channel_post_id,score});
  }
  return {items:[...map.values()].filter(i=>i.score>=0.15).sort((a,b)=>b.score-a.score).slice(0,3),degraded};
 }
 async newDraft(update:BaleUpdate,message:Message,mode='report',target?:number):Promise<void>{
  const user=message.from!;const text=message.text!.trim();const id='d'+update.update_id;
  if(text.length>2800){await this.say('long:'+update.update_id,message.chat.id,'لطفاً متن را به حداکثر ۲۸۰۰ نویسه کوتاه کنید تا پیش از انتشار، تمام آن قابل بررسی باشد.');return;}
  const count=await one<{n:number}>(this.env.DB,'SELECT COUNT(*) AS n FROM drafts WHERE user_id=? AND created_at>?',user.id,now()-86400);
  if((count?.n??0)>=20){await this.say('limit:'+update.update_id,message.chat.id,'سقف روزانهٔ ثبت گزارش پر شده است؛ فردا دوباره تلاش کنید.');return;}
  const category=classify(text,this.available);const title=mode==='comment'?`توضیح تکمیلی #${target}`:reportTitle(text);
  const similar=mode==='report'?await this.candidates(text):{items:[],degraded:false};
  await execute(this.env.DB,`INSERT OR IGNORE INTO drafts(id,user_id,chat_id,body,title,category,mode,target_issue,candidates_json,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,id,user.id,message.chat.id,text,title,category.key,mode,target??null,JSON.stringify(similar.items),now()+86400);
  const buttons:{text:string;callback_data?:string;url?:string}[][]=[];
  const matches=similar.items.map(i=>`#${i.number} — ${i.title}`).join('\n');
  for(const item of similar.items)buttons.push([{text:`همین موضوع است: #${item.number}`,callback_data:`use:${id}:${item.number}`}]);
  buttons.push([{text:mode==='report'?'تأیید انتشار موضوع جدید':'تأیید انتشار توضیح',callback_data:`approve:${id}`}]);
  if(mode==='report')buttons.push(this.available.map(c=>({text:'#'+c.hashtag,callback_data:`category:${id}:${c.key}`})));
  buttons.push([{text:'اصلاح متن',callback_data:`edit:${id}`},{text:'لغو',callback_data:`cancel:${id}`}]);
  await this.say('draft-preview:'+id,message.chat.id,
   `${title}\nدسته: #${category.hashtag}\n\nمتن قابل انتشار:\n${text}\n\n${matches?'موضوع‌های احتمالاً مشابه:\n'+matches+'\n\n':''}${similar.degraded?'بررسی موضوع‌های مشابه کامل نبود؛ پیش از ثبت، نتیجه‌ها را مرور کنید.\n':''}با تأیید، همین متن در GitHub و کانال عمومی منتشر می‌شود. نام، شناسه و گفت‌وگوی خصوصی شما منتشر نمی‌شود؛ اطلاعات خصوصی داخل متن را پیش از تأیید حذف کنید.`,buttons);
 }
 async callback(update:BaleUpdate):Promise<void>{
  const q=update.callback_query!;if(await one(this.env.DB,'SELECT user_id FROM blocked_users WHERE user_id=?',q.from.id))return;
  if(!q.data||!q.message||q.message.chat.type!=='private')return;
  const [action,id,arg]=q.data.split(':');
  const draft=await one<Draft>(this.env.DB,'SELECT * FROM drafts WHERE id=? AND user_id=? AND chat_id=?',id,q.from.id,q.message.chat.id);
  await effect(this.env.DB,'callback-answer:'+q.id,()=>this.api.bale('answerCallbackQuery',{callback_query_id:q.id},false),true).catch(()=>undefined);
  if(!draft||draft.expires_at<now()||draft.state==='cancelled'){
   await this.say('stale:'+update.update_id,q.message.chat.id,'این درخواست منقضی یا لغو شده است. گزارش را دوباره بفرستید.');return;
  }
  if(draft.state==='created'){
   await this.say('already:'+update.update_id,draft.chat_id,`این درخواست قبلاً برای #${draft.issue_number} ثبت شده است.`);return;
  }
  if((action==='cancel'||action==='edit'||action==='category')&&draft.state!=='draft'){await this.say('busy:'+update.update_id,draft.chat_id,'درخواست در حال ثبت است؛ لطفاً منتظر نتیجه بمانید.');return;}
  if(action==='cancel'||action==='edit'){
   await execute(this.env.DB,"UPDATE drafts SET state='cancelled' WHERE id=? AND state='draft'",id);
   await this.say('draft-'+action+':'+id,draft.chat_id,action==='edit'?'متن اصلاح‌شده را در یک پیام تازه بفرستید.':'درخواست لغو شد.');return;
  }
  if(action==='category'){
   const cat=this.available.find(c=>c.key===arg);if(!cat)return;
   await execute(this.env.DB,"UPDATE drafts SET category=? WHERE id=? AND state='draft'",cat.key,id);
   await this.say('category:'+update.update_id,draft.chat_id,`دسته به #${cat.hashtag} تغییر کرد. برای انتشار، دکمهٔ تأیید همان پیش‌نمایش را بزنید.`);return;
  }
  if(action==='use'){
   const selected=(JSON.parse(draft.candidates_json) as Candidate[]).find(i=>i.number===Number(arg));if(!selected)return;
   const issue=await this.syncIssue(await this.issue(selected.number),'duplicate:'+id);
   await execute(this.env.DB,"UPDATE drafts SET state='created',issue_number=? WHERE id=?",selected.number,id);
   await this.say('duplicate-result:'+id,draft.chat_id,`موضوع قبلی #${selected.number}\n${selected.url}\n${this.postLink(issue.channel_post_id!)}\nتوضیح تکمیلی را زیر همان پست بنویسید.`);return;
  }
  if(action!=='approve')return;
  await execute(this.env.DB,"UPDATE drafts SET state='publishing' WHERE id=? AND state='draft'",id);
  if(draft.mode==='comment'){
   const issue=await this.syncIssue(await this.issue(draft.target_issue!),'supplement:'+id);
   await this.createBaleComment('private:'+id,issue,draft.body,q.from.id);
   await execute(this.env.DB,"UPDATE drafts SET state='created',issue_number=? WHERE id=?",issue.number,id);
   await this.say('supplement-result:'+id,draft.chat_id,`توضیح برای #${issue.number} ثبت شد.\n${issue.url}`);return;
  }
  const cat=this.available.find(c=>c.key===draft.category)??this.available[0];
  const structured=draft.report_json?JSON.parse(draft.report_json) as {type?:string;labels:string[]}:undefined;
  const issue=await effect<GitIssue>(this.env.DB,'github-create:'+id,()=>this.api.github(this.api.repo('/issues'),'POST',{
   title:draft.title,body:draft.body+`\n\n<!-- mobarak-bridge:report:${id} -->`,labels:[cat.label,...(structured&&this.env.GITHUB_GOVERNANCE_READY==='true'?structured.labels:[])],...(structured?.type?{type:structured.type}:{})
  }));
  const saved=await this.syncIssue(issue,'report:'+id,draft.chat_id);
  await execute(this.env.DB,"UPDATE drafts SET state='created',issue_number=? WHERE id=?",issue.number,id);
  await this.say('report-result:'+id,draft.chat_id,this.env.INTAKE_ENABLED==='true'?`${ui.success}\nشماره گزارش: #${issue.number}\n${this.postLink(saved.channel_post_id!)}`:`گزارش #${issue.number} ثبت شد.\n${issue.html_url}\n${this.postLink(saved.channel_post_id!)}\nنتیجه و تغییر وضعیت را همین‌جا دریافت می‌کنید.`,this.env.INTAKE_ENABLED==='true'?[[{text:ui.view,url:this.postLink(saved.channel_post_id!)},{text:ui.mine,callback_data:'menu:mine'}],[{text:ui.new_short,callback_data:'menu:new'}]]:undefined);
 }
 async createBaleComment(key:string,issue:IssueRow,text:string,userId:number,sourceMessage?:number):Promise<void>{
  const marker='bale:'+key;if(this.env.INTAKE_ENABLED==='true')text=redact(text).text;const alias=await aliasFor(userId,this.env.ADMIN_SECRET);
  const comment=await effect<GHComment>(this.env.DB,'github-comment:'+key,()=>this.api.github(this.api.repo(`/issues/${issue.number}/comments`),'POST',{body:githubComment(text,alias,marker)}));
  await execute(this.env.DB,'INSERT OR IGNORE INTO comment_links(source,source_id,issue_number,github_comment_id,bale_message_id) VALUES (?,?,?,?,?)','bale',key,issue.number,comment.id,sourceMessage??null);
  if(!sourceMessage){
   if(!issue.group_root_id)throw new Retryable('await_group_root',15);
   await effect(this.env.DB,'private-comment-mirror:'+key,()=>this.api.bale('sendMessage',{chat_id:Number(this.env.BALE_GROUP_ID),reply_to_message_id:issue.group_root_id,text:`از بله — ${alias}\n\n${text}`}));
  }
 }
 async onBale(update:BaleUpdate):Promise<void>{
  if(this.env.INTAKE_ENABLED==='true'&&await new Intake(this).handle(update))return;
  if(update.callback_query){await this.callback(update);return;}
  const message=update.message??update.edited_message;
  if(!message)return;
  if(message.chat.id===Number(this.env.BALE_GROUP_ID)&&message.chat.type==='group'){
   const from=message.from;
   if(from?.is_bot&&from.username===this.env.BALE_CHANNEL_USERNAME.replace(/^@/, '')&&message.text&&!message.reply_to_message){
    const matches=await rows<{issue_number:number}>(this.env.DB,'SELECT issue_number FROM post_versions WHERE body_hash=?',await digest(message.text));
    if(matches.length===1){
     const number=matches[0].issue_number;
     await execute(this.env.DB,'INSERT OR IGNORE INTO threads(root_id,issue_number) VALUES (?,?)',message.message_id,number);
     await execute(this.env.DB,'UPDATE issues SET group_root_id=COALESCE(group_root_id,?) WHERE number=?',message.message_id,number);
    }else if(matches.length>1)throw new Rejected('ambiguous_channel_mirror');
    return;
   }
   if(!from||from.is_bot||!message.text||!safeNumber(message.message_thread_id))return;
   if(await one(this.env.DB,'SELECT user_id FROM blocked_users WHERE user_id=?',from.id))return;
   const thread=await one<{issue_number:number}>(this.env.DB,'SELECT issue_number FROM threads WHERE root_id=?',message.message_thread_id);
   if(!thread)throw new Retryable('unknown_thread_waiting_for_mirror',60);
   const issue=(await one<IssueRow>(this.env.DB,'SELECT * FROM issues WHERE number=?',thread.issue_number))!;
   const key=`group:${message.chat.id}:${message.message_id}`;
   if(this.env.INTAKE_ENABLED==='true'){
    await execute(this.env.DB,'INSERT OR IGNORE INTO participants(user_id,issue_number) VALUES (?,?)',from.id,issue.number);
    if(!usefulComment(message.text))return;
   }
   if(update.edited_message){
    const link=await one<{github_comment_id:number}>(this.env.DB,"SELECT github_comment_id FROM comment_links WHERE source='bale' AND source_id=?",key);
    if(!link)return;
    const alias=await aliasFor(from.id,this.env.ADMIN_SECRET);
    await effect(this.env.DB,'github-comment-edit:'+update.update_id,()=>this.api.github(this.api.repo('/issues/comments/'+link.github_comment_id),'PATCH',{body:githubComment(message.text!,alias,'bale:'+key)}),true);
   }else await this.createBaleComment(key,issue,message.text,from.id,message.message_id);
   return;
  }
  if(message.chat.type!=='private'||!message.from||message.from.is_bot||!message.text)return;
  if(await one(this.env.DB,'SELECT user_id FROM blocked_users WHERE user_id=?',message.from.id))return;
  if(update.edited_message){await this.say('private-edit:'+update.update_id,message.chat.id,'برای اصلاح پیش‌نویس، متن کامل اصلاح‌شده را در پیام تازه بفرستید.');return;}
  const text=message.text.trim();
  if(/^\/(start|help|new|privacy)(\s|$)/.test(text)){
   await this.say('welcome:'+update.update_id,message.chat.id,'مشکل یا پیشنهاد خود را در یک پیام بفرستید. پیش از انتشار عمومی، متن و دسته را برای تأیید نشان می‌دهم.\n\nدیدگاه‌های کانال به GitHub عمومی منتقل می‌شوند؛ از درج اطلاعات خصوصی خودداری کنید. نام و شناسهٔ خصوصی شما منتشر نمی‌شود.\n\n/status شماره: وضعیت\n/comment شماره متن: توضیح تکمیلی با تأیید\n/report شماره دلیل: گزارش محتوای نامناسب\n/cancel: لغو پیش‌نویس‌ها\n/forget: حذف پیش‌نویس و توقف پیگیری خصوصی');return;
  }
  if(text==='/cancel'){
   await execute(this.env.DB,"UPDATE drafts SET state='cancelled' WHERE user_id=? AND state='draft'",message.from.id);
   await this.say('cancel-all:'+update.update_id,message.chat.id,'پیش‌نویس‌های تأییدنشده لغو شدند.');return;
  }
  if(text==='/forget'){
   await execute(this.env.DB,'DELETE FROM drafts WHERE user_id=?',message.from.id);
   await execute(this.env.DB,'UPDATE issues SET reporter_chat_id=NULL WHERE reporter_chat_id=?',message.chat.id);
   await this.say('forget:'+update.update_id,message.chat.id,'پیش‌نویس‌ها و ارتباط پیگیری خصوصی شما حذف شد. محتوایی که قبلاً با تأیید شما عمومی شده، همچنان در GitHub و کانال باقی می‌ماند.');return;
  }
  const status=text.match(/^\/(?:status|follow)\s+#?(\d+)$/);
  if(status){const issue=await this.issue(Number(status[1]));await this.say('status-result:'+update.update_id,message.chat.id,`#${issue.number} — ${issue.title}\n${statusText(issue)}\n${issue.html_url}`);return;}
  const abuse=text.match(/^\/report\s+#?(\d+)\s+([\s\S]+)$/);
  if(abuse){await execute(this.env.DB,'INSERT OR IGNORE INTO abuse_reports(id,user_id,issue_number,reason) VALUES (?,?,?,?)','abuse:'+update.update_id,message.from.id,Number(abuse[1]),abuse[2].slice(0,2000));await this.say('abuse-result:'+update.update_id,message.chat.id,'گزارش شما برای بررسی مدیر ثبت شد و عمومی منتشر نمی‌شود.');return;}
  const supplement=text.match(/^\/comment\s+#?(\d+)\s+([\s\S]+)$/);
  if(supplement){await this.newDraft(update,{...message,text:supplement[2]},'comment',Number(supplement[1]));return;}
  if(text.startsWith('/')){await this.say('unknown:'+update.update_id,message.chat.id,'دستور شناخته نشد. /help را بفرستید.');return;}
  await this.newDraft(update,message);
 }
 async onGitHub(payload:Record<string,unknown>,kind:string,key:string):Promise<void>{
  const repository=payload.repository as {full_name?:string}|undefined;
  if(repository?.full_name?.toLowerCase()!==this.env.GITHUB_REPO.toLowerCase())throw new Rejected('wrong_repository');
  const given=payload.issue as PublicIssue|undefined;
  if(!given||given.pull_request||!safeNumber(given.number))return;
  const issue=await this.issue(given.number);
  const reportMatch=issue.body?.match(/<!-- mobarak-bridge:report:(d[a-z0-9]+) -->/);
  const draft=reportMatch?await one<Draft>(this.env.DB,'SELECT * FROM drafts WHERE id=?',reportMatch[1]):undefined;
  const saved=await this.syncIssue(issue,key,draft?.chat_id);
  if(kind!=='issue_comment')return;
  const comment=payload.comment as GHComment|undefined;const action=payload.action;
  if(!comment||!safeNumber(comment.id))return;
  // The bridge's own GitHub comments are already present in Bale.
  if(comment.body.includes('<!-- mobarak-bridge:bale:'))return;
  const own=await one(this.env.DB,"SELECT source_id FROM comment_links WHERE source='bale' AND github_comment_id=?",comment.id);
  if(own)return;
  const link=await one<{bale_message_id:number}>(this.env.DB,"SELECT bale_message_id FROM comment_links WHERE source='github' AND source_id=?",String(comment.id));
  if(action==='deleted'){
   if(link)await effect(this.env.DB,'github-delete:'+comment.id,()=>this.api.bale('editMessageText',{chat_id:Number(this.env.BALE_GROUP_ID),message_id:link.bale_message_id,text:'این دیدگاه در GitHub حذف شده است.'},false),true);
   return;
  }
  const content=toBaleComment(comment.body,comment.user.login,comment.html_url);
  if(link){await effect(this.env.DB,'github-edit:'+key,()=>this.api.bale('editMessageText',{chat_id:Number(this.env.BALE_GROUP_ID),message_id:link.bale_message_id,text:content},false),true);return;}
  if(!saved.group_root_id)throw new Retryable('await_group_root',15);
  const result=await effect<{message_id:number}>(this.env.DB,'github-mirror:'+comment.id,()=>this.api.bale('sendMessage',{chat_id:Number(this.env.BALE_GROUP_ID),reply_to_message_id:saved.group_root_id,text:content}));
  await execute(this.env.DB,'INSERT OR IGNORE INTO comment_links(source,source_id,issue_number,github_comment_id,bale_message_id) VALUES (?,?,?,?,?)','github',String(comment.id),issue.number,comment.id,result.message_id);
 }
 async handle(event:EventRow):Promise<void>{
  const payload=JSON.parse(event.payload_json);
  if(event.source==='bale')return this.onBale(payload as BaleUpdate);
  if(event.source==='github')return this.onGitHub(payload as Record<string,unknown>,event.kind,event.id);
  if(event.kind==='notice'){await this.say('notice:'+event.id,Number(payload.chat_id),payload.text,payload.closed?[[{text:ui.fixed,callback_data:'feedback:fixed:'+payload.number},{text:ui.persists,callback_data:'feedback:persists:'+payload.number}]]:undefined);return;}
  if(event.kind==='sync') {await this.syncIssue(await this.issue(Number(payload.number)),event.id);return;}
  if(event.kind==='status'){
   const issue=await one<IssueRow>(this.env.DB,'SELECT * FROM issues WHERE number=?',payload.number);
   if(!issue?.group_root_id)throw new Retryable('await_group_root',15);
   await effect(this.env.DB,'status-group:'+event.id,()=>this.api.bale('sendMessage',{chat_id:Number(this.env.BALE_GROUP_ID),reply_to_message_id:issue.group_root_id,text:payload.text}));
   if(this.env.INTAKE_ENABLED==='true'){
    const subscribers=await rows<{chat_id:number}>(this.env.DB,'SELECT DISTINCT chat_id FROM subscriptions WHERE issue_number=? LIMIT 50',issue.number);
    const recipients=new Set(subscribers.map(s=>s.chat_id));if(issue.reporter_chat_id)recipients.add(issue.reporter_chat_id);
    await execute(this.env.DB,`INSERT OR IGNORE INTO events(id,source,kind,payload_json) SELECT 'notice:'||?||':'||value,'internal','notice',json_object('chat_id',value,'number',?,'closed',?,'text',?) FROM json_each(?)`,event.id,issue.number,issue.state==='closed'?1:0,payload.text,JSON.stringify([...recipients]));
   }else if(issue.reporter_chat_id)await this.say('status-reporter:'+event.id,issue.reporter_chat_id,payload.text);
  }
 }
}

export async function drain(env:BridgeEnv,limit=2):Promise<void>{
 if(env.BRIDGE_ENABLED!=='true')return;
 limit=env.INTAKE_ENABLED==='true'?1:limit;
 const bridge=new Bridge(env);
 const ready=await rows<EventRow>(env.DB,"SELECT * FROM events WHERE (state='pending' AND available_at<=?) OR (state='processing' AND lease_until<?) ORDER BY created_at,id LIMIT ?",now(),now(),limit);
 for(const event of ready){
  const lease=await execute(env.DB,"UPDATE events SET state='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND ((state='pending' AND available_at<=?) OR (state='processing' AND lease_until<?))",now()+120,event.id,now(),now());
  if(!lease)continue;
  try{
   await bridge.handle(event);
   await execute(env.DB,"UPDATE events SET state='done',payload_json='{}',error_code=NULL WHERE id=?",event.id);
  }catch(error){
   const retry=!(error instanceof Rejected)&&!(error instanceof Uncertain)&&event.attempts<8;
   const code=error instanceof Retryable||error instanceof Rejected||error instanceof Uncertain?error.message:'internal_error';
   await execute(env.DB,'UPDATE events SET state=?,available_at=?,error_code=? WHERE id=?',retry?'pending':error instanceof Uncertain?'uncertain':'failed',now()+(error instanceof Retryable?Math.max(error.delay,Math.min(3600,2**event.attempts*15)):0),code,event.id);
  }
 }
}
