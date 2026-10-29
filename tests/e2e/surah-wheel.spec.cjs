const {test,expect}=require('@playwright/test');
for(const direction of ['next','previous'])test(`surah edge wheel: ${direction} requires a fresh deliberate gesture`,async({page},testInfo)=>{
 await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 await page.goto('/s/20',{waitUntil:'domcontentloaded'});
 const scroller=page.locator('[data-reading-scroll]');await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached();
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('.desktop-surah-navigation')).toHaveCount(0);
 const sign=direction==='next'?1:-1,target=direction==='next'?21:19;
 await scroller.evaluate((el,sign)=>{el.scrollTop=sign>0?el.scrollHeight:0},sign);
 const box=await scroller.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 // First continuous burst, including its inertia, never crosses the boundary.
 for(let i=0;i<8;i++)await page.mouse.wheel(0,sign*180);
 await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached();
 await expect(page.locator('.surah-wheel-hint')).toHaveCount(0);
 await page.waitForTimeout(350);
 await page.mouse.wheel(0,sign*120);await expect(page.locator('.surah-wheel-hint')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('edge-navigation.png')});
 await page.waitForTimeout(1350);await expect(page.locator('.surah-wheel-hint')).toHaveCount(0);
 await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached();
 // Start again, pause at the edge, then deliberately fill the indicator.
 await page.mouse.wheel(0,sign*120);await page.waitForTimeout(350);
 for(let i=0;i<4;i++)await page.mouse.wheel(0,sign*120);
 await expect(scroller.locator(`[data-surah="${target}"]`).first()).toBeAttached();
 await expect(scroller.locator('[data-surah="20"]').first()).toHaveCount(0);
});
