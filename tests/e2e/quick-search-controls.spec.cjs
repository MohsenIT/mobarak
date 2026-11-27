const {test,expect}=require('@playwright/test');

test('quick-search modes and scope share a row while advanced sits beside the field',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 const version=await (await page.request.get('/api/version')).json();
 await page.route('**/api/version',r=>r.fulfill({json:version}));
 await page.goto('/s/2');
 await page.getByRole('button',{name:'جست‌وجو در قرآن',exact:true}).click();
 const row=page.locator('.quick-search-actions');
 const mode=row.getByRole('group',{name:'روش جست‌وجوی سریع'});
 const form=page.locator('.quick-surah-search form');
 const advanced=form.getByRole('button',{name:'پیشرفته',exact:true});
 const input=form.getByRole('searchbox');
 await expect(mode.getByRole('button')).toHaveCount(3);
 await expect(form.locator('.dictation-leading-icon svg')).toHaveCount(1);
 await expect(advanced.locator('svg')).toHaveCount(1);
 for(const width of [320,623,1280]){
  await page.setViewportSize({width,height:800});
  await expect.poll(()=>row.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const bounds=await row.locator(':scope > *').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,height:r.height}}));
  expect(Math.max(...bounds.map(r=>r.top))-Math.min(...bounds.map(r=>r.top))).toBeLessThan(1);
  expect(Math.max(...bounds.map(r=>r.height))-Math.min(...bounds.map(r=>r.height))).toBeLessThan(1);
  expect(bounds[1].right).toBeLessThanOrEqual(bounds[0].x);
  const [field, action]=await Promise.all([input.boundingBox(),advanced.boundingBox()]);
  expect(action.x+action.width).toBeLessThanOrEqual(field.x);
  const buttons=await mode.getByRole('button').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().toJSON()));
  expect(Math.abs(buttons[0].x-buttons[1].right)).toBeLessThan(1);
 }
 await mode.getByRole('button',{name:'ریشه',exact:true}).click();
 await expect(mode.getByRole('button',{name:'ریشه',exact:true})).toHaveAttribute('aria-pressed','true');
 await advanced.click();
 await expect(page.locator('[data-search-page], [data-search-and-go]')).toBeVisible();
});

test('longer translated controls remain on one line at narrow widths',async({page})=>{
 const en=require('../../src/messages/en.json');
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','en');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await page.setViewportSize({width:320,height:800});
 await page.goto('/s/2');
 await page.getByRole('button',{name:en['ui.cd32ebbeba'],exact:true}).click();
 await expect.poll(()=>page.locator('.quick-search-actions').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await expect(page.getByRole('button',{name:en['ui.9617b95709'],exact:true})).toBeInViewport();
});

test('quick navigation shows the same destinations as advanced search and Enter opens the first', async ({ page }) => {
 await page.addInitScript(() => {
  localStorage.setItem('mubarak.ui-language.v1', 'fa');
  localStorage.setItem('mushaf.safavi-default.v1', 'true');
 });
 await page.route('**/api/version', r => r.fulfill({ json: { version: 'fixture', releases: [] } }));
 await page.goto('/s/7/a/5');
 const open = () => page.locator('.reader-quick-search-trigger').click();
 await open();
 const field = page.getByRole('searchbox');
 const choices = page.locator('.quick-jump-options');
 await field.fill('۱۰');
 await expect(choices.getByRole('option')).toHaveText([
  'سورهٔ ۱۰', 'آیهٔ ۱۰ سورهٔ اعراف', 'سیاق ۱۰ سورهٔ اعراف', 'صفحهٔ ۱۰', 'جزء ۱۰',
 ]);
 await expect(page).toHaveURL(/\/s\/7\/a\/5$/);
 await field.press('Enter');
 await expect(page).toHaveURL(/\/s\/10\/a\/1$/);
 await page.locator('[data-quick-search-return]').click();
 await expect(page).toHaveURL(/\/s\/7\/a\/5$/);

 await page.goto('/s/101/a/4');
 await open();
 await field.fill('قارعه');
 await expect(choices.getByRole('option', { name: 'سورهٔ قارعه' })).toBeVisible();
 await field.fill('صفحه ۱۰');
 await field.press('Enter');
 await expect(page.locator('[data-quick-search-return]')).toBeVisible();
 await page.locator('[data-quick-search-return]').click();
 await expect(page).toHaveURL(/\/s\/101\/a\/4$/);
});
