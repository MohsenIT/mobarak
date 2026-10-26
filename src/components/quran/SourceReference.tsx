'use client'
import {t,languageLabel,uiDirection} from '@/lib/i18n'

import { useId, useState } from 'react'
import { BookOpen, ExternalLink, X, Info } from 'lucide-react'
import ResourcePortrait from './ResourcePortrait'
import { getResource,RESOURCE_KINDS,RESOURCE_LANGUAGES,RECITATION_STYLES } from '@/lib/resources'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type SourceInfo = {
  title: string
  resourceId?:string
  image?:{src:string;alt:string}
  description?: string
  fields?: { label: string; value: string }[]
  notes?: string[]
  links?: { label: string; href: string }[]
  details?: string
}

const chipClass = 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-5 text-right cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2'
const chipStyle = { borderColor: 'var(--line)', color: 'var(--ink-soft)' }

// Keep verse references and older citations compatible with the same presentation.
function fromText(text: string): SourceInfo {
  const links: NonNullable<SourceInfo['links']> = []
  const lines = text.replace(/https?:\/\/[^\s]+/g, href => {
    links.push({ label: t("ui.70af150854"), href })
    return ''
  }).split('\n').map(line => line.trim()).filter(Boolean)
  const fields: NonNullable<SourceInfo['fields']> = []
  const notes: string[] = []
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':')
    if (colon > 0 && colon < 30 && line.slice(colon + 1).trim()) fields.push({ label: line.slice(0, colon), value: line.slice(colon + 1).trim() })
    else notes.push(line)
  }
  return { title: lines[0] || t("ui.18147dbf03"), fields, notes, links }
}

export default function SourceReference({ text = '', source, label = t("ui.8a52f7bc3f"),sourceId,iconOnly=false }: { text?: string; source?: SourceInfo; label?: string;sourceId?:string;iconOnly?:boolean }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const resource=getResource(sourceId??source?.resourceId??'')
  const provided=source??fromText(text)
  const base:SourceInfo|undefined=resource?{title:resource.title,description:resource.description,image:resource.image,
    fields:[{label:t("ui.23625d3dd4"),value:t(RESOURCE_KINDS[resource.kind])},...(resource.creator?[{label:resource.kind==='recitation'?t("ui.48288575ed"):resource.kind==='translation'?t("ui.52baa2cbee"):resource.kind==='lexicon'?t("ui.f72a3d8543"):t("ui.5544db5ccf"),value:resource.creator}]:[]),...(resource.country?[{label:t("ui.0ca5a0d367"),value:resource.country}]:[]),{label:t("ui.edd0aba98b"),value:languageLabel(resource.language)},...(resource.style?[{label:t("ui.861afdb3c3"),value:t(RECITATION_STYLES[resource.style])}]:[]),...(resource.date?[{label:resource.dateLabel??t("ui.9699c34220"),value:resource.date}]:[])],notes:resource.features,links:resource.links}:undefined
  const info:SourceInfo=base?{...provided,title:base.title,description:provided.description??base.description,image:provided.image??base.image,fields:[...(base.fields??[]).filter(field=>!provided.fields?.some(p=>p.label===field.label)),...(provided.fields??[])],notes:[...(base.notes??[]),...(provided.notes??[])],links:[...(base.links??[]),...(provided.links??[])]}:provided
  const fields=(info.fields??[]).filter((field,i,all)=>!/(مجوز|license|copyright)/i.test(field.label)&&all.findIndex(other=>other.label===field.label&&other.value===field.value)===i)
  const links = info.links?.filter((link,i,all) => (/^https?:\/\//.test(link.href) || /^\/(?!\/)/.test(link.href)) && all.findIndex(other=>other.href===link.href)===i)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className={iconOnly?'icon-btn sm resource-info-button':chipClass} aria-label={`${iconOnly?t("ui.5b74392d72"):label}، ${info.title}`} style={chipStyle} data-source-chip>
        {iconOnly?<Info size={17} aria-hidden="true"/>:<><BookOpen size={13} aria-hidden="true"/><span>{label}</span></>}
      </button>
    </PopoverTrigger>
    <PopoverContent dir={uiDirection()} side="top" aria-labelledby={titleId} className="w-[min(24rem,calc(100vw-2rem))] rounded-xl p-4 text-xs leading-7 break-words [overflow-wrap:anywhere]" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--line)', zIndex: 100, maxHeight: 'min(70dvh, var(--radix-popover-content-available-height, 70dvh))', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <header className="flex items-start gap-3 mb-2">
        <h3 id={titleId} className="font-bold text-sm leading-7 flex-1">{info.title}</h3>
        <button type="button" aria-label={t("ui.7f0f10c904")} className="shrink-0 rounded-full p-1 cursor-pointer" onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></button>
      </header>
      {resource&&<ResourcePortrait image={info.image} large/>}
      {info.description && <p className="mb-3" style={{ color: 'var(--ink-soft)' }}>{info.description}</p>}
      {!!fields.length && <dl className="divide-y" style={{ borderColor: 'var(--line)' }}>
        {fields.map((field, i) => <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 py-1.5" style={{ borderColor: 'var(--line)' }}>
          <dt style={{ color: 'var(--ink-soft)' }}>{t(field.label)}</dt><dd className="min-w-0">{field.value}</dd>
        </div>)}
      </dl>}
      {!!info.notes?.length && <div className="mt-3 space-y-2" style={{ color: 'var(--ink-soft)' }}>{info.notes.map((note, i) => <p key={i}>{note}</p>)}</div>}
      {info.details && <details className="mt-3"><summary className="cursor-pointer">{t("ui.8db4c42ee5")}</summary><p className="mt-2 whitespace-pre-wrap" style={{ color: 'var(--ink-soft)' }}>{info.details}</p></details>}
      {!!links?.length && <nav aria-label={t("ui.3c62e36ece")} className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
        {links.map((link, i) => <a key={i} className={chipClass} style={chipStyle} href={link.href} target="_blank" rel="noreferrer"><ExternalLink size={12} aria-hidden="true" />{t(link.label)}<span className="sr-only">{' '}{t("ui.3aea18199a")}</span></a>)}
      </nav>}
    </PopoverContent>
  </Popover>
}
