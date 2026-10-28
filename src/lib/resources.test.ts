import {existsSync} from 'node:fs'
import {describe,expect,test} from 'bun:test'
import {RESOURCES,filterResources,getResource} from './resources'
import {RECITERS} from './recitation'
describe('resource catalogue',()=>{
 test('all selectable reciters and translations have unique profiles',()=>{
  expect(new Set(RESOURCES.map(r=>r.id)).size).toBe(RESOURCES.length)
  for(const reciter of RECITERS)expect(getResource(`reciter:${reciter.id}`)?.kind).toBe('recitation')
  for(const t of ['s','f','a','m'])expect(getResource(`translation:${t}`)?.language).toBe('fa')
 })
 test('search combines country nationality style and author without matching a different reciter',()=>{
  const reciters=RESOURCES.filter(r=>r.kind==='recitation')
  expect(filterResources(reciters,{query:'ترتیل ایرانی'}).map(r=>r.id)).toEqual(['reciter:parhizgar'])
  const egyptian=filterResources(reciters,{country:'مصر',style:'murattal'})
  expect(egyptian.map(r=>r.id)).toContain('reciter:minshawi-murattal')
  expect(egyptian.map(r=>r.id)).toContain('reciter:tanzil-husary')
  expect(egyptian.every(r=>r.country==='مصر'&&r.style==='murattal')).toBe(true)
  expect(filterResources(reciters,{style:'mujawwad'})).toHaveLength(0)
 })
 test('language kind title and era remain searchable',()=>{
  expect(filterResources(RESOURCES,{language:'fa',kind:'translation'})).toHaveLength(4)
  expect(filterResources(RESOURCES,{query:'المیزان'}).map(r=>r.id)).toEqual(['translation:s','book:mizan'])
  expect(filterResources(RESOURCES,{query:'قرن چهارم'}).map(r=>r.id)).toEqual(['book:maqayis'])
  expect(filterResources(RESOURCES,{query:'مقاييس'}).some(r=>r.id==='book:maqayis')).toBe(true)
 })
})

test('portraits are bundled and the two original reciters have photographs',()=>{
 for(const id of ['reciter:minshawi-murattal','reciter:parhizgar'])expect(getResource(id)?.image?.src).toStartWith('/images/reciters/')
 for(const resource of RESOURCES)if(resource.image)expect(existsSync('public'+resource.image.src)).toBe(true)
})
