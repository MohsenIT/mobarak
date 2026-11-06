import { test, expect } from 'bun:test'
import { anchorOptions } from './study-anchors'
import type { SurahData } from './quran'
import type { ContextRange } from './contexts'
import type { PersonalContext } from './study'

// A tiny stand-in for SurahData: anchorOptions only reads verses and words.
const surah = {
  n: 20,
  vc: 2,
  v: [
    { n: 1, w: [{ t: 'طه', r: 'طوه', lemma: 'طه', form: 'N' }, { t: 'ما', r: null, lemma: 'ما', form: 'P' }] },
    { n: 2, w: [{ t: 'أنزلنا', r: 'نزل', lemma: 'أنزل', form: 'V' }, { t: 'طه', r: 'طوه', lemma: 'طه', form: 'N' }] },
  ],
} as unknown as SurahData

const source: ContextRange[] = [
  { id: 1, from: 1, to: 8, sourcePage: 313, title: '' },
  { id: 2, from: 9, to: 23, sourcePage: 314, title: '' },
]
const personal: PersonalContext[] = [
  { id: 'p20:1', from: 1, to: 8, title: '', body: '' },
  { id: 'p20:2', from: 9, to: 23, title: 'My section', body: '' },
]

test('verse anchors cover every verse of the surah', () => {
  const options = anchorOptions('verse', surah, source, personal)
  expect(options.map(option => option.key)).toEqual(['1', '2'])
})

test('context anchors list source ranges first, then the reader own contexts', () => {
  const options = anchorOptions('context', surah, source, personal)
  expect(options.map(option => option.key)).toEqual(['s20:1', 's20:2', 'p20:1', 'p20:2'])
  // A titled personal context shows its title; an untitled one falls back to a
  // generated "context n" label.
  expect(options[3].label).toContain('My section')
  expect(options[2].label).not.toContain('My section')
})

test('root anchors are de-duplicated and sorted by label', () => {
  const options = anchorOptions('root', surah, source, personal)
  expect(options.map(option => option.key)).toEqual(['طوه', 'نزل'])
  expect(options.every(option => option.label === option.key)).toBe(true)
})

test('words without a root are omitted from root anchors, not blank entries', () => {
  expect(anchorOptions('root', surah, source, personal).some(option => option.key === '')).toBe(false)
})

test('lemma and form anchors key on the derived value, not the surface word', () => {
  const lemmas = anchorOptions('lemma', surah, source, personal)
  expect(lemmas.map(option => option.key)).toContain('أنزل')
  const forms = anchorOptions('form', surah, source, personal)
  expect(forms.map(option => option.key)).toContain('نزل:V')
})

test('a null surah yields no anchors, so the notebook can render before load', () => {
  expect(anchorOptions('verse', null, source, personal)).toEqual([])
  expect(anchorOptions('root', null, source, personal)).toEqual([])
})
