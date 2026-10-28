/** Full story: pending summary -> bundled excerpt -> cold offline reload -> optional full text. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const url=process.env.READER_URL||'http://127.0.0.1:3000';
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:400,height:850}}),page=await context.newPage();
  const errors=[];let fullRequests=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/data\/mizan\/\d+\.json/.test(r.url()))fullRequests++});
  await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
  await page.goto(url+'/s/102');
  await page.getByRole('button',{name:'نمایش ترجمه',exact:true}).click();
  const block=page.locator('[data-reading-scroll] [data-verse="1"] .verse-source-block').filter({has:page.locator('[data-translation-verse="1"]')}).first();
  const excerpt=block.getByLabel('بخشی از متن المیزان',{exact:true});
  await excerpt.waitFor();
  const original=await excerpt.innerText();assert(original.length>100);
  assert.equal(await block.getByText('خلاصهٔ هوش مصنوعی',{exact:true}).count(),0);
  assert(await block.evaluate(el=>el.firstElementChild.matches('[data-translation-verse]')&&el.lastElementChild.classList.contains('mizan-commentary')));
  assert.equal(fullRequests,0,'opening must never load optional full source');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // Exercise the real core-pack installer, including all 114 opening files.
  const total=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const channel=new MessageChannel();
   channel.port1.onmessage=({data})=>{if(data.complete)resolve(data.total);if(data.error)reject(Error(data.error))};
   navigator.serviceWorker.controller.postMessage({type:'DOWNLOAD_PACKS',groups:['core']},[channel.port2]);
  }));
  assert(total>500);assert.equal(fullRequests,0);
  await context.setOffline(true);await page.reload();
  await excerpt.waitFor();assert.equal(await excerpt.innerText(),original);
  assert.equal(await block.locator('article').count(),0);
  // Verify a not-yet-visited surah's excerpt is in the installed core pack too.
  assert.equal(await page.evaluate(async()=>{const r=await fetch('/data/mizan-excerpts/2.json');return (await r.json()).verses}),286);
  await context.setOffline(false);
  await block.getByRole('button',{name:/دانلود متن کامل تفسیر این سوره/}).click();
  await block.locator('details summary').click();await block.locator('article').waitFor();
  const source=require('../public/data/mizan/102.json').passages.find(p=>p.from<=1&&p.to>=1);
  assert.equal(await block.locator('article').innerText(),source.text);
  assert.equal(fullRequests,1);assert.deepEqual(errors,[]);
  console.log(`PASS: translation then verbatim excerpt; no AI mislabel; ${total} core files installed; excerpt survives offline reload; unvisited surah opening available offline; full source fetched only after explicit click; no page errors.`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
