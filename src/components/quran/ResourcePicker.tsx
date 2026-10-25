'use client'
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
 return <><div className="resource-picker-trigger"><button type="button" className="resource-select" aria-label={browse?'جست‌وجوی منابع':`انتخاب ${label}`} aria-haspopup="dialog" onClick={()=>{setQuery('');setCountry('');setLanguage('');setStyle('');setKind('');setOpen(true)}}><span>{selected?.creator??selected?.name??(browse?'جست‌وجوی منابع':label)}</span><ChevronDown size={15}/></button>{selected&&<SourceReference sourceId={selected.id} iconOnly/>}</div>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="resource-picker-dialog" dir="rtl"><DialogHeader><DialogTitle>{browse?'منابع برنامه':`انتخاب ${label}`}</DialogTitle><DialogDescription>جست‌وجو بر اساس نام، پدیدآورنده، کشور و ویژگی‌های منبع</DialogDescription></DialogHeader>
 <div className="resource-picker-search"><Search size={16}/><input type="search" aria-label={`جست‌وجوی ${label}`} placeholder="نام، کشور یا ویژگی…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
 <div className="resource-picker-filters">{kinds.length>1&&<label>نوع منبع<select aria-label="فیلتر نوع منبع" value={kind} onChange={e=>setKind(e.target.value)}><option value="">همه</option>{kinds.map(k=><option key={k} value={k}>{RESOURCE_KINDS[k]}</option>)}</select></label>}<label>کشور<select aria-label="فیلتر کشور" value={country} onChange={e=>setCountry(e.target.value)}><option value="">همه</option>{countries.map(c=><option key={c}>{c}</option>)}</select></label><label>زبان<select aria-label="فیلتر زبان" value={language} onChange={e=>setLanguage(e.target.value)}><option value="">همه</option>{languages.map(l=><option key={l} value={l}>{RESOURCE_LANGUAGES[l]??l}</option>)}</select></label>{recitations&&<label>شیوهٔ تلاوت<select aria-label="فیلتر شیوهٔ تلاوت" value={style} onChange={e=>setStyle(e.target.value)}><option value="">همه</option>{Object.entries(RECITATION_STYLES).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>}</div>
 <div className="resource-picker-results">{!filtered.length&&<p role="status">منبعی با این مشخصات در فهرست فعلی نیست.</p>}{filtered.map(r=><div className="resource-picker-row" key={r.id}>{browse?<div className="resource-picker-choice"><span><b>{r.title}</b><small>{[r.creator,r.country,RESOURCE_LANGUAGES[r.language]].filter(Boolean).join(' · ')}</small></span></div>:<button type="button" className="resource-picker-choice" aria-pressed={value===r.id} onClick={()=>{onChange(r.id);setOpen(false)}}><span><b>{r.creator??r.title}</b><small>{[r.country,RESOURCE_LANGUAGES[r.language],r.style&&RECITATION_STYLES[r.style]].filter(Boolean).join(' · ')}</small></span>{value===r.id&&<Check size={17}/>}</button>}<SourceReference sourceId={r.id} iconOnly/></div>)}</div>
 </DialogContent></Dialog></>
}
