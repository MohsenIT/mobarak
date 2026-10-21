import { expect, test } from 'bun:test'
import { searchFormLabels } from './search-form-labels'
import type { QuranSearchResult } from './quran-search'
const sample = (morphology: [string|null,string|null,string|null][]): QuranSearchResult => ({ s:20,a:1,words:morphology.map(()=>''),positions:morphology.map((_,i)=>i+1),parts:{},waw:[],kind:'exact',score:0,morphology })
test('knowledge facets show علم, تعليم and تعلّم with the technical form in the description', () => {
  const labels = searchFormLabels([sample([['علم','Ealima','I'],['علم','Eal~ama','II'],['علم','taEal~ama','V']])])
  expect(labels.get('I')?.label).toBe('عِلْم')
  expect(labels.get('II')?.label).toBe('تعليم')
  expect(labels.get('V')?.label).toBe('تعلّم')
  expect(labels.get('II')?.description).toContain('تفعیل')
})
test('unlisted and weak-root forms use attested lemmas rather than fabricated patterns', () => {
  const labels=searchFormLabels([sample([['رءي',">araY`",'IV']])])
  expect(labels.get('IV')?.label).toBe('أَرَىٰ')
})
test('multi-root searches show more than one family example rather than labeling every result as one root', () => {
  const labels=searchFormLabels([sample([['علم','Eal~ama','II'],['بدل','bad~ala','II']])])
  expect(labels.get('II')?.label).toContain('تعليم')
  expect(labels.get('II')?.label).toContain('تبديل')
})
