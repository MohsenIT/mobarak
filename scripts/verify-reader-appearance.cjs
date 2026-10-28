const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.READER_URL||'http://127.0.0.1:3000';
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:400,height:850},locale:'fa-IR'}),page=await context.newPage();
  await page.addInitScript(()=>{
   localStorage.setItem('mubarak.ui-language.v1','fa');window.__native=[];
   window.QuranNativeAudio={onmessage:null,postMessage(raw){const m=JSON.parse(raw);window.__native.push(m);setTimeout(()=>this.onmessage?.({data:JSON.stringify({id:m.id})}),0)}};
  });
  await page.goto(base+'/s/20/a/135');
  const word=page.locator('[data-surah="20"][data-ayah="135"][data-pos] .quran-word').last();
  await word.waitFor();await word.click();
  const sheet=page.locator('.root-panel');await sheet.waitFor();
  // Recreate the stale temporary spacer left by the previous app version.
  await page.locator('[data-reading-scroll]').evaluate(el=>{if(!el.querySelector('[data-reader-reveal-spacer]')){const spacer=document.createElement('div');spacer.dataset.readerRevealSpacer='';spacer.style.height='500px';el.appendChild(spacer)}});
  await sheet.getByRole('button',{name:'بستن',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-reader-reveal-spacer]'));
  await page.locator('[data-reading-scroll]').evaluate(el=>el.scrollTop=el.scrollHeight);
  const end=await page.locator('[data-reading-scroll]').evaluate(el=>{
   const words=el.querySelectorAll('[data-surah="20"][data-ayah="135"] .quran-word');
   return {gap:el.getBoundingClientRect().bottom-words[words.length-1].getBoundingClientRect().bottom};
  });
  assert(end.gap<100,`Unexpected end-of-surah gap: ${end.gap}`);
  await page.getByRole('button',{name:'منوی برنامه',exact:true}).click();
  await page.getByRole('button',{name:'تنظیمات',exact:true}).click();
  const calendar=page.getByLabel('نوع تقویم',{exact:true});await calendar.waitFor();
  assert.equal(await calendar.inputValue(),'auto');
  await calendar.selectOption('gregory');
  await page.getByRole('button',{name:'تاریخچهٔ نسخه\u200cها',exact:true}).click();
  await page.locator('time[datetime="2026-10-28"]').first().waitFor();
  assert((await page.locator('time[datetime="2026-10-28"]').first().innerText()).includes('۲۰۲۶'));
  await page.keyboard.press('Escape');
  await calendar.selectOption('persian');
  await page.getByRole('button',{name:'تاریخچهٔ نسخه\u200cها',exact:true}).click();
  assert((await page.locator('time[datetime="2026-10-28"]').first().innerText()).includes('۱۴۰۵'));
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'شب\u200cخوان',exact:true}).click();
  await page.waitForFunction(()=>window.__native.some(m=>m.op==='appearance'&&m.theme==='night'));
  await page.reload();
  await page.getByRole('button',{name:'منوی برنامه',exact:true}).waitFor();
  await page.getByRole('button',{name:'منوی برنامه',exact:true}).click();
  await page.getByRole('button',{name:'تنظیمات',exact:true}).click();
  assert.equal(await page.getByLabel('نوع تقویم',{exact:true}).inputValue(),'persian');
  console.log('PASS: final-ayah reveal spacer disappears after sheet closes; end gap <100px; calendar settings update history immediately and persist; night theme sends native appearance command.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
