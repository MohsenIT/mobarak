const {test,expect}=require('@playwright/test');
// Regression coverage for two React defects that were fixed together, because
// both were the same mistake seen from two sides: a ref read or written while
// rendering.
//
// 1. OccurrencePicker remembered its list scroll offset in a ref and *reset*
//    that ref during render when the group changed. A ref mutated in render can
//    be seen by a render that React throws away, so the memory could belong to
//    whichever group rendered last rather than the one on screen. The memory is
//    now dropped in an effect. What a reader can see is unchanged and pinned
//    here: scrolling the list and reopening it on the same group restores the
//    offset, while a different group starts at the top.
//
// 2. page.tsx derived SurahPull's `arriveAtEnd` from a ref during render. That
//    ref is written when a pull lands, so the value the render read could be
//    stale. It is state now. What a reader sees is unchanged and pinned here:
//    pulling to the previous surah lands at the *end* of it, pulling to the
//    next lands at its start.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}

/** The saved scroll length of a scroller, to tell "at the top" from "at the end". */
const scrollState = (scroller) => scroller.evaluate(el => ({
 top: Math.round(el.scrollTop),
 scrollable: Math.round(el.scrollHeight - el.clientHeight),
}));

test('the occurrence picker keeps its list position for the same group and starts a different one at the top', async ({page})=>{
 await setup(page);
 await page.setViewportSize({width:1280,height:900});
 // Surah 2 ayah 3: word 1 is a frequent word, so its list is scrollable and a
 // neighbouring word gives a genuinely different group.
 await page.goto('/s/2/a/3',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});

 const pickWord = async pos => {
  const word=page.locator(`[data-reading-scroll] [data-surah="2"][data-ayah="3"][data-pos="${pos}"] [data-word-part="stem"]`);
  await expect(word).toBeAttached({timeout:20000});
  await word.scrollIntoViewIfNeeded();
  await word.click();
  await expect(page.locator('.root-panel')).toBeVisible({timeout:20000});
  const trigger=page.locator('.analysis-position-button');
  await expect(trigger).toBeEnabled({timeout:20000});
  return trigger;
 };
 const closePicker = async () => {
  await page.locator('[data-analysis-picker] .occurrence-picker-close').click();
  await expect(page.locator('[data-analysis-picker]')).toHaveCount(0);
 };
 const scrollTop = () => page.locator('[data-analysis-picker] .occurrence-picker-list').evaluate(el=>Math.round(el.scrollTop));

 const trigger=await pickWord(1);
 await trigger.click();
 const list=page.locator('[data-analysis-picker] .occurrence-picker-list');
 await expect(page.locator('[data-analysis-picker]')).toBeVisible();
 // The offset is recorded by the list's own scroll handler, so really scroll.
 const scrolled=await list.evaluate(el=>{
  el.scrollTop=Math.round((el.scrollHeight-el.clientHeight)*0.6);
  el.dispatchEvent(new Event('scroll',{bubbles:true}));
  return Math.round(el.scrollTop);
 });
 expect(scrolled).toBeGreaterThan(0);

 // Reopening the same group restores that offset rather than the top.
 await closePicker();
 await trigger.click();
 await expect(page.locator('[data-analysis-picker]')).toBeVisible();
 await expect.poll(scrollTop).toBe(scrolled);

 // A different group cannot inherit it: its list starts at the top.
 await closePicker();
 const other=await pickWord(2);
 await other.click();
 await expect(page.locator('[data-analysis-picker]')).toBeVisible();
 await expect.poll(scrollTop).toBe(0);
});

for (const [direction,landing] of [['previous','end'],['next','start']]) {
 test(`pulling to the ${direction} surah lands at its ${landing}`, async ({page})=>{
  await setup(page);
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/s/20',{waitUntil:'domcontentloaded'});
  const scroller=page.locator('[data-reading-scroll]');
  await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached({timeout:20000});
  await page.evaluate(() => document.fonts.ready);

  const sign = direction==='previous' ? -1 : 1;
  // Keeping the analysis sidebar open must not block reader-edge navigation.
  await scroller.locator('[data-surah="20"] .quran-word').first().click();
  await expect(page.locator('.root-panel')).toBeVisible();
  const target = direction==='previous' ? 19 : 21;
  // Wheel gestures are the deterministic way to pull: the same state
  // (`pullArrival`) drives touch and wheel landings.
  await scroller.evaluate((el,sign)=>{ el.scrollTop = sign>0 ? el.scrollHeight : 0 }, sign);
  const box=await scroller.boundingBox();
  await page.mouse.move(box.x+box.width/2, box.y+box.height/2);
  await page.mouse.wheel(0, sign*120);
  await page.waitForTimeout(350);
  for (let i=0;i<4;i++) await page.mouse.wheel(0, sign*120);

  // The reader is now in the neighbouring surah...
  await expect(scroller.locator(`[data-surah="${target}"]`).first()).toBeAttached({timeout:20000});
  await expect(scroller.locator('[data-surah="20"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // ...at the end of it when we pulled backwards, at its start when forwards.
  const state=await scrollState(scroller);
  expect(state.scrollable).toBeGreaterThan(0);
  if (landing==='end') expect(state.top).toBeGreaterThan(state.scrollable*0.9);
  else expect(state.top).toBeLessThan(4);
 });
}
