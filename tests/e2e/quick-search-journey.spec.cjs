const {test,expect}=require('@playwright/test');

async function setup(page,path='/s/6/a/37'){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.goto(path);
 await expect(page.locator('[data-reading-scroll] [data-surah="6"][data-ayah="37"][data-pos="1"]')).toBeVisible({timeout:20000});
 await expect(page.locator('.startup-splash')).toHaveCount(0);
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))) });
}
async function open(page){
 await page.locator('.reader-toolbar button[aria-label="جست‌وجو در قرآن"]').click();
 return page.locator('.quick-surah-search');
}

test('quick scope defaults locally and persists across closing and reload',async({page})=>{
 await setup(page);
 let quick=await open(page);
 await expect(quick.getByRole('button',{name:'این سوره',exact:true})).toHaveAttribute('aria-pressed','true');
 await quick.getByRole('button',{name:'کل قرآن',exact:true}).click();
 await quick.getByRole('button',{name:'بستن جست‌وجوی سریع'}).click();
 quick=await open(page);
 await expect(quick.getByRole('button',{name:'کل قرآن',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.reload();
 quick=await open(page);
 await expect(quick.getByRole('button',{name:'کل قرآن',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('local quick search works without the global corpus',async({page})=>{
 await setup(page);
 await page.route('**/data/quran-search.json',r=>r.abort());
 const quick=await open(page);
 await quick.getByRole('searchbox').fill('الله');
 await expect(quick.locator('.quick-search-status [role="status"]')).toContainText('از',{timeout:20000});
 await expect(page).toHaveURL(/\/s\/6\/a\//);
 const first=page.url();
 await quick.getByRole('button',{name:'نتیجهٔ بعدی در سوره',exact:true}).click();
 await expect(page).not.toHaveURL(first);
});

for(const method of ['chip','back'])test(`global results retain one origin and restore its reading offset with ${method}`,async({page})=>{
 await setup(page);
 // Capture the real visible anchor rather than assuming the URL is the first visible verse.
 const origin=await page.locator('[data-reading-scroll]').evaluate(el=>{
  const top=el.getBoundingClientRect().top;
  const word=[...el.querySelectorAll('[data-pos]')].find(w=>w.getBoundingClientRect().bottom>top+2);
  return {s:word.dataset.surah,a:word.dataset.ayah,pos:word.dataset.pos,offset:word.getBoundingClientRect().top-top};
 });
 const originUrl=page.url();
 const quick=await open(page);
 await quick.getByRole('button',{name:'کل قرآن',exact:true}).click();
 await quick.getByRole('searchbox').fill('رصد');
 await expect(page).toHaveURL(/\/s\/9\/a\/5\/w\/14$/,{timeout:20000});
 const chip=page.locator('[data-quick-search-return]');
 await expect(chip).toContainText('انعام');
 const label=await chip.textContent();
 const first=page.url();
 await quick.getByRole('button',{name:'نتیجهٔ بعدی',exact:true}).click();
 await expect(page).not.toHaveURL(first);
 await expect(chip).toHaveText(label);
 if(method==='chip')await chip.click();else await page.goBack();
 await expect(page).toHaveURL(originUrl);
 await expect(quick).toHaveCount(0);
 const anchor=page.locator(`[data-reading-scroll] [data-surah="${origin.s}"][data-ayah="${origin.a}"][data-pos="${origin.pos}"]`);
 await expect(anchor).toBeVisible({timeout:20000});
 // Chromium rounds scrollTop to device pixels even when word bounds are fractional.
 await expect.poll(async()=>Math.abs(await anchor.evaluate(w=>w.getBoundingClientRect().top-w.closest('[data-reading-scroll]').getBoundingClientRect().top)-origin.offset)).toBeLessThanOrEqual(1);
 if(method==='back'){
  await page.goForward();
  await expect(chip).toHaveText(label);
  await chip.click();
  await expect(page).toHaveURL(originUrl);
 }
});

test('the active quick result is centered apart from the return chip', async ({ page }) => {
 await setup(page);
 const quick = await open(page);
 const location = page.locator('[data-quick-search-location]');
 await expect(location).toHaveCount(0);
 await quick.getByRole('button', { name: 'کل قرآن', exact: true }).click();
 await quick.getByRole('searchbox').fill('رصد');
 await expect(location).toHaveText('توبه · ۵');
 const returnChip = page.locator('[data-quick-search-return]');
 await expect(returnChip).toContainText('انعام');

 for (const width of [320, 390, 1280]) {
  await page.setViewportSize({ width, height: 800 });
  const label = await location.boundingBox();
  const chip = await returnChip.boundingBox();
  const bar = await page.locator('.quick-search-return').boundingBox();
  expect(Math.abs((label.x + label.width / 2) - (bar.x + bar.width / 2))).toBeLessThan(1);
  expect(chip.x).toBeGreaterThan(label.x + label.width);
 }

 await quick.getByRole('button', { name: 'نتیجهٔ بعدی', exact: true }).click();
 await expect(location).toHaveText('جن · ۹');
 await quick.getByRole('searchbox').fill('');
 await expect(location).toHaveCount(0);
 await expect(returnChip).toBeVisible();
});

test('a global quick-search journey returns to the same mushaf page and offset',async({page})=>{
 await setup(page);
 await page.goto('/p/130');
 await expect(page.locator('[data-mushaf-page="130"]')).toBeVisible({timeout:20000});
 await page.evaluate(()=>document.fonts.ready);
 const origin=await page.locator('[data-reading-scroll]').evaluate(el=>{
  const top=el.getBoundingClientRect().top;
  const word=[...el.querySelectorAll('[data-pos]')].find(w=>w.getBoundingClientRect().bottom>top+2);
  return {s:word.dataset.surah,a:word.dataset.ayah,pos:word.dataset.pos,offset:word.getBoundingClientRect().top-top};
 });
 const url=page.url();
 const quick=await open(page);
 await quick.getByRole('button',{name:'کل قرآن',exact:true}).click();
 await quick.getByRole('searchbox').fill('رصد');
 await expect(page).not.toHaveURL(url);
 await page.locator('[data-quick-search-return]').click();
 await expect(page).toHaveURL(url);
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible();
 const anchor=page.locator(`[data-reading-scroll] [data-surah="${origin.s}"][data-ayah="${origin.a}"][data-pos="${origin.pos}"]`);
 // Chromium rounds scrollTop to device pixels even when word bounds are fractional.
 await expect.poll(async()=>Math.abs(await anchor.evaluate(w=>w.getBoundingClientRect().top-w.closest('[data-reading-scroll]').getBoundingClientRect().top)-origin.offset)).toBeLessThanOrEqual(1);
});

test('returning cancels a result reveal whose surah is still loading',async({page})=>{
 await setup(page);
 const origin=page.url();
 let release,requested;
 const gate=new Promise(resolve=>release=resolve);
 const pending=new Promise(resolve=>requested=resolve);
 await page.route('**/data/surah/72.json',async route=>{requested();await gate;await route.continue()});
 const quick=await open(page);
 await quick.getByRole('button',{name:'کل قرآن',exact:true}).click();
 await quick.getByRole('searchbox').fill('رصد');
 await expect(page).toHaveURL(/\/s\/9\/a\/5\/w\/14$/,{timeout:20000});
 await quick.getByRole('button',{name:'نتیجهٔ بعدی',exact:true}).click();
 await pending;
 await page.locator('[data-quick-search-return]').click();
 await expect(page).toHaveURL(origin);
 const response=page.waitForResponse('**/data/surah/72.json');
 release();
 await (await response).finished();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(page).toHaveURL(origin);
 await expect(quick).toHaveCount(0);
});
