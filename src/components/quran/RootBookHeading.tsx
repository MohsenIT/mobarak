'use client'
import {t} from '@/lib/i18n'
import { ChevronDown } from 'lucide-react'
import SourceReference, { type SourceInfo } from './SourceReference'

export const ROOT_BOOK_TITLES = {
  tahqiq: { short: t("ui.486f5d9141"), full: t("ui.df7eaafe0c") },
  maqayis: { short: t("ui.4c3a424943"), full: t("ui.9c1717f2f2") },
  ishtiqaqi: { short: t("ui.1da653b2f3"), full: t("ui.21e5e1b857") },
} as const

/** RTL order: title/preview, source chip, disclosure arrow at the far left.
 * New root dictionaries use this heading rather than their own layout.
 */
export default function RootBookHeading({ book, expanded, summary, source, onToggle }: {
  book: keyof typeof ROOT_BOOK_TITLES; expanded: boolean; summary?: string; source?: SourceInfo; onToggle: () => void
}) {
  const title = ROOT_BOOK_TITLES[book]
  return <div className="flex items-start gap-2" dir="rtl" data-root-book-heading={book}>
    <button type="button" className="flex-1 min-w-0 text-right cursor-pointer" aria-expanded={expanded} onClick={onToggle}>
      <span className={expanded ? 'block truncate font-bold' : 'block'} title={expanded ? title.full : undefined}>
        <strong>{expanded ? title.full : title.short}{!expanded && summary && ': '}</strong>{!expanded && summary}
      </span>
    </button>
    {expanded && source && <span className="shrink-0"><SourceReference sourceId={`book:${book}`} source={source} /></span>}
    <button type="button" className="shrink-0 mt-1 cursor-pointer" aria-expanded={expanded} aria-label={t("ui.fde1fab404",{p0:(expanded ? t("ui.313cbecb4d") : t("ui.592c8cbd7f")),p1:(title.short)})} onClick={onToggle}>
      <ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
    </button>
  </div>
}
