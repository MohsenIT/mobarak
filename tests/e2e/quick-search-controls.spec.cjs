const {test,expect}=require('@playwright/test');

test('quick-search segments and advanced action share a compact aligned row',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 const version=await (await page.request.get('/api/version')).json();
 await page.route('**/api/version',r=>r.fulfill({json:version}));
 await page.goto('/s/2');
 await page.getByRole('button',{name:'جست‌وجو در قرآن',exact:true}).click();
 const row=page.locator('.quick-search-actions');
 const mode=row.getByRole('group',{name:'روش جست‌وجوی سریع'});
 const advanced=row.getByRole('button',{name:'پیشرفته',exact:true});
 await expect(mode.getByRole('button')).toHaveCount(3);
 await expect(advanced.locator('svg')).toHaveCount(1);
 for(const width of [320,623,1280]){
  await page.setViewportSize({width,height:800});
  await expect.poll(()=>row.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const bounds=await row.locator(':scope > *').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,height:r.height}}));
  expect(Math.max(...bounds.map(r=>r.top))-Math.min(...bounds.map(r=>r.top))).toBeLessThan(1);
  expect(Math.max(...bounds.map(r=>r.height))-Math.min(...bounds.map(r=>r.height))).toBeLessThan(1);
  expect(bounds[2].right).toBeLessThanOrEqual(bounds[1].x);
  const buttons=await mode.getByRole('button').evaluateAll(elements=>elements.map(el=>el.getBoundingClientRect().toJSON()));
  expect(Math.abs(buttons[0].x-buttons[1].right)).toBeLessThan(1);
 }
 await mode.getByRole('button',{name:'ریشه',exact:true}).click();
 await expect(mode.getByRole('button',{name:'ریشه',exact:true})).toHaveAttribute('aria-pressed','true');
 await advanced.click();
 await expect(page.locator('[data-search-page]')).toBeVisible();
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
