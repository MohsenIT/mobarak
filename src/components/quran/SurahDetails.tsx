'use client'
import {t} from '@/lib/i18n'
import {toFa, type SurahData, type SurahMeta, type Translator} from '@/lib/quran'
import VerseActions from './VerseActions'

export default function SurahDetails({surah, meta, translator}: {surah: SurahData; meta: SurahMeta; translator: Translator}) {
  const words = surah.v.flatMap(verse => verse.w)
  const roots = new Set(words.flatMap(word => word.r ? [word.r] : []))
  const facts = [
    ['surah.number', toFa(surah.n)],
    ['surah.revelation', t(meta.rev === 'makkah' ? 'surah.makkah' : 'surah.madinah')],
    ['surah.verses', toFa(surah.v.length)],
    ['surah.words', toFa(words.length)],
    ['surah.roots', toFa(roots.size)],
    ['surah.pages', `${toFa(surah.v[0]?.p ?? meta.pg)}–${toFa(surah.v.at(-1)?.p ?? meta.pg)}`],
  ]
  return <section className="surah-details">
    <div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-bold text-lg">{surah.fa}</h2><VerseActions surah={surah} verse={surah.v[0]} translator={translator} wholeSurah /></div>
    <dl className="grid grid-cols-2 gap-3">{facts.map(([label, value]) => <div key={label} className="stat"><dt>{t(label)}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
  </section>
}
