/** Manual end-of-surah scrolling must work independently of selected-word reveal. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.READER_URL||'http://127.0.0.1:3000';
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  for(const [path,lastSelector,translated] of [
   ['/s/20','[data-surah="20"][data-ayah="135"] .quran-word',false],
   ['/p/604','[data-surah="114"][data-ayah="6"] .quran-word',false],
   ['/s/114','[data-translation-verse="6"]',true],
   ['/p/604','[data-translation-verse="6"]',true],
  ]){
   const context=await browser.newContext({viewport:{width:400,height:850},reducedMotion:'reduce'}),page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
   await page.goto(base+path);
   if(translated)await page.getByRole('button',{name:'نمایش ترجمه',exact:true}).click();
   const scroll=page.locator('[data-reading-scroll]'),panel=page.locator('.root-panel');
   await scroll.locator('.quran-word').first().click();await panel.waitFor();
   async function checkEnd(label){
    await page.waitForFunction(()=>{
     const s=document.querySelector('[data-reading-scroll]'),p=document.querySelector('.root-panel');
     const height=parseFloat(s?.querySelector('[data-reader-reveal-spacer]')?.style.height)||0;
     return s&&p&&height>=s.getBoundingClientRect().bottom-p.getBoundingClientRect().top-1;
    },null,{timeout:5000});
    await page.mouse.move(200,100);await page.mouse.wheel(0,100000);
    await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);
    await scroll.locator(lastSelector).last().waitFor();
    await page.waitForFunction(selector=>{
     const s=document.querySelector('[data-reading-scroll]'),last=s?.querySelectorAll(selector);
     const rect=last?.length?last[last.length-1].getBoundingClientRect():null;
     const exposed=rect&&rect.top>=s.getBoundingClientRect().top&&rect.bottom<=document.querySelector('.root-panel').getBoundingClientRect().top+1;
     if(!exposed&&s){
      // A page footer may put the final control slightly above a very short
      // upper pane at the absolute end; it must remain reachable by scrolling.
      if(rect&&rect.top<s.getBoundingClientRect().top)s.scrollTop-=s.getBoundingClientRect().top-rect.top;
      else s.scrollTop=s.scrollHeight; // Finish scrolling after virtual pages settle.
     }
     return exposed;
    },lastSelector,{timeout:5000});
    console.log(`PASS ${path} translated=${translated}: final content reachable above ${label} panel.`);
   }
   await checkEnd('normal');
   for(let i=0;i<6;i++)await panel.locator('.panel-handle').press('ArrowUp');
   await checkEnd('expanded');
   await panel.locator('.panel-handle').press('Home');
   await checkEnd('minimized');
   await panel.getByRole('button',{name:'بستن',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('[data-reader-reveal-spacer]'));
   await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);
   const gap=await scroll.evaluate((e,selector)=>{
    const words=e.querySelectorAll(selector);return e.getBoundingClientRect().bottom-words[words.length-1].getBoundingClientRect().bottom;
   },lastSelector);
   assert(gap<(translated?180:100),`${path}: leftover closed-panel gap ${gap}px`);
   assert.deepEqual(errors,[]);await context.close();
   console.log(`PASS ${path}: closing panel removes reserve; final gap ${Math.round(gap)}px; no page errors.`);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
