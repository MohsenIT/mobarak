import {expect,test} from 'bun:test'
import {sujudKind} from './sujud'
test('marks obligatory and recommended recitation prostrations',()=>{
 expect(sujudKind(32,15)).toBe('obligatory');expect(sujudKind(96,19)).toBe('obligatory');expect(sujudKind(7,206)).toBe('recommended');expect(sujudKind(1,1)).toBeNull()
})
