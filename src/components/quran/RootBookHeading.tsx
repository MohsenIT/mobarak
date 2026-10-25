'use client'
import { ChevronDown } from 'lucide-react'
import SourceReference, { type SourceInfo } from './SourceReference'

export const ROOT_BOOK_TITLES = {
  tahqiq: { short: 'التحقیق', full: 'التحقیق فی کلمات القرآن الکریم' },
  maqayis: { short: 'مقاییس', full: 'معجم مقاييس اللغة' },
  ishtiqaqi: { short: 'المعجم الاشتقاقی', full: 'المعجم الاشتقاقي المؤصل لألفاظ القرآن الكريم' },
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
    <button type="button" className="shrink-0 mt-1 cursor-pointer" aria-expanded={expanded} aria-label={`${expanded ? 'بستن' : 'بازکردن'} شرح ${title.short}`} onClick={onToggle}>
      <ChevronDown aria-hidden="true" size={16} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
    </button>
  </div>
}
