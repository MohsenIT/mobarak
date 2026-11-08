const {test,expect}=require('@playwright/test');
// Characterization coverage for the search facet filters inside QuranSearch.
//
// Selecting a lemma/form facet narrows the current results; changing the
// search identity (the query) drops the facet selections so stale filters can
// never follow the reader into a new search. QuranSearch re-implements this
// reset without an effect, so these tests pin it through the real UI.

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
async function openAdvancedFromMenu(page){
 await page.locator('.reader-toolbar button[aria-label="منوی برنامه"]').click();
 await page.locator('.drawer-tool-row').filter({hasText:'جست‌وجوی پیشرفته'}).click();
 await expect(page.locator('[data-search-page]')).toBeVisible({timeout:20000});
}

test('selecting a facet filters results and a new query drops the selection',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await openAdvancedFromMenu(page);

 const input=page.locator('.search-page-input input');
 await input.fill('الله');
 // Dismiss the autocomplete dropdown so it stops intercepting facet clicks.
 await input.press('Escape');
 await expect(page.locator('.search-result-card').first()).toBeVisible({timeout:20000});
 const total=await page.locator('.search-result-card').count();
 expect(total).toBeGreaterThan(1);

 // The inline facet groups list the lemmas and forms behind those hits;
 // pressing one both narrows the list and shows a removable chip.
 const facets=page.locator('.search-facets-inline');
 await expect(facets).toBeVisible();
 const facetButton=facets.locator('button[aria-pressed]').first();
 await expect(facetButton).toBeVisible();
 await facetButton.click();
 await expect(facets.locator('button[aria-pressed="true"]')).toHaveCount(1);
 await expect(page.locator('.search-active-facets button').first()).toBeVisible();
 await expect.poll(async()=>page.locator('.search-result-card').count()).toBeLessThan(total);

 // A new query resets the facet selection: no chips, nothing pressed, and the
 // full result count for the new word comes back unfiltered.
 await input.fill('الرحمن');
 // Dismiss the autocomplete dropdown again before reading the facets.
 await input.press('Escape');
 await expect.poll(async()=>page.locator('.search-result-card').count(),{timeout:20000}).toBeGreaterThan(0);
 await expect(page.locator('.search-active-facets')).toHaveCount(0);
 await expect(page.locator('.search-facets-inline button[aria-pressed="true"]')).toHaveCount(0);
});
