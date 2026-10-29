const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
for(const language of ['fa','en'])test(`${language}: dialogs, controls and voice preserve geometry`,async({page},testInfo)=>{
 const m=JSON.parse(fs.readFileSync(`src/messages/${language}.json`)),native=testInfo.project.name.startsWith('android-bridge');
 await page.addInitScript(({language,native})=>{
  localStorage.setItem('mubarak.ui-language.v1',language);
  window.__speech=null;window.__audioCommands=[];
  HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('canplay'));return Promise.resolve()};
  function speech(engine){window.__speech={emit(text,final=false){engine.onresult?.({results:[{isFinal:final,0:{transcript:text}}]});if(final)engine.onend?.()},error(code){engine.onerror?.({error:code});engine.onend?.()}};setTimeout(()=>engine.onstart?.(),5)}
  window.SpeechRecognition=class {start(){speech(this)}stop(){this.onend?.()}abort(){this.onerror?.({error:'aborted'});this.onend?.()}};
  if(!native)return;
  const options={speed:1,verse:1,surah:1,pause:0,rangeSurah:0,from:0,to:0,sleepDeadline:0,sleepAtEnd:false,translationAudio:''};
  const state={type:'state',connected:true,playing:false,playWhenReady:false,ready:true,ended:false,position:0,duration:10,speed:1,options,safeArea:{top:44,bottom:28,left:0,right:0}};
  window.QuranNativeAudio={onmessage:null,postMessage(raw){const command=JSON.parse(raw);window.__audioCommands.push(command);setTimeout(()=>{
   if(command.op==='select'){state.item=`v/${command.r}/${command.s}/${command.a}`;state.playing=command.play}
   if(command.op==='libraryGet'||command.op==='library')this.onmessage?.({data:JSON.stringify({type:'library',data:{favorites:[],playlists:[],reading:{},revision:0}})});
   this.onmessage?.({data:JSON.stringify({id:command.id})});this.onmessage?.({data:JSON.stringify(state)});
  },1)}};
  window.QuranNativeSpeech={onmessage:null,postMessage(raw){const data=JSON.parse(raw),send=(type,value='')=>this.onmessage?.({data:JSON.stringify({id:data.id,type,value})});
   if(data.op==='start'){window.__speech={emit(text,final=false){send(final?'result':'partial',text);if(final)send('end')},error(code){send('error',code);send('end')}};setTimeout(()=>send('start'),5)}
   else {send('error','aborted');send('end')}
  }};
 },{language,native});
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 await page.route('**/api/recitation?**',r=>r.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3.....')}));
 await page.route('https://verses.quran.com/**',r=>r.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3.....')}));
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:m['ui.facfd50c31'],exact:true}).click();
 await page.getByRole('button',{name:m['ui.d2ac810b00'],exact:true}).click();
 const settings=page.locator('.recitation-settings');await expect(settings).toBeVisible();
 async function dialogGeometry(dialog){
  const rect=await dialog.boundingBox(),height=page.viewportSize().height;
  expect(rect.y).toBeGreaterThanOrEqual(native?44:0);expect(rect.y+rect.height).toBeLessThanOrEqual(height-(native?28:0)+1);
  const title=await dialog.locator('[data-slot="dialog-title"]').boundingBox(),close=await dialog.locator('[data-slot="dialog-close"]').boundingBox();
  expect(title.x+title.width<=close.x||close.x+close.width<=title.x||title.y+title.height<=close.y||close.y+close.height<=title.y).toBe(true);
 }
 await dialogGeometry(settings);
 if(native)await settings.locator('.car-study-controls > summary').click();
 for(const select of await settings.locator('select:visible').all()){
  await select.scrollIntoViewIfNeeded();
  expect(await select.evaluate(el=>{const p=el.parentElement.getBoundingClientRect(),r=el.getBoundingClientRect();const text=el.parentElement.firstChild;let clear=true;if(text?.nodeType===Node.TEXT_NODE){const range=document.createRange();range.selectNodeContents(text);const t=range.getBoundingClientRect();clear=t.right<=r.left+1||r.right<=t.left+1||t.bottom<=r.top||r.bottom<=t.top}return clear&&r.left>=p.left-1&&r.right<=p.right+1})).toBe(true);
 }
 await settings.locator('.resource-select').click();
 const picker=page.locator('.resource-picker-dialog');await dialogGeometry(picker);
 const input=picker.locator('.resource-picker-search input'),shell=picker.locator('.dictation-input-shell'),mic=picker.locator('.dictation-button');
 const before=await shell.boundingBox();await mic.click();
 await expect(input).toHaveAttribute('aria-busy','true');
 const during=await shell.boundingBox();expect(Math.abs(before.height-during.height)).toBeLessThanOrEqual(1);
 const button=await mic.boundingBox();expect(Math.abs(button.y+button.height/2-(during.y+during.height/2))).toBeLessThanOrEqual(1);
 await page.evaluate(()=>window.__speech.emit('کریم منصوری',false));await expect(input).toHaveValue('کریم منصوری');
 await page.evaluate(()=>window.__speech.emit('کریم منصوری',true));await expect(input).toHaveAttribute('aria-busy','false');
 await input.fill('');await mic.click();await page.evaluate(()=>window.__speech.error('network'));await expect(picker.locator('.dictation-error')).toHaveText(m['voice.network']);
 expect(Math.abs(before.height-(await shell.boundingBox()).height)).toBeLessThanOrEqual(1);
 await mic.click();await mic.click();await expect(input).toHaveAttribute('aria-busy','false');
 await picker.locator('.resource-info-button').first().click();
 const profile=page.locator('[data-slot="popover-content"]');await expect(profile).toBeVisible();
 const profileRect=await profile.boundingBox();expect(profileRect.y).toBeGreaterThanOrEqual(native?44:0);
 const profileClose=profile.locator('button').first();await profileClose.click();await expect(picker).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('picker-layout.png')});
 await picker.locator('[data-slot="dialog-close"]').click();await expect(settings).toBeVisible();
 await settings.locator('[data-slot="dialog-close"]').click();await expect(settings).not.toBeVisible();
});

test('web plays Persian translation after Arabic before advancing the ayah',async({page},testInfo)=>{
 test.skip(testInfo.project.name.startsWith('android-bridge'),'Native paired playback has its Media3 tests.');
 await page.addInitScript(()=>{localStorage.setItem('mubarak.ui-language.v1','fa');HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('canplay'));return Promise.resolve()}});
 const requests=[];
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 await page.route('https://verses.quran.com/**',r=>{requests.push(r.request().url());return r.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3.....')})});
 await page.route('**/api/recitation?**',r=>{requests.push(r.request().url());return r.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3.....')})});
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'پخش تلاوت از آیهٔ فعلی',exact:true}).click();await page.getByRole('button',{name:'تنظیمات تلاوت و دانلود',exact:true}).click();
 await page.getByLabel('ترجمهٔ صوتی بعد از هر آیه',{exact:true}).selectOption('translation-fa-fooladvand');
 await expect.poll(()=>requests.some(url=>url.endsWith('/001001.mp3'))).toBe(true);
 await page.locator('audio').evaluate(el=>el.dispatchEvent(new Event('ended')));
 await expect.poll(()=>requests.some(url=>url.includes('r=translation-fa-fooladvand')&&url.includes('a=1'))).toBe(true);
 await page.locator('audio').evaluate(el=>el.dispatchEvent(new Event('ended')));
 await expect.poll(()=>requests.some(url=>url.endsWith('/001002.mp3'))).toBe(true);
 expect(requests.findIndex(url=>url.includes('r=translation-fa-fooladvand'))).toBeLessThan(requests.findIndex(url=>url.endsWith('/001002.mp3')));
});

for(const path of ['/s/1','/p/1'])test(`translation toggle does not open Mizan (${path})`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('mubarak.ui-language.v1','fa'));
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[],tahqiq:[]}}}));
 await page.goto(path,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'نمایش ترجمه',exact:true}).click();
 const reader=page.locator('[data-reading-scroll]');await expect(reader.locator('[data-translation-verse]').first()).toBeVisible();
 await expect(reader.locator('.mizan-commentary')).toHaveCount(0);
 await expect(reader.locator('.verse-source-block')).toHaveCount(0);
 const fragment=reader.locator('.verse-translation').first();await expect(fragment).toBeVisible();
 expect(await reader.locator('[data-verse]').first().evaluate(el=>getComputedStyle(el).display)).toBe('inline');
 const geometry=await fragment.evaluate(el=>{const r=el.getBoundingClientRect();const host=el.parentElement.getBoundingClientRect();return {left:r.left,right:r.right,hostLeft:host.left,hostRight:host.right}});
 expect(geometry.left).toBeGreaterThanOrEqual(geometry.hostLeft-1);expect(geometry.right).toBeLessThanOrEqual(geometry.hostRight+1);
 await reader.locator('.quran-word').first().click();const panel=page.locator('.root-panel');await expect(panel).toBeVisible();
 await panel.getByRole('tab',{name:'آیه',exact:true}).click();await expect(panel.locator('.mizan-commentary')).toBeVisible();
});
