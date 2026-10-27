import {expect,test} from 'bun:test'
import {readingTargetDelta,readingVerseDelta} from './reading-visibility'
test('fully exposed selections do not move, including at the viewport edges',()=>{
 for(const rect of [{top:100,bottom:150},{top:280,bottom:320},{top:450,bottom:500}])expect(readingTargetDelta(rect,{top:100,bottom:500})).toBe(0)
})
test('hidden and partially obscured selections align at the top with a reading gap',()=>{
 for(const rect of [{top:30,bottom:80},{top:90,bottom:130},{top:490,bottom:530},{top:610,bottom:650}]){
  const delta=readingTargetDelta(rect,{top:100,bottom:500})
  expect(rect.top-delta).toBe(112)
 }
})
test('a bottom sheet and top bar define the exposed reading area, rather than the whole screen',()=>{
 expect(readingTargetDelta({top:430,bottom:470},{top:70,bottom:420})).toBe(348)
 expect(readingTargetDelta({top:75,bottom:115},{top:70,bottom:420})).toBe(0)
 expect(readingTargetDelta({top:20,bottom:60},{top:70,bottom:420})).toBe(-62)
 expect(readingTargetDelta({top:100,bottom:130},{top:500,bottom:400})).toBe(0)
})

test('a verse with its first word visible still moves when its end is covered',()=>{
 const rect={top:160,bottom:560},visible={top:100,bottom:500}
 const delta=readingVerseDelta(rect,visible)
 expect(delta).toBe(60);expect(rect.top-delta).toBeGreaterThanOrEqual(visible.top);expect(rect.bottom-delta).toBeLessThanOrEqual(visible.bottom)
})
test('partly hidden verses move only to the nearest clear edge; fully visible verses stay still',()=>{
 const visible={top:100,bottom:500}
 expect(readingVerseDelta({top:110,bottom:510},visible)).toBe(10)
 expect(readingVerseDelta({top:90,bottom:480},visible)).toBe(-15)
 expect(readingVerseDelta({top:110,bottom:490},visible)).toBe(0)
 expect(readingVerseDelta({top:610,bottom:710},visible)).toBe(498)
})
test('a verse that cannot fit starts at the exposed top without changing font size',()=>{
 expect(readingVerseDelta({top:420,bottom:950},{top:100,bottom:500})).toBe(308)
})
