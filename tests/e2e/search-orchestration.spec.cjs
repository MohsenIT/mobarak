const {test,expect}=require('@playwright/test');
// Characterization coverage for the search orchestration that lives in
// page.tsx: the two entry points (the quick bar in the toolbar and the
// full-page advanced search), how a hit is picked from each, the "back to
// search results" band, the occurrence filter handed over from the analysis
// panel, and how all of that interacts with history and the reading position.
//
// These pin current behavior before/while the orchestration is moved into a
// dedicated hook, so the extraction can be shown to change nothing the reader
// can see.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
}
async function readerReady(page){
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
}
async function openAdvancedFromMenu(page){
 await page.locator('.reader-toolbar button[aria-label="منوی برنامه"]').click();
 await page.locator('.drawer-tool-row').filter({hasText:'جست‌وجوی پیشرفته'}).click();
 await expect(page.locator('[data-search-page]')).toBeVisible({timeout:20000});
}

test('the quick bar opens in the toolbar and closing it returns to the reader',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page).toHaveURL(/\/s\/19$/);

 await page.locator('.reader-toolbar button[aria-label="جست‌وجو در قرآن"]').click();
 const quick=page.locator('.quick-surah-search');
 await expect(quick).toBeVisible();
 await expect(quick.getByRole('group',{name:'روش جست‌وجوی سریع'})).toBeVisible();
 // The bar replaces the toolbar controls, so the reader is not reachable from
 // it — closing is the only way back.
 await expect(page.locator('.reader-surah-link')).toHaveCount(0);

 await quick.getByRole('button',{name:'بستن جست‌وجوی سریع'}).click();
 await expect(page.locator('.quick-surah-search')).toHaveCount(0);
 await expect(page.locator('.reader-surah-link')).toBeVisible();
 // Closing the quick bar does not rewrite the location.
 await expect(page).toHaveURL(/\/s\/19$/);
});

test('a quick-bar hit moves the reader but leaves the bar open so results can be stepped through',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await page.locator('.reader-toolbar button[aria-label="جست‌وجو در قرآن"]').click();
 const quick=page.locator('.quick-surah-search');
 await expect(quick).toBeVisible();

 // A bare verse number is the deterministic path: it resolves to that ayah of
 // the surah being read without needing a corpus search.
 await quick.getByRole('searchbox').fill('۵');
 await expect(quick.locator('.quick-search-status')).toContainText('۱ از ۱',{timeout:20000});
 await expect(page).toHaveURL(/\/s\/19\/a\/5$/,{timeout:20000});

 // The bar deliberately stays mounted: its previous/next arrows walk the
 // hits. Closing it is what returns the toolbar.
 await expect(quick).toBeVisible();
 await quick.getByRole('button',{name:'بستن جست‌وجوی سریع'}).click();
 await expect(page.locator('.quick-surah-search')).toHaveCount(0);
 await expect(page.locator('.reader-surah-link')).toContainText('مريم');
 // ...and the reading position the bar moved to is kept.
 await expect(page).toHaveURL(/\/s\/19\/a\/5$/);
});

test('advanced search opened from the tools menu keeps a way back to the reading position',async({page})=>{
 await setup(page);
 await page.goto('/s/1/a/3',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await openAdvancedFromMenu(page);
 await expect(page).toHaveURL(/\/q(\?|$)/);

 // Leaving search by its own button returns to the reading view.
 await page.locator('[data-search-page] button[aria-label="بازگشت به قرآن"]').first().click();
 await expect(page.locator('[data-search-page]')).toHaveCount(0);
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
});

test('the occurrence filter handed over from the analysis panel marks the search as filtered and can be cleared',async({page})=>{
 await setup(page);
 await page.goto('/s/20/a/34',{waitUntil:'domcontentloaded'});
 await readerReady(page);

 // Select the word, then ask for its occurrences in this surah.
 const word=page.locator('[data-reading-scroll] [data-surah="20"][data-ayah="34"][data-pos="1"] [data-word-part="stem"]');
 await word.scrollIntoViewIfNeeded();
 await word.click();
 const trigger=page.locator('.analysis-position-button');
 await expect(trigger).toBeVisible({timeout:20000});
 await trigger.click();
 await page.locator('[data-occurrence-scope="surah"]').click();

 const pageSearch=page.locator('[data-search-page]');
 await expect(pageSearch).toBeVisible({timeout:20000});
 await expect(pageSearch.locator('.search-active-filter')).toBeVisible();
 // The filter is part of the search URL, so it survives a reload. The panel was
 // on its default root tab, so the criterion is a root occurrence.
 await expect(page).toHaveURL(/[?&]o=r\.20\.34\.1/);

 // Clearing the filter keeps the reader in search, with an empty query.
 await pageSearch.getByRole('button',{name:'حذف فیلتر تکرارها'}).click();
 await expect(pageSearch.locator('.search-active-filter')).toHaveCount(0);
 await expect(page).toHaveURL(/\/(q|search)(\?|$)/,{timeout:20000});
});

test('a selected search result can be revisited from the back-to-results band, and the band can be dismissed',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await openAdvancedFromMenu(page);

 // Search for a common word, then take the first hit.
 await page.locator('.search-page-input input').fill('الله');
 const firstResult=page.locator('.search-result-card').first();
 await expect(firstResult).toBeVisible({timeout:20000});
 await firstResult.click();

 // The reader moved to the hit and the band offers the way back.
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 const band=page.getByRole('button',{name:'بازگشت به نتایج جست‌وجو'});
 await expect(band).toBeVisible({timeout:20000});
 // goVerse writes the hit's verse URL only after its surah has loaded, while
 // the band appears synchronously with the pick. Wait for the location to
 // settle on the verse address before capturing it, or the captured "reading"
 // URL may still be the search URL the rewrite has not replaced yet.
 await expect(page).toHaveURL(/\/s\/\d+\/a\/\d+(\/w\/\d+)?$/,{timeout:20000});
 const readingUrl=page.url();

 // Going back opens the search page again on the same query.
 await band.click();
 await expect(page.locator('[data-search-page]')).toBeVisible({timeout:20000});
 await expect(page.locator('.search-page-input input')).toHaveValue('الله');

 // Coming back to the reading view restores the very same hit.
 await page.locator('[data-search-page] button[aria-label="بازگشت به قرآن"]').first().click();
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await expect(page).toHaveURL(readingUrl);

 // Dismissing the band removes it and keeps the reading position.
 await page.getByRole('button',{name:'بستن نوار بازگشت به جست‌وجو'}).click();
 await expect(page.getByRole('button',{name:'بازگشت به نتایج جست‌وجو'})).toHaveCount(0);
 await expect(page).toHaveURL(readingUrl);
});

test('quick search hands its query and scope to the advanced page',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await page.locator('.reader-toolbar button[aria-label="جست‌وجو در قرآن"]').click();
 const quick=page.locator('.quick-surah-search');
 await expect(quick).toBeVisible();
 await quick.getByRole('searchbox').fill('رحمة');

 // "پیشرفته" carries the query into advanced search, scoped to this surah;
 // "کل قرآن" carries it with no scope.
 await quick.getByRole('button',{name:'پیشرفته'}).click();
 await expect(page.locator('[data-search-page]')).toBeVisible({timeout:20000});
 await expect(page.locator('.search-page-input input')).toHaveValue('رحمة');
 await expect(page).toHaveURL(/[?&]s=19\b/,{timeout:20000});
});
