'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export default function SourceReference({ text, label = 'منبع' }: { text: string; label?: string }) {
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs leading-5 cursor-pointer" aria-label={`${label}: ${text}`} style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>{label}</button>
    </PopoverTrigger>
    <PopoverContent dir="rtl" side="top" className="max-w-[calc(100vw-24px)] text-xs leading-7 whitespace-pre-wrap" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--line)', zIndex: 100 }}>
      {text}
    </PopoverContent>
  </Popover>
}
