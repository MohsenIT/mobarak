const {test,expect}=require('@playwright/test');
// Characterization coverage for the toolbar's recitation button cycle.
//
// One control, three interaction phases: closed (open the player with its
// controls), open with controls (collapse them), collapsed (bring them back
// and resume). The labels and aria state describe each phase. The button
// currently lives inline in page.tsx; these tests pin the cycle through the
// real UI before it moves into its own component.

async function setup(page){
 await page.addInitScript(()=>{
  localStorage.setItem('mubarak.ui-language.v1','fa');
  localStorage.setItem('mushaf.safavi-default.v1','true');
  // Stub media playback so opening the player needs no real audio.
  HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('canplay'));return Promise.resolve()};
 });
 await page.route('**/api/version',r=>r.fulfill({json:{version:'fixture',releases:[]}}));
 await page.route('**/offline-manifest.json',r=>r.fulfill({json:{groups:{core:[]}}}));
 await page.route('**/api/recitation?**',r=>r.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3.....')}));
 await page.route('https://verses.quran.com/**',r=>r.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3.....')}));
}

test('the recitation button opens the player, collapses its controls and brings them back',async({page})=>{
 await setup(page);
 await page.goto('/s/1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.reader-toolbar')).toBeVisible({timeout:20000});

 // Closed: offered as "play from the current ayah". The label changes with
 // each phase, so the button is located structurally (the toolbar's third
 // icon button, between search and translation).
 const button=page.locator('.reader-toolbar > button.icon-btn').nth(2);
 await expect(button).toBeVisible();
 await expect(button).toHaveAttribute('aria-label','پخش تلاوت از آیهٔ فعلی');
 await expect(button).toHaveAttribute('aria-expanded','false');
 await button.click();
 // Open with controls visible.
 await expect(button).toHaveAttribute('aria-expanded','true');
 await expect(button).toHaveAttribute('aria-label','جمع‌کردن کنترل‌های تلاوت');
 await expect(page.getByRole('button',{name:'جمع‌کردن کنترل‌های تلاوت',exact:true})).toBeVisible();

 // Collapse the controls: the toolbar button offers to bring them back.
 await button.click();
 await expect(button).toHaveAttribute('aria-expanded','false');
 await expect(button).toHaveAttribute('aria-label','بازکردن نوار و ادامهٔ تلاوت');

 // Bring them back.
 await button.click();
 await expect(button).toHaveAttribute('aria-expanded','true');
 await expect(button).toHaveAttribute('aria-label','جمع‌کردن کنترل‌های تلاوت');
});
