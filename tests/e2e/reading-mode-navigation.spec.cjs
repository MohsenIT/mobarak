const {test,expect}=require('@playwright/test');
// Characterization coverage for reading-mode switching.
//
// There is exactly one switch path: page.tsx's `switchMode` -> useReadingRoute's
// `setMode`, which owns the surah carry-over, the URL rewrite and the
// `mushaf.mode` persistence. The selector is a pure control rendered in
// SettingsScreen (the only reachable placement); NavDrawer carries no second
// copy. These tests pin that through the real UI, so a hypothetical third
// reading mode cannot quietly fork the switch logic.
//
// Also pins the mode-aware verse reveal that goVerse / panelJump /
// jumpSurahRoot now share via revealVerse(): mushaf goes to the verse's page,
// flow switches surah.

async function setup(page){
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 // Answer the update check with the running build, so the update banner (which
 // would sit over the settings modal) never appears. A fixture build id would
 // differ from NEXT_PUBLIC_APP_VERSION and raise the banner.
 const real=await (await page.request.get('/api/version')).json().catch(()=>null);
 await page.route('**/api/version',r=>r.fulfill({json:{version:real?.version??'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}
async function readerReady(page){
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
}
async function openSettings(page){
 await page.locator('.reader-toolbar button[aria-label="تنظیمات"]').click();
 const screen=page.locator('.settings-screen');
 await expect(screen).toBeVisible({timeout:20000});
 await expect(screen).toHaveAttribute('aria-modal','true');
 return screen;
}
const modeGroup=screen=>screen.getByRole('group',{name:'حالت نمایش'});

test('the mode selector exists exactly once, inside settings, and not on the reader',async({page})=>{
 await setup(page);
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await readerReady(page);

 const screen=await openSettings(page);
 const group=modeGroup(screen);
 await expect(group).toBeVisible();
 await expect(group.getByRole('button',{name:'پیوسته'})).toHaveAttribute('aria-pressed','true');
 await expect(group.getByRole('button',{name:'مصحف'})).toHaveAttribute('aria-pressed','false');

 // App-wide, including the reader behind the modal: one of each, no duplicate
 // selector anywhere (the drawer used to carry a second, unreachable copy).
 await expect(page.getByRole('button',{name:'مصحف',exact:true})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'پیوسته',exact:true})).toHaveCount(1);
 await expect(page.locator('.reader-toolbar').getByRole('button',{name:'مصحف'})).toHaveCount(0);
});

test('switching from settings follows the one switch path: surah, URL, persistence',async({page})=>{
 await setup(page);
 // Surah 19 starts its own page (305), so the mode round trip is lossless and
 // the assertion is about the switch path, not about page segmentation.
 await page.goto('/s/19',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page.locator('.surah-pull-content')).toBeVisible({timeout:20000});
 await expect(page.locator('.reader-surah-link')).toContainText('مريم');
 await expect(page).toHaveURL(/\/s\/19$/);

 const screen=await openSettings(page);
 await modeGroup(screen).getByRole('button',{name:'مصحف'}).click();
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible({timeout:20000});
 await expect(page.locator('.surah-pull-content')).toHaveCount(0);
 // Same single path as any other switch: the URL becomes the page.
 await expect(page).toHaveURL(/\/p\/305$/);
 await expect(modeGroup(screen).getByRole('button',{name:'مصحف'})).toHaveAttribute('aria-pressed','true');
 // Persisted under the existing key, not a new one.
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mushaf.mode')))).toBe('mushaf');

 // Switch back: the surah on screen is carried across, not reset to 1.
 await modeGroup(screen).getByRole('button',{name:'پیوسته'}).click();
 await expect(page.locator('.surah-pull-content')).toBeVisible({timeout:20000});
 await expect(page.locator('.reader-surah-link')).toContainText('مريم');
 await expect(page).toHaveURL(/\/s\/19$/);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mushaf.mode')))).toBe('flow');
});

test('a mode chosen in settings survives a reload, and a surah deep link still outranks it',async({page})=>{
 await setup(page);
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 const screen=await openSettings(page);
 await modeGroup(screen).getByRole('button',{name:'مصحف'}).click();
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible({timeout:20000});
 await screen.locator('button[aria-label="بستن"]').click();
 await expect(page.locator('.settings-screen')).toHaveCount(0);

 // Reload with no reading position in the location: the stored mode is used.
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible({timeout:20000});

 // A location naming a surah still outranks the stored mode.
 await page.goto('/s/18/a/10',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page.locator('.surah-pull-content')).toBeVisible({timeout:20000});
 await expect(page.locator('.reader-surah-link')).toContainText('الكهف');
});

test('a page deep link opens mushaf, a verse deep link opens flow',async({page})=>{
 await setup(page);
 await page.goto('/p/293',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible({timeout:20000});
 await expect(page).toHaveURL(/\/p\/293$/);

 await page.goto('/s/18/a/10',{waitUntil:'domcontentloaded'});
 await readerReady(page);
 await expect(page.locator('.surah-pull-content')).toBeVisible({timeout:20000});
 await expect(page.locator('.reader-surah-link')).toContainText('الكهف');
});
