export const RELEASE_CHANGE_KINDS=['feature','improvement','fix','security','removed'] as const
export type ReleaseChangeKind=typeof RELEASE_CHANGE_KINDS[number]
export interface AppRelease { version:string; date:string; title:string; changes:string[];changeKinds?:ReleaseChangeKind[] }
/** Newest first. Append a versioned entry for each user-facing release; retain history. */
export const APP_RELEASES:AppRelease[]=[{
  version:'0.3.7',date:'2026-10-26',title:'تایپ با صدا و چیدمان انتخاب زبان',changeKinds:['feature','fix','fix'],changes:[
    'میکروفون کنار کادرهای متنی، در مرورگرهایی که تایپ صوتی را در اختیار برنامه می‌گذارند؛ متن پیش از ارسال قابل ویرایش است.',
    'فاصلهٔ بیشتر میان اسکرول و گزینه‌های انتخاب زبان.',
    'ضربدر پنجرهٔ انتخاب زبان از عنوان جدا و در سمت مناسب قرار گرفت.',
  ],
},{
  version:'0.3.6',date:'2026-10-26',title:'خوانایی آیکون و دکمه‌های به‌روزرسانی',changeKinds:['improvement','improvement'],changes:[
    'آیکون ترجمه با حروف «ب» و «B» واضح‌تر شد.',
    'دکمه‌های «بعداً» و «به‌روزرسانی» در پنجرهٔ تغییرات، هم‌اندازه و خواناتر شدند.',
  ],
},{
  version:'0.3.5',date:'2026-10-26',title:'انتخاب زبان و مرور تغییرات',changeKinds:['fix','fix','improvement','improvement'],changes:[
    'انتخاب زبان با فهرست جست‌وجوپذیر؛ نوشته‌ها و دایرهٔ انتخاب در فارسی و انگلیسی در جای مناسب قرار می‌گیرند.',
    'نمایش شماره‌ها و شمارنده‌ها با رقم‌های زبان انتخابی، از جمله رقم‌های عربی.',
    'تاریخچهٔ نسخه‌ها با نشانهٔ جدا برای امکان تازه، بهبود و رفع مشکل؛ نمایش تدریجی نسخه‌های قدیمی‌تر.',
    'آیکون ترجمه با نشانه‌های عربی و انگلیسی روشن‌تر شد.',
  ],
},{
  version:'0.3.4',changeKinds:['fix','improvement','fix'],date:'2026-10-26',title:'اصلاح نمایش زبان‌ها و متن عربی',changes:[
    'بسم‌الله و عنوان سوره همیشه عربی می‌مانند و جای دکمه‌های نوار مطالعه با تغییر زبان عوض نمی‌شود.',
    'تغییر زبان رابط، ترجمهٔ همان زبان را انتخاب می‌کند؛ نام زبان‌ها انگلیسی و بومی و با ترتیب تازه نمایش داده می‌شوند.',
    'اصلاح جای متن و کنترل گزینه‌های انتخابی در رابط راست‌به‌چپ و چپ‌به‌راست.',
  ],
},{
  version:'0.3.3',changeKinds:['fix'],date:'2026-10-26',title:'خوانایی پیشنهاد زبان',changes:[
    'اصلاح پس‌زمینه، رنگ متن‌ها و دکمه‌های پیشنهاد زبان در حالت شب و روشن.',
  ],
},{
  version:'0.3.2',changeKinds:['feature','feature','feature'],date:'2026-10-25',title:'زبان رابط و ترجمه‌های بیشتر',changes:[
    'انتخاب زبان منوها و ترجمهٔ قرآن از تنظیمات برنامه.',
    'پیشنهاد زبان در اولین ورود با تأیید کاربر و حفظ انتخاب برای دفعات بعد.',
    'افزودن منابع تنزیل برای ۴۳ زبان دیگر، با دریافت اختیاری ترجمه برای استفادهٔ آفلاین.',
  ],
},{
  version:'0.3.1',changeKinds:['feature','feature','feature','improvement'],date:'2026-10-25',title:'شناسنامه و یافتن منابع',changes:[
    'شناسنامهٔ مشترک برای قاری‌ها، ترجمه‌ها، کتاب‌ها و داده‌های بیرونی؛ اطلاعات منبع کنار محل انتخاب در دسترس است.',
    'جست‌وجوی قاری و ترجمه با نام، کشور و ویژگی‌ها؛ فیلتر کشور، زبان و شیوهٔ تلاوت.',
    'فهرست منابع برنامه در تنظیمات برای مرور و جست‌وجوی شناسنامه‌ها.',
    'نشانگر متحرک هنگام پخش؛ جمع‌کردن نوار بدون قطع صدا و پایان پخش با ضربدر نوار.',
  ],
},{
  version:'0.3.0',changeKinds:['feature','improvement','feature','improvement','feature','feature'],date:'2026-10-25',title:'تلاوت، پیمایش و به‌روزرسانی روشن‌تر',changes:[
    'تلاوت آیه‌به‌آیه با منشاوی و پرهیزگار، تنظیم سرعت، تکرار و دانلود سوره برای پخش آفلاین.',
    'شروع تلاوت با یک لمس، رنگ‌گذاری یکپارچهٔ آیه و هماهنگی ترجمه و آمار در تب آیه.',
    'کنترل‌های رسانهٔ سیستم و امکان ادامهٔ پخش در پس‌زمینه در مرورگرهای پشتیبانی‌شده.',
    'انتقال «برو» و میان‌برهای سوره‌های اخیر و سنجاق‌شده به فهرست سوره‌ها؛ پیمایش کوتاهِ صفحه، جزء و سیاق.',
    'لینک قابل اشتراک برای جست‌وجو و فیلترهای آن؛ آیکن قیف برای انتخاب سوره‌ها.',
    'اعلان باریک به‌روزرسانی و نمایش تغییرات نسخه‌های جدید پیش از دریافت.',
  ],
}]
export const CURRENT_RELEASE=APP_RELEASES[0].version
const parts=(s:string)=>/^\d+\.\d+\.\d+$/.test(s)?s.split('.').map(Number):null
export function compareRelease(a:string,b:string){const x=parts(a),y=parts(b);if(!x||!y)return 0;for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0}
export function missedReleases(releases:AppRelease[],installed:string){return releases.filter(r=>compareRelease(r.version,installed)>0).sort((a,b)=>compareRelease(b.version,a.version))}
export interface AppUpdate { build:string; releases:AppRelease[]; latest?:AppRelease }
export function parseAppUpdate(value:unknown):AppUpdate {
  const data=value as {version?:unknown;releases?:unknown}
  if(typeof data?.version!=='string'||!data.version)throw new Error('invalid-version')
  const releases:AppRelease[]=[];const seen=new Set<string>()
  if(Array.isArray(data.releases))for(const raw of data.releases.slice(0,200)){
    const r=raw as AppRelease
    if(!r||typeof r.version!=='string'||!parts(r.version)||seen.has(r.version)||typeof r.title!=='string'||typeof r.date!=='string'||!Array.isArray(r.changes)||!r.changes.every(c=>typeof c==='string'))continue
    seen.add(r.version);releases.push({version:r.version,title:r.title.slice(0,200),date:r.date.slice(0,30),changes:r.changes.slice(0,30).map(c=>c.slice(0,1000)),changeKinds:r.changes.slice(0,30).map((_,i)=>RELEASE_CHANGE_KINDS.includes(r.changeKinds?.[i] as ReleaseChangeKind)?r.changeKinds![i]:'improvement')})
  }
  releases.sort((a,b)=>compareRelease(b.version,a.version))
  return {build:data.version,releases,latest:releases[0]}
}
export async function checkAppUpdate(signal?:AbortSignal){const response=await fetch('/api/version',{cache:'no-store',signal:signal??AbortSignal.timeout(10000)});if(!response.ok)throw new Error('version');return parseAppUpdate(await response.json())}
