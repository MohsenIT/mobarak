const {test,expect}=require('@playwright/test');
async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true');
  localStorage.setItem('mushaf.appearance.v1',JSON.stringify({paper:{highlight:'#ccbbaa',selected:'#447799'}}));
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}
async function colorOnly(locator,color){
 await expect(locator).toHaveCSS('background-color',color);await expect(locator).toHaveCSS('box-shadow','none');await expect(locator).toHaveCSS('text-decoration-line','none');await expect(locator).toHaveCSS('border-top-width','0px');await expect(locator).toHaveCSS('outline-style','none');
}
test('selection header shows a complete word and the beginning of long selections after retargeting and resizing',async({page})=>{
 await setup(page);await page.goto('/s/90/a/20',{waitUntil:'domcontentloaded'});
 const word=page.locator('[data-reading-scroll] [data-surah="90"][data-ayah="20"][data-pos="3"] .quran-word');
 await expect(word).toBeAttached();await word.scrollIntoViewIfNeeded();await word.click();
 await page.locator('#analysis-tab-word').click();
 const header=page.locator('[data-selection-preview]');await expect(header).toHaveText(await word.innerText());await expect(header).toHaveAttribute('data-truncated','false');
 await page.locator('#analysis-tab-surah').click();
 await expect(header).toContainText('لَا');await expect(header).toHaveAttribute('data-truncated','true');await expect(header).toContainText('…');
 const start=await header.innerText();expect(start.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
 await page.setViewportSize({width:320,height:800});
 await expect.poll(()=>header.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 const bounds=await header.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(320);
});
test('quick and advanced search use ordinary and selected colors without borders or underlines',async({page})=>{
 await setup(page);await page.goto('/s/2',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'جست‌وجو در قرآن',exact:true}).click();
 await page.getByRole('searchbox',{name:'جست‌وجو در همین سوره',exact:true}).fill('الله');
 await colorOnly(page.locator('[data-reading-scroll] [data-quick-search-match="active"]').first(),'rgb(68, 119, 153)');
 await colorOnly(page.locator('[data-reading-scroll] [data-quick-search-match="match"]').first(),'rgb(204, 187, 170)');
 await page.goto('/q?q=الله&h=0',{waitUntil:'domcontentloaded'});
 await colorOnly(page.locator('.search-result-card [data-search-match]').first(),'rgb(204, 187, 170)');
 await page.locator('.search-result-open').first().click();
 const chosen=page.locator('[data-reading-scroll] .quran-word.flash').first();await colorOnly(chosen,'rgb(68, 119, 153)');
 const text=await chosen.innerText();await chosen.click();await page.locator('#analysis-tab-word').click();
 await expect(page.locator('[data-selection-preview]')).toHaveText(text);
});
