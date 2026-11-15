const {test,expect}=require('@playwright/test');

test('introduction has a local-font responsive layout and persistent navigation',async({page})=>{
 const failures=[],external=[];
 page.on('pageerror',error=>failures.push(error.message));
 page.on('request',request=>{if(new URL(request.url()).origin!==new URL(process.env.READER_URL||'http://127.0.0.1:3009').origin)external.push(request.url())});
 const response=await page.goto('/about');
 await expect(page).toHaveURL(/\/about$/);
 expect(response.status()).toBe(200);
 expect(response.headers()['content-type']).toContain('text/html');
 await expect(page.locator('.slide')).toHaveCount(10);
 await expect(page.locator('#counter')).toHaveText('۱ از ۱۰');
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://mobarak.app/about');
 for(const [width,height]of [[320,700],[390,850],[1280,900],[740,390]]){
  await page.setViewportSize({width,height});
  await expect(page.locator('nav')).toBeInViewport();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 expect(external).toEqual([]);
 expect(failures).toEqual([]);
});

test('every slide and all supplied screenshots load through the next/previous controls',async({page})=>{
 await page.goto('/about');
 const previous=page.locator('#prev'),next=page.locator('#next');
 await expect(previous).toBeDisabled();
 const digits='۰۱۲۳۴۵۶۷۸۹',fa=n=>String(n).replace(/\d/g,d=>digits[Number(d)]);
 for(let number=1;number<=10;number++){
  const slide=page.locator('.slide:not([hidden])');
  await expect(slide).toHaveCount(1);
  await expect(page.locator('#counter')).toHaveText(`${fa(number)} از ۱۰`);
  await expect.poll(()=>slide.locator('img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  if(number<10)await next.click();
 }
 await expect(next).toBeDisabled();
 await expect(page.locator('.slide:not([hidden]) a[href="https://mobarak.app"]')).toBeVisible();
 await previous.click();
 await expect(page.locator('#counter')).toHaveText('۹ از ۱۰');
});

test('keyboard navigation and native button Space activation never advance twice',async({page})=>{
 await page.goto('/about');
 await page.locator('#next').focus();await page.keyboard.press('Space');
 await expect(page.locator('#counter')).toHaveText('۲ از ۱۰');
 await page.keyboard.press('ArrowLeft');await expect(page.locator('#counter')).toHaveText('۳ از ۱۰');
 await page.keyboard.press('ArrowRight');await expect(page.locator('#counter')).toHaveText('۲ از ۱۰');
 await page.keyboard.press('End');await expect(page.locator('#counter')).toHaveText('۱۰ از ۱۰');
 await page.keyboard.press('Home');await expect(page.locator('#counter')).toHaveText('۱ از ۱۰');
});

test('touch scrolling is distinct from horizontal slide navigation',async({page})=>{
 await page.setViewportSize({width:390,height:780});
 await page.goto('/about');
 await expect(page.locator('#counter')).toHaveText('۱ از ۱۰');
 const touch=await page.context().newCDPSession(page);
 await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const swipe=async(start,end)=>{
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[end]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 };
 await swipe({x:100,y:250},{x:180,y:450});
 await expect(page.locator('#counter')).toHaveText('۱ از ۱۰');
 await swipe({x:90,y:260},{x:310,y:265});
 await expect(page.locator('#counter')).toHaveText('۲ از ۱۰');
 await touch.detach();
});

test('the authored introduction remains readable when JavaScript is unavailable',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
 const page=await context.newPage();
 await page.goto(`${process.env.READER_URL||'http://127.0.0.1:3009'}/about`);
 await expect(page.locator('.slide:visible')).toHaveCount(10);
 await expect(page.locator('nav')).toBeHidden();
 await expect(page.getByRole('heading',{name:'این مسیر را با هم بسازیم'})).toBeVisible();
 await context.close();
});

test('reading and the introduction keep separate documents when used offline',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'allow'});
 const page=await context.newPage();
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.safavi-default.v1','true')});
 await context.route('**/offline-manifest.json',route=>route.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 const base=process.env.READER_URL||'http://127.0.0.1:3009';
 await page.goto(`${base}/s/18`);
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.reload();
 await expect(page.locator('[data-reading-scroll] [data-surah="18"]').first()).toBeAttached({timeout:20000});
 await page.goto(`${base}/about`);await expect(page.locator('#counter')).toHaveText('۱ از ۱۰');
 await context.setOffline(true);
 await page.reload();await expect(page.locator('#counter')).toHaveText('۱ از ۱۰');
 await page.goto(`${base}/s/18`);
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});
 await expect(page.locator('.slide')).toHaveCount(0);
 await context.close();
});
