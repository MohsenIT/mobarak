export type ResourceKind='quran'|'translation'|'recitation'|'lexicon'|'tafsir'|'corpus'
export interface Resource {
  id:string;name:string;title:string;kind:ResourceKind;language:string
  creator?:string;country?:string;nationality?:string;date?:string;dateLabel?:string
  style?:'murattal'|'mujawwad';description:string;features:string[];keywords?:string[]
  image?:{src:string;alt:string};links?:{label:string;href:string}[]
}
export const RESOURCE_KINDS:Record<ResourceKind,string>={quran:'متن قرآن',translation:'ترجمه',recitation:'تلاوت',lexicon:'فرهنگ واژه',tafsir:'تفسیر',corpus:'دادهٔ زبانی'}
export const RESOURCE_LANGUAGES:Record<string,string>={fa:'فارسی',ar:'عربی',en:'انگلیسی'}
export const RECITATION_STYLES={murattal:'ترتیل',mujawwad:'تحقیق / مجوّد'}
/** Bibliographic metadata, independent from playback/data providers. Unknown facts stay absent. */
export const RESOURCES:Resource[]=[
 {id:'reciter:minshawi-murattal',name:'محمد صدیق منشاوی',title:'ترتیل محمد صدیق منشاوی',kind:'recitation',language:'ar',creator:'محمد صدیق منشاوی',country:'مصر',nationality:'مصری',style:'murattal',description:'تلاوت ترتیل آیه‌به‌آیه با صدای محمد صدیق منشاوی.',features:['پخش آیه‌به‌آیه','تکرار و تنظیم سرعت','دانلود اختیاری سوره'],links:[{label:'مأخذ صوت: Quran.com',href:'https://quran.com/'}]},
 {id:'reciter:parhizgar',name:'شهریار پرهیزگار',title:'ترتیل شهریار پرهیزگار',kind:'recitation',language:'ar',creator:'شهریار پرهیزگار',country:'ایران',nationality:'ایرانی',style:'murattal',description:'تلاوت ترتیل آیه‌به‌آیه با صدای شهریار پرهیزگار، از مجموعهٔ صوتی تنزیل.',features:['پخش آیه‌به‌آیه','تکرار و تنظیم سرعت','دانلود اختیاری سوره'],links:[{label:'مأخذ صوت: تنزیل',href:'https://tanzil.net/'}]},
 {id:'translation:s',name:'صفوی',title:'ترجمهٔ سید محمدرضا صفوی',kind:'translation',language:'fa',creator:'سید محمدرضا صفوی',country:'ایران',nationality:'ایرانی',description:'ترجمهٔ فارسی قرآنِ صفوی، مبتنی بر تفسیر المیزان.',features:['ترجمهٔ فارسی','مبتنی بر المیزان'],keywords:['المیزان','صفوی']},
 {id:'translation:f',name:'فولادوند',title:'ترجمهٔ محمدمهدی فولادوند',kind:'translation',language:'fa',creator:'محمدمهدی فولادوند',country:'ایران',nationality:'ایرانی',description:'ترجمهٔ فارسی قرآن از محمدمهدی فولادوند.',features:['ترجمهٔ فارسی']},
 {id:'translation:a',name:'انصاریان',title:'ترجمهٔ حسین انصاریان',kind:'translation',language:'fa',creator:'حسین انصاریان',country:'ایران',nationality:'ایرانی',description:'ترجمهٔ فارسی قرآن از حسین انصاریان.',features:['ترجمهٔ فارسی']},
 {id:'translation:m',name:'مکارم شیرازی',title:'ترجمهٔ ناصر مکارم شیرازی',kind:'translation',language:'fa',creator:'ناصر مکارم شیرازی',country:'ایران',nationality:'ایرانی',description:'ترجمهٔ فارسی قرآن از ناصر مکارم شیرازی.',features:['ترجمهٔ فارسی']},
 {id:'book:tahqiq',name:'التحقیق',title:'التحقیق فی کلمات القرآن الکریم',kind:'lexicon',language:'ar',creator:'حسن مصطفوی',country:'ایران',nationality:'ایرانی',description:'واژه‌پژوهی قرآن با تمرکز بر معنای محوری ریشه‌ها و کاربردهای قرآنی آن‌ها.',features:['معنای محوری ریشه','بررسی کاربردهای قرآنی','متن عربی و شرح فارسی'],keywords:['مصطفوی','التحقیق']},
 {id:'book:maqayis',name:'مقاییس',title:'معجم مقاييس اللغة',kind:'lexicon',language:'ar',creator:'احمد بن فارس بن زکریا',date:'قرن چهارم هجری',dateLabel:'دورهٔ تألیف',description:'فرهنگ ریشه‌های عربی؛ بررسی اصول معنایی ریشه‌ها با شواهد و کاربردهای زبانی.',features:['اصول معنایی ریشه','شواهد زبانی','متن عربی و شرح فارسی'],keywords:['ابن فارس','مقاییس','مقاييس']},
 {id:'book:ishtiqaqi',name:'المعجم الاشتقاقی',title:'المعجم الاشتقاقي المؤصل لألفاظ القرآن الكريم',kind:'lexicon',language:'ar',creator:'محمد حسن حسن جبل',country:'مصر',nationality:'مصری',description:'فرهنگ اشتقاقی واژگان قرآن با تأکید بر معنای محوری و پیوند واژه‌های هم‌ریشه.',features:['واژگان قرآن','روابط اشتقاقی','متن عربی و شرح فارسی'],keywords:['جبل','اشتقاقی','اشتقاقي']},
 {id:'quran:tanzil',name:'تنزیل',title:'متن قرآن تنزیل',kind:'quran',language:'ar',creator:'پروژهٔ تنزیل',description:'متن قرآن با رسم عثمانی که پایهٔ نمایش آیات در برنامه است.',features:['متن عثمانی قرآن'],links:[{label:'پروژهٔ تنزیل',href:'https://tanzil.net/'}]},
 {id:'corpus:qac',name:'پیکرهٔ عربی قرآن',title:'Quranic Arabic Corpus',kind:'corpus',language:'ar',creator:'Kais Dukes',date:'نسخهٔ ۰٫۴ · ۲۰۱۱ میلادی',dateLabel:'نسخهٔ داده',description:'مأخذ ریشه، لِمّا و ساخت صرفی واژه‌ها در برنامه.',features:['تحلیل صرفی','ریشه و لِمّا','باب صرفیِ ثبت‌شده'],keywords:['صرف','باب','پیکره'],links:[{label:'پیکرهٔ عربی قرآن',href:'https://corpus.quran.com/'}]},
]
export const getResource=(id:string)=>RESOURCES.find(resource=>resource.id===id)
export interface ResourceFilters {query?:string;country?:string;language?:string;style?:string;kind?:string}
export function normalizeResourceText(value:string){return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/ة/g,'ه').replace(/\u200c/g,' ').toLocaleLowerCase().trim()}
export function filterResources(resources:Resource[],filters:ResourceFilters){const words=normalizeResourceText(filters.query??'').split(/\s+/).filter(Boolean);return resources.filter(r=>{
 if(filters.country&&r.country!==filters.country||filters.language&&r.language!==filters.language||filters.style&&r.style!==filters.style||filters.kind&&r.kind!==filters.kind)return false
 const haystack=normalizeResourceText([r.name,r.title,r.creator,r.country,r.nationality,r.date,r.description,RESOURCE_KINDS[r.kind],RESOURCE_LANGUAGES[r.language],r.style&&RECITATION_STYLES[r.style],...r.features,...(r.keywords??[])].filter(Boolean).join(' '))
 return words.every(word=>haystack.includes(word))
})}
