export interface Category { key: string; label: string; hashtag: string; }
export const defaultCategories: Category[] = [
 {key:'bug',label:'bug',hashtag:'باگ'},
 {key:'suggestion',label:'suggestion',hashtag:'پیشنهاد'},
 {key:'enhancement',label:'enhancement',hashtag:'بهبود'},
 {key:'question',label:'question',hashtag:'سؤال'}
];
export function categories(value?: string): Category[] {
 if(!value)return defaultCategories;
 const parsed: unknown=JSON.parse(value);
 if(!Array.isArray(parsed)||!parsed.length||parsed.length>20)throw new Error('Invalid categories');
 return parsed.map((v:unknown)=>{
  if(!v||typeof v!=='object')throw new Error('Invalid category');
  const c=v as Category;
  if(!/^[a-z][a-z0-9_-]{0,20}$/.test(c.key)||typeof c.label!=='string'||!c.label.trim()||c.label.length>50||typeof c.hashtag!=='string'||!/^[\p{L}\p{N}_‌]{1,40}$/u.test(c.hashtag))throw new Error('Invalid category');
  return c;
 });
}
export function normalize(text:string):string {
 return text.normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u065F\u0670]/g,'').replace(/\u200c/g,' ').toLowerCase();
}
const words=(v:string)=>new Set(normalize(v).match(/[\p{L}\p{N}]{2,}/gu)??[]);
export function similarity(a:string,b:string):number {
 const left=words(a),right=words(b);
 if(!left.size||!right.size)return 0;
 let common=0;for(const v of left)if(right.has(v))common++;
 return common/(left.size+right.size-common);
}
export function classify(text:string,available:Category[]):Category {
 const s=normalize(text);
 const key=/پیشنهاد|اضافه کنید|افزودن قابلیت/.test(s)?'suggestion':
 /بهبود|بهینه|سریع تر/.test(s)?'enhancement':
 /خطا|مشکل|کار نمی|خراب|باگ|bug|error/.test(s)?'bug':
 /چگونه|چطور|سوال|سؤال|\؟|\?/.test(s)?'question':'bug';
 return available.find(c=>c.key===key)??available[0];
}
export function reportTitle(text:string):string {
 return text.split(/[\n.!؟?]/).find(v=>v.trim())?.trim().slice(0,160)||'گزارش جدید';
}
export interface PublicIssue {
 id:number; number:number;title:string;body:string|null;state:string;state_reason?:string|null;
 html_url:string;labels:({name:string}|string)[];pull_request?:unknown;
}
export function categoryForIssue(issue:PublicIssue,available:Category[]):Category {
 const labels=issue.labels.map(l=>typeof l==='string'?l:l.name);
 return available.find(c=>labels.includes(c.label))??classify(issue.title+' '+(issue.body??''),available);
}
export function statusText(issue:PublicIssue):string {
 if(issue.state==='closed')return issue.state_reason==='not_planned'?'⚪ بسته‌شده — برنامه‌ریزی نشده':'🟢 بسته‌شده — انجام‌شده';
 const labels=issue.labels.map(l=>typeof l==='string'?l:l.name);
 return labels.some(l=>['in progress','in-progress','status:in-progress'].includes(l.toLowerCase()))?'🟠 در حال انجام':'🔵 در حال بررسی';
}
export function publicBody(body:string|null):string {
 return (body??'').replace(/<!--[\s\S]*?-->/g,'').trim();
}
export function channelPost(issue:PublicIssue,available:Category[]):string {
 const category=categoryForIssue(issue,available);
 const description=publicBody(issue.body).replace(/\s+/g,' ').slice(0,1600);
 return `#${issue.number} — ${issue.title.slice(0,180)}\n\nدسته: #${category.hashtag}\nوضعیت: ${statusText(issue)}\n\nتوضیح: ${description||'توضیحی ثبت نشده است.'}\n\nGitHub Issue: ${issue.html_url}\n\nگفت‌وگو و مشارکت: بخش «افزودن دیدگاه» همین پست`;
}
export function githubComment(text:string,alias:string,marker:string):string {
 // Quote user content so it cannot impersonate the attribution or bridge marker.
 return `از بله — ${alias}\n\n`+text.split('\n').map(line=>'> '+line).join('\n')+`\n\n<!-- mobarak-bridge:${marker} -->`;
}
export function toBaleComment(text:string,login:string,url:string):string {
 const content=publicBody(text);
 return `از GitHub — ${login}\n\n${content.slice(0,3300)}${content.length>3300?'\n… ادامه در GitHub':''}\n\n${url}`;
}
