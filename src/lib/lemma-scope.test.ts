import {expect,test} from 'bun:test'
import {wordLemma} from './lemma-display'
import {occurrenceScopeSurahs} from './occurrence-scope'
import taha from '../../public/data/surah/20.json'
test('lemma labels use the canonical corpus form instead of attached pronouns or inflection',()=>{
 expect(wordLemma(taha.v[33].w[0])).toBe('ذَكَرَ')
 expect(wordLemma(taha.v[30].w[2])).toBe('أَزْر')
 expect(wordLemma({...taha.v[33].w[0],wa:true},'prefix')).toBe('وَ')
 expect(wordLemma({t:'بِهِ',l:1})).toBeNull()
})
test('scope changes target only the previous, current, next or all surahs without wrapping',()=>{
 expect(occurrenceScopeSurahs('previous',20)).toEqual([19])
 expect(occurrenceScopeSurahs('surah',20)).toEqual([20])
 expect(occurrenceScopeSurahs('next',20)).toEqual([21])
 expect(occurrenceScopeSurahs('quran',20)).toEqual([])
 expect(occurrenceScopeSurahs('previous',1)).toBeNull()
 expect(occurrenceScopeSurahs('next',114)).toBeNull()
 expect(occurrenceScopeSurahs('surah',0)).toBeNull()
})
