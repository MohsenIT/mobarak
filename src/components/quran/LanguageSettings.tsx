'use client'
import {useEffect,useState} from 'react'
import {Download,ChevronDown} from 'lucide-react'
import {IconTranslate} from './Ornaments'
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {UI_LANGUAGES,languageName,languageLabel,resolveLanguage,uiDirection,setUiLanguage,useUiLanguage,t} from '@/lib/i18n'
import {defaultTranslation,EXTRA_TRANSLATIONS,type Translator} from '@/lib/translations'
import regions from '@/messages/regions.json'
import {downloadOffline} from './OfflineSettings'
const SEEN='mubarak.language-suggestion.v1'
export function LanguageOnboarding({onTranslation,knownPersianReader=false}:{onTranslation:(id:Translator)=>void;knownPersianReader?:boolean}){
 useUiLanguage()
 const [suggestion,setSuggestion]=useState<string|null>(null),[preview,setPreview]=useState<Record<string,string>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  if(knownPersianReader)return
  try{if(localStorage.getItem(SEEN)||localStorage.getItem('mubarak.ui-language.v1'))return}catch{return}
  let live=true
  const controller=new AbortController()
  ;(async()=>{
   const tags=navigator.languages?.length?navigator.languages:[navigator.language]
   const device=tags.some(tag=>tag.toLowerCase().split(/[-_]/)[0]==='fa')?'fa':resolveLanguage(tags)
   const timeout=setTimeout(()=>controller.abort(),1500)
   const region=await fetch('/api/language-region',{cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():null).catch(()=>null)
   clearTimeout(timeout)
   if(!live)return
   try{if(localStorage.getItem('mubarak.ui-language.v1'))return}catch{}
   const country=region?.country as keyof typeof regions|undefined
   const proposed=country==='IR'&&(!device||device==='en')?'fa':device??(country?regions[country]:null)
   if(!proposed||proposed==='fa'||!UI_LANGUAGES.includes(proposed)){try{localStorage.setItem(SEEN,'1')}catch{};return}
   setSuggestion(proposed)
   try{const messages=await import(`../../messages/${proposed}.json`).then(module=>module.default);if(live)setPreview(messages)}catch{}
  })()
  return()=>{live=false;controller.abort()}
 },[knownPersianReader])
 const dismiss=()=>{try{localStorage.setItem(SEEN,'1')}catch{};setSuggestion(null)}
 async function accept(){if(!suggestion)return;setBusy(true);if(await setUiLanguage(suggestion)){onTranslation(defaultTranslation(suggestion));dismiss()}else setError(t('language.failed'));setBusy(false)}
 const prompt=(key:string)=>preview?.[key]??t(key)
 return <Dialog open={!!suggestion&&!!preview} onOpenChange={open=>{if(!open&&!busy)dismiss()}}>
  <DialogContent dir={uiDirection(suggestion??'fa')} lang={suggestion??undefined} className="language-dialog language-dialog-compact">
   <DialogTitle className="sr-only">{prompt('language.suggestTitle')}</DialogTitle>
   <DialogDescription className="language-question">{prompt('language.suggestBody').replace('{language}',languageName(suggestion??'fa'))}</DialogDescription>
   <div className="language-actions"><button className="chip language-accept min-h-11 px-3" disabled={busy} onClick={accept}>{prompt(busy?'language.loading':'language.accept')}</button><button className="chip language-decline min-h-11 px-3" disabled={busy} onClick={dismiss}>{prompt('language.decline')}</button></div>
   {error&&<p role="status">{error}</p>}
  </DialogContent>
 </Dialog>
}
export default function LanguageSettings({translator,onTranslation}:{translator:Translator;onTranslation:(id:Translator)=>void}){
 const {language,dir}=useUiLanguage(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[choosing,setChoosing]=useState(false),[query,setQuery]=useState('')
 async function change(next:string){setBusy(true);if(await setUiLanguage(next)){onTranslation(defaultTranslation(next));setMessage(t('language.saved'));setChoosing(false)}else setMessage(t('language.failed'));setBusy(false)}
 async function download(){setBusy(true);setMessage(t('language.downloading'));try{const groups=EXTRA_TRANSLATIONS.some(item=>item.id===translator)?[`translation:${translator}`]:['core'];await downloadOffline(groups);try{const saved=JSON.parse(localStorage.getItem('offline-optional-translations')??'[]');localStorage.setItem('offline-optional-translations',JSON.stringify([...new Set([...(Array.isArray(saved)?saved:[]),...groups.filter(group=>group.startsWith('translation:'))])]))}catch{};setMessage(t('language.downloaded'))}catch{setMessage(t('language.downloadFailed'))}finally{setBusy(false)}}
 return <section dir={dir} className="language-settings"><h3 className="text-sm font-bold mb-3 flex items-center gap-2"><IconTranslate size={18}/>{t('language.settings')}</h3>
 <div className="flex flex-col gap-2 text-sm"><span>{t('language.interface')}</span><button type="button" aria-label={t('language.interface')} aria-haspopup="dialog" className="resource-select" onClick={()=>{setQuery('');setChoosing(true)}}><span>{languageLabel(language)}</span><ChevronDown size={15}/></button></div>
 <Dialog open={choosing} onOpenChange={open=>{if(!busy)setChoosing(open)}}><DialogContent className="resource-picker-dialog language-select-dialog" dir={dir}><DialogTitle>{t('language.choose')}</DialogTitle><DialogDescription className="sr-only">{t('language.separate')}</DialogDescription><input type="search" className="resource-select" value={query} aria-label={t('language.choose')} placeholder={t('ui.edd0aba98b')} onChange={event=>setQuery(event.target.value)}/><div className="language-choice-list" role="radiogroup" aria-label={t('language.interface')}>{UI_LANGUAGES.filter(code=>`${languageLabel(code)} ${languageName(code,language)} ${code}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(code=><label key={code} className="language-choice-row choice-row"><span>{languageLabel(code)}</span><input type="radio" name="ui-language-choice" value={code} checked={language===code} disabled={busy} onChange={()=>void change(code)}/></label>)}</div></DialogContent></Dialog>
 <p className="text-xs leading-6 my-2">{t('language.separate')}</p><button type="button" className="chip min-h-11 px-3 inline-flex items-center gap-2" disabled={busy} onClick={download}><Download size={15}/>{t('language.download')}</button><p className="text-xs leading-6 mt-2" role="status">{message}</p></section>
}
