import {expect,test} from 'bun:test'
import {selectedContentText,selectionPreview} from './selection-presentation'
import type {AnalysisSelection} from './analysis'
import data from '../../public/data/surah/90.json'
import type {SurahData} from './quran'
const surah=data as SurahData
const selection:AnalysisSelection={tab:'word',s:90,a:19,pos:1,root:null,text:'واژه'}
test('short words stay complete while long selections keep their beginning and adapt at word boundaries',()=>{
 expect(selectionPreview('واژه',()=>false)).toBe('واژه')
 expect(selectionPreview('یک دو سه چهار')).toBe('یک دو سه…')
 expect(selectionPreview('یک دو سه چهار',text=>text.length<=7)).toBe('یک دو…')
 expect(selectionPreview('یک دو سه چهار',()=>false)).toBe('یک…')
 expect(selectionPreview('یک دو')).toBe('یک دو')
})
test('surah header starts at the surah beginning even when the tapped word is near its end',()=>{
 const text=selectedContentText({...selection,tab:'surah'},surah)
 expect(text.startsWith(surah.v[0].w[0].t)).toBe(true)
 expect(text).toContain(surah.v.at(-1)!.w.at(-1)!.t)
 expect(selectedContentText(selection,surah)).toBe('واژه')
 const verse=selectedContentText({...selection,tab:'verse',a:1},surah)
 expect(verse.startsWith(surah.v[0].w[0].t)).toBe(true)
 expect(verse).not.toContain(surah.v.at(-1)!.w.at(-1)!.t)
 const context=selectedContentText({...selection,tab:'context',from:2,to:3},surah)
 expect(context.startsWith('وَ أَنتَ')).toBe(true)
 expect(selectedContentText({...selection,s:2,tab:'surah'},surah)).toBe('واژه')
})
