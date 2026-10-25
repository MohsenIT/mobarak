'use client'
import {t,languageName,uiDirection} from '@/lib/i18n'
import {useState} from 'react'
import {Check,ChevronDown,Search} from 'lucide-react'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {RESOURCES,RESOURCE_LANGUAGES,RECITATION_STYLES,RESOURCE_KINDS,filterResources,getResource} from '@/lib/resources'
import SourceReference from './SourceReference'
export default function ResourcePicker({ids,value,onChange,label,browse=false}:{browse?:boolean;ids:string[];value:string;onChange:(id:string)=>void;label:string}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[country,setCountry]=useState(''),[language,setLanguage]=useState(''),[style,setStyle]=useState(''),[kind,setKind]=useState('')
 const resources=RESOURCES.filter(r=>ids.includes(r.id)),selected=getResource(value)
 const countries=[...new Set(resources.map(r=>r.country).filter((x):x is string=>!!x))]
 const languages=[...new Set(resources.map(r=>r.language))]
 const kinds=[...new Set(resources.map(r=>r.kind))]
 const recitations=resources.every(r=>r.kind==='recitation')
 const filtered=filterResources(resources,{query,country,language,style,kind})
 return <><div className="resource-picker-trigger"><button type="button" className="resource-select" aria-label={browse?t("ui.6ad327d237"):t("ui.558dc6254e",{p0:(label)})} aria-haspopup="dialog" onClick={()=>{setQuery('');setCountry('');setLanguage('');setStyle('');setKind('');setOpen(true)}}><span>{selected?.creator??selected?.name??(browse?t("ui.6ad327d237"):label)}</span><ChevronDown size={15}/></button>{selected&&<SourceReference sourceId={selected.id} iconOnly/>}</div>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="resource-picker-dialog" dir={uiDirection()}><DialogHeader><DialogTitle>{browse?t("ui.b6a850cc59"):t("ui.558dc6254e",{p0:(label)})}</DialogTitle><DialogDescription>{t("ui.95df295b80")}</DialogDescription></DialogHeader>
 <div className="resource-picker-search"><Search size={16}/><input type="search" aria-label={t("ui.a24381d8b8",{p0:(label)})} placeholder={t("ui.4985474be1")} value={query} onChange={e=>setQuery(e.target.value)}/></div>
 <div className="resource-picker-filters">{kinds.length>1&&<label>{t("ui.23625d3dd4")}<select aria-label={t("ui.82017c312f")} value={kind} onChange={e=>setKind(e.target.value)}><option value="">{t("ui.15270886ea")}</option>{kinds.map(k=><option key={k} value={k}>{t(RESOURCE_KINDS[k])}</option>)}</select></label>}<label>{t("ui.0ca5a0d367")}<select aria-label={t("ui.b0cc9e0ee2")} value={country} onChange={e=>setCountry(e.target.value)}><option value="">{t("ui.15270886ea")}</option>{countries.map(c=><option key={c}>{c}</option>)}</select></label><label>{t("ui.edd0aba98b")}<select aria-label={t("ui.89a53b5221")} value={language} onChange={e=>setLanguage(e.target.value)}><option value="">{t("ui.15270886ea")}</option>{languages.map(l=><option key={l} value={l}>{languageName(l)}</option>)}</select></label>{recitations&&<label>{t("ui.861afdb3c3")}<select aria-label={t("ui.f11a305a02")} value={style} onChange={e=>setStyle(e.target.value)}><option value="">{t("ui.15270886ea")}</option>{Object.entries(RECITATION_STYLES).map(([key,name])=><option key={key} value={key}>{t(name)}</option>)}</select></label>}</div>
 <div className="resource-picker-results">{!filtered.length&&<p role="status">{t("ui.a894ae84a7")}</p>}{filtered.map(r=><div className="resource-picker-row" key={r.id}>{browse?<div className="resource-picker-choice"><span><b>{r.title}</b><small>{[r.creator,r.country,languageName(r.language)].filter(Boolean).join(' · ')}</small></span></div>:<button type="button" className="resource-picker-choice" aria-pressed={value===r.id} onClick={()=>{onChange(r.id);setOpen(false)}}><span><b>{r.creator??r.title}</b><small>{[r.country,languageName(r.language),r.style&&t(RECITATION_STYLES[r.style])].filter(Boolean).join(' · ')}</small></span>{value===r.id&&<Check size={17}/>}</button>}<SourceReference sourceId={r.id} iconOnly/></div>)}</div>
 </DialogContent></Dialog></>
}
