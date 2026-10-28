/** Real-browser regression checks; run with PLAYWRIGHT_MODULE and READER_URL. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.READER_URL||'http://127.0.0.1:3000';
async function boot(browser,native){
 const page=await browser.newPage();
 await page.addInitScript(native=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  window.__htmlPlays=0;window.__commands=[];
  HTMLMediaElement.prototype.play=function(){window.__htmlPlays++;this.dispatchEvent(new Event('canplay'));return Promise.resolve()};
  if(!native)return;
  const options={speed:1,verse:1,surah:1,pause:0,rangeSurah:0,from:0,to:0,sleepDeadline:0,sleepAtEnd:false,translationAudio:''};
  const library={favorites:[],playlists:[],reading:{},revision:0};
  const state={type:'state',connected:true,playing:false,playWhenReady:false,ready:true,ended:false,position:0,duration:10,speed:1,options};
  window.QuranNativeAudio={onmessage:null,postMessage(raw){
   const m=JSON.parse(raw);window.__commands.push(m);
   setTimeout(()=>{
    const send=data=>this.onmessage?.({data:JSON.stringify(data)});
    if(m.op==='select'){state.item=`v/${m.r}/${m.s}/${m.a}`;state.playing=state.playWhenReady=m.play}
    if(m.op==='play')state.playing=state.playWhenReady=true;
    if(m.op==='pause')state.playing=state.playWhenReady=false;
    if(m.op==='speed')options.speed=state.speed=m.value;
    if(m.op==='repeat'){options.verse=m.verse;options.surah=m.surah}
    if(m.op==='carOption'){
     const n=Number(m.value);
     if(m.key==='normal')Object.assign(options,{speed:1,verse:1,surah:1,pause:0,rangeSurah:0,from:0,to:0});
     if(m.key==='pause')options.pause=n;
     if(m.key==='range')Object.assign(options,m.value==='off'?{rangeSurah:0,from:0,to:0}:{rangeSurah:1,from:1,to:Math.min(7,n),verse:3,surah:3,pause:5});
     if(m.key==='timer'){options.sleepAtEnd=m.value==='end';options.sleepDeadline=n>0?Date.now()+n*60000:0}
     if(m.key==='translation')options.translationAudio=m.value==='off'?'':m.value;
     state.speed=options.speed;
    }
    if(m.op==='library'){
     if(m.action==='reading')library.reading={s:m.s,a:m.a};
     if(m.action==='favorite'){library.favorites=library.favorites.filter(v=>v.s!==m.s||v.a!==m.a);if(m.add)library.favorites.push({s:m.s,a:m.a})}
     if(m.action==='saveList'){library.playlists=library.playlists.filter(p=>p.id!==m.listId);library.playlists.push({id:m.listId,title:m.title,surahs:m.surahs})}
     if(m.action==='deleteList')library.playlists=library.playlists.filter(p=>p.id!==m.listId);
     library.revision++;
    }
    if(m.op==='libraryGet'||m.op==='library')send({type:'library',data:library});
    send({id:m.id});send(state);
   },1);
  }};
 },native);
 await page.route('**/api/recitation?**',route=>route.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3'+'.'.repeat(120))}));
 await page.route('https://verses.quran.com/**',route=>route.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3'+'.'.repeat(120))}));
 await page.goto(url+'/s/1');
 await page.getByRole('button',{name:'پخش تلاوت از آیهٔ فعلی',exact:true}).waitFor();
 await page.waitForTimeout(600);
 return page;
}
async function main(){
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const page=await boot(browser,true);
  const commands=()=>page.evaluate(()=>window.__commands);
  await page.waitForFunction(()=>window.__commands.some(m=>m.op==='library'&&m.action==='reading'));
  assert(!(await commands()).some(m=>['play','select'].includes(m.op)),'reading must not start audio');
  assert((await commands()).some(m=>m.op==='library'&&m.action==='reading'));
  await page.getByRole('button',{name:'پخش تلاوت از آیهٔ فعلی',exact:true}).click();
  await page.waitForFunction(()=>window.__commands.some(m=>m.op==='select'));
  await page.getByRole('button',{name:'تنظیمات تلاوت و دانلود',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('.car-study-controls summary').click();
  await page.evaluate(()=>{window.__commands=[]});
  await dialog.getByRole('button',{name:'ذخیرهٔ این آیه در علاقه‌مندی‌ها',exact:true}).click();
  await dialog.getByRole('button',{name:'حذف این آیه از علاقه‌مندی‌ها',exact:true}).waitFor();
  await dialog.getByRole('textbox',{name:'نام فهرست پخش',exact:true}).fill('Browser test');
  await dialog.locator('.car-playlist-editor select').selectOption('2');
  await dialog.locator('.car-playlist-editor').getByRole('button',{name:'افزودن سوره',exact:true}).click();
  await dialog.getByRole('button',{name:'ذخیرهٔ فهرست',exact:true}).click();
  await dialog.getByText('Browser test · ۲',{exact:true}).waitFor();
  const saved=(await commands()).find(m=>m.action==='saveList');assert.deepEqual(saved.surahs,[1,2]);
  await dialog.getByRole('button',{name:'ویرایش',exact:true}).click();
  await dialog.locator('.car-playlist-editor li').nth(1).getByRole('button',{name:'بالاتر',exact:true}).click();
  await dialog.getByRole('button',{name:'ذخیرهٔ فهرست',exact:true}).click();
  await page.waitForFunction(()=>window.__commands.filter(m=>m.action==='saveList').length===2);
  assert.deepEqual((await commands()).filter(m=>m.action==='saveList')[1].surahs,[2,1]);
  assert(!(await commands()).some(m=>['select','play'].includes(m.op)),'library CRUD must not start playback');
  await dialog.getByLabel('مکث بین آیه‌ها',{exact:true}).selectOption('2');
  await dialog.getByLabel('بازهٔ حفظ و مرور',{exact:true}).selectOption('5');
  await dialog.getByLabel('تایمر توقف',{exact:true}).selectOption('15');
  await dialog.getByLabel('ترجمهٔ صوتی بعد از هر آیه',{exact:true}).selectOption('translation-fa-fooladvand');
  await dialog.getByRole('button',{name:'دریافت ترجمهٔ صوتی این سوره',exact:true}).click();
  await page.waitForFunction(()=>window.__commands.filter(m=>m.op==='cache'&&m.r==='translation-fa-fooladvand').length===7);
  await dialog.getByLabel('سرعت پخش',{exact:true}).selectOption('1.25');
  await dialog.getByRole('button',{name:'بازگشت به پخش معمولی',exact:true}).click();
  await page.waitForTimeout(100);
  assert.equal(await dialog.getByLabel('سرعت پخش',{exact:true}).inputValue(),'1');
  assert.equal(await dialog.getByLabel('ترجمهٔ صوتی بعد از هر آیه',{exact:true}).inputValue(),'translation-fa-fooladvand');
  assert.equal(await page.evaluate(()=>window.__htmlPlays),0);
  await page.close();
  const fallback=await boot(browser,false);
  await fallback.getByRole('button',{name:'پخش تلاوت از آیهٔ فعلی',exact:true}).click();
  await fallback.waitForFunction(()=>window.__htmlPlays>0);
  assert.equal((await fallback.evaluate(()=>window.__commands)).length,0);
  await fallback.close();
  console.log('PASS: reading is passive; favorite and playlist CRUD/reorder are passive; practice, timer, translation download, reset and native state sync; HTML fallback.');
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
