const {test,expect}=require('@playwright/test');
// Characterization coverage for the search copy-link feedback reset.
//
// Pressing the copy-link button in advanced search shows a "copied" state on
// the button; changing the search state (the query) drops that feedback so a
// stale "copied" chip never follows the reader into a new search. QuranSearch
// implements the reset during render, so this pins it through the real UI.

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

test('copy-link feedback clears when the search state changes',async({page})=>{
 await setup(page);
 // Headless Chromium denies navigator.clipboard without explicit grants.
 await page.context().grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await page.locator('.reader-toolbar button[aria-label="منوی برنامه"]').click();
 await page.locator('.drawer-tool-row').filter({hasText:'جست‌وجوی پیشرفته'}).click();
 const search=page.locator('[data-search-page]');
 await expect(search).toBeVisible({timeout:20000});

 const input=page.locator('.search-page-input input');
 await input.fill('الله');
 await expect(page.locator('.search-result-card').first()).toBeVisible({timeout:20000});
 // Dismiss the autocomplete dropdown so it stops intercepting clicks.
 await input.press('Escape');

 // The copy-link button sits in the command row after the back button;
 // identify it structurally because its label changes once the copy has
 // happened.
 const copy=search.locator('.search-command-row button.icon-btn').nth(1);
 await expect(copy).toHaveAttribute('aria-label','کپی لینک جست‌وجو');
 await copy.click();
 await expect(copy).toHaveAttribute('aria-label','لینک کپی شد');

 // A new query changes the search state; the "copied" feedback must go away.
 await input.fill('الرحمن');
 await input.press('Escape');
 await expect.poll(async()=>page.locator('.search-result-card').count(),{timeout:20000}).toBeGreaterThan(0);
 await expect(copy).toHaveAttribute('aria-label','کپی لینک جست‌وجو');
});
