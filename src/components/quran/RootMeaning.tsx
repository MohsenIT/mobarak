'use client'

import { useEffect, useState } from 'react'
import { toFa } from '@/lib/quran'
import TahqiqText from './TahqiqText'
import SourceReference from './SourceReference'

type Entry = { word: string; ar: string; fa: string; provenance?: { kind: string; translator: string; volume: number; page: number; pageEnd: number; heading: string }; examples?: { s: number; a: number; text: string; surahName: string }[] }
type Definition = { root: string; entries: Entry[] }
type Index = { matchedRoots: string[]; source: { title: string; author: string; translator: string } }
let indexPromise: Promise<Index> | undefined
const cache = new Map<string, Promise<Definition | null>>()
function load(root: string) {
  if (!indexPromise) indexPromise = fetch('/data/tahqiq-index.json').then(r => { if (!r.ok) throw new Error('index'); return r.json() })
  if (!cache.has(root)) cache.set(root, indexPromise.then(index => {
    if (!index.matchedRoots.includes(root)) return null
    return fetch(`/data/tahqiq/${encodeURIComponent(root)}.json`).then(r => { if (!r.ok) throw new Error('entry'); return r.json() })
  }))
  return cache.get(root)!
}

export default function RootMeaning({ root }: { root: string }) {
  const [state, setState] = useState<{ root: string; data?: Definition | null; error?: boolean }>({ root })
  useEffect(() => {
    let live = true
    load(root).then(data => { if (live) setState({ root, data }) }).catch(() => { if (live) setState({ root, error: true }) })
    return () => { live = false }
  }, [root])
  const ready = state.root === root
  return <section className="rounded-xl border p-3 mb-4 text-sm leading-7" aria-label="معنای ریشه در التحقیق" style={{ borderColor: 'var(--line)' }}>
    <h3 className="font-bold">اصل واحد و شرح ریشه · التحقیق</h3>
    {!ready || state.data === undefined && !state.error ? <p role="status" className="text-xs">در حال بارگیری شرح ریشه…</p>
      : state.error ? <p role="alert" className="text-xs">شرح ریشه بارگیری نشد.</p>
        : !state.data ? <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>برای این ریشه مدخل منطبق در نسخهٔ ارسالی پیدا نشد.</p>
          : <>
            {state.data.entries.length > 1 && <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>چند مدخل با نوشتار نزدیک وجود دارد؛ عنوان اصلی هر مدخل برای تشخیص معنای مورد نظر حفظ شده است.</p>}
            {state.data.entries.map(entry => <div key={entry.word}>
              {state.data!.entries.length > 1 && <h4 className="font-bold mt-2">مدخل «{entry.word}»</h4>}
              {entry.provenance && <p className="text-xs mt-2" style={{ color: 'var(--ink-soft)' }}>
                ترجمهٔ خلاصه با کمک هوش مصنوعی{' '}
                <SourceReference text={`التحقیق · جلد ${toFa(entry.provenance.volume)}، صفحهٔ ${toFa(entry.provenance.page)}${entry.provenance.pageEnd > entry.provenance.page ? ` تا ${toFa(entry.provenance.pageEnd)}` : ''}\nمدخل مأخذ: «${entry.provenance.heading}»`} />
              </p>}
              <p className="text-justify mt-2" dir="rtl">{entry.fa.split(/[.\n]/)[0]}.</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs underline">{entry.provenance ? 'شرح فارسی و نمونه‌های قرآنی (ترجمهٔ خلاصه)' : 'متن کامل شرح فارسی و کاربردهای قرآنی'}</summary>
                <TahqiqText text={entry.fa} />
                {entry.examples && <div className="mt-3 text-xs leading-7">
                  <p className="font-bold">نمونهٔ کاربرد در قرآن</p>
                  {entry.examples.map(example => <p key={`${example.s}:${example.a}`}><span className="font-quran tahqiq-example" lang="ar">«{example.text}»</span>{' '}<SourceReference label="نشانی آیه" text={`سورهٔ ${example.surahName}، آیهٔ ${toFa(example.a)}`} /></p>)}
                </div>}
              </details>
              <details className="mt-2"><summary className="cursor-pointer text-xs underline">متن عربی مدخل «{entry.word}»</summary>
                <p lang="ar" className="mt-2 whitespace-pre-wrap text-justify break-words">{entry.ar}</p>
              </details>
            </div>)}
            <div className="mt-3"><SourceReference text={state.data.entries.some(entry => entry.provenance) ? 'منبع: «التحقیق فی کلمات القرآن الکریم»، حسن مصطفوی؛ متن عربی از مجموعهٔ ۱۴ جلدی ارسالی. این شرح، ترجمه و تلخیص تازه است.' : 'منبع: خلاصهٔ «التحقیق فی کلمات القرآن الکریم»، حسن مصطفوی؛ ترجمهٔ صادق عباسی و مجموعهٔ مدارس دانشجویی قرآن و عترت دانشگاه تهران، طبق معرفی اپ.'} /></div>
          </>}
  </section>
}
