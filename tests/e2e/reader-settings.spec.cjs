const {test,expect}=require('@playwright/test');
// Characterization coverage for reader presentation settings, whose update
// arithmetic moved into src/lib/reader-settings.ts (unit tested): scale
// clamping/stepping, the recent-surah list, pinned surahs, and the initial
// translator resolution. These tests pin the same behavior through the UI and
// the persisted mushaf.* values, so the storage format cannot drift.
//
// Note: the scale controls live in the settings modal (scale steps of 0.15,
// readout in an <output>), not in the drawer; the drawer only shows a slider
// that calls the same setter.

async function setup(page, seed){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(values=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
  for(const [key,value] of Object.entries(values)) localStorage.setItem(key,JSON.stringify(value));
 },seed||{});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}
async function openSurahDrawer(page){
 // The surah list lives in the navigation drawer, opened from the toolbar's
 // surah button — not from the app menu, which shows the tools pane.
 await page.locator('.reader-surah-link').click();
 const drawer=page.locator('.drawer');
 await expect(drawer).toBeVisible();
 return drawer;
}
async function openSettings(page){
 await page.locator('button[aria-label="تنظیمات"]').first().click();
 const screen=page.locator('.settings-screen');
 await expect(screen).toBeVisible();
 return screen;
}
const stored=page=>page.evaluate(()=>{
 const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return undefined}};
 return {scale:read('mushaf.scale'),theme:read('mushaf.theme'),recent:read('mushaf.recent-surahs'),pinned:read('mushaf.pinned-surahs'),tr:read('mushaf.tr'),safavi:read('mushaf.safavi-default.v1')};
});
// Persian digits, for asserting the readout.
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[+d]);

test('the scale buttons step and persist, and the value is restored on reload',async({page})=>{
 await setup(page);
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 const screen=await openSettings(page);
 const output=screen.locator('.settings-scale output');
 const zoomIn=screen.getByRole('button',{name:'بزرگ‌نمایی'});
 await expect(output).toHaveText(fa(100)+'٪');

 await zoomIn.click();
 await expect(output).toHaveText(fa(115)+'٪');
 // Persistence is debounced by 200ms, so poll rather than reading immediately.
 await expect.poll(async()=>(await stored(page)).scale,{timeout:5000}).toBe(1.15);

 // A reload must show the persisted value, not the default.
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 const again=await openSettings(page);
 await expect(again.locator('.settings-scale output')).toHaveText(fa(115)+'٪');
});

test('zooming stops at the top of the range instead of overflowing',async({page})=>{
 await setup(page,{'mushaf.scale':1.85});
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 const screen=await openSettings(page);
 const output=screen.locator('.settings-scale output');
 const zoomIn=screen.getByRole('button',{name:'بزرگ‌نمایی'});
 await expect(output).toHaveText(fa(185)+'٪');
 await zoomIn.click();
 await expect(output).toHaveText(fa(190)+'٪');
 await expect(zoomIn).toBeDisabled();
 await expect.poll(async()=>(await stored(page)).scale,{timeout:5000}).toBe(1.9);
});

test('the recent surah list records visits, most recent first, without duplicates',async({page})=>{
 await setup(page,{'mushaf.recent-surahs':[2,3]});
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 // 1 was just visited, so it leads the stored list and the seeded 2/3 follow.
 await expect.poll(async()=>(await stored(page)).recent,{timeout:15000}).toEqual([1,2,3]);

 // Visiting 2 again moves it to the front rather than adding a duplicate.
 // Navigating in-app (not via page.goto) keeps the seeded storage intact.
 const drawer=await openSurahDrawer(page);
 await drawer.locator('.nav-surah-row').filter({hasText:'البقرة'}).click();
 await expect(page).toHaveURL(/\/s\/2/);
 await expect.poll(async()=>(await stored(page)).recent,{timeout:15000}).toEqual([2,1,3]);
});

test('the recent tab lists the stored surahs and clearing it empties storage',async({page})=>{
 await setup(page,{'mushaf.recent-surahs':[2,3]});
 await page.goto('/s/55',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await expect.poll(async()=>(await stored(page)).recent,{timeout:15000}).toEqual([55,2,3]);
 const drawer=await openSurahDrawer(page);
 await drawer.locator('.tab-btn').filter({hasText:'اخیر'}).click();
 const rows=drawer.locator('.nav-surah-row');
 await expect(rows).toHaveCount(3);
 await drawer.getByRole('button',{name:'پاک‌کردن سابقه'}).click();
 await expect.poll(async()=>(await stored(page)).recent,{timeout:5000}).toEqual([]);
 await expect(rows).toHaveCount(0);
});

test('the theme choice is persisted and survives a reload',async({page})=>{
 await setup(page);
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 const screen=await openSettings(page);
 await screen.getByRole('button',{name:'شب‌خوان'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','night');
 await expect.poll(async()=>(await stored(page)).theme,{timeout:5000}).toBe('night');

 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await expect(page.locator('html')).toHaveAttribute('data-theme','night');
});

test('a stored translator is honoured for an opted-in reader',async({page})=>{
 await setup(page,{'mushaf.tr':'f'});
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 // Resolving the initial translator writes it back unchanged.
 await expect.poll(async()=>(await stored(page)).tr,{timeout:10000}).toBe('f');
 await expect.poll(async()=>(await stored(page)).safavi,{timeout:10000}).toBe(true);
});

test('a stale translator from a non-opted-in reader falls back to the default',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  // No mushaf.safavi-default.v1: this reader never opted in, so a stored
  // translation from a build that ignored the setting must not win.
  localStorage.removeItem('mushaf.safavi-default.v1');
  localStorage.setItem('mushaf.tr',JSON.stringify('f'));
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 // The screen resolves to the bundled default and, by writing the opt-in
 // marker, records that this reader now uses per-translation settings.
 const state=await page.evaluate(()=>{
  const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return undefined}};
  return {tr:read('mushaf.tr'),safavi:read('mushaf.safavi-default.v1')};
 });
 expect(state.safavi).toBe(true);
 expect(state.tr==='f').toBe(false);
});
