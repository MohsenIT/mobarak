const {test,expect}=require('@playwright/test');
// Characterization coverage for the URL/history sync between the reading
// screen and the advanced search page (src/app/page.tsx: writeSearchState /
// changeSearchOpen). This orchestration is untested elsewhere and is a
// candidate for extraction into a dedicated hook; these tests pin down its
// current, intentional behavior first.

test('opening advanced search from the reader pushes history, and the back button restores the prior reading position',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.goto('/s/1/a/3',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/\/s\/1\/a\/3$/);
 await page.locator('button[aria-label="منوی برنامه"]').click();
 await page.locator('.drawer-tool-row').filter({hasText:'جست‌وجوی پیشرفته'}).click();
 await expect(page).toHaveURL(/\/q(\?|$)/);
 await page.goBack();
 await expect(page).toHaveURL(/\/s\/1\/a\/3$/);
});

test('a direct deep link into search has no prior reading history, so closing it replaces the URL with the default reading location',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.goto('/?search=1&q=الله',{waitUntil:'domcontentloaded'});
 await expect(page).toHaveURL(/\/q\?q=/);
 await page.locator('[data-search-page] button[aria-label]').first().click();
 await expect(page).toHaveURL(/\/s\/1$/);
});
