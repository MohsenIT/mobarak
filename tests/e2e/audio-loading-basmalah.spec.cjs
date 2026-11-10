const {test,expect}=require('@playwright/test');
// A valid one-second PCM WAV keeps the browser's decoder from emitting errors
// while transport events are driven explicitly by the test.
const audio=Buffer.alloc(16044);audio.write('RIFF');audio.writeUInt32LE(16036,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(8000,24);audio.writeUInt32LE(16000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(16000,40);
async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('canplay'));this.dispatchEvent(new Event('play'));return Promise.resolve()};
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
}
test('loading can be paused without closing controls or starting after the response arrives',async({page})=>{
 await setup(page);let release;const held=new Promise(r=>release=r);
 await page.route('https://verses.quran.com/**',async r=>{await held;await r.fulfill({contentType:'audio/wav',body:audio}).catch(()=>{})});
 await page.goto('/s/20/a/1');const button=page.locator('.reader-toolbar > button.icon-btn').nth(2);
 await button.click();await expect(button).toHaveAttribute('aria-busy','true');await expect(button.locator('svg.lucide-pause')).toBeVisible();
 await button.click();await expect(button).toHaveAttribute('aria-busy','false');await expect(page.locator('.recitation-bar')).toBeVisible();
 release();await expect(button.locator('svg.lucide-play')).toBeVisible();
 await expect(page.locator('audio')).toHaveJSProperty('paused',true);
 await button.click();await expect(button).toHaveAttribute('aria-expanded','true');
});
for(const s of [1,9,20])test(`opening audio order for surah ${s}`,async({page})=>{
 await setup(page);const requests=[];
 await page.route('https://verses.quran.com/**',r=>{requests.push(new URL(r.request().url()).pathname.split('/').pop());return r.fulfill({contentType:'audio/wav',body:audio})});
 await page.goto(`/s/${s}/a/1`);await page.locator('.reader-toolbar > button.icon-btn').nth(2).click();
 const first=s===20?'001001.mp3':`${String(s).padStart(3,'0')}001.mp3`;
 await expect.poll(()=>requests.includes(first)).toBe(true);
 await expect(page.locator('.reader-toolbar .recitation-activity')).toBeVisible();
 if(s===20){await page.locator('audio').evaluate(a=>a.dispatchEvent(new Event('ended')));await expect.poll(()=>requests.includes('020001.mp3')).toBe(true)}
 else expect(requests.filter(x=>x==='001001.mp3').length).toBe(s===1?1:0);
});
