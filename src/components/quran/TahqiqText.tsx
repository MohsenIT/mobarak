import {t} from '@/lib/i18n'
import { splitTahqiqText } from '@/lib/tahqiq-format'
import SourceReference from './SourceReference'

export default function TahqiqText({ text }: { text: string }) {
  return <div className="tahqiq-prose mt-2" data-tahqiq-persian>
    {splitTahqiqText(text).map((part, index) => part.kind === 'quran'
      ? <blockquote key={index} className="tahqiq-verse font-quran" lang="ar" dir="rtl">{part.text}</blockquote>
      : part.kind === 'reference' ? <div key={index} className="tahqiq-reference"><SourceReference text={part.text} label={t("ui.217283c5b6")} /></div>
        : <p key={index} className="whitespace-pre-wrap text-justify break-words">{part.text}</p>)}
  </div>
}
