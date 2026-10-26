'use client'
import {useEffect,useState} from 'react'
import {Languages,Download} from 'lucide-react'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {UI_LANGUAGES,languageName,resolveLanguage,setUiLanguage,useUiLanguage,t} from '@/lib/i18n'
import {defaultTranslation,EXTRA_TRANSLATIONS,type Translator} from '@/lib/translations'
import regions from '@/messages/regions.json'
import {downloadOffline} from './OfflineSettings'
const SEEN='mubarak.language-suggestion.v1'
export function LanguageOnboarding({onTranslation}:{onTranslation:(id:Translator)=>void}){
 const {language,dir}=useUiLanguage()
 const [suggestion,setSuggestion]=useState<string|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{
  try{if(localStorage.getItem(SEEN)||localStorage.getItem('mubarak.ui-language.v1'))return}catch{return}
  let live=true
  const controller=new AbortController()
  ;(async()=>{
   const device=resolveLanguage(navigator.languages?.length?navigator.languages:[navigator.language])
   const timeout=setTimeout(()=>controller.abort(),1500)
   const region=await fetch('/api/language-region',{cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():null).catch(()=>null)
   clearTimeout(timeout)
   if(!live)return
   try{if(localStorage.getItem('mubarak.ui-language.v1'))return}catch{}
   const country=region?.country as keyof typeof regions|undefined
   const proposed=device??(country?regions[country]:null)
   if(!proposed||proposed==='fa'||!UI_LANGUAGES.includes(proposed)){try{localStorage.setItem(SEEN,'1')}catch{};return}
   setSuggestion(proposed)
   try{const messages=await import(`../../messages/${proposed}.json`).then(module=>module.default);if(live)setPreview(messages['language.suggestBody'].replace('{language}',languageName(proposed)))}catch{}
  })()
  return()=>{live=false;controller.abort()}
 },[])
 const dismiss=()=>{try{localStorage.setItem(SEEN,'1')}catch{};setSuggestion(null)}
 async function accept(){if(!suggestion)return;setBusy(true);if(await setUiLanguage(suggestion)){onTranslation(defaultTranslation(suggestion));dismiss()}else setError(t('language.failed'));setBusy(false)}
 return <Dialog open={!!suggestion} onOpenChange={open=>{if(!open&&!busy)dismiss()}}><DialogContent dir={dir} className="language-dialog"><DialogHeader><DialogTitle>{t('language.suggestTitle')}</DialogTitle><DialogDescription>{t('language.suggestBody',{language:languageName(suggestion??'fa',language)})}</DialogDescription></DialogHeader>{preview&&<p lang={suggestion??undefined} dir={['ar','ur','ps','sd','ug','dv','ku'].includes(suggestion??'')?'rtl':'ltr'}>{preview}</p>}<p className="text-xs leading-6 opacity-70">{t('language.detected')}</p><div className="flex flex-wrap gap-2"><button className="chip language-accept min-h-11 px-3" disabled={busy} onClick={accept}>{busy?t('language.loading'):t('language.accept')}</button><button className="chip language-decline min-h-11 px-3" disabled={busy} onClick={dismiss}>{t('language.decline')}</button></div><p role="status">{error}</p></DialogContent></Dialog>
}
export default function LanguageSettings({translator}:{translator:Translator}){
 const {language,dir}=useUiLanguage(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function change(next:string){setBusy(true);setMessage(await setUiLanguage(next)?t('language.saved'):t('language.failed'));setBusy(false)}
 async function download(){setBusy(true);setMessage(t('language.downloading'));try{const groups=EXTRA_TRANSLATIONS.some(item=>item.id===translator)?[`translation:${translator}`]:['core'];await downloadOffline(groups);try{const saved=JSON.parse(localStorage.getItem('offline-optional-translations')??'[]');localStorage.setItem('offline-optional-translations',JSON.stringify([...new Set([...(Array.isArray(saved)?saved:[]),...groups.filter(group=>group.startsWith('translation:'))])]))}catch{};setMessage(t('language.downloaded'))}catch{setMessage(t('language.downloadFailed'))}finally{setBusy(false)}}
 return <section dir={dir} className="language-settings"><h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Languages size={18}/>{t('language.settings')}</h3><label className="flex flex-col gap-2 text-sm">{t('language.interface')}<select aria-label={t('language.interface')} className="resource-select" value={language} disabled={busy} onChange={event=>void change(event.target.value)}>{UI_LANGUAGES.map(code=><option key={code} value={code} lang={code}>{languageName(code)} · {languageName(code,language)}</option>)}</select></label><p className="text-xs leading-6 my-2">{t('language.separate')}</p><button type="button" className="chip min-h-11 px-3 inline-flex items-center gap-2" disabled={busy} onClick={download}><Download size={15}/>{t('language.download')}</button><p className="text-xs leading-6 mt-2" role="status">{message}</p></section>
}
