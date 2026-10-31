const {test,expect}=require('@playwright/test');
const meta=require('../../public/data/meta.json');
for(const theme of ['paper','night'])for(const mode of ['flow','mushaf'])test(`${theme} ${mode}: root highlights and continuous surah selection obey custom colors`,async({page})=>{
 await page.addInitScript(({theme})=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');localStorage.setItem('mushaf.theme',JSON.stringify(theme));localStorage.setItem('mushaf.showTrans','false');
  localStorage.setItem('mushaf.appearance.v1',JSON.stringify({paper:{highlight:'#ccbbaa',selected:'#447799'},night:{highlight:'#ccbbaa',selected:'#447799'}}));
 },{theme});
 const number=meta.surahs[89].pg;
 await page.goto(mode==='flow'?'/s/90':`/p/${number}`,{waitUntil:'domcontentloaded'});
 const surface=mode==='flow'?page.locator('[data-reading-scroll] [data-quran-copy-surface]').first():page.locator(`[data-mushaf-page="${number}"] [data-quran-copy-surface]`);
 const target=surface.locator('[data-surah="90"][data-ayah="1"][data-pos="4"] .quran-word');
 await expect(target).toBeVisible();await target.click();
 await page.locator('#analysis-tab-root').click();
 await expect(target).toHaveCSS('background-color','rgb(68, 119, 153)');
 await expect(target).toHaveCSS('box-shadow','none');await expect(target).toHaveCSS('text-decoration-line','none');await expect(target).toHaveCSS('border-top-width','0px');
 const related=surface.locator('[data-surah="90"][data-ayah="2"][data-pos="4"] .quran-word');
 await expect(related).toHaveCSS('background-color','rgb(204, 187, 170)');
 for(const tab of ['verse','context','surah']){
  await page.locator(`#analysis-tab-${tab}`).click();
  if(mode==='flow'){
   const ranges=surface.locator('.analysis-range');await expect(ranges.first()).toBeAttached();
   for(const range of await ranges.all())await expect(range).toHaveCSS('background-color','rgb(68, 119, 153)');
   const words=surface.locator('.analysis-range .quran-word.analysis-selected');
   expect(await words.count()).toBeGreaterThan(0);
   for(const word of await words.all()){await expect(word).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(word).toHaveCSS('box-shadow','none');await expect(word).toHaveCSS('text-decoration-line','none');await expect(word).toHaveCSS('border-top-width','0px')}
  }else{
   const bands=surface.locator('.mushaf-line[data-analysis-range]');await expect(bands.first()).toBeAttached();
   await expect.poll(()=>bands.locator('.analysis-selected').evaluateAll(words=>words.length>0&&words.every(word=>getComputedStyle(word).backgroundColor==='rgba(0, 0, 0, 0)'))).toBe(true);
   const painted=await bands.evaluateAll(lines=>lines.map(line=>({color:getComputedStyle(line,'::before').backgroundColor,width:parseFloat(getComputedStyle(line,'::before').width),words:[...line.querySelectorAll('.analysis-selected')].map(w=>({background:getComputedStyle(w).backgroundColor,shadow:getComputedStyle(w).boxShadow,decoration:getComputedStyle(w).textDecorationLine,border:getComputedStyle(w).borderTopWidth}))})));
   for(const band of painted){expect(band.color).toBe('rgb(68, 119, 153)');expect(band.width).toBeGreaterThan(0);for(const word of band.words){expect(word.background).toBe('rgba(0, 0, 0, 0)');expect(word.shadow).toBe('none');expect(word.decoration).toBe('none');expect(word.border).toBe('0px')}}
  }
 }
 await page.screenshot({path:test.info().outputPath(`${theme}-${mode}-surah-highlight.png`)});
});
