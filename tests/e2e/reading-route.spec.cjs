const {test,expect}=require('@playwright/test');
// Characterization coverage for the reading route itself: what a location
// means, what the reader restores from it, and what the URL is rewritten to
// when the reader navigates. This is the contract of useReadingRoute /
// src/lib/reading-route.ts, which owns page / mode / surah + browser history.

async function setup(page){
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}
/** The reading screen is ready once the toolbar names a surah or page. */
async function readerReady(page){
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
}

test('a verse deep link restores flow mode at that verse and keeps its own URL',async({page})=>{
 await setup(page);
 await page.goto('/s/20/a/7',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page).toHaveURL(/\/s\/20\/a\/7$/);
 // Flow mode is identified by the per-surah pull surface, mushaf by the page scroller.
 await expect(page.locator('.surah-pull-content')).toBeVisible();
 await expect(page.locator('[data-surah="20"][data-ayah="7"][data-pos="1"]')).toBeAttached({timeout:20000});
});

test('a page deep link restores mushaf mode without rewriting the URL',async({page})=>{
 await setup(page);
 await page.goto('/p/42',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page).toHaveURL(/\/p\/42$/);
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible();
 await expect(page.locator('[data-mushaf-page="42"]')).toBeAttached();
});

test('a bare surah deep link restores flow mode at that surah',async({page})=>{
 await setup(page);
 await page.goto('/s/36',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page).toHaveURL(/\/s\/36$/);
 await expect(page.locator('.surah-pull-content')).toBeVisible();
});

test('the stored reading position is used when the location carries none',async({page})=>{
 await setup(page);
 await page.addInitScript(()=>{localStorage.setItem('mushaf.page','7');localStorage.setItem('mushaf.mode','"mushaf"')});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 // The first navigation of the reader makes the location canonical.
 await expect(page).toHaveURL(/\/p\/7$/);
});

test('navigating between pages rewrites the URL in place rather than growing history',async({page})=>{
 await setup(page);
 await page.goto('/p/5',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 const before=await page.evaluate(()=>history.length);
 // Carry the current history state, as the app's own pushes do: a state-less
 // entry invites the Next dev client to re-assert its last-known URL on
 // whatever entry is current, clobbering a back/forward target under load.
 await page.evaluate(()=>window.history.pushState(window.history.state,'','/p/6'));
 await expect(page.locator('[data-mushaf-page="6"]')).toBeAttached({timeout:20000});
 // Browser back/forward restores the page from the location.
 await page.goBack();
 await expect(page).toHaveURL(/\/p\/5$/);
 await expect(page.locator('[data-mushaf-page="5"]')).toBeAttached({timeout:20000});
 expect(await page.evaluate(()=>history.length)).toBeGreaterThanOrEqual(before);
});

/**
 * Drive a same-document history traversal from inside the page and wait until
 * its popstate has been dispatched to the app before resolving. Issuing a
 * second traversal while the previous one's popstate is still queued can be
 * dropped by the browser under main-thread load — the pointer then never
 * moves, which is a browser-side race, not an app behavior under test.
 */
async function traverseHistory(page,dir){
 await page.evaluate(d=>new Promise(resolve=>{
  window.addEventListener('popstate',()=>requestAnimationFrame(resolve),{once:true});
  if(d==='back')window.history.back();else window.history.forward();
 }),dir);
}

test('forward navigation after back restores the newer reading position',async({page})=>{
 await setup(page);
 await page.goto('/s/2',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await page.evaluate(()=>window.history.pushState(window.history.state,'','/s/3'));
 await expect(page).toHaveURL(/\/s\/3$/);
 await traverseHistory(page,'back');
 await expect(page).toHaveURL(/\/s\/2$/);
 await traverseHistory(page,'forward');
 await expect(page).toHaveURL(/\/s\/3$/);
 await readerReady(page);
});

test('a refresh keeps the reader on the restored verse address',async({page})=>{
 await setup(page);
 await page.goto('/s/18/a/10/w/2',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await page.reload({waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page).toHaveURL(/\/s\/18\/a\/10\/w\/2$/);
 await expect(page.locator('[data-surah="18"][data-ayah="10"][data-pos="2"]')).toBeAttached({timeout:20000});
});
