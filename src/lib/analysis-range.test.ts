import {expect,test} from 'bun:test'
import {analysisRangeContains,type AnalysisSelection} from './analysis'
const base:AnalysisSelection={tab:'surah',s:90,a:1,pos:4,root:'بلد',text:'البلد'}
test('range selection is shared by text, gaps and verse markers without bleeding into adjacent surahs',()=>{
 expect(analysisRangeContains(base,90,20)).toBe(true)
 expect(analysisRangeContains(base,89,20)).toBe(false)
 expect(analysisRangeContains({...base,tab:'verse'},90,2)).toBe(false)
 expect(analysisRangeContains({...base,tab:'verse'},90,1)).toBe(true)
 for(const a of [3,4,5])expect(analysisRangeContains({...base,tab:'context',from:3,to:5},90,a)).toBe(true)
 for(const a of [2,6])expect(analysisRangeContains({...base,tab:'context',from:3,to:5},90,a)).toBe(false)
 expect(analysisRangeContains({...base,tab:'context'},90,1)).toBe(false)
 expect(analysisRangeContains({...base,tab:'root'},90,1)).toBe(false)
 expect(analysisRangeContains(null,90,1)).toBe(false)
})
