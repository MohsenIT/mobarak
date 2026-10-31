const {test,expect}=require('@playwright/test');
test('desktop surah menu opens from the toolbar and navigates to a different surah',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
 await page.goto('/s/20',{waitUntil:'domcontentloaded'});
 const menu=page.locator('.reader-surah-link');
 await expect(menu).toBeVisible();await menu.click();
 await expect(menu).toHaveAttribute('aria-expanded','true');
 const drawer=page.locator('.drawer');await expect(drawer).toBeVisible();
 await drawer.locator('.nav-surah-row').filter({hasText:'بقره'}).click();
 await expect(page).toHaveURL(/\/s\/2(?:$|\/)/);
});
