const {test,expect}=require('@playwright/test');
// Characterization coverage for the release-history dialog pagination.
//
// The dialog shows releases incrementally: an initial page, a "older
// releases" button that grows the list, and an infinite-fill observer that can
// top the list up when the dialog is tall. What is pinned here is the reset:
// after closing, reopening the dialog starts from a fresh page again instead
// of continuing where the expanded list left off. The reset is implemented
// during render, so these tests pin it through the real UI.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 // Answer the update check with the running build, so the update banner (which
 // would intercept clicks) never appears.
 const real=await (await page.request.get('/api/version')).json().catch(()=>null);
 await page.route('**/api/version',r=>r.fulfill({json:{version:real?.version??'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}

test('release history paginates and restarts from the top when reopened',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await page.locator('.reader-toolbar button[aria-label="تنظیمات"]').click();
 const screen=page.locator('.settings-screen');
 await expect(screen).toBeVisible({timeout:20000});
 await screen.locator('.settings-screen-tabs button',{hasText:'درباره ما'}).click();
 await screen.getByRole('button',{name:'تاریخچهٔ نسخه‌ها'}).click();

 const dialog=page.locator('.release-notes-dialog');
 await expect(dialog).toBeVisible({timeout:20000});
 const entries=dialog.locator('.release-notes-list > section');
 await expect(entries.first()).toBeVisible();
 // Let the incremental fill settle: a tall dialog tops the list up beyond the
 // first page, so the steady first-open count is viewport-dependent.
 await page.waitForTimeout(800);
 const firstOpenCount=await entries.count();
 expect(firstOpenCount).toBeGreaterThanOrEqual(5);
 expect(firstOpenCount).toBeLessThan(78); // 78 known releases bundled

 // The "older releases" button grows the list beyond the settled page. Drive
 // the click programmatically: scrolling the button into view exposes the
 // sentinel, which makes the fill observer race the click.
 await dialog.getByRole('button',{name:'نسخه‌های قدیمی‌تر'}).evaluate((el)=>el.click());
 await expect.poll(async()=>dialog.locator('.release-notes-list > section').count()).toBe(Math.min(firstOpenCount+5,78));

 // Close the dialog (the settings screen stays open underneath), then reopen:
 // the list is back at its fresh first-open count, not the grown one.
 await dialog.locator('.release-action-secondary').click();
 await expect(dialog).not.toBeVisible();
 await screen.getByRole('button',{name:'تاریخچهٔ نسخه‌ها'}).click();
 await expect(dialog).toBeVisible({timeout:20000});
 await expect(entries.first()).toBeVisible();
 await page.waitForTimeout(800);
 await expect(entries).toHaveCount(firstOpenCount);
});
