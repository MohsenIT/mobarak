/** Verify the prepared summary sample and explicit full-text download in a browser. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const url=process.env.READER_URL||'http://127.0.0.1:3000';
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const context=await browser.newContext();const page=await context.newPage();let fullRequests=0;
  page.on('request',r=>{if(r.url().includes('/data/mizan/1.json'))fullRequests++});
  await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
  await page.goto(url+'/s/1');
  await page.getByRole('button',{name:'پخش تلاوت از آیهٔ فعلی',exact:true}).waitFor();
  await page.locator('[data-surah="1"][data-ayah="2"] .quran-word').first().click();
  await page.locator('#analysis-tab-verse').click();
  const panel=page.getByRole('region',{name:'تفسیر المیزان',exact:true});
  await panel.getByText(/در المیزان، همهٔ ستایش‌ها/).waitFor();
  assert.equal(fullRequests,0,'summary must not fetch full commentary');
  assert.equal(await panel.locator('article').count(),0);
  assert.equal(await panel.getByText('خلاصهٔ هوش مصنوعی',{exact:true}).count(),1);
  await panel.getByRole('button',{name:/دانلود متن کامل تفسیر این سوره/}).click();
  await panel.locator('details summary').click();
  const text=await panel.locator('article').innerText();assert(text.length>100);
  assert((await panel.innerText()).includes('۲ تا ۳'));
  assert.equal(await panel.locator('article script').count(),0);
  assert(fullRequests>0);
  await page.evaluate(async()=>{const data=await fetch('/data/mizan/1.json');const cache=await caches.open('quran-offline-packs-v1');await cache.put('/data/mizan/1.json',data);await navigator.serviceWorker.ready});
  await context.setOffline(true);
  const data=await page.evaluate(async()=>{const r=await fetch('/data/mizan/1.json');return r.json()});assert.equal(data.verses,7);
  console.log('PASS: source-checked AI-labelled sample appears without full download; explicit download shows shared 2–3 source range; escaped text; offline fetch succeeds.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
