import {Retryable} from './api.ts';
import type {Bridge} from './bridge.ts';
import {execute,one,rows} from './db.ts';
import {analyze} from './ai-intake.ts';
import {ui,rules,redact,githubDraft,areaNames,compactPreview,type Report} from './intake-domain.ts';
import {faq} from './knowledge.ts';
import {attachImage,attachmentLinks,type Photo} from './attachments.ts';
interface Button {text:string;callback_data?:string;url?:string;}
export interface IntakeMessage {message_id:number;chat:{id:number;type:string};from?:{id:number;is_bot?:boolean};text?:string;caption?:string;photo?:Photo[];document?:{file_id:string;mime_type?:string;file_size?:number};voice?:unknown;audio?:unknown;}
export interface IntakeUpdate {update_id:number;message?:IntakeMessage;edited_message?:IntakeMessage;callback_query?:{id:string;from:{id:number};data?:string;message?:IntakeMessage};}
export interface Conversation {id:string;user_id:number;chat_id:number;state:string;revision:number;context:string;report_json:string;question:string|null;options_json:string;questions:number;question_limit:number;draft_id:string|null;issue_number:number|null;ignore_duplicate:number;candidates_json:string;expires_at:number;}
interface Match {number:number;title:string;url:string;post:number|null;score:number;}
const active="('collecting','clarifying','help','preview','editing_title','editing_body','editing_other','publishing')";
const time=()=>Math.floor(Date.now()/1000);
export class Intake {
 bridge:Bridge;
 constructor(bridge:Bridge){this.bridge=bridge;}
 get db(){return this.bridge.env.DB;}
 callback(c:Conversation,action:string,arg?:string):string{return `i:${action}:${c.id}:${c.revision}${arg?':'+arg:''}`;}
 button(c:Conversation,text:string,action:string,arg?:string):Button{return {text,callback_data:this.callback(c,action,arg)};}
 async say(key:string,chat:number,text:string,buttons?:Button[][]){return this.bridge.say('intake:'+key,chat,text,buttons);}
 async load(id:string):Promise<Conversation>{return (await one<Conversation>(this.db,'SELECT * FROM conversations WHERE id=?',id))!;}
 async current(user:number):Promise<Conversation|undefined>{return one(this.db,`SELECT * FROM conversations WHERE user_id=? AND state IN ${active} AND expires_at>? ORDER BY updated_at DESC,rowid DESC LIMIT 1`,user,time());}
 async start(user:number,chat:number,event:number):Promise<Conversation|undefined>{
  const n=await one<{n:number}>(this.db,'SELECT COUNT(*) AS n FROM conversations WHERE user_id=? AND created_at>?',user,time()-86400);
  if((n?.n??0)>=20){await this.say('limit:'+event,chat,ui.limit);return;}
  const existing=await this.current(user);if(existing?.state==='publishing'){await this.say('busy:'+event,chat,ui.busy);return;}
  await execute(this.db,`UPDATE conversations SET state='cancelled',revision=revision+1 WHERE user_id=? AND state IN ${active}`,user);
  await execute(this.db,'INSERT OR IGNORE INTO intake_users(user_id) VALUES (?)',user);
  const id='c'+event.toString(36);await execute(this.db,'INSERT OR IGNORE INTO conversations(id,user_id,chat_id,expires_at) VALUES (?,?,?,?)',id,user,chat,time()+86400);
  return this.load(id);
 }
 async update(c:Conversation,state:string,context=c.context,report?:Report):Promise<Conversation>{
  await execute(this.db,'UPDATE conversations SET state=?,context=?,report_json=?,revision=revision+1,updated_at=unixepoch() WHERE id=? AND revision=?',state,context,report?JSON.stringify(report):c.report_json,c.id,c.revision);
  return this.load(c.id);
 }
 menu():Button[][]{return [[{text:ui.new,callback_data:'menu:new'}],[{text:ui.mine,callback_data:'menu:mine'},{text:ui.about,callback_data:'menu:about'}]];}
 async mine(user:number,chat:number,key:string):Promise<void>{
  const reports=await rows<{number:number;title:string;state:string;state_reason:string|null;url:string;channel_post_id:number|null;updated_at:string}>(this.db,`SELECT DISTINCT i.* FROM issues i LEFT JOIN subscriptions s ON s.issue_number=i.number LEFT JOIN participants p ON p.issue_number=i.number WHERE s.user_id=? OR i.reporter_chat_id=? OR p.user_id=? ORDER BY i.updated_at DESC LIMIT 10`,user,chat,user);
  if(!reports.length){await this.say(key,chat,ui.no_reports,this.menu());return;}
  await execute(this.db,'INSERT OR IGNORE INTO subscriptions(user_id,chat_id,issue_number) SELECT ?,?,CAST(value AS INTEGER) FROM json_each(?)',user,chat,JSON.stringify(reports.map(r=>r.number)));
  for(const r of reports){await this.say(key+':'+r.number,chat,`#${r.number} — ${r.title}\n${r.state==='closed'?(r.state_reason==='not_planned'?'برنامه‌ریزی نشده':'بسته‌شده'):'باز — در انتظار بررسی'}\n${r.url}${r.channel_post_id?'\n'+this.bridge.postLink(r.channel_post_id):''}\nآخرین تغییر: ${r.updated_at.slice(0,10)}`);}
 }
 async show(c:Conversation,key:string):Promise<void>{
  if(c.state==='clarifying'){const options=JSON.parse(c.options_json) as string[];await this.say(key,c.chat_id,c.question??ui.generic_question,[...options.slice(0,4).map((v,i)=>[this.button(c,v,'answer',String(i))]),[this.button(c,ui.without,'ready'),this.button(c,ui.cancel,'cancel')]]);return;}
  if(c.state==='help'){await this.say(key,c.chat_id,(c.question??ui.no_help)+'\n\n'+ui.help_check,[[this.button(c,ui.solved,'solved'),this.button(c,ui.unresolved,'unresolved')]]);return;}
  if(c.state.startsWith('editing_')){await this.say(key,c.chat_id,c.state==='editing_title'?ui.edit_title:c.state==='editing_body'?ui.edit_body:ui.edit_other,[[this.button(c,ui.back,'back')]]);return;}
  if(c.state==='publishing'){await this.say(key,c.chat_id,ui.busy);return;}
  if(c.state==='preview'){await this.preview(c,key);return;}
  await this.say(key,c.chat_id,ui.send,[[this.button(c,ui.done,'ready'),this.button(c,ui.cancel,'cancel')]]);
 }
 async evaluate(c:Conversation,key:string,force=false):Promise<void>{
    const answer=faq(c.context);
  if((answer||rules(c.context).intent==='question')&&!force&&c.questions===0){c=await this.update(c,'help');await execute(this.db,'UPDATE conversations SET question=? WHERE id=?',answer??ui.no_help,c.id);await this.show(await this.load(c.id),key);return;}
  if(this.bridge.env.AI_ENABLED==='true')await this.bridge.api.bale('sendChatAction',{chat_id:c.chat_id,action:'typing'},false).catch(()=>undefined);
  const report=await analyze(this.bridge.env,c.id,key,c.context);
  if(!report.follow_up_question&&report.intent==='bug'&&report.area==='reader'&&!report.environment.platform&&/درگ|پیمایش|اسکرول/.test(c.context))report.follow_up_question='این مشکل روی موبایل پیش میاد یا دسکتاپ؟';
  if(!report.summary.trim()){report.summary='تصویر ارسال شده؛ شرح مشکل هنوز مشخص نشده است.';report.needs_human_review=true;report.missing_critical_info=['شرح مشکل در تصویر'];if(c.questions<c.question_limit){force=false;report.needs_clarification=true;report.next_question='عکس رسید؛ کدوم قسمت تصویر مشکل داره یا انتظار داشتی چه اتفاقی بیفته؟';}}
  if(force)report.follow_up_question=null;
  if(!force&&report.needs_clarification&&report.next_question&&c.questions<c.question_limit){
   c=await this.update(c,'clarifying',c.context,report);
   await execute(this.db,'UPDATE conversations SET questions=questions+1,question=?,options_json=? WHERE id=?',report.next_question,JSON.stringify(report.suggested_buttons.slice(0,4)),c.id);
   await this.show(await this.load(c.id),key);return;
  }
  c=await this.update(c,'preview',c.context,report);await this.prepare(c,key);
 }
 async prepare(c:Conversation,key:string):Promise<void>{
  const report=JSON.parse(c.report_json) as Report;
  const candidates=c.ignore_duplicate?[]:(await this.bridge.candidates(report.title+' '+report.summary)).items.filter(v=>v.score>=0.45).slice(0,1);
  const draft=githubDraft(report,c.id,c.context,await attachmentLinks(this.db,c.id,this.bridge.env.PUBLIC_BASE_URL??''));
  const draftId='di'+c.id+'r'+c.revision;
  await execute(this.db,`INSERT OR IGNORE INTO drafts(id,user_id,chat_id,body,title,category,candidates_json,expires_at,report_json) VALUES (?,?,?,?,?,?,?,?,?)`,draftId,c.user_id,c.chat_id,draft.body,draft.title,draft.category,JSON.stringify(candidates),c.expires_at,JSON.stringify({type:draft.type,labels:draft.labels,conversation:c.id}));
  await execute(this.db,'UPDATE conversations SET draft_id=?,candidates_json=? WHERE id=?',draftId,JSON.stringify(candidates),c.id);
  await this.preview(await this.load(c.id),key);
 }
 async preview(c:Conversation,key:string):Promise<void>{
  const report=JSON.parse(c.report_json) as Report;
  const draft=await one<{title:string;body:string}>(this.db,'SELECT title,body FROM drafts WHERE id=?',c.draft_id);
  if(!draft){await this.say(key,c.chat_id,ui.expired,this.menu());return;}
  const links=await attachmentLinks(this.db,c.id,this.bridge.env.PUBLIC_BASE_URL??'');
  const match=(JSON.parse(c.candidates_json) as Match[])[0];
  const summary=compactPreview(report,links.length);
  let buttons:Button[][];
  if(match&&!c.ignore_duplicate){
   const url=match.url;
   buttons=[[this.button(c,ui.same,'duplicate',String(match.number)),this.button(c,ui.different,'different')],[{text:ui.view,url}],[this.button(c,ui.cancel,'cancel')]];
   await this.say(key+':confirm',c.chat_id,summary+'\n\n'+ui.similar+`\n#${match.number} — ${match.title}\n\n`+ui.preview_notice,buttons);return;
  }
  buttons=[[this.button(c,ui.approve,'publish')],[this.button(c,ui.edit,'edit')],[this.button(c,'گزینه‌های بیشتر','options')],[this.button(c,ui.cancel,'cancel')]];
  if(report.follow_up_question&&c.questions<c.question_limit)buttons.splice(1,0,[this.button(c,'💬 تکمیل اختیاری','enrich')]);
  if(links.length)buttons.push([this.button(c,ui.remove_media,'remove_media')]);
  if(report.needs_clarification&&c.questions>=2&&c.question_limit===2)buttons.push([this.button(c,ui.more,'more')]);
  await this.say(key+':confirm',c.chat_id,summary+'\n\n'+ui.preview_notice+(report.privacy_flags.length?'\n'+ui.redacted:''),buttons);
 }
 async publish(c:Conversation,event:number):Promise<void>{
  await execute(this.db,"UPDATE conversations SET state='publishing' WHERE id=? AND state='preview' AND revision=?",c.id,c.revision);
  const fresh=await this.load(c.id);if(fresh.state!=='publishing')return;
  if(!c.draft_id)return;
  await execute(this.db,'UPDATE intake_attachments SET published=1 WHERE conversation_id=?',c.id);
  await this.bridge.callback({update_id:event,callback_query:{id:'intake-publish-'+event,from:{id:c.user_id},data:'approve:'+c.draft_id,message:{message_id:0,chat:{id:c.chat_id,type:'private'}}}});
  const result=await one<{state:string;issue_number:number|null}>(this.db,'SELECT state,issue_number FROM drafts WHERE id=?',c.draft_id);
  if(result?.state==='created'&&result.issue_number){
   await execute(this.db,"UPDATE conversations SET state='published',issue_number=?,revision=revision+1 WHERE id=?",result.issue_number,c.id);
   await execute(this.db,'INSERT OR IGNORE INTO subscriptions(user_id,chat_id,issue_number) VALUES (?,?,?)',c.user_id,c.chat_id,result.issue_number);
  }
 }
 async handle(update:IntakeUpdate):Promise<boolean>{
  const q=update.callback_query,m=update.message??update.edited_message;const user=q?.from.id??m?.from?.id,chat=q?.message?.chat??m?.chat;
  if(!user||chat?.type!=='private')return false;
  const won=await execute(this.db,`INSERT INTO conversation_locks(user_id,event_id,lease_until) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET event_id=excluded.event_id,lease_until=excluded.lease_until WHERE conversation_locks.lease_until<? OR conversation_locks.event_id=excluded.event_id`,user,update.update_id,time()+180,time());
  if(!won)throw new Retryable('intake_user_busy',5);
  try{return await this.handleUnlocked(update);}finally{await execute(this.db,'DELETE FROM conversation_locks WHERE user_id=? AND event_id=?',user,update.update_id);}
 }
 async handleUnlocked(update:IntakeUpdate):Promise<boolean>{
  const q=update.callback_query,m=update.message??update.edited_message;const user=q?.from.id??m?.from?.id,chat=q?.message?.chat??m?.chat;
  if(!user||!chat||chat.type!=='private')return false;
  if(await one(this.db,'SELECT user_id FROM blocked_users WHERE user_id=?',user))return true;
  const key=String(update.update_id);
  if(q){
   if(!q.data?.startsWith('i:')&&!q.data?.startsWith('menu:')&&!q.data?.startsWith('feedback:'))return false;
   await this.bridge.api.bale('answerCallbackQuery',{callback_query_id:q.id},false).catch(()=>undefined);
   if(q.data.startsWith('menu:')){
    const action=q.data.slice(5);
    if(action==='mine')await this.mine(user,chat.id,key);else if(action==='about')await this.say(key,chat.id,ui.privacy,this.menu());
    else if(action==='new'){const c=await this.start(user,chat.id,update.update_id);if(c)await this.show(c,key);}
    return true;
   }
   if(q.data.startsWith('feedback:')){
    const [,action,num]=q.data.split(':');const n=Number(num);
    if(!Number.isSafeInteger(n)||n<1||!['fixed','persists'].includes(action)||!await one(this.db,'SELECT user_id FROM subscriptions WHERE user_id=? AND issue_number=?',user,n))return true;
    if(action==='persists'){await this.say(key,chat.id,`لطفاً توضیح تازه‌ات را با دستور /comment ${n} و سپس متن توضیح بفرست. پیش از انتشار تأیید می‌گیرم.`);}
    else {await execute(this.db,"INSERT INTO report_feedback(user_id,issue_number,result) VALUES (?,?,'fixed') ON CONFLICT(user_id,issue_number) DO UPDATE SET result='fixed'",user,n);await this.say(key,chat.id,ui.feedback_saved);}
    return true;
   }
   const [,action,id,revision,arg]=q.data.split(':');let c=await one<Conversation>(this.db,'SELECT * FROM conversations WHERE id=? AND user_id=? AND chat_id=?',id,user,chat.id);
   if(!c||c.expires_at<time()){await this.say(key,chat.id,ui.expired,this.menu());return true;}
   if(c.state==='published')return true;
   if(c.state==='publishing'&&action==='publish'){await this.publish(c,update.update_id);return true;}
   if(c.revision!==Number(revision)||['cancelled','resolved','publishing'].includes(c.state)){await this.say(key,chat.id,ui.stale);return true;}
   if(action==='cancel'){await this.update(c,'cancelled');await this.say(key,chat.id,ui.cancelled,this.menu());return true;}
   if(action==='resume'){await this.show(c,key);return true;}
   if(action==='publish'&&c.state==='preview'){await this.publish(c,update.update_id);return true;}
   if(action==='options'&&c.state==='preview'){await this.say(key,chat.id,'می‌تونی عکس یا جزئیات اضافه کنی؛ ثبت با همین اطلاعات هم ممکنه.',[[this.button(c,ui.attach,'attach')],[this.button(c,ui.details,'details')],[this.button(c,ui.back,'back')]]);return true;}
   if(action==='enrich'&&c.state==='preview'){const report=JSON.parse(c.report_json) as Report;if(!report.follow_up_question||c.questions>=c.question_limit)return true;c=await this.update(c,'clarifying');const options=/موبایل|دسکتاپ/.test(report.follow_up_question)?['موبایل','دسکتاپ','مطمئن نیستم']:[];await execute(this.db,'UPDATE conversations SET question=?,questions=questions+1,options_json=? WHERE id=?',report.follow_up_question,JSON.stringify(options),c.id);await this.show(await this.load(c.id),key);return true;}
   if(action==='details'&&c.state==='preview'){
    const draft=await one<{title:string;body:string}>(this.db,'SELECT title,body FROM drafts WHERE id=?',c.draft_id);
    if(draft){const text=draft.title+'\n\n'+draft.body;for(let i=0;i<text.length;i+=2800)await this.say(key+':'+i,c.chat_id,text.slice(i,i+2800));}
    return true;
   }
   if(action==='edit'&&c.state==='preview'){await this.say(key,chat.id,ui.edit_prompt,[[this.button(c,ui.title,'title'),this.button(c,ui.body,'body')],[this.button(c,ui.other,'other'),this.button(c,ui.back,'back')]]);return true;}
   if(['title','body','other'].includes(action)&&c.state==='preview'){c=await this.update(c,'editing_'+action);await this.show(c,key);return true;}
   if(action==='back'&&(c.state.startsWith('editing_')||c.state==='preview')){c=await this.update(c,'preview');await this.prepare(c,key);return true;}
   if(action==='solved'&&c.state==='help'){await this.update(c,'resolved');await this.say(key,chat.id,ui.resolved,this.menu());return true;}
   if(action==='unresolved'&&c.state==='help'){const r=rules(c.context);r.intent='bug';r.needs_clarification=true;r.next_question=ui.generic_question;c=await this.update(c,'clarifying',c.context,r);await execute(this.db,'UPDATE conversations SET question=?,questions=questions+1 WHERE id=?',ui.generic_question,c.id);await this.show(await this.load(c.id),key);return true;}
   if(action==='answer'&&c.state==='clarifying'){
    const option=(JSON.parse(c.options_json) as string[])[Number(arg)];if(!option)return true;
    if(option===ui.free){await this.say(key,chat.id,ui.free_prompt,[[this.button(c,ui.without,'ready')]]);return true;}
    c=await this.update(c,'collecting',c.context+'\n'+option);await this.evaluate(c,key,true);return true;
   }
   if(action==='ready'&&['collecting','clarifying'].includes(c.state)){if(!c.context.trim()&&!await one(this.db,'SELECT id FROM intake_attachments WHERE conversation_id=? LIMIT 1',c.id)){await this.say(key,chat.id,ui.generic_question);return true;}await this.evaluate(c,key,c.state==='clarifying');return true;}
   if(action==='more'&&c.state==='preview'&&c.question_limit===2){await execute(this.db,'UPDATE conversations SET question_limit=3 WHERE id=?',c.id);await this.evaluate(await this.load(c.id),key);return true;}
   if(action==='attach'&&['preview','collecting'].includes(c.state)){c=await this.update(c,'collecting');await this.say(key,chat.id,ui.media_prompt,[[this.button(c,ui.done,'ready')]]);return true;}
   if(action==='remove_media'&&['preview','collecting'].includes(c.state)){await execute(this.db,'DELETE FROM intake_attachments WHERE conversation_id=? AND published=0',c.id);c=await this.update(c,'preview');await this.prepare(c,key);return true;}
   if(action==='different'&&c.state==='preview'){await execute(this.db,'UPDATE conversations SET ignore_duplicate=1 WHERE id=?',c.id);c=await this.update(c,'preview');await this.prepare(c,key);return true;}
   if(action==='duplicate'&&c.state==='preview'){
    const match=(JSON.parse(c.candidates_json) as Match[]).find(v=>v.number===Number(arg));if(!match)return true;
    await execute(this.db,'INSERT OR IGNORE INTO subscriptions(user_id,chat_id,issue_number) VALUES (?,?,?)',user,chat.id,match.number);
    await execute(this.db,"UPDATE conversations SET state='published',issue_number=?,revision=revision+1 WHERE id=? AND revision=?",match.number,c.id,c.revision);
    await this.say(key,chat.id,ui.duplicate+`\n#${match.number}\n${match.post?this.bridge.postLink(match.post):match.url}`,this.menu());return true;
   }
   await this.say(key,chat.id,ui.stale);return true;
  }
  if(!m)return false;
  const text=m.text??m.caption??'';
  if(/^\/(start|help|new|my|continue|done|cancel|privacy|forget)(\s|$)/.test(text)){
   const command=text.split(/\s/)[0];let c=await this.current(user);
   if(command==='/my'){await this.mine(user,chat.id,key);return true;}
   if(command==='/privacy'){await this.say(key,chat.id,ui.privacy,this.menu());return true;}
   if(command==='/forget'){
    await execute(this.db,'DELETE FROM intake_attachments WHERE published=0 AND conversation_id IN (SELECT id FROM conversations WHERE user_id=?)',user);
    await execute(this.db,'DELETE FROM intake_inputs WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=?)',user);
    await execute(this.db,'UPDATE ai_usage SET result_json=NULL WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id=?)',user);
    await execute(this.db,"UPDATE conversations SET state='cancelled',context='',report_json='{}',question=NULL,options_json='[]',revision=revision+1 WHERE user_id=?",user);
    await execute(this.db,'DELETE FROM subscriptions WHERE user_id=?',user);
    // Let the existing handler remove old drafts and reporter linkage too.
    return false;
   }
   if(command==='/cancel'){if(c)await this.update(c,'cancelled');return false;}
   if(command==='/continue'){if(c)await this.show(c,key);else await this.say(key,chat.id,ui.send,this.menu());return true;}
   if(command==='/done'){if(c)await this.evaluate(c,key,c.state==='clarifying');else await this.say(key,chat.id,ui.send);return true;}
   if(command==='/new'){c=await this.start(user,chat.id,update.update_id);if(c)await this.show(c,key);return true;}
   const returning=!!await one(this.db,'SELECT user_id FROM intake_users WHERE user_id=?',user);
   await execute(this.db,'INSERT OR IGNORE INTO intake_users(user_id) VALUES (?)',user);
   await this.say(key,chat.id,(returning?ui.returning:ui.welcome)+(c?'\n\n'+ui.unfinished:''),c?[[this.button(c,ui.resume,'resume')],...this.menu()]:this.menu());return true;
  }
  if(text.startsWith('/'))return false;
  const previous=await one<{conversation_id:string;force_ready:number;kind:string}>(this.db,'SELECT conversation_id,force_ready,kind FROM intake_inputs WHERE event_id=?',key);
  if(previous){const saved=await this.load(previous.conversation_id);if(previous.kind!=='photo'&&saved.state==='collecting'&&saved.context)await this.evaluate(saved,key,!!previous.force_ready);else if(saved.state==='preview')await this.prepare(saved,key);else await this.show(saved,key);return true;}
  let c=await this.current(user);
  if(c?.state==='publishing'){await this.say(key,chat.id,ui.busy);return true;}
  if(!c)c=await this.start(user,chat.id,update.update_id);if(!c)return true;
  if(update.edited_message){await this.say(key,chat.id,ui.edit_prompt,[[this.button(c,ui.edit,'edit')]]);return true;}
  if(m.voice||m.audio||(m.document&&!['image/png','image/jpeg','image/webp'].includes(m.document.mime_type??''))){await this.say(key,chat.id,ui.unsupported);return true;}
  if(text.length>2800||c.context.length+text.length>7000){await this.say(key,chat.id,ui.long);return true;}
  if(m.photo?.length||m.document){
   const photos=m.photo??(m.document?[m.document]:[]);const result=await attachImage(this.db,this.bridge.api,c.id,key,photos);
   if(result==='saved')await execute(this.db,"INSERT OR IGNORE INTO intake_inputs(event_id,conversation_id,text,kind) VALUES (?,?,?,'photo')",key,c.id,redact(text).text);
   if(result!=='saved'&&text.trim())await execute(this.db,"INSERT OR IGNORE INTO intake_inputs(event_id,conversation_id,text,kind) VALUES (?,?,?,'append')",key,c.id,redact(text).text);
   c=await this.load(c.id);await this.say(key,chat.id,result==='saved'?ui.media_saved:result==='limit'?ui.media_limit:result==='too_large'?ui.media_large:ui.media_error,[[this.button(c,ui.done,'ready')],[this.button(c,ui.cancel,'cancel')]]);return true;
  }
  if(!text.trim()){await this.say(key,chat.id,ui.unsupported);return true;}
  const clean=redact(text);
  if(c.state.startsWith('editing_')){
   const kind=c.state==='editing_title'?'title':c.state==='editing_body'?'body':'append';
   await execute(this.db,'INSERT OR IGNORE INTO intake_inputs(event_id,conversation_id,force_ready,text,kind) VALUES (?,?,?,?,?)',key,c.id,1,kind==='title'?clean.text.slice(0,120):clean.text,kind);
   c=await this.load(c.id);
   if(kind==='append')await this.evaluate(c,key,true);else await this.prepare(c,key);return true;
  }
  const wasQuestion=c.state==='clarifying';
  await execute(this.db,'INSERT OR IGNORE INTO intake_inputs(event_id,conversation_id,force_ready,text) VALUES (?,?,?,?)',key,c.id,wasQuestion?1:0,clean.text);
  c=await this.load(c.id);await this.evaluate(c,key,wasQuestion);return true;
 }
}
