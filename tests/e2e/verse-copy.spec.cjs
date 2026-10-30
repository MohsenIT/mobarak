const {test,expect}=require('@playwright/test');
async function setup(page,context){
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}
for(const mode of ['flow','mushaf'])test(`native copy: ${mode} keeps partial words and appends a verse range`,async({page,context})=>{
 await setup(page,context);
 await page.goto(mode==='flow'?'/s/2':'/p/2',{waitUntil:'domcontentloaded'});
 const selector=mode==='flow'?'[data-reading-scroll] [data-quran-copy-surface]':'[data-mushaf-page="2"] [data-quran-copy-surface]';
 const surface=page.locator(selector).first();await expect(surface.locator('.quran-word').first()).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 await surface.evaluate(surface=>{
 const first=surface.querySelector('[data-ayah="2"][data-pos="2"] .quran-word');
 const last=surface.querySelector('[data-ayah="4"][data-pos="3"] .quran-word');
 const range=document.createRange();range.setStart(first.firstChild,2);range.setEnd(last.firstChild,3);
 const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 });
 await page.keyboard.press('Control+C');
 const copied=await page.evaluate(()=>navigator.clipboard.readText());
 expect(copied).toMatch(/\(بقره، 2-4\)$/);expect(copied).not.toContain('\n');expect(copied).toContain('، ');
 expect(copied).not.toMatch(/^[\p{M}]/u);expect(copied).not.toMatch(/[\u06D6-\u06DC\u06DF\u06E2\u06E3\u06EB\u06ED]/u);
 if(await page.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches)){
  await expect(surface.locator('.quran-native-selection > span').first()).toBeAttached();
  const bands=await surface.locator('.quran-native-selection > span').evaluateAll(items=>items.map(item=>item.getBoundingClientRect().toJSON()));
  expect(bands.length).toBeGreaterThan(1);for(const band of bands){expect(band.width).toBeGreaterThan(0);expect(band.height).toBeGreaterThan(0)}
 }
 await page.evaluate(()=>getSelection().removeAllRanges());await expect(surface.locator('.quran-native-selection')).toHaveCount(0);
});
test('share dialog copies consecutive and separate verses without hidden glyphs',async({page,context})=>{
 await setup(page,context);await page.goto('/s/22',{waitUntil:'domcontentloaded'});
 const words=page.locator('[data-reading-scroll] [data-surah="22"][data-ayah="1"] .quran-word');await expect(words.first()).toBeVisible();await words.first().click();
 await page.getByRole('button',{name:'کپی و اشتراک آیات',exact:true}).click();
 const dialog=page.locator('.verse-share-dialog');await expect(dialog).toBeVisible();
 await dialog.locator('.verse-share-verse').nth(1).click();
 await dialog.getByRole('button',{name:'کپی',exact:true}).click();
 let copied=await page.evaluate(()=>navigator.clipboard.readText());
 expect(copied).toMatch(/\(حج، 1-2\)$/);expect(copied).not.toContain('\n');expect(copied).not.toMatch(/[\u06D6-\u06DC\u06DF\u06E2\u06E3\u06EB\u06ED]/u);
 await dialog.getByRole('button',{name:'نمایش آیات بعد',exact:true}).click();
 await dialog.locator('.verse-share-verse').nth(1).click();await dialog.locator('.verse-share-verse').nth(2).click();
 await dialog.getByRole('button',{name:'کپی',exact:true}).click();
 copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain('(حج، 1)، ');expect(copied).toMatch(/\(حج، 3\)$/);expect(copied).not.toContain('\n');
});
