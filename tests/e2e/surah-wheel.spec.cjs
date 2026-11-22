const {test,expect}=require('@playwright/test');
for(const direction of ['next','previous'])test(`surah edge wheel: ${direction} requires a fresh deliberate gesture`,async({page},testInfo)=>{
 await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 await page.goto('/s/20',{waitUntil:'domcontentloaded'});
 const scroller=page.locator('[data-reading-scroll]');await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached();
 await expect(page.locator('.startup-splash')).toHaveCount(0);
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('.desktop-surah-navigation')).toHaveCount(0);
 const sign=direction==='next'?1:-1,target=direction==='next'?21:19;
 const now = new Date();
 await page.clock.install({time:now});
 await page.clock.pauseAt(new Date(now.getTime()+1000));
 // Dispatch a burst as one browser task so CI scheduling cannot turn it into separate gestures.
 const wheel=(delta,count=1)=>scroller.evaluate((el,{delta,count})=>{
  el.scrollTop=delta>0?el.scrollHeight:0;
  for(let i=0;i<count;i++)el.dispatchEvent(new WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true}));
 },{delta,count});
 // First continuous burst, including its inertia, never crosses the boundary.
 await wheel(sign*180,8);
 await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached();
 await expect(page.locator('.surah-wheel-hint')).toHaveCount(0);
 await page.clock.runFor(350);
 await wheel(sign*120);await expect(page.locator('.surah-wheel-hint')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('edge-navigation.png')});
 await page.clock.runFor(1350);await expect(page.locator('.surah-wheel-hint')).toHaveCount(0);
 await expect(scroller.locator('[data-surah="20"]').first()).toBeAttached();
 // Start again, pause at the edge, then deliberately fill the indicator.
 await wheel(sign*120);await page.clock.runFor(350);
 await wheel(sign*120,4);
 await page.clock.runFor(500);
 await expect(scroller.locator(`[data-surah="${target}"]`).first()).toBeAttached();
 await expect(scroller.locator('[data-surah="20"]').first()).toHaveCount(0);
});
