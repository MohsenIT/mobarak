import { splitTahqiqText } from '@/lib/tahqiq-format'

export default function TahqiqText({ text }: { text: string }) {
  return <div className="tahqiq-prose mt-2" data-tahqiq-persian>
    {splitTahqiqText(text).map((part, index) => part.kind === 'quran'
      ? <blockquote key={index} className="tahqiq-verse font-quran" lang="ar" dir="rtl">{part.text}</blockquote>
      : part.kind === 'reference' ? <p key={index} className="tahqiq-reference">{part.text}</p>
        : <p key={index} className="whitespace-pre-wrap text-justify break-words">{part.text}</p>)}
  </div>
}
