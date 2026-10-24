import { expect, test } from 'bun:test'
import rawMeta from '../../public/data/meta.json'
import type { Meta } from './quran'
import { searchSurahs, resolveDestination } from './navigation'
const meta: Meta = { ...rawMeta, juz: Object.fromEntries(Object.entries(rawMeta.juz).map(([key, [s, a]]) => [key, [s, a] as [number, number]])) }

test('surah search accepts Arabic names, diacritics and both digit sets', () => {
  for (const query of ['بقره', 'الْبَقَرَة', '۲', '٢']) expect(searchSurahs(meta, query).some(s => s.n === 2)).toBe(true)
  expect(resolveDestination(meta, 'surah', 'طه', 1)).toEqual({ kind: 'surah', s: 20 })
  expect(resolveDestination(meta, 'surah', 'نام ناموجود', 1)).toBeNull()
})
test('page and juz destinations are bounded and use the actual juz boundary', () => {
  expect(resolveDestination(meta, 'page', '۶۰۴', 1)).toEqual({ kind: 'page', p: 604 })
  for (const value of ['0', '605', '1.5']) expect(resolveDestination(meta, 'page', value, 1)).toBeNull()
  const [s, a] = meta.juz['2']
  expect(resolveDestination(meta, 'juz', '٢', 1)).toEqual({ kind: 'verse', s, a })
  expect(resolveDestination(meta, 'juz', '31', 1)).toBeNull()
})
test('verse jumps support current surah, named references and explicit prefixes', () => {
  expect(resolveDestination(meta, 'verse', '۱۱', 20)).toEqual({ kind: 'verse', s: 20, a: 11 })
  expect(resolveDestination(meta, 'verse', 'بقره:۲۵۵', 20)).toEqual({ kind: 'verse', s: 2, a: 255 })
  expect(resolveDestination(meta, 'surah', 'آیه طه:۱۱', 1)).toEqual({ kind: 'verse', s: 20, a: 11 })
  expect(resolveDestination(meta, 'surah', 'صفحه ۵۰', 1)).toEqual({ kind: 'page', p: 50 })
  for (const value of ['طه:136', 'طه:0', '20:1:2', '']) expect(resolveDestination(meta, 'verse', value, 20)).toBeNull()
})

test('one navigation field suggests named surahs, explicit references and numeric alternatives', async () => {
  const { destinationSuggestions } = await import('./navigation')
  expect(destinationSuggestions(meta, 'طه', 2)[0].destination).toEqual({ kind: 'surah', s: 20 })
  expect(destinationSuggestions(meta, 'ق', 2)[0].destination).toEqual({ kind: 'surah', s: 50 })
  expect(destinationSuggestions(meta, '۲۰:۱۴', 2)[0].destination).toEqual({ kind: 'verse', s: 20, a: 14 })
  expect(destinationSuggestions(meta, 'صفحه ۵۰', 20)[0].destination).toEqual({ kind: 'page', p: 50 })
  const alternatives = destinationSuggestions(meta, '۲۰', 20)
  expect(alternatives.map(item => item.destination.kind)).toContain('surah')
  expect(alternatives.map(item => item.destination.kind)).toContain('page')
  expect(alternatives.some(item => item.destination.kind === 'verse' && item.destination.s === 20 && item.destination.a === 20)).toBe(true)
  expect(destinationSuggestions(meta, '۹۹۹', 20)).toEqual([])
})

test('common aliases rank before substring matches but retain useful alternatives', async () => {
  const { destinationSuggestions } = await import('./navigation')
  const hamd = searchSurahs(meta, 'حمد')
  expect(hamd[0].n).toBe(1)
  expect(hamd.map(s => s.n)).toContain(47)
  const chips = destinationSuggestions(meta, 'حمد', 20)
  expect(chips[0].destination).toEqual({ kind: 'surah', s: 1 })
  expect(chips.some(chip => chip.destination.kind === 'surah' && chip.destination.s === 47)).toBe(true)
  expect(resolveDestination(meta, 'surah', 'حمد', 20)).toEqual({ kind: 'surah', s: 1 })
})
test('alternate names and opening phrases support Persian/Arabic spelling and verse references', () => {
  for (const [query, s] of [['توحید',112], ['احد',112], ['قُلْ هُوَ اللَّهُ أَحَدٌ',112], ['قتال',47], ['بنی اسرائیل',17], ['براءة',9], ['ملائکه',35], ['مؤمن',40], ['حم سجده',41], ['تبارک',67], ['دهر',76], ['عم یتساءلون',78], ['انشراح',94], ['اقرأ',96], ['لهب',111]] as const) {
    expect(searchSurahs(meta, query)[0]?.n).toBe(s)
    expect(resolveDestination(meta, 'surah', query, 20)).toEqual({ kind:'surah', s })
  }
  expect(resolveDestination(meta, 'verse', 'توحید:۳', 20)).toEqual({ kind:'verse', s:112, a:3 })
  expect(resolveDestination(meta, 'surah', 'سوره حمد', 20)).toEqual({ kind:'surah', s:1 })
})

test('compact commands accept attached or spaced Persian, Arabic and Latin digits', async () => {
  const {destinationSuggestions}=await import('./navigation')
  for(const text of ['ص۶','ص ۶','ص٦','ص6','صفحه۶','صفحه ۶'])expect(destinationSuggestions(meta,text,20)[0]?.destination).toEqual({kind:'page',p:6})
  for(const text of ['س۲۰','س ۲۰','س٢٠','س20','سوره۲۰','سورة٢٠'])expect(destinationSuggestions(meta,text,1)[0]?.destination).toEqual({kind:'surah',s:20})
  for(const text of ['آ۶','ا۶','آیه۶','آية٦'])expect(destinationSuggestions(meta,text,20)[0]?.destination).toEqual({kind:'verse',s:20,a:6})
  for(const text of ['ج۶','ج ۶','جزء۶'])expect(destinationSuggestions(meta,text,20)[0]?.destination).toEqual({kind:'verse',s:meta.juz['6'][0],a:meta.juz['6'][1]})
})
test('context commands use the recorded ranges and keep first and last alefs distinct', async()=>{
  const {destinationSuggestions}=await import('./navigation')
  const first={kind:'context' as const,s:20,index:1,from:1,to:8},last={kind:'context' as const,s:20,index:9,from:127,to:135}
  for(const input of ['ق۶','ق ۶','سیاق۶','سیاق ۶','سياق٦'])expect(destinationSuggestions(meta,input,20)[0]?.destination).toEqual({kind:'context',s:20,index:6,from:80,to:98})
  for(const input of ['ق ا','ق اول','قا'])expect(destinationSuggestions(meta,input,20)[0]?.destination).toEqual(first)
  for(const input of ['ق آ','ق آخر','ق اخر','قآ','ق ا\u0653'])expect(destinationSuggestions(meta,input,20)[0]?.destination).toEqual(last)
  for(const input of ['ق۰','ق۱۰','سیاق ۹۹۹'])expect(destinationSuggestions(meta,input,20)).toEqual([])
  expect(destinationSuggestions(meta,'ق',20)[0]?.destination).toEqual({kind:'surah',s:50})
})
test('explicit cross-surah context/verse references and edge destinations are bounded',()=>{
  for(const input of ['ق۲۰:۶','سیاق طه:۶','س۲۰ ق۶'])expect(resolveDestination(meta,'surah',input,1)).toEqual({kind:'context',s:20,index:6,from:80,to:98})
  expect(resolveDestination(meta,'surah','س۲۰ آ۷۲',1)).toEqual({kind:'verse',s:20,a:72})
  expect(resolveDestination(meta,'surah','ص آ',20)).toEqual({kind:'page',p:604})
  expect(resolveDestination(meta,'surah','س آ',20)).toEqual({kind:'surah',s:114})
  expect(resolveDestination(meta,'surah','آ آ',20)).toEqual({kind:'verse',s:20,a:135})
  expect(resolveDestination(meta,'surah','س۹۹۹',20)).toBeNull()
})
test('search navigation never intercepts ordinary words or standalone surah initials',async()=>{
  const {searchDestinations}=await import('./navigation')
  for(const value of ['علم','ق','س','طه','صالح'])expect(searchDestinations(meta,value,20)).toEqual([])
  expect(searchDestinations(meta,'ق۶',20)[0].destination.kind).toBe('context')
})
