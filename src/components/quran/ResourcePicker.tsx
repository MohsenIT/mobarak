'use client'
import {DictationInput} from './DictationInput'
import {t,languageName,useUiLanguage,uiDirection,UI_LANGUAGES} from '@/lib/i18n'
import {formatDigits} from '@/lib/locale-numbers'
import {useState} from 'react'
import {Check,ChevronDown,Search} from 'lucide-react'
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {RESOURCES,RECITATION_STYLES,RESOURCE_KINDS,filterResources,getResource,resourceCountryFlag,resourceCountryName,type Resource} from '@/lib/resources'
import SourceReference from './SourceReference'
import ResourcePortrait from './ResourcePortrait'
export default function ResourcePicker({ids,value,onChange,label,browse=false}:{browse?:boolean;ids:string[];value:string;onChange:(id:string)=>void;label:string}){
 const {language:uiLanguage}=useUiLanguage()
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[country,setCountry]=useState(''),[language,setLanguage]=useState(''),[style,setStyle]=useState(''),[kind,setKind]=useState('')
 const resources=RESOURCES.filter(r=>ids.includes(r.id)).sort((a,b)=>UI_LANGUAGES.indexOf(a.language)-UI_LANGUAGES.indexOf(b.language)),selected=getResource(value)
 const countries=[...new Set(resources.map(r=>r.country).filter((x):x is string=>!!x))].map(value=>({value,resource:resources.find(r=>r.country===value)!,count:resources.filter(r=>r.country===value).length})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value,uiLanguage))
 const languages=[...new Set(resources.map(r=>r.language))]
 const kinds=[...new Set(resources.map(r=>r.kind))]
 const filtered=filterResources(resources,{query,country,language,style,kind})
 return <><div className="resource-picker-trigger"><button type="button" className="resource-select" aria-label={browse?t("ui.6ad327d237"):t("ui.558dc6254e",{p0:(label)})} aria-haspopup="dialog" onClick={()=>{setQuery('');setCountry('');setLanguage('');setStyle('');setKind('');setOpen(true)}}><span>{selected?.creator??selected?.name??(browse?t("ui.6ad327d237"):label)}</span><ChevronDown size={15}/></button>{selected&&<SourceReference sourceId={selected.id} iconOnly/>}</div>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="resource-picker-dialog" dir={uiDirection()} aria-describedby={undefined}><DialogHeader><DialogTitle>{browse?t("ui.b6a850cc59"):t("ui.558dc6254e",{p0:(label)})}</DialogTitle></DialogHeader>
 <div className="resource-picker-search"><Search size={16}/><DictationInput type="search" aria-label={t("ui.a24381d8b8",{p0:(label)})} placeholder={t("ui.4985474be1")} value={query} onChange={e=>setQuery(e.target.value)}/></div>
 <div className="resource-picker-filters">
 <div className="resource-filter-row" role="group" aria-label={t("ui.23625d3dd4")}><span className="resource-filter-label">{t("ui.23625d3dd4")}:</span><div className="resource-filter-options"><FilterChip active={!kind&&!style} onClick={()=>{setKind('');setStyle('')}}>{t("ui.15270886ea")}</FilterChip>{kinds.map(k=>k==='recitation'?Object.entries(RECITATION_STYLES).filter(([key])=>resources.some(r=>r.kind===k&&r.style===key)).map(([key,name])=><FilterChip key={key} active={style===key} onClick={()=>{setStyle(style===key?'':key);setKind(style===key?'':k)}}>{t(name)}</FilterChip>):<FilterChip key={k} active={kind===k} onClick={()=>{setKind(kind===k?'':k);setStyle('')}}>{t(RESOURCE_KINDS[k])}</FilterChip>)}</div></div>
 {countries.length>0&&<div className="resource-filter-row" role="group" aria-label={t("resource.nationality")}><span className="resource-filter-label">{t("resource.nationality")}:</span><div className="resource-filter-options"><FilterChip active={!country} onClick={()=>setCountry('')}>{t("ui.15270886ea")}</FilterChip>{countries.map(c=><FilterChip key={c.value} active={country===c.value} onClick={()=>setCountry(country===c.value?'':c.value)}><span aria-hidden="true">{resourceCountryFlag(c.resource)}</span>{resourceCountryName(c.resource,uiLanguage)} <span>({formatDigits(c.count,uiLanguage)})</span></FilterChip>)}</div></div>}
 {languages.length>1&&<div className="resource-filter-row" role="group" aria-label={t("ui.edd0aba98b")}><span className="resource-filter-label">{t("ui.edd0aba98b")}:</span><div className="resource-filter-options"><FilterChip active={!language} onClick={()=>setLanguage('')}>{t("ui.15270886ea")}</FilterChip>{languages.map(l=><FilterChip key={l} active={language===l} onClick={()=>setLanguage(language===l?'':l)}>{languageName(l,uiLanguage)}</FilterChip>)}</div></div>}
 </div>
 <div className="resource-picker-results">{!filtered.length&&<p role="status">{t("ui.a894ae84a7")}</p>}{filtered.map(r=><div className="resource-picker-row" key={r.id}>{browse?<div className="resource-picker-choice"><ResourcePortrait image={r.image}/><span className="resource-picker-copy"><b>{r.title}</b><small>{r.creator}</small><ResourceMeta resource={r} language={uiLanguage}/></span></div>:<button type="button" className="resource-picker-choice" aria-pressed={value===r.id} onClick={()=>{onChange(r.id);setOpen(false)}}><ResourcePortrait image={r.image}/><span className="resource-picker-copy"><b>{r.creator??r.title}</b><ResourceMeta resource={r} language={uiLanguage}/></span>{value===r.id&&<Check size={17}/>}</button>}<SourceReference sourceId={r.id} iconOnly/></div>)}</div>
 </DialogContent></Dialog></>
}

function ResourceMeta({resource:r,language}:{resource:Resource;language:string}){
 const flag=resourceCountryFlag(r)
 return <span className="resource-meta">{r.country&&<span className="resource-meta-chip">{flag&&<span aria-hidden="true">{flag}</span>}{resourceCountryName(r,language)}</span>}<span className="resource-meta-chip">{languageName(r.language,language)}</span>{r.style&&<span className="resource-meta-chip">{t(RECITATION_STYLES[r.style])}</span>}</span>
}

function FilterChip({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}){
 return <button type="button" className="resource-filter-chip" aria-pressed={active} onClick={onClick}>{children}</button>
}
