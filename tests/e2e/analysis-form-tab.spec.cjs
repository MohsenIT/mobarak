const {test,expect}=require('@playwright/test');
// Characterization coverage for the analysis panel's form-tab fallback.
//
// A 'form' tab restored from the saved analysis view is honored when the
// panel opens, but when the surah data proves the selected word has no form,
// the panel redirects to the word tab. RootPanel implements this without an
// effect, so this pins the redirect through the real UI.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
  localStorage.setItem('quran.analysis-view.v1',JSON.stringify({tab:'form'}));
 });
 // Answer the update check with the running build, so the update banner (which
 // would intercept clicks) never appears.
 const real=await (await page.request.get('/api/version')).json().catch(()=>null);
 await page.route('**/api/version',r=>r.fulfill({json:{version:real?.version??'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}

test('a restored form tab falls back to the word tab for a word without form data',async({page})=>{
 await setup(page);
 await page.goto('/s/90/a/1',{waitUntil:'domcontentloaded'});
 // Word 4 of ayah 1 (بلد) has a root but no form entry in the corpus, so the
 // form tab cannot be shown for it.
 const word=page.locator('[data-reading-scroll] [data-surah="90"][data-ayah="1"][data-pos="4"] .quran-word');
 await expect(word).toBeVisible({timeout:20000});
 await word.scrollIntoViewIfNeeded();
 await word.click();
 const panel=page.locator('.root-panel');
 await expect(panel).toBeVisible();

 // The saved 'form' tab is accepted at open (the form tab has no button in
 // the strip, so nothing would be active), then redirected once the load
 // proves there is no form for this word.
 await expect(page.locator('#analysis-tab-word')).toHaveAttribute('aria-selected','true',{timeout:20000});
});
