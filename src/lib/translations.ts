import catalogue from '../../public/data/translations/catalogue.json'
export const EXTRA_TRANSLATIONS = catalogue
export const TRANSLATION_IDS = ['s','f','a','m',...catalogue.map(item=>item.id)]
export type Translator = string
export const isTranslator=(value:unknown):value is Translator=>typeof value==='string'&&TRANSLATION_IDS.includes(value)
export function defaultTranslation(language:string):Translator{return language==='fa'?'s':catalogue.find(item=>item.language===language)?.id??'s'}
export function translationLanguage(id:Translator){return catalogue.find(item=>item.id===id)?.language??'fa'}
export function translationDirection(id:Translator){return ['ar','fa','ur','ps','sd','ug','dv','ku'].includes(translationLanguage(id))?'rtl':'ltr'}
