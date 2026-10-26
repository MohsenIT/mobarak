import {test,expect} from 'bun:test'
import {insertDictation,speechLanguage} from './dictation'
test('dictation inserts at selection without replacing unrelated text',()=>{
 expect(insertDictation('before old after',7,10,'new')).toEqual({value:'before new after',caret:10})
 expect(insertDictation('hello',5,5,'world')).toEqual({value:'hello world',caret:11})
 expect(insertDictation('abc XYZ',4,4,'long speech',10).value).toBe('abc lo XYZ')
 expect(insertDictation('12345',5,5,'word',5).value).toBe('12345')
})

test('speech uses a full locale and respects matching device region',()=>{
 expect(speechLanguage('fa', ['en-US'])).toBe('fa-IR')
 expect(speechLanguage('en', ['en-GB'])).toBe('en-GB')
 expect(speechLanguage('ar', [])).toBe('ar-EG')
})
