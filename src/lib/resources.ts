import resourceCatalogue from '../../public/data/resources.json'
import {t,languageName,UI_LANGUAGES,currentLanguage} from './i18n'
import {EXTRA_TRANSLATIONS} from './translations'
export type ResourceKind='quran'|'translation'|'recitation'|'lexicon'|'tafsir'|'corpus'
export interface Resource {
  id:string;name:string;title:string;kind:ResourceKind;language:string
  creator?:string;country?:string;countryCode?:string;nationality?:string;date?:string;dateLabel?:string
  style?:'murattal'|'mujawwad';description:string;features:string[];keywords?:string[]
  image?:{src:string;alt:string};links?:{label:string;href:string}[]
}
export const RESOURCE_KINDS:Record<ResourceKind,string>={quran:'resource.quran',translation:'ui.37e2fdb79c',recitation:'ui.2ea8f68e72',lexicon:'resource.lexicon',tafsir:'resource.tafsir',corpus:'resource.corpus'}
export const RESOURCE_LANGUAGES:Record<string,string>=Object.fromEntries(UI_LANGUAGES.map(code=>[code,languageName(code,'fa')]))
export const RECITATION_STYLES={murattal:'resource.murattal',mujawwad:'resource.mujawwad'}
/** Bibliographic metadata, independent from playback/data providers. Unknown facts stay absent. */
export const RESOURCES:Resource[]=[...resourceCatalogue] as Resource[]

RESOURCES.push(...EXTRA_TRANSLATIONS.map(item=>({id:`translation:${item.id}`,name:item.name,title:item.name,kind:item.kind as 'translation'|'tafsir',language:item.language,creator:item.name,description:item.source,features:item.translatedVerses<6236?[`${item.translatedVerses} / 6236`]:[],links:[{label:'Tanzil',href:item.source}]})))
export const getResource=(id:string)=>RESOURCES.find(resource=>resource.id===id)
export interface ResourceFilters {query?:string;country?:string;language?:string;style?:string;kind?:string}
export function normalizeResourceText(value:string){return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/ة/g,'ه').replace(/\u200c/g,' ').toLocaleLowerCase().trim()}
export function filterResources(resources:Resource[],filters:ResourceFilters){const words=normalizeResourceText(filters.query??'').split(/\s+/).filter(Boolean);return resources.filter(r=>{
 if(filters.country&&r.country!==filters.country||filters.language&&r.language!==filters.language||filters.style&&r.style!==filters.style||filters.kind&&r.kind!==filters.kind)return false
 const haystack=normalizeResourceText([r.name,r.title,r.creator,r.country,r.nationality,r.date,r.description,t(RESOURCE_KINDS[r.kind]),RESOURCE_LANGUAGES[r.language],languageName(r.language),languageName(r.language,currentLanguage()),r.style&&t(RECITATION_STYLES[r.style]),...r.features,...(r.keywords??[])].filter(Boolean).join(' '))
 return words.every(word=>haystack.includes(word))
})}

export function resourceCountryFlag(resource:Pick<Resource,'countryCode'>){
 const code=resource.countryCode
 return code&&/^[A-Z]{2}$/.test(code)?String.fromCodePoint(...[...code].map(letter=>127397+letter.charCodeAt(0))):''
}
export function resourceCountryName(resource:Pick<Resource,'country'|'countryCode'>,language=currentLanguage()){
 if(!resource.countryCode)return resource.country??''
 try{return new Intl.DisplayNames([language],{type:'region'}).of(resource.countryCode)??resource.country??''}catch{return resource.country??''}
}
