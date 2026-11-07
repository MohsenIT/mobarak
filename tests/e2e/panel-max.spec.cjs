const {test,expect}=require('@playwright/test');
// Characterization coverage for the analysis panel's maximize lifecycle.
//
// The maximized flag is reset when the selection closes — no matter how it
// closes (the panel's own close button, the word toggle, the maximized
// backdrop) — and it deliberately carries over while the panel stays open and
// the selection is merely retargeted (for example through the panel's own
// unit navigation). page.tsx implements this rule without an effect, keyed on
// the selection itself, so these tests pin the observable lifecycle through
// the real UI across all close paths.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 // Answer the update check with the running build, so the update banner (which
 // would intercept clicks) never appears.
 const real=await (await page.request.get('/api/version')).json().catch(()=>null);
 await page.route('**/api/version',r=>r.fulfill({json:{version:real?.version??'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}
const word=(page,pos)=>page.locator('[data-reading-scroll] [data-surah="2"][data-ayah="2"][data-pos="'+pos+'"] .quran-word');

test('maximize survives retargeting but resets once the panel closes',async({page})=>{
 await setup(page);
 await page.goto('/s/2/a/2',{waitUntil:'domcontentloaded'});
 await expect(word(page,1)).toBeVisible({timeout:20000});
 await word(page,1).scrollIntoViewIfNeeded();
 await word(page,1).click();
 const panel=page.locator('.root-panel');
 await expect(panel).toBeVisible();
 await expect(panel).not.toHaveClass(/maximized/);

 // Maximize.
 await panel.locator('button[aria-label="تمام‌صفحه"]').click();
 await expect(panel).toHaveClass(/maximized/);

 // Retarget through the panel's own unit navigation: the selection moves but
 // the stay-open panel keeps its maximized state.
 const preview=panel.locator('[data-selection-preview]');
 const before=await preview.innerText();
 await panel.locator('[data-analysis-nav-slot="unit-next"]').click();
 await expect(preview).not.toHaveText(before);
 await expect(panel).toHaveClass(/maximized/);

 // Close and reopen: the panel comes back half-page again.
 await panel.locator('button[aria-label="بستن"]').click();
 await expect(panel).toHaveCount(0);
 await word(page,1).click();
 await expect(panel).toBeVisible();
 await expect(panel).not.toHaveClass(/maximized/);
});

test('closing through the maximized backdrop resets the panel for the next selection',async({page,},testInfo)=>{
 await setup(page);
 test.skip(testInfo.project.name!=='chromium-phone'&&testInfo.project.name!=='android-bridge-phone','The backdrop is a mobile-only affordance.');
 await page.goto('/s/2/a/2',{waitUntil:'domcontentloaded'});
 await expect(word(page,1)).toBeVisible({timeout:20000});
 await word(page,1).scrollIntoViewIfNeeded();
 await word(page,1).click();
 const panel=page.locator('.root-panel');
 await expect(panel).toBeVisible();
 await panel.locator('button[aria-label="تمام‌صفحه"]').click();
 await expect(panel).toHaveClass(/maximized/);

 // The backdrop under a maximized panel is another close path (not the close
 // button, not the word toggle): whatever closes the selection must also drop
 // the maximize flag so the next panel opens half-page. On the phone layout
 // the maximized sheet leaves only slivers of backdrop visible, so drive the
 // handler directly instead of depending on hit-target geometry.
 await page.locator('.panel-backdrop').evaluate((el) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
 });
 await expect(panel).toHaveCount(0);
 await word(page,1).click();
 await expect(panel).toBeVisible();
 await expect(panel).not.toHaveClass(/maximized/);
});
