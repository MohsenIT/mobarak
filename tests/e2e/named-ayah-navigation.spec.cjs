const {test,expect}=require('@playwright/test');
test('Go drawer accepts named ayahs in both orders and submits the selected verse',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.goto('/s/20',{waitUntil:'domcontentloaded'});
 await page.locator('.reader-surah-link').click();
 const form=page.locator('.drawer-navigation-form'),field=form.locator('input');
 for(const input of ['انعام، 37','انعام37','انعام 37','37انعام','37 انعام']){
  await field.fill(input);
  const options=page.locator('.drawer-destination-options button');
  await expect(options).toHaveCount(1);
  await expect(options).toContainText('انعام');
  await expect(options).toContainText('۳۷');
 }
 await form.locator('button[type="submit"]').click();
 await expect.poll(()=>new URL(page.url()).pathname).toMatch(/^\/s\/6\/a\/37(?:\/|$)/);
});
