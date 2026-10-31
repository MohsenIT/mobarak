'use client'
import {translationDirection,translationLanguage} from '@/lib/translations'
import {t,uiDirection} from '@/lib/i18n'
import {BISMILLAH} from '@/lib/branding'

import { useState } from 'react'
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Content as DialogContentPrimitive } from '@radix-ui/react-dialog'
import { Copy, Link, Share2, X } from 'lucide-react'
import type { SurahData, Verse, Translator, Translations } from '@/lib/quran'
import { formatVerseCopy } from '@/lib/verse-copy'
import { versePath } from '@/lib/verse-link'
import { toFa, loadTrans } from '@/lib/quran'

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return } catch { /* Older browsers may require the selection fallback. */ }
  }
  const active = document.activeElement as HTMLElement | null
  const field = document.createElement('textarea')
  field.value = text
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  field.setAttribute('readonly', '')
  document.body.append(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  active?.focus({ preventScroll: true })
  if (!copied) throw new Error('copy unavailable')
}

export default function VerseActions({ surah, verse, translator, wholeSurah = false }: { wholeSurah?: boolean; surah: SurahData; verse: Verse; translator: Translator }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([verse.n])
  const [visible, setVisible] = useState<[number, number]>([Math.max(1, verse.n - 1), Math.min(surah.v.length, verse.n + 1)])
  const [withTranslation, setWithTranslation] = useState(false)
  const [bismillah, setBismillah] = useState(false)
  const [translations, setTranslations] = useState<Translations | null>(null)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const chosen = surah.v.filter(v => selected.includes(v.n))
  const reference = t("ui.0d7cba2b23",{p0:(surah.fa),p1:(chosen.length === 1 ? t("ui.1723d54443") : t("ui.d83f4af983")),p2:(chosen.map(v => toFa(v.n)).join('، '))})
  const text = formatVerseCopy(chosen.map(v => ({ surah: surah.n, name: surah.fa, ayah: v.n, text: v.w.map(w => w.t).join(' '), translation: withTranslation ? translations?.[String(v.n)]?.[translator] : undefined })), bismillah ? BISMILLAH : undefined)
  const ready = chosen.length > 0 && (!withTranslation || chosen.every(v => translations?.[String(v.n)]?.[translator]))
  const links = () => wholeSurah ? new URL(`/s/${surah.n}`, process.env.NEXT_PUBLIC_DESKTOP === '1' ? 'https://mobarak.app/' : window.location.origin).href : chosen.map(v => new URL(versePath({ s: surah.n, a: v.n, pos: 1 }), process.env.NEXT_PUBLIC_DESKTOP === '1' ? 'https://quran-vajeh.vercel.app/' : window.location.origin).href).join('\n')
  const copy = async (value: string) => {
    try { await copyText(value); setStatus(t("ui.2d3a29b875")) } catch { setStatus(t("ui.fe0cbd12e3")) }
  }
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: reference, text }); setStatus(t("ui.e47a2e66d2")); return }
      catch (error) { if (error instanceof Error && error.name === 'AbortError') return }
    }
    await copy(text)
  }
  const begin = () => {
    setSelected(wholeSurah ? surah.v.map(v => v.n) : [verse.n]); setVisible(wholeSurah ? [1, Math.min(20, surah.v.length)] : [Math.max(1, verse.n - 1), Math.min(surah.v.length, verse.n + 1)]); setStatus(''); setOpen(true)
    setFailed(false); setTranslations(null)
    loadTrans(surah.n,translator).then(setTranslations).catch(() => setFailed(true))
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <button className="icon-btn sm" aria-label={t(wholeSurah ? "surah.share" : "ui.f23b76eb4e")} title={t(wholeSurah ? "surah.share" : "ui.f23b76eb4e")} onClick={begin}><Share2 size={18} /></button>
    <DialogPortal>
      <DialogOverlay style={{ zIndex: 10000 }} />
      <DialogContentPrimitive dir={uiDirection()} aria-describedby="share-help" className="verse-share-dialog">
        <div className="flex items-center justify-between gap-3">
          <DialogTitle className="font-bold">{t("ui.a0fd1de31c")}</DialogTitle>
          <DialogClose className="icon-btn" aria-label={t("ui.8911c7385c")}><X size={20} /></DialogClose>
        </div>
        <p id="share-help" className="text-sm" style={{ color: 'var(--ink-soft)' }}>{t("ui.cb4ff054ad")}</p>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 min-h-11 choice-row"><input type="checkbox" checked={withTranslation} onChange={e => setWithTranslation(e.target.checked)} />{t("ui.d30162bcea")}</label>
          <details className="relative"><summary className="cursor-pointer p-2">{t("ui.d239a47f24")}</summary><div className="verse-share-options">
            <label className="flex items-center gap-2 min-h-11 choice-row"><input type="checkbox" checked={bismillah} onChange={e => setBismillah(e.target.checked)} />{t("ui.18068d691e")}</label>
            <button className="chip min-h-11 w-full" disabled={!chosen.length} onClick={() => copy(links())}><Link size={16} className="inline mx-1" />{t("ui.3b907474a3")}{' '}{chosen.length > 1 ? t("ui.d83f4af983") : t("ui.b1b168c791")}</button>
          </div></details>
        </div>
        <div className="verse-share-scroll">
          {visible[0] > 1 && <button className="chip min-h-11 w-full" onClick={() => setVisible(([a,b]) => [Math.max(1,a-3),b])}>{t("ui.609ab7679c")}</button>}
          {bismillah && <p className="font-quran text-center text-2xl py-3">{BISMILLAH}</p>}
          {surah.v.filter(v => v.n >= visible[0] && v.n <= visible[1]).map(v => <button key={v.n} aria-pressed={selected.includes(v.n)} className="verse-share-verse" onClick={() => setSelected(old => old.includes(v.n) ? old.filter(n => n !== v.n) : [...old,v.n])}>
            <span className="text-xs flex justify-between mb-2"><span>{surah.fa}{' '}{t("ui.f922b82cb1")}{' '}{toFa(v.n)}</span><span>{selected.includes(v.n) ? t("ui.b87afe7141") : t("ui.e53a7e34a8")}</span></span>
            <span className="font-quran block text-2xl leading-loose">{v.w.map(w => w.t).join(' ')}</span>
            {withTranslation && <span className="block text-sm leading-8 mt-2" dir={translationDirection(translator)} lang={translationLanguage(translator)}>{translations?.[String(v.n)]?.[translator] || (failed ? t("ui.4468be1c43") : t("ui.bcd4159e9d"))}</span>}
          </button>)}
          {visible[1] < surah.v.length && <button className="chip min-h-11 w-full" onClick={() => setVisible(([a,b]) => [a,Math.min(surah.v.length,b+3)])}>{t("ui.36a9d4da70")}</button>}
        </div>
        <div className="verse-share-footer">
          <p role="status" className="text-xs mb-2">{status || (chosen.length ? t("ui.cde1dfe998",{p0:(toFa(chosen.length))}) : t("ui.5951f88986"))}</p>
          <div className="flex gap-2"><button className="chip min-h-11 flex-1" disabled={!ready} onClick={() => copy(text)}><Copy size={17} className="inline mx-1" />{t("ui.5573893bf6")}</button><button className="chip min-h-11 flex-1" style={{ background: 'var(--sage)', color: '#fff' }} disabled={!ready} onClick={share}><Share2 size={17} className="inline mx-1" />{t("ui.f910f3eee6")}</button></div>
        </div>
      </DialogContentPrimitive>
    </DialogPortal>
  </Dialog>
}
