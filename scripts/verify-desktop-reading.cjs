const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{
 for(const width of [1280,1600]){
  const page=await browser.newPage({viewport:{width,height:950}});
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
  await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
  await page.goto((process.env.READER_URL||'http://127.0.0.1:3018')+'/s/2',{waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'رفت‌وبرگشت بین سوره‌ها'});await nav.waitFor();
  await page.getByRole('button',{name:'بازکردن فهرست سوره‌ها',exact:true}).click();
  const drawer=page.locator('.drawer');await drawer.waitFor();
  const words=page.locator('[data-reading-scroll] .quran-word[data-word-part="stem"]');
  await words.first().click();const panel=page.locator('.root-panel:not(.maximized)');await panel.waitFor();
  const boxes=await Promise.all([drawer.boundingBox(),page.locator('.quran-main').boundingBox(),panel.boundingBox()]);
  const sorted=[...boxes].sort((a,b)=>a.x-b.x);assert(sorted[1].x>=sorted[0].x+sorted[0].width-1);assert(sorted[2].x>=sorted[1].x+sorted[1].width-1);assert(boxes[1].width>=400);
  await panel.getByRole('button',{name:'بستن',exact:true}).click();
  const word=words.first();await word.scrollIntoViewIfNeeded();const b=await word.boundingBox();
  await page.mouse.move(b.x+b.width*.9,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.1,b.y+b.height*.5,{steps:12});await page.mouse.up();
  assert((await page.evaluate(()=>getSelection().toString())).length>0,'mouse drag selects Quran text');assert.equal(await panel.count(),0,'selection must not open analysis');
  const selected=await page.evaluate(()=>getSelection().toString());await page.keyboard.press('Control+C');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),selected);
  const address=page.url();await page.keyboard.press('ArrowRight');assert.equal(page.url(),address,'arrows adjust native selection rather than switching surah');
  assert(await word.evaluate(e=>{const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});return e.dispatchEvent(event)}),'native context menu remains available');
  await page.evaluate(()=>getSelection().removeAllRanges());await word.click();await panel.waitFor();await panel.getByRole('button',{name:'بستن',exact:true}).click();
  await nav.getByRole('button',{name:/سورهٔ قبل/}).click();await page.waitForFunction(()=>document.querySelector('.desktop-current-surah')?.textContent==='الفاتحة');await assert.doesNotReject(()=>drawer.waitFor());
  assert(await nav.getByRole('button',{name:/سورهٔ قبل/}).isDisabled());
  await page.close();console.log(`PASS ${width}: three columns, native selection/context menu, word analysis, previous-surah navigation, persistent drawer.`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
