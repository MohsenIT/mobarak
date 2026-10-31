const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const meta=JSON.parse(fs.readFileSync('public/data/meta.json','utf8'));
const surahs=Array.from({length:114},(_,i)=>JSON.parse(fs.readFileSync(`public/data/surah/${i+1}.json`,'utf8')));
// Exercise the actual virtualized reader: a data-only test cannot catch a
// missing SurahBand, unloaded page, dropped word, or clipped reading line.
for(let start=1;start<=604;start+=30){
 const end=Math.min(604,start+29);
 test(`mushaf renders every word and surah heading on pages ${start}-${end}`,async({page})=>{
  test.setTimeout(180000);
  await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.showTrans','false')});
  await page.goto(`/p/${start}`,{waitUntil:'domcontentloaded'});
  for(let number=start;number<=end;number++){
   const section=page.locator(`[data-mushaf-page="${number}"]`);
   await section.evaluate(el=>{const scroll=el.closest('[data-reading-scroll]');scroll.scrollTop=el.offsetTop;scroll.dispatchEvent(new Event('scroll'))});
   const words=section.locator('[data-surah][data-ayah][data-pos]');
   const expected=meta.pages[number-1].flatMap(seg=>surahs[seg.s-1].v.filter(v=>v.n>=seg.f&&v.n<=seg.t).flatMap(v=>v.w.map((_,i)=>`${seg.s}:${v.n}:${i+1}`)));
   await expect(words).toHaveCount(expected.length);
   expect(await words.evaluateAll(nodes=>nodes.map(el=>`${el.dataset.surah}:${el.dataset.ayah}:${el.dataset.pos}`)),`page ${number}: ordered word coverage`).toEqual(expected);
   const starts=meta.pages[number-1].filter(seg=>seg.f===1);
   await expect(section.locator('.surah-band')).toHaveCount(starts.length);
   for(const seg of starts)await expect(section.locator('.band-title').filter({hasText:meta.surahs[seg.s-1].ar})).toBeVisible();
   await expect(section.locator('.bismillah-line')).toHaveCount(starts.filter(seg=>meta.surahs[seg.s-1].b).length);
   await page.evaluate(()=>document.fonts.ready);
   const clipped=await section.locator('.mushaf-line').evaluateAll(lines=>lines.flatMap(line=>{const r=line.getBoundingClientRect();return [...line.children].filter(child=>{const c=child.getBoundingClientRect();return c.left<r.left-2||c.right>r.right+2}).map(child=>child.textContent)}));
   expect(clipped,`page ${number}: text fits horizontally`).toEqual([]);
  }
 });
}
