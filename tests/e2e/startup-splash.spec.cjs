const {test,expect}=require('@playwright/test');
// Characterization coverage for the startup splash lifecycle.
//
// The splash shows while the first screen loads, departs once the reader is
// ready (plus a minimum display time), and a reader pressing and holding it
// pauses that departure until they release. page.tsx computes the departure
// without effects (startupLeaving is derived), so these tests pin the
// observable lifecycle through the real UI before the state moves into a
// dedicated hook.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 const real=await (await page.request.get('/api/version')).json().catch(()=>null);
 await page.route('**/api/version',r=>r.fulfill({json:{version:real?.version??'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}

test('the startup splash departs on its own once the reader is ready',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 const splash=page.locator('.startup-splash');
 await expect(splash).toBeVisible({timeout:20000});
 // No interaction: it leaves by itself once the first screen is ready and
 // the minimum display time has elapsed, uncovering the reader.
 await expect(splash).toHaveCount(0,{timeout:15000});
 await expect(page.locator('.reader-toolbar')).toBeVisible();
});

test('pressing and holding the splash pauses its departure until release',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 const splash=page.locator('.startup-splash');
 await expect(splash).toBeVisible({timeout:20000});
 // The splash is server-rendered, so visibility does not mean React has
 // hydrated and attached its pointer handlers yet. The theme attribute on
 // <html> is written by a client mount effect, which makes it a reliable
 // post-hydration marker; pressing before it appears would land on dead DOM.
 await page.waitForFunction(()=>!!document.documentElement.dataset.theme,null,{timeout:20000});

 // Press and keep the button down. Real mouse input, because the hold relies
 // on pointer capture that synthetic events cannot provide.
 const box=await splash.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 // Still holding well after an unheld load would have departed: the hold is
 // the only thing keeping the splash up.
 await page.waitForTimeout(6000);
 await expect(splash).toBeVisible();
 // Releasing lets it carry on and leave.
 await page.mouse.up();
 await expect(splash).toHaveCount(0,{timeout:10000});
 await expect(page.locator('.reader-toolbar')).toBeVisible();
});
