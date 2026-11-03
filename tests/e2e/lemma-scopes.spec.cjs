const {test,expect}=require('@playwright/test');
async function open(page,s=20,a=34,pos=1){
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 await page.goto(`/s/${s}/a/${a}`,{waitUntil:'domcontentloaded'});
 const word=page.locator(`[data-reading-scroll] [data-surah="${s}"][data-ayah="${a}"][data-pos="${pos}"] [data-word-part="stem"]`);
 await expect(word).toBeAttached();await word.scrollIntoViewIfNeeded();await word.click();await page.locator('#analysis-tab-word').click();
 return page.locator('.analysis-position-button');
}
test('shared occurrence picker preserves the selected lemma and its scope contract',async({page})=>{
 const trigger=await open(page);
 await expect(trigger.locator('.analysis-position-title')).toHaveText('ذَكَرَ');
 await expect(page.locator('[data-selection-preview]')).toContainText('نَذْكُرَكَ');
 await trigger.click();const picker=page.locator('[data-analysis-picker]');await expect(picker).toBeVisible();
 await expect(picker.locator('.occurrence-search-scopes[data-picker-operation="exact"]')).toBeVisible();
 await expect(picker.locator('[data-occurrence-scope]')).toHaveCount(2);
 await expect(picker.locator('[data-occurrence-scope="surah"]')).toBeVisible();
 await expect(picker.locator('[data-occurrence-scope="quran"]')).toBeVisible();
 const box=await picker.boundingBox();
 for(const chip of await picker.locator('[data-occurrence-scope]').all()){
  const rect=await chip.boundingBox();expect(rect.x).toBeGreaterThanOrEqual(box.x);expect(rect.x+rect.width).toBeLessThanOrEqual(box.x+box.width+1);
 }
 const highlight=picker.locator('[data-highlight-state="selected"]').first();await expect(highlight).toHaveCSS('text-decoration-line','none');await expect(highlight).toHaveCSS('box-shadow','none');
 await expect(trigger).toHaveCSS('outline-style','none');
});
for(const [scope,s] of [['surah','20'],['quran',null]])test(`${scope} scope preserves the lemma criterion and searches the requested surahs`,async({page})=>{
 const trigger=await open(page);await trigger.click();await page.locator(`[data-occurrence-scope="${scope}"]`).click();
 await expect(page.locator('[data-search-page]')).toBeVisible();
 await expect.poll(()=>{const p=new URL(page.url()).searchParams;return {s:p.get('s'),o:p.get('o'),mode:p.get('m')}}).toEqual({s,o:'w.20.34.1',mode:'l'});
});
