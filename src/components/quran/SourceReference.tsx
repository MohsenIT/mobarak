'use client'

import { useId, useState } from 'react'
import { BookOpen, ExternalLink, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type SourceInfo = {
  title: string
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
    links.push({ label: 'مشاهدهٔ مأخذ', href })
    return ''
  }).split('\n').map(line => line.trim()).filter(Boolean)
  const fields: NonNullable<SourceInfo['fields']> = []
  const notes: string[] = []
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(':')
    if (colon > 0 && colon < 30 && line.slice(colon + 1).trim()) fields.push({ label: line.slice(0, colon), value: line.slice(colon + 1).trim() })
    else notes.push(line)
  }
  return { title: lines[0] || 'مشخصات منبع', fields, notes, links }
}

export default function SourceReference({ text = '', source, label = 'منبع' }: { text?: string; source?: SourceInfo; label?: string }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const info = source ?? fromText(text)
  const links = info.links?.filter(link => /^https?:\/\//.test(link.href) || /^\/(?!\/)/.test(link.href))
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" className={chipClass} aria-label={`${label}، ${info.title}`} style={chipStyle} data-source-chip>
        <BookOpen size={13} aria-hidden="true" /><span>{label}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent dir="rtl" side="top" aria-labelledby={titleId} className="w-[min(24rem,calc(100vw-2rem))] rounded-xl p-4 text-xs leading-7 break-words [overflow-wrap:anywhere]" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--line)', zIndex: 100, maxHeight: 'min(70dvh, var(--radix-popover-content-available-height, 70dvh))', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <header className="flex items-start gap-3 mb-2">
        <h3 id={titleId} className="font-bold text-sm leading-7 flex-1">{info.title}</h3>
        <button type="button" aria-label="بستن مشخصات منبع" className="shrink-0 rounded-full p-1 cursor-pointer" onClick={() => setOpen(false)}><X size={16} aria-hidden="true" /></button>
      </header>
      {info.description && <p className="mb-3" style={{ color: 'var(--ink-soft)' }}>{info.description}</p>}
      {!!info.fields?.length && <dl className="divide-y" style={{ borderColor: 'var(--line)' }}>
        {info.fields.map((field, i) => <div key={i} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 py-1.5" style={{ borderColor: 'var(--line)' }}>
          <dt style={{ color: 'var(--ink-soft)' }}>{field.label}</dt><dd className="min-w-0">{field.value}</dd>
        </div>)}
      </dl>}
      {!!info.notes?.length && <div className="mt-3 space-y-2" style={{ color: 'var(--ink-soft)' }}>{info.notes.map((note, i) => <p key={i}>{note}</p>)}</div>}
      {info.details && <details className="mt-3"><summary className="cursor-pointer">روش تهیه و محدودیت‌ها</summary><p className="mt-2 whitespace-pre-wrap" style={{ color: 'var(--ink-soft)' }}>{info.details}</p></details>}
      {!!links?.length && <nav aria-label="دسترسی به مأخذ" className="flex flex-wrap gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
        {links.map((link, i) => <a key={i} className={chipClass} style={chipStyle} href={link.href} target="_blank" rel="noreferrer"><ExternalLink size={12} aria-hidden="true" />{link.label}<span className="sr-only"> (در زبانهٔ تازه)</span></a>)}
      </nav>}
    </PopoverContent>
  </Popover>
}
