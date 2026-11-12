const {test,expect}=require('@playwright/test');

test('facet overflow follows the space available and updates when resized',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.setViewportSize({width:1000,height:800});
 await page.goto('/q?q=رزق');
 const group=page.getByRole('group',{name:'فیلتر بُن‌واژه'});
 await expect(group.getByRole('button',{pressed:false}).first()).toBeVisible({timeout:20000});
 await expect(group.locator('.search-facet-more:visible')).toHaveCount(0);
 const wide=await group.getByRole('button').count();
 expect(wide).toBeGreaterThan(3);
 await page.locator('.search-page-input input').fill('علم');
 await page.getByRole('button',{name:'ریشه',exact:true}).click();
 await expect(group.getByRole('button').nth(wide)).toBeVisible({timeout:20000});
 const all=await group.getByRole('button').count();
 await page.setViewportSize({width:320,height:700});
 const more=group.locator('.search-facet-more:visible');
 await expect(more).toBeVisible();
 const narrow=await group.getByRole('button').count();
 expect(narrow).toBeLessThan(all);
 const line=await group.getByRole('button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().top));
 expect(Math.max(...line)-Math.min(...line)).toBeLessThan(3);
 await expect.poll(()=>page.locator('.search-page-results').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await more.click();
 expect(await group.getByRole('button').count()).toBeGreaterThan(narrow);
});

test('form filters use the same responsive row and can display more than three options',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.setViewportSize({width:1000,height:800});
 await page.goto('/q?q=نصر&m=r');
 const group=page.getByRole('group',{name:'فیلتر باب'});
 await expect(group.locator('button[aria-pressed="false"]')).toHaveCount(4,{timeout:20000});
 await expect(group.locator('.search-facet-more:visible')).toHaveCount(0);
 await page.setViewportSize({width:320,height:700});
 await expect(group.locator('.search-facet-more:visible')).toBeVisible();
 await group.locator('.search-facet-more:visible').click();
 await expect(group.locator('button[aria-pressed="false"]')).toHaveCount(4);
 await group.locator('button[aria-pressed="false"]').last().click();
 await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
});
