const {test,expect}=require('@playwright/test');
// Characterization coverage for the root-dictionary panels (tahqiq, maqayis,
// ishtiqaqi). Their disclosure state used to be reset by a setState at the top
// of the loading effect; it is now scoped to the root it was opened for. These
// tests pin the user-visible behavior that change must not alter: a panel opens
// and closes on toggle, and switching roots closes it rather than carrying the
// open state across.
//
// al-Fatiha is used because its roots (سمو، اله، رحم، حمد...) are present in
// all three dictionaries, so every panel has content to disclose.

async function setup(page){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
  localStorage.setItem('mushaf.showTrans','false');
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}
/** Selects a reader word by its verse/position, the way the selection spec does. */
async function pickWord(page,surah,ayah,pos){
 const word=page.locator(`[data-reading-scroll] [data-surah="${surah}"][data-ayah="${ayah}"][data-pos="${pos}"] .quran-word`);
 await expect(word).toBeAttached({timeout:20000});
 await word.scrollIntoViewIfNeeded();
 await word.click();
}
/** The dictionary heading for a book, inside the open root analysis panel. */
const heading=(page,book)=>page.locator(`[data-root-book-heading="${book}"]`).first();

test('an Arabic-only etymological entry does not render an empty explanation card',async({page})=>{
 await setup(page);await page.goto('/s/1/a/6',{waitUntil:'domcontentloaded'});
 await pickWord(page,1,6,1);await page.locator('#analysis-tab-root').click();
 await expect(heading(page,'tahqiq')).toBeVisible();
 await expect(heading(page,'maqayis')).toBeVisible();
 await expect(heading(page,'ishtiqaqi')).toHaveCount(0);
 await pickWord(page,1,1,1);await page.locator('#analysis-tab-root').click();
 await expect(heading(page,'ishtiqaqi')).toBeVisible();
});

test('the dictionary panel opens on toggle and closes on a second toggle',async({page})=>{
 await setup(page);
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await pickWord(page,1,1,1);
 await page.locator('#analysis-tab-root').click();

 const ishtiqaqi=heading(page,'ishtiqaqi');
 await expect(ishtiqaqi).toBeVisible({timeout:20000});
 const toggle=ishtiqaqi.locator('button').first();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','true');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-expanded','false');
});

test('switching to another root closes the previously opened dictionary',async({page})=>{
 await setup(page);
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await pickWord(page,1,1,1);
 await page.locator('#analysis-tab-root').click();

 const ishtiqaqi=heading(page,'ishtiqaqi');
 await expect(ishtiqaqi).toBeVisible({timeout:20000});
 await ishtiqaqi.locator('button').first().click();
 await expect(heading(page,'ishtiqaqi').locator('button').first()).toHaveAttribute('aria-expanded','true');

 // Select a different word in a different verse, which has a different root:
 // the dictionary must come back closed, not still expanded from the old root.
 await pickWord(page,1,1,2);
 await page.locator('#analysis-tab-root').click();
 await expect(heading(page,'ishtiqaqi')).toBeVisible({timeout:20000});
 await expect(heading(page,'ishtiqaqi').locator('button').first()).toHaveAttribute('aria-expanded','false');
});
