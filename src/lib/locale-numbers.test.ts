import {test,expect} from 'bun:test'
import {formatDigits,normalizeDigits} from './locale-numbers'
test('UI numbers use explicit native digits and can be parsed back without changing addresses',()=>{
 expect(formatDigits('20 / 135','ar')).toBe('٢٠ / ١٣٥')
 expect(formatDigits('٢٠ / 135','fa')).toBe('۲۰ / ۱۳۵')
 expect(formatDigits('۲۰ / ١٣٥','en')).toBe('20 / 135')
 expect(formatDigits('20','bn')).toBe('২০')
 expect(formatDigits('20','hi')).toBe('२०')
 expect(normalizeDigits('۲۰:٧२')).toBe('20:72')
})
