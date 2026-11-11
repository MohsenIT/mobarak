import fa from './messages/fa.json' with {type:'json'};
import {normalize,reportTitle} from './domain.ts';
export const ui=fa;
export const intents=['bug','feature','content','documentation','question','other'] as const;
export const areas=['reader','search','analysis','translation','tafsir','recitation','settings','other'] as const;
export interface Report {
 schema_version:'intake.v1';intent:typeof intents[number];title:string;summary:string;area:typeof areas[number];
 current_behavior:string;expected_behavior:string;reproduction_steps:string[];environment:Record<string,string>;
 missing_critical_info:string[];needs_clarification:boolean;next_question:string|null;suggested_buttons:string[];
 confidence:number;privacy_flags:string[];needs_human_review:boolean;
}
export function redact(text:string):{text:string;flags:string[]}{
 const flags:string[]=[];let result=text;
 for(const [name,re] of [['email',/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],['phone',/(?:\+98|0098|0)?9[0-9]{9}\b/g],['card',/\b(?:[0-9][ -]?){16}\b/g],['password',/(?:رمز(?: عبور)?|توکن|password|api[_ -]?key)\s*[:=]\s*[^\s،]+/gi],['token',/\b(?:sk-[A-Za-z0-9_-]{16,}|github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]{20,}|[0-9]{8,12}:[A-Za-z0-9_-]{25,})\b/g]] as const){
  result=result.replace(re,()=>{flags.push(name);return '[اطلاعات خصوصی حذف شد]';});
 }
 // Persian numerals must be checked too; keep user prose otherwise verbatim.
 result=result.replace(/[۰-۹٠-٩][۰-۹٠-٩ -]{9,22}[۰-۹٠-٩]/g,v=>{
  const digits=v.replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\D/g,'');
  if(/^(?:09\d{9}|9\d{9}|\d{16})$/.test(digits)){flags.push('numeric_private');return '[اطلاعات خصوصی حذف شد]';}return v;
 });
 return {text:result.replace(/<!--[\s\S]*?-->/g,'').replace(/\u0000/g,''),flags:[...new Set(flags)]};
}
export function areaFor(text:string):Report['area']{
 const s=normalize(text);
 for(const [area,re] of [['tafsir',/تفسیر|المیزان/],['translation',/ترجمه|مترجم/],['analysis',/تحلیل|ریشه|بن واژه/],['search',/جستجو|جست وجو|سرچ/],['recitation',/تلاوت|قاری|صوت/],['settings',/تنظیم|فونت|رنگ|قلم/],['reader',/مصحف|آیه|سوره|مطالعه|پیمایش|اسکرول|نمایش/]] as const)if(re.test(s))return area;
 return 'other';
}
export function rules(text:string):Report{
 const clean=redact(text),s=normalize(clean.text),area=areaFor(s);
 const intent:Report['intent']=/چطور|چگونه|چجوری|از کجا/.test(s)?'question': /ترجمه|تفسیر|متن قرآن|متن آیه/.test(s)&&/اشتباه|اشکال|غلط|مشکل|درست نیست/.test(s)?'content':/کاش|پیشنهاد|امکانش|اضافه|افزودن|می شد/.test(s)?'feature':/راهنما|مستندات/.test(s)?'documentation':'bug';
 const vague=clean.text.trim().length<32||/(?:مشکل|اشکال)ی?\s*(?:داره|دارد|هست)[.!؟]*$/.test(s)||/^(?:یه |یک )?(?:مشکل|اشکال) (?:عجیب|توی|در)/.test(s)&&s.length<65;
 let question:string|null=null,buttons:string[]=[];
 if(vague&&intent!=='feature'&&intent!=='question'){
  question=area==='search'?ui.search_question:intent==='content'?ui.content_question:/نمایش|آیه/.test(s)?ui.display_question:ui.generic_question;
  if(area==='search')buttons=[ui.search_none,ui.search_wrong,ui.search_error,ui.free];
 }
 const environment:Record<string,string>={};
 if(/موبایل|گوشی|اندروید|آیفون/.test(s))environment.platform='موبایل';
 if(/دسکتاپ|کامپیوتر|لپ تاپ/.test(s))environment.platform=environment.platform?'موبایل و دسکتاپ':'دسکتاپ';
 if(/فایرفاکس|firefox/.test(s))environment.browser='Firefox';else if(/کروم|chrome/.test(s))environment.browser='Chrome';else if(/سافاری|safari/.test(s))environment.browser='Safari';
 return {schema_version:'intake.v1',intent,title:reportTitle(clean.text).slice(0,120),summary:clean.text.slice(0,1000),area,current_behavior:intent==='bug'?clean.text.slice(0,1400):'',expected_behavior:'',reproduction_steps:[],environment,missing_critical_info:question?['شرح رفتار']:[],needs_clarification:!!question,next_question:question,suggested_buttons:buttons,confidence:0.5,privacy_flags:clean.text.includes('[اطلاعات خصوصی حذف شد]')?[...new Set([...clean.flags,'redacted'])]:clean.flags,needs_human_review:intent==='content'};
}
export function validateReport(value:unknown):Report{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_report');
 const v=value as Record<string,unknown>;
 const allowed=['schema_version','intent','title','summary','area','current_behavior','expected_behavior','reproduction_steps','environment','missing_critical_info','needs_clarification','next_question','suggested_buttons','confidence','privacy_flags','needs_human_review'];
 if(Object.keys(v).some(k=>!allowed.includes(k)))throw Error('invalid_report');
 if(v.schema_version!=='intake.v1'||!intents.includes(v.intent as Report['intent'])||!areas.includes(v.area as Report['area']))throw Error('invalid_report');
 for(const field of ['title','summary','current_behavior','expected_behavior'])if(typeof v[field]!=='string'||(v[field] as string).length>(field==='title'?160:1400))throw Error('invalid_report');
 if(!(v.title as string).trim()||!(v.summary as string).trim())throw Error('invalid_report');
 for(const field of ['reproduction_steps','missing_critical_info','suggested_buttons','privacy_flags'])if(!Array.isArray(v[field])||(v[field] as unknown[]).length>8||(v[field] as unknown[]).some(x=>typeof x!=='string'||x.length>400))throw Error('invalid_report');
 if(JSON.stringify(v).length>6500)throw Error('invalid_report');
 if(!v.environment||typeof v.environment!=='object'||Array.isArray(v.environment)||Object.keys(v.environment).length>6||Object.values(v.environment).some(x=>typeof x!=='string'||x.length>150))throw Error('invalid_report');
 if(typeof v.needs_clarification!=='boolean'||typeof v.needs_human_review!=='boolean'||typeof v.confidence!=='number'||!Number.isFinite(v.confidence)||v.confidence<0||v.confidence>1||(v.next_question!==null&&(typeof v.next_question!=='string'||v.next_question.length>250)))throw Error('invalid_report');
 const result=JSON.parse(JSON.stringify(v)) as Report;
 result.needs_human_review=result.intent==='content'||result.needs_human_review;
 result.title=redact(result.title).text;result.summary=redact(result.summary).text;
 result.current_behavior=redact(result.current_behavior).text;result.expected_behavior=redact(result.expected_behavior).text;
 result.reproduction_steps=result.reproduction_steps.map(s=>redact(s).text);
 return result;
}
export const areaNames:Record<Report['area'],string>={reader:'نمایش قرآن',search:'جستجو',analysis:'تحلیل واژه',translation:'ترجمه',tafsir:'تفسیر',recitation:'تلاوت',settings:'تنظیمات',other:'سایر'};
export function githubDraft(report:Report,id:string,source:string,attachments:{url:string}[]=[]):{title:string;body:string;category:string;type?:string;labels:string[]}{
 const prefix=({bug:'Bug',feature:'Feature',content:'Content',documentation:'Documentation',question:'Question',other:'Report'})[report.intent];
 const section=(name:string,value:string)=>value.trim()?`### ${name}\n${value.trim()}\n\n`:'';
 let body=section('Summary',report.summary);
 if(report.intent==='content')body+=section('Content Type',report.area)+section('Reported Problem',report.current_behavior||report.summary)+section('Content Review Status',ui.content_review);
 else if(report.intent==='feature')body+=section('Problem / User Need',report.current_behavior)+section('Desired Outcome',report.expected_behavior);
 else body+=section('Current Behavior',report.current_behavior)+section('Expected Behavior',report.expected_behavior);
 body+=section('Steps to Reproduce',report.reproduction_steps.map((s,i)=>`${i+1}. ${s}`).join('\n'))+section('Environment',Object.entries(report.environment).map(([k,v])=>`${k}: ${v}`).join('\n'));
 if(attachments.length)body+=section('Evidence',attachments.map((a,i)=>`![تصویر ${i+1}](${a.url})`).join('\n'));
 body+=section('Original User Report',source.replace(/<!--/g,'').replace(/-->/g,''));
 body+=section('Metadata',`Source: Bale\nReport ID: ${id}\nProduct Area: ${report.area}\nReview State: Needs Triage${report.needs_human_review?'\nSpecialist review required: yes':''}`);
 return {title:`[${prefix}] ${report.title}`,body,category:report.intent==='feature'?'suggestion':report.intent==='question'?'question':report.intent==='content'?'content':report.intent==='documentation'?'documentation':'bug',type:report.intent==='bug'?'Bug':report.intent==='feature'?'Feature':undefined,labels:[`area:${report.area}`,...(report.intent==='content'?['needs-content-review']:report.intent==='documentation'?['documentation']:[]),...(report.needs_clarification?['needs-info']:[])]};
}
export function usefulComment(text:string):boolean{
 const s=normalize(text.trim());return s.length>=20&&!/^(?:ممنون|تشکر|سپاس|عالی|من هم|منم|همین مشکل|تست|test)[.!\s🌱👍🙏]*$/.test(s);
}
