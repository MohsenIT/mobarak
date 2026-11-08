const {test,expect}=require('@playwright/test');
// Characterization coverage for the *context* comparison path — the one the
// extracted src/components/quran/useComparison.ts now owns end to end.
//
// root-comparison.spec.cjs already pins the sheet-driven comparison; this file
// pins what the sheet never touches: a range picked from the analysis panel's
// context tab, which keeps following the selected context while the panel is
// open, survives the sheet being opened and closed, and is cleared by the
// reader band's dismiss button. All of that used to be four effects inside
// page.tsx.
//
// Surah 55 (Ar-Rahman) has three documented contexts (1-13, 14-36, 37-78), so
// the "follows the selection" test has a second range to move to.

async function setup(page){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}
async function readerReady(page){
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
}
/**
 * Select a word, switch the analysis panel to the context tab, compare it.
 * Returns the panel so the caller can keep using it.
 */
async function compareContextOfFirstWord(page){
 const word=page.locator('.surah-pull-content .quran-word').first();
 await word.scrollIntoViewIfNeeded();
 await word.click();
 const panel=page.locator('.root-panel');
 await expect(panel).toBeVisible({timeout:20000});
 await panel.getByRole('tab',{name:'سیاق',exact:true}).click();
 const compare=panel.getByRole('button',{name:'مقایسهٔ ریشه‌ای این سیاق با باقی سوره'});
 await expect(compare).toBeVisible({timeout:20000});
 await compare.click();
 return panel;
}
/**
 * The reader-side band. `comparison-range-band` is also the class FlowPage puts
 * on every verse wrapper inside the compared range, so anchor on the band's own
 * label instead.
 */
const readerBand = page => page.locator('span.comparison-range-band', {hasText:'درون بازه'});

test('a context comparison shows its range band and highlights shared roots',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await compareContextOfFirstWord(page);

 // The reader-side band names the range and the interaction hint.
 await expect(readerBand(page)).toBeVisible({timeout:20000});
 await expect(readerBand(page)).toContainText('درون بازه');
 await expect(page.locator('.quran-word.comparison-shared').first()).toBeAttached({timeout:20000});
 // Getting here never opened the range sheet.
 await expect(page.locator('.surah-index-drawer')).toHaveCount(0);
});

test('opening the range sheet from the band keeps the context comparison alive',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await compareContextOfFirstWord(page);
 await expect(readerBand(page)).toBeVisible({timeout:20000});

 // "بازگشت به مقایسه" opens the sheet on this comparison: the range is pre-filled.
 await page.getByRole('button',{name:'بازگشت به مقایسه'}).click();
 const sheet=page.locator('.surah-index-drawer');
 await expect(sheet).toBeVisible({timeout:20000});
 await expect(sheet.getByLabel('از آیه')).not.toHaveValue('');
 await expect(sheet.getByLabel('تا آیه')).not.toHaveValue('');

 // Closing the sheet restores the reader band: the comparison was not dropped.
 await sheet.getByRole('button',{name:'بستن مقایسه'}).click();
 await expect(page.locator('.surah-index-drawer')).toHaveCount(0);
 await expect(readerBand(page)).toBeVisible({timeout:20000});
 await expect(page.locator('.quran-word.comparison-shared').first()).toBeAttached({timeout:20000});
});

test('dismissing the band clears the context comparison and its highlights',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await compareContextOfFirstWord(page);
 await expect(page.locator('.quran-word.comparison-shared').first()).toBeAttached({timeout:20000});

 await page.getByRole('button',{name:'پاک کردن هایلایت مقایسه'}).click();
 await expect(readerBand(page)).toHaveCount(0);
 await expect(page.locator('.quran-word.comparison-shared')).toHaveCount(0);
 await expect(page.locator('.quran-word.comparison-muted')).toHaveCount(0);

 // The comparison and the selection it was built from go away together.
 await expect(page.locator('.root-panel')).toHaveCount(0);
});

test('the context comparison follows the context selected in the panel',async({page})=>{
 await setup(page);
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 const panel=await compareContextOfFirstWord(page);
 await expect(readerBand(page)).toContainText('۱–۱۳',{timeout:20000});

 // Pick the surah's second context from the panel's range list. The band must
 // follow it, because a context comparison tracks the selected context.
 const ranges=panel.locator('section[aria-label="فهرست سیاق‌های این سوره"] button.chip');
 await expect(ranges).toHaveCount(3,{timeout:20000});
 await ranges.nth(1).click();
 await expect(readerBand(page)).toContainText('۱۴–۳۶',{timeout:20000});
});
