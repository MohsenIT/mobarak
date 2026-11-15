const {test,expect}=require('@playwright/test');

async function open(page,path='/s/18'){
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 const version=await (await page.request.get('/api/version')).json();
 await page.route('**/api/version',r=>r.fulfill({json:version}));
 await page.goto(path);
 await page.getByRole('button',{name:'بازکردن فهرست سوره‌ها',exact:true}).click();
 return page.locator('.drawer');
}

test('choosing a surah from the drawer preserves flow navigation and the active row',async({page})=>{
 const drawer=await open(page);
 await expect(drawer.locator('.nav-surah-row[data-active]')).toContainText('الكهف');
 await expect(drawer.locator('.nav-surah-row[data-active]')).toBeInViewport();
 await drawer.locator('.nav-surah-row').filter({hasText:'مريم'}).click();
 await expect(page).toHaveURL(/\/s\/19(?:\/a\/1)?$/);
 await expect(page.locator('.surah-pull-content [data-surah="19"]').first()).toBeAttached();
});

test('indexing the list leaves mushaf mode and its reading location intact',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('mushaf.mode','"mushaf"'));
 const drawer=await open(page,'/p/293');
 const rail=drawer.getByRole('slider',{name:'جزء',exact:true});
 await rail.focus();await rail.press('End');
 await expect(rail).toHaveAttribute('aria-valuenow','30');
 await expect(page).toHaveURL(/\/p\/293$/);
 await drawer.locator('.nav-surah-row').filter({hasText:'مريم'}).click();
 await expect(page).toHaveURL(/\/p\/305$/);
 await expect(page.locator('[data-continuous-mushaf]')).toBeVisible();
});

test('rail has exact compact anchors, all thirty slots and a tight final edge',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 const drawer=await open(page);
 const rail=drawer.getByRole('slider',{name:'جزء',exact:true});
 await expect(rail.locator('[data-juz-slot]')).toHaveCount(30);
 await expect.poll(()=>rail.locator('[data-labelled]').evaluateAll(es=>es.map(e=>Number(e.dataset.juzSlot)))).toEqual([1,5,10,15,20,25,30]);
 await expect(rail.locator('[data-juz-slot="1"]')).toBeVisible();
 const gap=await rail.evaluate(el=>el.getBoundingClientRect().bottom-el.lastElementChild.getBoundingClientRect().bottom);
 expect(gap).toBeLessThanOrEqual(9);
 const range=drawer.locator('[data-surah-row="18"] .nav-surah-juz-range');
 await expect(range).toHaveText('جزء ۱۵–۱۶');
 await page.setViewportSize({width:390,height:1400});
 await expect.poll(()=>rail.locator('[data-labelled]').count()).toBeGreaterThan(7);
 await expect(rail.locator('[data-juz-slot]')).toHaveCount(30);
});

test('drag, touch and keyboard use the same juz slots and show the complete floating label',async({page})=>{
 const drawer=await open(page);
 const rail=drawer.getByRole('slider',{name:'جزء',exact:true});
 await rail.focus();
 await rail.press('Home');
 await expect(rail).toHaveAttribute('aria-valuenow','1');
 for(let j=1;j<16;j++)await rail.press('ArrowDown');
 await expect(rail).toHaveAttribute('aria-valuenow','16');
 await expect(rail.locator('.juz-rail-preview')).toHaveText('جزء ۱۶');
 await expect(drawer.locator('[data-surah-row="18"]')).toBeInViewport();
 await expect(page).toHaveURL(/\/s\/18$/);
 const box=await rail.locator('[data-juz-slot="30"]').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await expect(rail).toHaveAttribute('aria-valuenow','30');
 const first=await rail.locator('[data-juz-slot="1"]').boundingBox();
 await page.mouse.move(first.x+first.width/2,first.y+first.height/2,{steps:12});
 await expect(rail).toHaveAttribute('aria-valuenow','1');
 await page.mouse.up();
 // Pointer events follow the same path in WebView/touch; no device-specific navigation gate.
 const touch=await page.context().newCDPSession(page);
 await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const target=await rail.locator('[data-juz-slot="16"]').boundingBox();
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(rail).toHaveAttribute('aria-valuenow','16');
 await touch.detach();
});
