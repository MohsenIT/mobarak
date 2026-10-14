'use client'

import { useEffect, useState } from 'react'

type Entry = { word: string; ar: string; fa: string }
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
              <p className="text-justify mt-2" dir="rtl">{entry.fa.split(/[.\n]/)[0]}.</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs underline">متن کامل شرح فارسی و کاربردهای قرآنی</summary>
                <p className="mt-2 whitespace-pre-wrap text-justify break-words">{entry.fa}</p>
              </details>
              <details className="mt-2"><summary className="cursor-pointer text-xs underline">متن عربی مدخل «{entry.word}»</summary>
                <p lang="ar" className="mt-2 whitespace-pre-wrap text-justify break-words">{entry.ar}</p>
              </details>
            </div>)}
            <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>منبع: خلاصهٔ «التحقیق فی کلمات القرآن الکریم»، حسن مصطفوی؛ ترجمهٔ صادق عباسی و مجموعهٔ مدارس دانشجویی قرآن و عترت دانشگاه تهران، طبق معرفی اپ.</p>
          </>}
  </section>
}
