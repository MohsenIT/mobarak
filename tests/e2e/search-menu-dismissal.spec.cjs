const {test,expect}=require('@playwright/test');

test('desktop advanced-search menus close when the user clicks elsewhere',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='chromium-desktop','This regression is specific to the desktop toolbar.');
 await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.goto('/q',{waitUntil:'domcontentloaded'});
 for(const menu of [page.locator('.search-scope'),page.locator('.search-extra-options')]){
  await menu.locator('summary').click();
  await expect(menu).toHaveAttribute('open','');
  await page.mouse.click(640,800);
  await expect(menu).not.toHaveAttribute('open','');
 }
});
